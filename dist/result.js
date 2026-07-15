export function createSuccessResult(input) {
    return {
        ok: true,
        target: input.target,
        operation: input.operation,
        evidence: input.evidence ?? [],
        warnings: input.warnings ?? [],
        paths: input.paths ?? {},
        commands: input.commands ?? [],
        logs: input.logs ?? [],
        ...(input.releaseCandidate === undefined ? {} : { releaseCandidate: input.releaseCandidate })
    };
}
export function createFailureResult(input) {
    return {
        ok: false,
        target: input.target,
        operation: input.operation,
        error: input.error,
        evidence: input.evidence ?? [],
        warnings: input.warnings ?? [],
        paths: input.paths ?? {},
        commands: input.commands ?? [],
        logs: input.logs ?? [],
        ...(input.releaseCandidate === undefined ? {} : { releaseCandidate: input.releaseCandidate })
    };
}
