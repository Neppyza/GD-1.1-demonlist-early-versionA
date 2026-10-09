// One public victor per player and level, using the same approved records as Stats.
export function victorNames(records, levelId) {
    const players = new Map();
    for (const record of records) {
        if (record.approved !== true || Number(record.progress) !== 100 || record.levelId !== levelId) continue;
        if (typeof record.player !== 'string' || !record.player.trim() || !record.playerId) continue;
        players.set(record.playerId, record.player.trim());
    }
    return [...players.values()].sort((a, b) => a.localeCompare(b));
}
