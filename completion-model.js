export function validCompletion({ levelId, proofUrl, notes = "" }) {
    try {
        return typeof levelId === "string" && levelId.length > 0 && !levelId.includes("/")
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
