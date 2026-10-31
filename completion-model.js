export function minimumProgress(level) {
    const value = level?.minProgress;
    return Number.isInteger(value) && value >= 1 && value <= 100 ? value : 100;
}

export function validProgress(progress, minimum = 100) {
    return Number.isInteger(progress) && progress >= minimum && progress <= 100;
}

export function shouldReplaceRecord(existing, progress) {
    return !existing || existing.approved !== true || progress > Number(existing.progress);
}

export function validCompletion({ levelId, proofUrl, notes = "", progress = 100 }, minimum = 100) {
    try {
        return validProgress(progress, minimum) && typeof levelId === "string" && levelId.length > 0 && !levelId.includes("/")
            && typeof proofUrl === "string" && proofUrl.length <= 2000
            && new URL(proofUrl).protocol === "https:"
            && typeof notes === "string" && notes.length <= 500;
    } catch { return false; }
}

export async function completionKey(playerId, levelId) {
    const bytes = new TextEncoder().encode(JSON.stringify([playerId, levelId]));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}
