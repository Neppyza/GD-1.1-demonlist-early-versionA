// These are self-described interests, never permission or achievement badges.
export const playerTags = ["Player", "Creator", "Verifier"];

export function validPlayerProfile(profile) {
    return typeof profile?.displayName === "string" && profile.displayName.trim().length >= 3
        && profile.displayName.length <= 24 && typeof profile.bio === "string" && profile.bio.length <= 300
        && Array.isArray(profile.tags) && profile.tags.length > 0 && profile.tags.length <= playerTags.length
        && new Set(profile.tags).size === profile.tags.length && profile.tags.every(tag => playerTags.includes(tag));
}
