import { position, sortLevels } from "./list-model.js";
import { validPlayerProfile } from "./player-profile.js";

export function buildStats(levels, records, profiles = [], adjustments = []) {
    const corrections = new Map(adjustments.map(item => [String(item.id), item.delta]));
    const removed = new Set(profiles.filter(profile => profile.removed === true).map(profile => String(profile.id)));
    const byLevel = new Map(levels.map(level => [level.id, level]));
    const players = new Map();
    for (const profile of profiles) {
        if (!profile.id || !validPlayerProfile(profile)) continue;
        players.set(String(profile.id), { id: String(profile.id), name: profile.displayName, bio: profile.bio, countryCode: profile.countryCode || null, tags: [...profile.tags], registered: true, completed: new Map() });
    }
    for (const record of records) {
        if (record.approved !== true || Number(record.progress) !== 100 || !record.playerId || !record.player) continue;
        const level = byLevel.get(record.levelId);
        if (!level) continue;
        const id = String(record.playerId);
        if (removed.has(id)) continue;
        if (!players.has(id)) players.set(id, { id, name: String(record.player), bio: "", countryCode: null, tags: [], registered: false, completed: new Map() });
        players.get(id).completed.set(level.id, level);
    }
    return [...players.values()].map(player => {
        const completed = sortLevels([...player.completed.values()]);
        const basePoints = completed.reduce((sum,level) => {
            const points = Number(level.points);
            return sum + (Number.isFinite(points) && points >= 0 ? points : 0);
        },0);
        const value = corrections.get(player.id);
        const pointCorrection = typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1000000 ? value : 0;
        return { ...player, completed, basePoints, pointCorrection, points: Math.max(0, basePoints + pointCorrection) };
    }).sort((a,b) => b.points - a.points || b.completed.length - a.completed.length || a.name.localeCompare(b.name));
}

export function playerDetails(player, levels, records, ranked) {
    const done = new Set(player.completed.map(l => l.id));
    const rankedLevels = levels.filter(l => position(l.position) !== Infinity);
    const coverage = limit => {
        const subset = rankedLevels.filter(l => position(l.position) <= limit);
        return {completed:subset.filter(l => done.has(l.id)).length,total:subset.length};
    };
    const byLevel = new Map(levels.map(l => [l.id,l]));
    const runs = new Map();
    for (const record of records) {
        if (record.approved !== true || String(record.playerId) !== player.id || !byLevel.has(record.levelId)) continue;
        const progress = Number(record.progress);
        if (!Number.isFinite(progress) || progress <= 0 || progress > 100) continue;
        const old = runs.get(record.levelId);
        if (!old || progress > old.progress || (progress === old.progress && !old.proofUrl && record.proofUrl)) {
            runs.set(record.levelId,{level:byLevel.get(record.levelId),progress,proofUrl:record.proofUrl});
        }
    }
    const partial = sortLevels([...runs.values()].filter(r => r.progress < 100 && !done.has(r.level.id)).map(r => r.level)).map(l => runs.get(l.id));
    const countryPlayers = player.countryCode ? ranked.filter(p => p.countryCode === player.countryCode) : [];
    const countryIndex = countryPlayers.findIndex(p => p.id === player.id);
    return {
        hardest:player.completed.find(l => position(l.position) !== Infinity) || null,
        ranked:coverage(Infinity),top10:coverage(10),top50:coverage(50),
        countryRank:countryIndex < 0 ? null : countryIndex+1,countryTotal:countryPlayers.length,
        average:player.completed.length ? player.basePoints/player.completed.length : null,
        proofByLevel:new Map([...runs].filter(([,r]) => r.progress === 100).map(([id,r]) => [id,r.proofUrl])),
        partial
    };
}
