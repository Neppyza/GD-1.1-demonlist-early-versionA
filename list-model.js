export function position(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : Infinity;
}

export function sortLevels(levels, order = "position") {
    return [...levels].sort((a, b) => {
        if (order === "name") return String(a.name || "").localeCompare(String(b.name || "")) || position(a.position) - position(b.position);
        if (order === "points") {
            const score = item => item.points !== undefined && item.points !== null && Number.isFinite(Number(item.points)) ? Number(item.points) : -Infinity;
            const difference = score(b) - score(a);
            if (!Number.isNaN(difference) && difference !== 0) return difference;
        }
        return position(a.position) - position(b.position) || String(a.name || "").localeCompare(String(b.name || ""));
    });
}

export function rankLabel(level) { return position(level.position) === Infinity ? "Unranked" : `#${position(level.position)}`; }

export function filterLevels(levels, records, term) {
    const query = term.trim().toLowerCase();
    const names = new Map();
    for (const record of records) {
        if (record.approved !== true || Number(record.progress) !== 100) continue;
        if (!names.has(record.levelId)) names.set(record.levelId, []);
        names.get(record.levelId).push(record.player);
    }
    return levels.filter(level => [level.name, level.creator, level.verifier, level.difficulty, level.category, ...(names.get(level.id) || [])].some(value => String(value ?? "").toLowerCase().includes(query)));
}

// Old list tags are ignored so published levels remain accessible.
export const listTypes = ["main"];
export function levelList() { return "main"; }
export function filterList(levels) { return [...levels]; }

// Remove the old placement, then insert the level and make room below it.
export function placementUpdates(levels, levelId, target) {
    if (!Number.isSafeInteger(target) || target < 1) throw new Error("Enter a positive whole-number position.");
    const old = levels.find(level => level.id === levelId);
    const oldPosition = position(old?.position);
    const ranked = sortLevels(levels.filter(level => level.id !== levelId && position(level.position) !== Infinity));
    const updates = [];
    let next = 1;
    for (const level of ranked) {
        let rank = position(level.position);
        if (oldPosition !== Infinity && rank > oldPosition) rank--;
        if (rank >= target) rank++;
        rank = Math.max(rank, next);
        if (rank === target) rank++;
        if (!Number.isSafeInteger(rank)) throw new Error("A position is too large. Correct the rankings before saving.");
        next = rank + 1;
        if (rank !== level.position) updates.push({ id: level.id, position: rank });
    }
    return updates;
}
