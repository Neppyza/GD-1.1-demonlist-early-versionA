const KEY = "gd11-watchlist-v1";
export function readWatchlist(storage) {
    try {
        const value = JSON.parse((storage || globalThis.localStorage).getItem(KEY) || "[]");
        return new Set(Array.isArray(value) ? value.filter(id => typeof id === "string" && id.length <= 1500).slice(0, 1000) : []);
    } catch { return new Set(); }
}
export function writeWatchlist(ids, storage) {
    try {
        (storage || globalThis.localStorage).setItem(KEY, JSON.stringify([...ids].slice(0, 1000)));
        return true;
    } catch { return false; }
}
