const STORAGE_KEY = "gd11-saved-levels-v1";
export function parseSavedLevels(raw) {
    try {
        const ids = JSON.parse(raw);
        return new Set(Array.isArray(ids) ? ids.filter(id => typeof id === "string" && id.length > 0 && id.length <= 200) : []);
    } catch {
        return new Set();
    }
}
export function loadSavedLevels() {
    try { return parseSavedLevels(localStorage.getItem(STORAGE_KEY)); }
    catch { return new Set(); }
}
export function storeSavedLevels(ids) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])); return true; }
    catch { return false; }
}
