import { listPlacementUpdates, listTypes, levelList, position, listLabel } from "./list-model.js";

export function placementPreview(levels, id, target, type) {
    const updates = listPlacementUpdates(levels, id, target, type);
    const byId = new Map(levels.map(level => [level.id, level]));
    return updates.map(update => {
        const level = byId.get(update.id);
        return { name: level.name || update.id, list: listLabel(levelList(level)), from: position(level.position), to: update.position };
    });
}

export function rankingHealth(levels) {
    return listTypes.map(type => {
        const entries = levels.filter(level => levelList(level) === type);
        const active = entries.filter(level => level.rankingApplied !== false);
        const counts = new Map();
        let invalid = 0;
        for (const level of active) {
            const rank = position(level.position);
            if (rank === Infinity) { invalid++; continue; }
            counts.set(rank, (counts.get(rank) || 0) + 1);
        }
        const duplicates = type === "legacy" ? [] : [...counts].filter(([,count]) => count > 1).map(([rank]) => rank).sort((a,b) => a-b);
        const max = [...counts.keys()].reduce((a,b) => Math.max(a,b),0);
        return { type, count: active.length, pending: entries.length-active.length, invalid, duplicates, gaps: type === "legacy" ? 0 : max-counts.size };
    });
}

export function queueMatches(fields, query) {
    const terms = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = fields.map(value => String(value ?? "").toLowerCase()).join(" ");
    return terms.every(term => haystack.includes(term));
}

export function submissionTime(data) {
    const value = data?.submittedAt;
    if (typeof value?.toMillis === "function") return value.toMillis();
    const time = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? time : 0;
}
