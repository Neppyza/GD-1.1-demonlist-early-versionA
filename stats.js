import { subscribeData, retryData } from "./data.js";
import { buildStats } from "./stats-model.js";
import { element, stateRow } from "./ui.js";
import { dataMessage } from "./messages.js";

const body = document.getElementById("players");
const table = document.getElementById("players-table");
const search = document.getElementById("player-search");
const sort = document.getElementById("player-sort");
const status = document.getElementById("stats-status");
let levels = { status: "loading", items: [] }, records = { status: "loading", items: [] }, profiles = { status: "loading", items: [] };
let selected = new URLSearchParams(location.search).get("player");
const directoryStatus = document.getElementById("directory-status");
function tagList(tags) {
    const list = element("span", "player-tags");
    for (const tag of tags) list.append(element("span", "player-tag", tag));
    return list;
}
function render() {
    const detail = document.getElementById("player-details");
    directoryStatus.replaceChildren();
    if (profiles.status === "error") {
        directoryStatus.append(element("p", "form-status", dataMessage(profiles.error, "registered player profiles")));
        const retry = element("button", "secondary-button", "Retry player profiles");
        retry.type = "button";
        retry.addEventListener("click", () => retryData("players"));
        directoryStatus.append(retry);
    }
    if (levels.status === "error" || records.status === "error") {
        const error = levels.error || records.error;
        stateRow(body, 5, "Players are unavailable", dataMessage(error, "player rankings"), () => { retryData("levels"); retryData("records"); });
        status.textContent = "Player rankings unavailable"; table.setAttribute("aria-busy", "false"); detail.hidden = true; return;
    }
    if (levels.status !== "ready" || records.status !== "ready" || profiles.status === "loading") { stateRow(body, 5, "Loading player rankings…"); table.setAttribute("aria-busy", "true"); detail.hidden = true; return; }
    table.setAttribute("aria-busy", "false");
    const ranked = buildStats(levels.items, records.items, profiles.items).map((player, index) => ({ ...player, rank: index + 1 }));
    const term = search.value.toLowerCase().trim();
    const filtered = ranked.filter(player => [player.name, ...player.tags].join(" ").toLowerCase().includes(term));
    if (sort.value === "name") filtered.sort((a,b) => a.name.localeCompare(b.name));
    if (sort.value === "completions") filtered.sort((a,b) => b.completed.length - a.completed.length || a.rank - b.rank);
    body.replaceChildren();
    status.textContent = `${filtered.length} of ${ranked.length} players · ${ranked.reduce((sum,p) => sum + p.completed.length,0)} approved completions`;
    for (const player of filtered) {
        const row = element("tr");
        const name = element("td");
        const link = element("a", "text-button", player.name);
        link.href = `stats.html?player=${encodeURIComponent(player.id)}`;
        link.setAttribute("aria-label", `Player profile for ${player.name}`);
        link.addEventListener("click", event => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            selected = player.id;
            history.pushState(null, "", link.href);
            showPlayer(player);
            detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        name.append(link, tagList(player.tags));
        row.append(element("td", "rank", player.rank), name, element("td", "numeric", player.points.toLocaleString(undefined,{maximumFractionDigits:2})), element("td", "numeric", player.completed.length), element("td", "", player.completed[0]?.name || "—"));
        body.append(row);
    }
    if (!filtered.length) stateRow(body, 5, ranked.length ? "No matching players" : "No players yet", ranked.length ? "Try another player name or tag." : "Complete your profile in Account to join the leaderboard.");
    const player = ranked.find(player => player.id === selected);
    if (player) showPlayer(player);
    else if (selected && profiles.status === "ready") { detail.hidden = false; detail.replaceChildren(element("h2", "", "Player not found"), element("p", "muted", "This player has not published a profile or has no approved completions.")); }
    else detail.hidden = true;
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
    detail.replaceChildren(element("h2", "", player.name), tagList(player.tags));
    if (player.bio) detail.append(element("p", "player-bio", player.bio));
    detail.append(element("p", "muted", `${player.points.toLocaleString()} points · ${player.completed.length} approved completions`));
    if (player.registered) detail.append(element("p", "muted", "Tags describe the player's interests; they do not grant staff access or certify completions."));
    if (player.completed.length) detail.append(list);
    else detail.append(element("p", "muted", "No approved completions yet."));
}
search.addEventListener("input", render);
sort.addEventListener("change", render);
subscribeData("levels", value => { levels = value; render(); });
subscribeData("records", value => { records = value; render(); });
subscribeData("players", value => { profiles = value; render(); });
window.addEventListener("popstate", () => { selected = new URLSearchParams(location.search).get("player"); render(); });
