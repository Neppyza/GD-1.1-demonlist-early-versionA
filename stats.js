import { renderInsights } from "./community-insights.js";
import { subscribeData, retryData } from "./data.js";
import { buildStats, playerDetails } from "./stats-model.js";
import { element, stateRow, countryIndicator, externalLink } from "./ui.js";
import { getCountry } from "./countries.js";
import { position, rankLabel } from "./list-model.js";
import { dataMessage } from "./messages.js";

const body = document.getElementById("players");
const table = document.getElementById("players-table");
const search = document.getElementById("player-search");
const sort = document.getElementById("player-sort");
const status = document.getElementById("stats-status");
let levels = { status: "loading", items: [] }, records = { status: "loading", items: [] }, profiles = { status: "loading", items: [] };
let adjustments = { status: "loading", items: [] };
let selected = new URLSearchParams(location.search).get("player");
const directoryStatus = document.getElementById("directory-status");
const dialog = document.getElementById("player-dialog");
const detail = document.getElementById("player-details");
const closeButton = document.getElementById("close-player");
let profileKey = "", returnFocus = null;
const number = value => value.toLocaleString(undefined,{maximumFractionDigits:2});
function dismissProfile() {
    selected = null;
    const url = new URL(location.href);
    url.searchParams.delete("player");
    history.replaceState(history.state,"",url);
    hideProfile();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    else search.focus({preventScroll:true});
    returnFocus = null;
}
function hideProfile() {
    if (dialog.open) dialog.close();
    profileKey = "";
}
closeButton.addEventListener("click",dismissProfile);
dialog.addEventListener("cancel",event => { event.preventDefault(); dismissProfile(); });
dialog.addEventListener("click",event => {
    if (event.target !== dialog) return;
    const b = dialog.getBoundingClientRect();
    if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dismissProfile();
});
function openProfile() {
    if (!dialog.open) { dialog.showModal(); dialog.scrollTop = 0; }
}

function tagList(tags) {
    const list = element("span", "player-tags");
    for (const tag of tags) list.append(element("span", "player-tag", tag));
    return list;
}
function render() {
    document.getElementById("community-insights").hidden = true;
    directoryStatus.replaceChildren();
    document.getElementById("stats-summary")?.remove();
    if (profiles.status === "error") {
        directoryStatus.append(element("p", "form-status", dataMessage(profiles.error, "registered player profiles")));
        const retry = element("button", "secondary-button", "Retry player profiles");
        retry.type = "button";
        retry.addEventListener("click", () => retryData("players"));
        directoryStatus.append(retry);
        stateRow(body, 6, "Players are unavailable", "Player profiles could not be loaded. Retry to load the current leaderboard.");
        status.textContent = "Player rankings unavailable";
        table.setAttribute("aria-busy", "false"); hideProfile(); return;
    }
    if (levels.status === "error" || records.status === "error") {
        const error = levels.error || records.error;
        stateRow(body, 6, "Players are unavailable", dataMessage(error, "player rankings"), () => { retryData("levels"); retryData("records"); retryData("pointAdjustments"); });
        status.textContent = "Player rankings unavailable"; table.setAttribute("aria-busy", "false"); hideProfile(); return;
    }
    if (levels.status !== "ready" || records.status !== "ready" || profiles.status === "loading") { stateRow(body, 6, "Loading player rankings…"); table.setAttribute("aria-busy", "true"); hideProfile(); return; }
    if (adjustments.status !== "ready") {
        directoryStatus.append(element("p", "form-status", adjustments.status === "error"
            ? "Point corrections are unavailable. Showing completion-only scores and provisional ranks; corrected totals may differ."
            : "Loading point corrections. Scores and ranks below are provisional."));
        if (adjustments.status === "error") {
            const retry = element("button", "secondary-button", "Retry point corrections");
            retry.type = "button"; retry.addEventListener("click", () => retryData("pointAdjustments"));
            directoryStatus.append(retry);
        }
    }
    table.setAttribute("aria-busy", "false");
    const ranked = buildStats(levels.items, records.items, profiles.items, adjustments.status === "ready" ? adjustments.items : []).map((player, index) => ({ ...player, rank: index + 1 }));
    renderInsights(document.getElementById("community-insights"), levels.items, ranked);
    const summary = element("dl", "stats-summary");
    summary.id = "stats-summary";
    for (const [label, value] of [["Players", ranked.length], ["Levels", levels.items.length], ["Completions", ranked.reduce((sum, player) => sum + player.completed.length, 0)]]) {
        const group = element("div");
        group.append(element("dt", "", label), element("dd", "", value));
        summary.append(group);
    }
    document.querySelector(".list-toolbar").before(summary);
    const term = search.value.toLowerCase().trim();
    const filtered = ranked.filter(player => [player.name, ...player.tags, getCountry(player.countryCode)?.name || "", player.countryCode || ""].join(" ").toLowerCase().includes(term));
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
        link.setAttribute("aria-haspopup","dialog");
        link.addEventListener("click", event => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            returnFocus = link;
            if (selected !== player.id) history.pushState(null, "", link.href);
            selected = player.id;
            showPlayer(player,ranked);
        });
        name.append(link, tagList(player.tags));
        const country = element("td", "country-cell");
        country.append(countryIndicator(player.countryCode));
        row.append(element("td", "rank", player.rank), name, country, element("td", "numeric", player.points.toLocaleString(undefined,{maximumFractionDigits:2})), element("td", "numeric", player.completed.length), element("td", "", player.completed.find(l => position(l.position) !== Infinity)?.name || "—"));
        body.append(row);
    }
    if (!filtered.length) stateRow(body, 6, ranked.length ? "No matching players" : "No players yet", ranked.length ? "Try another player name, tag or country." : "Complete your profile in Account to join the leaderboard.");
    const player = ranked.find(player => player.id === selected);
    if (player) showPlayer(player,ranked);
    else if (selected && profiles.status === "ready") {
        const title = element("h2","","Player not found"); title.id = "player-dialog-title";
        detail.replaceChildren(title,element("p","muted","This player has not published a profile or has no approved completions."));
        profileKey = ""; openProfile();
    } else hideProfile();
}
function showPlayer(player, ranked) {
    const info = playerDetails(player,levels.items,records.items,ranked);
    const key = JSON.stringify([player,info,[...info.proofByLevel],adjustments.status]);
    if (dialog.open && key === profileKey) return;
    profileKey = key;
    const scroll = dialog.open ? dialog.scrollTop : 0;
    const title = element("h2","player-dialog-name",player.name); title.id = "player-dialog-title";
    detail.replaceChildren(element("p","eyebrow","Player profile"),title,tagList(player.tags),countryIndicator(player.countryCode));
    if (player.bio) detail.append(element("p","player-bio",player.bio));
    const metrics = element("dl","profile-metrics");
    for (const [label,value] of [
        ["Global rank","#"+player.rank],
        ["Total points",number(player.points)],
        ["Full completions",player.completed.length],
        ["Country rank",info.countryRank === null ? "—" : "#"+info.countryRank+" / "+info.countryTotal],
        ["Average completion points",info.average === null ? "—" : number(info.average)],
        ["Levels with partial progress",info.partial.length]
    ]) {
        const group = element("div");
        group.append(element("dt","",label),element("dd","",value)); metrics.append(group);
    }
    detail.append(metrics);
    if (adjustments.status !== "ready") detail.append(element("p","muted","Points and ranks are provisional until point corrections load."));
    if (player.pointCorrection) detail.append(element("p","muted","Completion points: "+number(player.basePoints)+" · Staff correction: "+(player.pointCorrection > 0 ? "+" : "")+number(player.pointCorrection)+" · Total cannot fall below zero."));
    const hardest = element("div","profile-hardest");
    hardest.append(element("h3","","Hardest ranked completion"));
    if (info.hardest) {
        const link = element("a","",rankLabel(info.hardest)+" · "+(info.hardest.name || "Unnamed level"));
        link.href = "index.html?level="+encodeURIComponent(info.hardest.id);
        hardest.append(link);
    } else hardest.append(element("p","muted","No ranked completion yet."));
    detail.append(hardest);
    const coverage = element("section","profile-section");
    coverage.append(element("h3","","List progress"));
    for (const [label,value] of [["Ranked list",info.ranked],["Top 10",info.top10],["Top 50",info.top50]]) {
        const group = element("div","profile-progress");
        const count = value.completed+"/"+value.total;
        const caption = element("div","profile-progress-label");
        caption.append(element("span","",label),element("strong","",count+(value.total ? " · "+Math.round(value.completed/value.total*100)+"%" : "")));
        group.append(caption);
        if (value.total) {
            const meter = element("progress"); meter.max=value.total; meter.value=value.completed;
            meter.setAttribute("aria-label",label+" completion"); group.append(meter);
        }
        coverage.append(group);
    }
    detail.append(coverage);
    const completions = element("section","profile-section");
    completions.append(element("h3","","Approved completions ("+player.completed.length+")"));
    const list = element("ul","completion-list profile-runs");
    function appendRun(container,level,progress,proofUrl) {
        const row = element("li");
        const text = element("div","profile-run-name");
        const link = element("a","",rankLabel(level)+" · "+(level.name || "Unnamed level"));
        link.href = "index.html?level="+encodeURIComponent(level.id);
        text.append(link,element("span","muted",progress === 100 ? number(Number.isFinite(Number(level.points)) && Number(level.points) >= 0 ? Number(level.points) : 0)+" points · 100%" : progress+"% · No completion points"));
        const proof = externalLink(proofUrl,"Proof ↗");
        if (proof) { proof.setAttribute("aria-label","Watch proof for "+(level.name || "level")); row.append(text,proof); }
        else row.append(text);
        container.append(row);
    }
    for (const level of player.completed) appendRun(list,level,100,info.proofByLevel.get(level.id));
    completions.append(player.completed.length ? list : element("p","muted","No approved completions yet."));
    detail.append(completions);
    const progress = element("section","profile-section");
    progress.append(element("h3","","Approved partial records"));
    const partialList = element("ul","completion-list profile-runs");
    for (const run of info.partial) appendRun(partialList,run.level,run.progress,run.proofUrl);
    progress.append(info.partial.length ? partialList : element("p","muted","No approved partial records on unfinished levels."));
    detail.append(progress);
    const actions = element("div","profile-footer");
    const permanent = element("a","","Permanent profile link");
    permanent.href = "stats.html?player="+encodeURIComponent(player.id);
    const copy = element("button","secondary-button","Copy profile link"); copy.type="button";
    copy.addEventListener("click",async () => {
        try { await navigator.clipboard.writeText(permanent.href); copy.textContent="Copied"; }
        catch { copy.textContent="Use permanent link"; }
    });
    actions.append(permanent,copy); detail.append(actions);
    if (player.registered) detail.append(element("p","muted profile-note","Profile tags describe interests, not staff permissions or certified achievements."));
    openProfile(); dialog.scrollTop=scroll;
}
search.addEventListener("input", render);
sort.addEventListener("change", render);
subscribeData("levels", value => { levels = value; render(); });
subscribeData("records", value => { records = value; render(); });
subscribeData("players", value => { profiles = value; render(); });
window.addEventListener("popstate", () => { selected = new URLSearchParams(location.search).get("player"); render(); });

subscribeData("pointAdjustments", value => { adjustments = value; render(); });
