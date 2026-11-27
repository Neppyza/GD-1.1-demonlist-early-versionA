import { position, sortLevels } from "./list-model.js";
import { victorNames } from "./victors.js";

export const categoryOf = level => String(level.category || level.difficulty || "").trim();
export function categories(levels) {
    return [...new Set(levels.map(categoryOf).filter(Boolean))].sort((a,b) => a.localeCompare(b));
}
export function latestPlacements(levels) {
    return levels.flatMap(level => {
        const events = Array.isArray(level.positionHistory) ? level.positionHistory : [];
        const first = events.find(e => e?.from === null && Number.isSafeInteger(e.to) && e.to > 0 && typeof e.at === "string" && Number.isFinite(Date.parse(e.at)));
        return first ? [{level, rank:first.to, at:first.at}] : [];
    }).sort((a,b) => Date.parse(b.at)-Date.parse(a.at) || String(a.level.id).localeCompare(String(b.level.id)));
}
export function discoverySort(levels, mode, records = []) {
    const ranked = sortLevels(levels);
    if (mode === "victors") {
        const counts = new Map(ranked.map(l => [l.id, victorNames(records,l.id).length]));
        return ranked.sort((a,b) => counts.get(b.id)-counts.get(a.id));
    }
    if (mode === "recent") {
        const dates = new Map(latestPlacements(levels).map(e => [e.level.id,Date.parse(e.at)]));
        return ranked.sort((a,b) => (dates.get(b.id) ?? -Infinity)-(dates.get(a.id) ?? -Infinity) || 0);
    }
    return sortLevels(levels,mode);
}
export function matchesRank(level, term) {
    const match = /^#\s*([1-9]\d*)$/.exec(term.trim());
    return match ? position(level.position) === Number(match[1]) : null;
}
export function distinctCompletions(levels, records) {
    const ids = new Set(levels.map(l => l.id));
    return new Set(records.filter(r => r.approved === true && Number(r.progress) === 100 && r.playerId && typeof r.player === "string" && r.player.trim() && ids.has(r.levelId)).map(r => JSON.stringify([r.playerId,r.levelId]))).size;
}

export function rankingActivity(levels, mode = "all") {
    const entries = levels.flatMap(level => {
        const events = Array.isArray(level.positionHistory) ? level.positionHistory : [];
        return events.filter(e => e && Number.isSafeInteger(e.to) && e.to > 0 &&
            (e.from === null || (Number.isSafeInteger(e.from) && e.from > 0 && e.from !== e.to)) &&
            typeof e.at === "string" && Number.isFinite(Date.parse(e.at)))
            .map(e => ({level, from:e.from, rank:e.to, at:e.at}));
    });
    return entries.filter(e => mode === "all" || (mode === "new" ? e.from === null : e.from !== null))
        .sort((a,b) => Date.parse(b.at)-Date.parse(a.at) || a.rank-b.rank || String(a.level.id).localeCompare(String(b.level.id)));
}
export function adjacentLevels(levels, id) {
    const ranked = sortLevels(levels);
    const index = ranked.findIndex(level => level.id === id);
    return index < 0 ? [null,null] : [ranked[index-1] || null,ranked[index+1] || null];
}
export function randomLevel(levels, random = Math.random) {
    return levels.length ? levels[Math.min(levels.length-1,Math.max(0,Math.floor(random()*levels.length)))] : null;
}
export function isRecentPlacement(level, now = Date.now(), days = 7) {
    const date = latestPlacements([level])[0]?.at;
    const age = date ? now-Date.parse(date) : Infinity;
    return age >= 0 && age <= days*86400000;
}
