import { subscribeData, retryData } from "./data.js";
import { buildStats } from "./stats-model.js";
import { element, stateRow } from "./ui.js";
import { dataMessage } from "./messages.js";

const body = document.getElementById("players");
const table = document.getElementById("players-table");
const search = document.getElementById("player-search");
const sort = document.getElementById("player-sort");
const status = document.getElementById("stats-status");
let levels = { status: "loading", items: [] }, records = { status: "loading", items: [] };
let selected = null;
function render() {
    const detail = document.getElementById("player-details");
    if (levels.status === "error" || records.status === "error") {
        const error = levels.error || records.error;
        stateRow(body, 5, "Players are unavailable", dataMessage(error, "player rankings"), () => { retryData("levels"); retryData("records"); });
        status.textContent = "Player rankings unavailable"; table.setAttribute("aria-busy", "false"); detail.hidden = true; return;
    }
    if (levels.status !== "ready" || records.status !== "ready") { stateRow(body, 5, "Loading player rankings…"); table.setAttribute("aria-busy", "true"); return; }
    table.setAttribute("aria-busy", "false");
    const ranked = buildStats(levels.items, records.items).map((player, index) => ({ ...player, rank: index + 1 }));
    const filtered = ranked.filter(player => player.name.toLowerCase().includes(search.value.toLowerCase().trim()));
    if (sort.value === "name") filtered.sort((a,b) => a.name.localeCompare(b.name));
    if (sort.value === "completions") filtered.sort((a,b) => b.completed.length - a.completed.length || a.rank - b.rank);
    body.replaceChildren();
    status.textContent = `${filtered.length} of ${ranked.length} players · ${ranked.reduce((sum,p) => sum + p.completed.length,0)} approved completions`;
    for (const player of filtered) {
        const row = element("tr");
        const name = element("td");
        const button = element("button", "text-button", player.name);
        button.type = "button";
        button.setAttribute("aria-label", `Approved completions for ${player.name}`);
        button.addEventListener("click", () => { selected = player.id; showPlayer(player); });
        name.append(button);
        row.append(element("td", "rank", player.rank), name, element("td", "numeric", player.points.toLocaleString(undefined,{maximumFractionDigits:2})), element("td", "numeric", player.completed.length), element("td", "", player.completed[0]?.name || "—"));
        body.append(row);
    }
    if (!filtered.length) stateRow(body, 5, ranked.length ? "No matching players" : "No approved completions yet", ranked.length ? "Try another player name." : "Players appear once the list team approves a completion.");
    const player = ranked.find(player => player.id === selected);
    if (player) showPlayer(player); else detail.hidden = true;
}
function showPlayer(player) {
    const detail = document.getElementById("player-details");
    detail.hidden = false;
    const list = element("ul", "completion-list");
    for (const level of player.completed) {
        const row = element("li");
        const link = element("a", "", String(level.name || "Unnamed level").trim());
        link.href = `index.html?level=${encodeURIComponent(level.id)}`;
        row.append(link, element("span", "muted", `${level.points ?? "—"} points`)); list.append(row);
    }
    detail.replaceChildren(element("h2", "", player.name), element("p", "muted", "Approved completions"), list);
}
search.addEventListener("input", render);
sort.addEventListener("change", render);
subscribeData("levels", value => { levels = value; render(); });
subscribeData("records", value => { records = value; render(); });
