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
        const completed = [...player.completed.values()].sort((a,b) => (Number(a.position) || Infinity) - (Number(b.position) || Infinity));
        const basePoints = completed.reduce((sum,level) => {
            const points = Number(level.points);
            return sum + (Number.isFinite(points) && points >= 0 ? points : 0);
        },0);
        const value = corrections.get(player.id);
        const pointCorrection = typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1000000 ? value : 0;
        return { ...player, completed, basePoints, pointCorrection, points: Math.max(0, basePoints + pointCorrection) };
    }).sort((a,b) => b.points - a.points || b.completed.length - a.completed.length || a.name.localeCompare(b.name));
}
