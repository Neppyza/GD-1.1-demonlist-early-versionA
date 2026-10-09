import { subscribeData, retryData } from "./data.js";
import { position, sortLevels } from "./list-model.js";
import { element, externalLink, stateRow } from "./ui.js";
import { dataMessage } from "./messages.js";

const body = document.getElementById("records");
const table = document.getElementById("records-table");
const search = document.getElementById("record-search");
const filter = document.getElementById("record-level");
const sort = document.getElementById("record-sort");
const status = document.getElementById("records-status");
let levels = { status: "loading", items: [] }, records = { status: "loading", items: [] };
let selection = new URLSearchParams(location.search).get("level") || "";

function render() {
    if (levels.status === "error" || records.status === "error") {
        stateRow(body, 6, "Records are unavailable", dataMessage(levels.error || records.error, "approved records"), () => { retryData("levels"); retryData("records"); });
        status.textContent = "Records unavailable"; table.setAttribute("aria-busy", "false"); return;
    }
    if (levels.status !== "ready" || records.status !== "ready") { stateRow(body, 6, "Loading approved records…"); table.setAttribute("aria-busy", "true"); return; }
    table.setAttribute("aria-busy", "false");
    const map = new Map(levels.items.map(level => [level.id, level]));
    filter.replaceChildren();
    const all = element("option", "", "All levels"); all.value = ""; filter.append(all);
    for (const level of sortLevels(levels.items)) { const option = element("option", "", String(level.name || "Unnamed level").trim()); option.value = level.id; filter.append(option); }
    if (selection && !map.has(selection)) selection = "";
    filter.value = selection;
    const term = search.value.toLowerCase().trim();
    const approved = records.items.filter(record => record.approved === true);
    const filtered = approved.filter(record => (!selection || record.levelId === selection) && [record.player, map.get(record.levelId)?.name].some(value => String(value || "").toLowerCase().includes(term)));
    filtered.sort((a,b) => sort.value === "player" ? String(a.player || "").localeCompare(String(b.player || "")) : position(map.get(a.levelId)?.position) - position(map.get(b.levelId)?.position) || String(a.player || "").localeCompare(String(b.player || "")));
    body.replaceChildren();
    status.textContent = `${filtered.length} of ${approved.length} approved records`;
    for (const record of filtered) {
        const level = map.get(record.levelId);
        const row = element("tr");
        const name = element("td", "level-name");
        if (level) { const link = element("a", "", String(level.name || "Unnamed level").trim()); link.href = `index.html?level=${encodeURIComponent(level.id)}`; name.append(link); }
        else name.textContent = "Level no longer available";
        const proof = element("td");
        proof.append(externalLink(record.proofUrl, "Watch proof ↗") || element("span", "muted", "—"));
        row.append(element("td", "rank", level && position(level.position) !== Infinity ? position(level.position) : "—"), name, element("td", "", record.player || "—"), element("td", "numeric", record.progress === undefined ? "—" : `${record.progress}%`), element("td", "numeric", level?.points ?? "—"), proof);
        body.append(row);
    }
    if (!filtered.length) stateRow(body, 6, approved.length ? "No matching records" : "No approved records yet", approved.length ? "Try another player, level, or filter." : "Approved completions will appear here after staff review.");
}
search.addEventListener("input", render);
filter.addEventListener("change", () => { selection = filter.value; render(); });
sort.addEventListener("change", render);
subscribeData("levels", value => { levels = value; render(); });
subscribeData("records", value => { records = value; render(); });
