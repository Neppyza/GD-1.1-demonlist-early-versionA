// Keep recent ranking events bounded to avoid unbounded document growth.
export function positionHistory(level, target, at = new Date().toISOString()) {
    const previous = Number(level?.position);
    const from = Number.isSafeInteger(previous) && previous > 0 ? previous : null;
    const history = Array.isArray(level?.positionHistory) ? level.positionHistory : [];
    if (from === target) return history;
    return [...history, { from, to: target, at }].slice(-100);
}
