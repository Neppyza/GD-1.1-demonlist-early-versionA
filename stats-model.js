export function buildStats(levels, records) {
    const byLevel = new Map(levels.map(level => [level.id, level]));
    const players = new Map();
    for (const record of records) {
        if (record.approved !== true || Number(record.progress) !== 100 || !record.playerId || !record.player) continue;
        const level = byLevel.get(record.levelId);
        if (!level) continue;
        const id = String(record.playerId);
        if (!players.has(id)) players.set(id, { id, name: String(record.player), completed: new Map() });
        players.get(id).completed.set(level.id, level);
    }
    return [...players.values()].map(player => {
        const completed = [...player.completed.values()].sort((a,b) => (Number(a.position) || Infinity) - (Number(b.position) || Infinity));
        return { ...player, completed, points: completed.reduce((sum,level) => {
            const points = Number(level.points);
            return sum + (Number.isFinite(points) && points >= 0 ? points : 0);
        },0) };
    }).sort((a,b) => b.points - a.points || b.completed.length - a.completed.length || a.name.localeCompare(b.name));
}
