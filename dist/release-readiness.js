import { extname } from "node:path";
export const RELEASE_METADATA_KEYS = [
    "addonSteamAppID",
    "addontitle",
    "addonAuthor",
    "addonDescription",
    "addonVersion",
    "DefaultMap",
    "maps"
];
export const MAX_SECRET_SCAN_BYTES = 1024 * 1024;
export const REQUIRED_PATH_LABELS = [
    "game addon root",
    "content addon root",
    "addon metadata",
    "lua entry",
    "localization file",
    "content maps directory",
    "hero list",
    "hero data",
    "unit support file",
    "ability support file"
];
export const SCAN_ROOT_IDENTITIES = ["game", "content"];
const TEXT_SCAN_EXTENSIONS = new Set([
    ".cfg",
    ".css",
    ".ini",
    ".js",
    ".json",
    ".kv",
    ".lua",
    ".md",
    ".ps1",
    ".ts",
    ".tsx",
    ".txt",
    ".vdf",
    ".xml",
    ".yaml",
    ".yml"
]);
const PLACEHOLDER_VALUES = new Set(["", "changeme", "change me", "placeholder", "tbd", "todo", "unknown", "your name"]);
const REQUIRED_PATH_LABEL_SET = new Set(REQUIRED_PATH_LABELS);
const SCAN_ROOT_IDENTITY_SET = new Set(SCAN_ROOT_IDENTITIES);
const SECRET_PATTERNS = [
    { category: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
    { category: "github token", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
    { category: "steam credential", pattern: /\bsteam_(?:password|token|secret|apikey|api_key)\b/i },
    { category: "password", pattern: /(?:\b|_)(?:password|passwd|pwd)\b\s*[:=]/i },
    { category: "token", pattern: /\b(?:token|api[_-]?key|secret)\b\s*[:=]/i },
    { category: "host credential", pattern: /\b(?:remote_|windows_)?(?:host|username)\b\s*[:=].*\b(?:password|token|secret|key)\b/i }
];
export function isReleaseTextPath(path) {
    return TEXT_SCAN_EXTENSIONS.has(extname(path).toLowerCase());
}
export function evaluateReleaseReadiness(input) {
    const findings = [];
    for (const requiredPath of canonicalRequiredPaths(input.requiredPaths)) {
        if (!isRequiredPathLabel(requiredPath.label) || typeof requiredPath.present !== "boolean") {
            findings.push({ code: "POLICY_INPUT_INVALID", category: "required-structure-identity", disposition: "blocker" });
            continue;
        }
        findings.push(requiredPath.present
            ? { code: "REQUIRED_PATH_PRESENT", category: "required-structure", disposition: "evidence", field: requiredPath.label }
            : { code: "REQUIRED_PATH_MISSING", category: "required-structure", disposition: "blocker", field: requiredPath.label });
    }
    appendMetadataFindings(findings, input.metadata);
    for (const scanRoot of canonicalScanRoots(input.scanRoots)) {
        if (!isScanRootIdentity(scanRoot.root) || !Array.isArray(scanRoot.files)) {
            findings.push({ code: "POLICY_INPUT_INVALID", category: "scan-root-identity", disposition: "blocker" });
            continue;
        }
        for (const file of canonicalScanFiles(scanRoot.files)) {
            appendScanFindings(findings, file);
        }
        findings.push({
            code: "SECRET_SCAN_COMPLETED",
            category: "sensitive-material",
            disposition: "evidence",
            field: scanRoot.root
        });
    }
    return findings;
}
function appendMetadataFindings(findings, metadata) {
    if (metadata === null || typeof metadata !== "object" || !("state" in metadata)) {
        findings.push({ code: "POLICY_INPUT_INVALID", category: "metadata-observation", disposition: "blocker" });
        return;
    }
    if (metadata.state === "missing") {
        for (const field of RELEASE_METADATA_KEYS) {
            findings.push({ code: "METADATA_MISSING", category: "metadata", disposition: "blocker", field });
        }
        return;
    }
    if (metadata.state !== "readable") {
        if ((metadata.state !== "oversized" && metadata.state !== "unreadable") || typeof metadata.path !== "string") {
            findings.push({ code: "POLICY_INPUT_INVALID", category: "metadata-observation", disposition: "blocker" });
            return;
        }
        const path = safeFindingPath(metadata.path);
        if (path === undefined) {
            findings.push({ code: "POLICY_INPUT_INVALID", category: "relative-path-identity", disposition: "blocker" });
            return;
        }
        findings.push(metadata.state === "oversized"
            ? { code: "REQUIRED_TEXT_OVERSIZED", category: "oversized-required-text", disposition: "blocker", path }
            : { code: "REQUIRED_TEXT_UNREADABLE", category: "unreadable-required-text", disposition: "blocker", path });
        return;
    }
    if (typeof metadata.content !== "string") {
        findings.push({ code: "POLICY_INPUT_INVALID", category: "metadata-observation", disposition: "blocker" });
        return;
    }
    const values = parseAddonInfo(metadata.content);
    for (const field of RELEASE_METADATA_KEYS) {
        const value = values.get(field.toLowerCase());
        if (value === undefined) {
            findings.push({ code: "METADATA_MISSING", category: "metadata", disposition: "blocker", field });
        }
        else if (PLACEHOLDER_VALUES.has(value.trim().toLowerCase())) {
            findings.push({ code: "METADATA_PLACEHOLDER", category: "metadata", disposition: "blocker", field });
        }
        else {
            findings.push({ code: "METADATA_PRESENT", category: "metadata", disposition: "evidence", field });
        }
    }
}
function appendScanFindings(findings, file) {
    if (file === null || typeof file !== "object" || typeof file.relativePath !== "string") {
        findings.push({ code: "POLICY_INPUT_INVALID", category: "relative-path-identity", disposition: "blocker" });
        return;
    }
    const path = safeFindingPath(file.relativePath);
    if (path === undefined) {
        findings.push({ code: "POLICY_INPUT_INVALID", category: "relative-path-identity", disposition: "blocker" });
        return;
    }
    if (file.state === "text") {
        if (typeof file.content !== "string") {
            findings.push({ code: "POLICY_INPUT_INVALID", category: "metadata-observation", disposition: "blocker" });
            return;
        }
        for (const category of sensitiveCategories(file.content)) {
            findings.push({
                code: "SENSITIVE_MATERIAL",
                category,
                disposition: "blocker",
                path
            });
        }
        return;
    }
    if (file.state === "non-text") {
        findings.push({
            code: "NON_TEXT_INCLUDED",
            category: "non-text",
            disposition: "warning",
            path
        });
        return;
    }
    if (file.state !== "oversized" && file.state !== "unreadable") {
        findings.push({ code: "POLICY_INPUT_INVALID", category: "metadata-observation", disposition: "blocker" });
        return;
    }
    if (file.state === "oversized") {
        findings.push(file.requiredText === true
            ? { code: "REQUIRED_TEXT_OVERSIZED", category: "oversized-required-text", disposition: "blocker", path }
            : { code: "TEXT_OVERSIZED", category: "oversized", disposition: "warning", path });
        return;
    }
    findings.push(file.requiredText === true
        ? { code: "REQUIRED_TEXT_UNREADABLE", category: "unreadable-required-text", disposition: "blocker", path }
        : { code: "TEXT_UNREADABLE", category: "unreadable", disposition: "warning", path });
}
function safeFindingPath(path) {
    if (path.length === 0 || path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(path)) {
        return undefined;
    }
    if (path.includes("\\") || path.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
        return undefined;
    }
    return path
        .split("/")
        .map((segment) => (sensitiveCategories(segment).length > 0 ? "[redacted]" : segment))
        .join("/");
}
function sensitiveCategories(value) {
    return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(value)).map(({ category }) => category);
}
function isRequiredPathLabel(value) {
    return typeof value === "string" && REQUIRED_PATH_LABEL_SET.has(value);
}
function isScanRootIdentity(value) {
    return typeof value === "string" && SCAN_ROOT_IDENTITY_SET.has(value);
}
function canonicalRequiredPaths(input) {
    return [...input].sort((left, right) => requiredPathOrder(left?.label) - requiredPathOrder(right?.label));
}
function requiredPathOrder(value) {
    return isRequiredPathLabel(value) ? REQUIRED_PATH_LABELS.indexOf(value) : REQUIRED_PATH_LABELS.length;
}
function canonicalScanRoots(input) {
    return [...input].sort((left, right) => scanRootOrder(left?.root) - scanRootOrder(right?.root));
}
function scanRootOrder(value) {
    return isScanRootIdentity(value) ? SCAN_ROOT_IDENTITIES.indexOf(value) : SCAN_ROOT_IDENTITIES.length;
}
function canonicalScanFiles(input) {
    return [...input].sort((left, right) => {
        const leftPath = typeof left?.relativePath === "string" ? safeFindingPath(left.relativePath) ?? "\uffff" : "\uffff";
        const rightPath = typeof right?.relativePath === "string" ? safeFindingPath(right.relativePath) ?? "\uffff" : "\uffff";
        return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
    });
}
function parseAddonInfo(content) {
    const values = new Map();
    const keyValuePattern = /^\s*"([^"]+)"\s+"([^"]*)"/gm;
    for (const match of content.matchAll(keyValuePattern)) {
        values.set(match[1].toLowerCase(), match[2]);
    }
    return values;
}
