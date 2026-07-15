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
const REQUIRED_PATH_LABELS = new Set([
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
]);
const SCAN_ROOT_IDENTITIES = new Set(["game", "content"]);
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
    for (const requiredPath of input.requiredPaths) {
        findings.push({
            code: requiredPath.present ? "REQUIRED_PATH_PRESENT" : "REQUIRED_PATH_MISSING",
            category: "required-structure",
            disposition: requiredPath.present ? "evidence" : "blocker",
            ...findingField(requiredPath.label, REQUIRED_PATH_LABELS)
        });
    }
    appendMetadataFindings(findings, input.metadata);
    for (const scanRoot of input.scanRoots) {
        for (const file of scanRoot.files) {
            appendScanFindings(findings, file);
        }
        findings.push({
            code: "SECRET_SCAN_COMPLETED",
            category: "sensitive-material",
            disposition: "evidence",
            ...findingField(scanRoot.root, SCAN_ROOT_IDENTITIES)
        });
    }
    return findings;
}
function appendMetadataFindings(findings, metadata) {
    if (metadata.state === "missing") {
        for (const field of RELEASE_METADATA_KEYS) {
            findings.push({ code: "METADATA_MISSING", category: "metadata", disposition: "blocker", field });
        }
        return;
    }
    if (metadata.state !== "readable") {
        findings.push({
            code: metadata.state === "oversized" ? "REQUIRED_TEXT_OVERSIZED" : "REQUIRED_TEXT_UNREADABLE",
            category: `${metadata.state}-required-text`,
            disposition: "blocker",
            ...findingPath(metadata.path)
        });
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
    if (file.state === "text") {
        for (const secret of SECRET_PATTERNS) {
            if (secret.pattern.test(file.content)) {
                findings.push({
                    code: "SENSITIVE_MATERIAL",
                    category: secret.category,
                    disposition: "blocker",
                    ...findingPath(file.relativePath)
                });
            }
        }
        return;
    }
    if (file.state === "non-text") {
        findings.push({
            code: "NON_TEXT_INCLUDED",
            category: "non-text",
            disposition: "warning",
            ...findingPath(file.relativePath)
        });
        return;
    }
    const required = file.requiredText === true;
    findings.push({
        code: file.state === "oversized"
            ? required
                ? "REQUIRED_TEXT_OVERSIZED"
                : "TEXT_OVERSIZED"
            : required
                ? "REQUIRED_TEXT_UNREADABLE"
                : "TEXT_UNREADABLE",
        category: required ? `${file.state}-required-text` : file.state,
        disposition: required ? "blocker" : "warning",
        ...findingPath(file.relativePath)
    });
}
function findingPath(path) {
    if (path.length === 0 || path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(path)) {
        return {};
    }
    if (path.includes("\\") || path.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
        return {};
    }
    return { path };
}
function findingField(field, allowed) {
    return allowed.has(field) ? { field } : {};
}
function parseAddonInfo(content) {
    const values = new Map();
    const keyValuePattern = /^\s*"([^"]+)"\s+"([^"]*)"/gm;
    for (const match of content.matchAll(keyValuePattern)) {
        values.set(match[1].toLowerCase(), match[2]);
    }
    return values;
}
