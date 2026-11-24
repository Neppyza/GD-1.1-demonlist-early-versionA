import { element } from "./ui.js";
const key = "gd11.saved-levels.v1";
let memory;
export function readSaved() {
    if (!memory) { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); memory = new Set(Array.isArray(value) ? value.filter(x => typeof x === "string") : []); } catch { memory = new Set(); } }
    return new Set(memory);
}
export function toggleSaved(id) {
    const saved = readSaved();
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    memory = saved;
    try { localStorage.setItem(key, JSON.stringify([...saved])); } catch {}
    return saved.has(id);
}
export function historyEntries(level) {
    return (Array.isArray(level.positionHistory) ? level.positionHistory : []).filter(e => e && Number.isSafeInteger(e.to) && e.to > 0 && (e.from === null || (Number.isSafeInteger(e.from) && e.from > 0)) && Number.isFinite(Date.parse(e.at)));
}
export function movement(level) {
    const last = historyEntries(level).at(-1);
    return last && last.from !== null && last.to === Number(level.position) ? last.from - last.to : 0;
}
export function renderHistory(level) {
    const section = element("section", "position-history");
    section.append(element("h3", "", "Position history"));
    const entries = historyEntries(level);
    if (!entries.length) { section.append(element("p", "muted", "No recorded changes yet. History starts when tracking is enabled.")); return section; }
    const best = Math.min(...entries.flatMap(e => e.from === null ? [e.to] : [e.from, e.to]));
    section.append(element("p", "muted", "Best recorded placement: #" + best + " · " + entries.length + " retained events"));
    const list = element("ol", "history-events");
    for (const e of [...entries].reverse()) {
        const row = element("li");
        const date = element("time", "", new Date(e.at).toLocaleDateString(undefined, {year:"numeric",month:"short",day:"numeric"})); date.dateTime = e.at;
        row.append(element("strong", "", e.from === null ? "Entered at #" + e.to : "#" + e.from + " → #" + e.to), date);
        list.append(row);
    }
    section.append(list); return section;
}
