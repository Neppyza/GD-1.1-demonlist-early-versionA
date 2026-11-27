import { categoryOf, categories, latestPlacements, discoverySort, matchesRank, distinctCompletions, rankingActivity, adjacentLevels, randomLevel, isRecentPlacement } from "./discovery-model.js";
import { position } from "./list-model.js";
import { readSaved, toggleSaved, movement, renderHistory } from "./list-extras.js";
import { minimumProgress } from "./completion-model.js";
import { subscribeData, retryData } from "./data.js";
import { filterLevels, sortLevels, rankLabel } from "./list-model.js";
import { victorNames } from "./victors.js";
import { element, thumbnail, externalLink } from "./ui.js";
import { dataMessage } from "./messages.js";

function connectionStatus() {
    document.getElementById("connection-status").textContent = !navigator.onLine ? "Offline · Reconnect to load current rankings." : levelState.status === "error" ? "Rankings connection failed · Use Try again below." : levelState.status === "ready" ? "Rankings loaded · Listening for updates" : "Connecting to rankings…";
}
const body = document.getElementById("levels");
const table = document.getElementById("demon-table");
const search = document.getElementById("search");
const sort = document.getElementById("sort");
const status = document.getElementById("result-count");
const dialog = document.getElementById("level-dialog");
let levelState = { status: "loading", items: [] };
let recordState = { status: "loading", items: [] };
const ranking = document.getElementById("ranking-index");
const category = document.getElementById("category-filter");
const completion = document.getElementById("completion-filter");
const activity = document.getElementById("placement-feed");
const activityMode = document.getElementById("activity-mode");
const activityItems = document.getElementById("activity-items");
const activityMore = document.getElementById("activity-more");
const randomButton = document.getElementById("random-level");
const compactButton = document.getElementById("compact-view");
const recentFilter = document.getElementById("recent-filter");
const retryRecords = document.getElementById("retry-records");
let visibleLevels = [], activityExpanded = false, activityKey = "";
function renderActivity(levels) {
    const entries = rankingActivity(levels,activityMode.value);
    const shown = entries.slice(0,activityExpanded ? 30 : 4);
    const key = JSON.stringify([activityMode.value,activityExpanded,entries.length,shown.map(({level,rank,from,at}) => [level.id,level.name,level.verifier,level.thumbnail,rank,from,at])]);
    activity.hidden = false;
    if (key === activityKey) return;
    activityKey = key;
    activityItems.replaceChildren();
    for (const {level,rank,from,at} of shown) {
        const link = levelLink(level.id,"","placement-item");
        const copy = element("div","placement-copy");
        const label = from === null ? "Entered at #" + rank : "#" + from + " → #" + rank;
        copy.append(element("span","placement-kicker",label),element("strong","",level.name || "Unnamed level"),element("span","muted","Verified by " + (level.verifier || "—")));
        const date = element("time","",new Date(at).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})); date.dateTime = at;
        const arrow = element("span","placement-arrow","→"); arrow.setAttribute("aria-hidden","true");
        link.append(thumbnail(level),copy,date,arrow);
        activityItems.append(link);
    }
    if (!shown.length) activityItems.append(element("p","muted","No recorded activity in this view."));
    activityMore.hidden = entries.length <= 4;
    activityMore.textContent = activityExpanded ? "Show less activity" : "Show more activity (up to 30)";
    activityMore.setAttribute("aria-expanded",String(activityExpanded));
}
activityMode.addEventListener("change",() => { activityExpanded = false; renderActivity(levelState.items); });
activityMore.addEventListener("click",() => { activityExpanded = !activityExpanded; renderActivity(levelState.items); });
randomButton.addEventListener("click",() => {
    const level = randomLevel(visibleLevels);
    if (level) showDetails(level.id,true);
});
function setCompact(active) {
    table.classList.toggle("compact-list",active);
    compactButton.setAttribute("aria-pressed",String(active));
    compactButton.textContent = active ? "Detailed view" : "Compact view";
}
try { setCompact(localStorage.getItem("gd11.compact") === "true"); } catch {}
compactButton.addEventListener("click",() => {
    const active = compactButton.getAttribute("aria-pressed") !== "true";
    setCompact(active);
    try { localStorage.setItem("gd11.compact",String(active)); } catch {}
});
retryRecords.addEventListener("click",() => retryData("records"));

function listState(title, message, retry) {
    const box = element("div", "list-state");
    box.append(element("strong", "", title));
    if (message) box.append(element("p", "", message));
    if (retry) {
        const button = element("button", "secondary-button", "Try again");
        button.type = "button"; button.addEventListener("click", retry); box.append(button);
    }
    body.replaceChildren(box);
    ranking.replaceChildren(element("li", "muted", title));
}

function levelLink(id, label, className = "") {
    const link = element("a", className, label);
    link.href = `?level=${encodeURIComponent(id)}`;
    link.addEventListener("click", event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        showDetails(id, true);
    });
    return link;
}

function render() {
    connectionStatus();
    table.setAttribute("aria-busy", String(levelState.status === "loading"));
    const recordNote = document.getElementById("records-note");
    recordNote.hidden = recordState.status !== "error";
    retryRecords.hidden = recordState.status !== "error";
    recordNote.textContent = recordState.status === "error" ? dataMessage(recordState.error, "approved records") : "";
    if (levelState.status !== "ready") { document.getElementById("list-overview").replaceChildren(); activity.hidden = true; visibleLevels = []; randomButton.disabled = true; syncDetails(); }
    if (levelState.status === "loading") {
        listState( "Loading the demonlist…");
        status.textContent = "Loading levels…";
        return;
    }
    if (levelState.status === "error") {
        listState( "The demonlist is unavailable", dataMessage(levelState.error, "the rankings"), () => retryData("levels"));
        status.textContent = "Rankings unavailable";
        return;
    }
    const records = recordState.status === "ready" ? recordState.items : [];
    const listed = levelState.items;
    renderActivity(listed);
    const selectedCategory = category.value;
    const options = categories(listed);
    category.replaceChildren(new Option("All categories",""), ...options.map(value => new Option(value,value)));
    category.value = options.includes(selectedCategory) ? selectedCategory : "";
    completion.disabled = recordState.status !== "ready";
    sort.querySelector('option[value="victors"]').disabled = recordState.status !== "ready";
    if (completion.disabled) completion.value = "all";
    if (recordState.status !== "ready" && sort.value === "victors") sort.value = "position";
    const counts = new Map(listed.map(l => [l.id,victorNames(records,l.id).length]));
    const saved = readSaved();
    const mode = document.getElementById("rank-filter").value;
    const savedOnly = document.getElementById("saved-filter").checked;
    const matching = (matchesRank({},search.value) === null ? filterLevels(listed, records, search.value) : listed.filter(l => matchesRank(l,search.value))).filter(level => {
        const rank = position(level.position);
        return (!recentFilter.checked || isRecentPlacement(level)) && (!category.value || categoryOf(level) === category.value) && (completion.value === "all" || (completion.value === "with" ? counts.get(level.id) > 0 : counts.get(level.id) === 0)) && (!savedOnly || saved.has(level.id)) && (mode === "all" || (mode === "top10" && rank <= 10) || (mode === "top50" && rank <= 50) || (mode === "unranked" && rank === Infinity));
    });
    const overview = document.getElementById("list-overview");
    overview.replaceChildren();
    for (const [label, value] of [["Ranked levels", listed.filter(l => position(l.position) !== Infinity).length], ["Approved completions", recordState.status === "ready" ? distinctCompletions(listed, records) : "—"], ["Saved levels", listed.filter(l => saved.has(l.id)).length]]) {
        const item = element("div"); item.append(element("strong", "", value), element("span", "", label)); overview.append(item);
    }
    const filtered = discoverySort(matching, sort.value, records);
    visibleLevels = filtered; randomButton.disabled = !filtered.length;
    status.textContent = `${filtered.length} of ${listed.length} levels`;
    body.replaceChildren();
    if (!filtered.length) {
        listState( listed.length ? "No matching levels" : "No levels have been published in this list yet", listed.length ? "Try another name, creator, verifier, or victor." : "Approved levels will appear here.");
        if (search.value) {
            const clear = element("button", "secondary-button", "Clear search");
            clear.type = "button";
            clear.addEventListener("click", () => { search.value = ""; render(); search.focus(); });
            body.querySelector(".list-state").append(clear);
        }
    }
    ranking.replaceChildren();
    for (const level of sortLevels(matching)) {
        const item = element("li");
        const link = levelLink(level.id, "");
        const name = element("span", "ranking-name", String(level.name || "Unnamed level").trim());
        if (level.creator) name.append(element("small", "", level.creator));
        link.append(element("span", "ranking-position", rankLabel(level)), name);
        item.append(link); ranking.append(item);
    }
    if (!matching.length) ranking.append(element("li", "muted", "No levels in this view."));
    for (const level of filtered) {
        const row = element("article", "demon-row");
        const previewLink = levelLink(level.id, "", "level-preview");
        previewLink.setAttribute("aria-label", `Details for ${String(level.name || "Unnamed level").trim()}`);
        previewLink.append(thumbnail(level));
        const overlay = element("span","preview-action","View level →"); overlay.setAttribute("aria-hidden","true"); previewLink.append(overlay);
        const content = element("div", "level-summary");
        const heading = element("h2", "level-name");
        heading.append(levelLink(level.id, String(level.name || "Unnamed level").trim()));
        const rank = element("div", "level-rank");
        rank.append(element("span", "level-placement", rankLabel(level)));
        if (position(level.position) === 1) rank.classList.add("rank-first");
        const creator = element("p", "level-creator");
        creator.append(document.createTextNode("Created by "), element("strong", "", level.creator || "—"));
        const verifier = element("p", "level-verifier");
        verifier.append(document.createTextNode("Verified by "), element("strong", "", level.verifier || "—"));
        const meta = element("dl", "row-meta");
        for (const [label, value, className] of [["Record requirement", `${minimumProgress(level)}%`, "level-percentage"], ["Points", level.points ?? "—", ""], ["Difficulty / category", level.category || level.difficulty || "—", ""], ["Victors", recordState.status === "ready" ? counts.get(level.id) : "—", "victor-count"]]) {
            const group = element("div");
            group.append(element("dt", "", label), element("dd", className, value));
            meta.append(group);
        }
        const actions = element("div", "level-row-actions");
        if (isRecentPlacement(level)) actions.append(element("span","recent-placement","New placement"));
        const delta = movement(level);
        if (delta) actions.append(element("span", delta > 0 ? "rank-up" : "rank-down", delta > 0 ? "↑ " + delta : "↓ " + Math.abs(delta)));
        const save = element("button", "save-level", saved.has(level.id) ? "Saved" : "Save");
        save.type = "button"; save.setAttribute("aria-pressed", String(saved.has(level.id)));
        save.setAttribute("aria-label", (saved.has(level.id) ? "Unsave " : "Save ") + (level.name || "level"));
        save.addEventListener("click", () => { const active = toggleSaved(level.id); if (savedOnly && !active) render(); else { save.textContent = active ? "Saved" : "Save"; save.setAttribute("aria-pressed", String(active)); save.setAttribute("aria-label", (active ? "Unsave " : "Save ") + (level.name || "level")); overview.lastElementChild.firstElementChild.textContent = String(listed.filter(l => readSaved().has(l.id)).length); } });
        const proof = externalLink(level.proofUrl, "Watch proof ↗");
        actions.append(save);
        if (proof) actions.append(proof);
        actions.append(levelLink(level.id, "Details →", "row-details"));
        content.append(heading, creator, verifier);
        const identity = element("div","level-identity");
        identity.append(previewLink, content);
        row.append(rank, identity, meta, actions); body.append(row);
    }
    syncDetails();
}

function syncDetails() {
    const selected = new URLSearchParams(location.search).get("level");
    const selectionStatus = document.getElementById("selection-status");
    selectionStatus.hidden = true;
    if (levelState.status === "ready" && selected) {
        if (levelState.items.some(level => level.id === selected)) {
            showDetails(selected);
            return;
        }
        selectionStatus.textContent = "That level is no longer available. Browse the current list below.";
        selectionStatus.hidden = false;
    }
    if (dialog.open) dialog.close();
}

function showDetails(id, updateURL = false) {
    const level = levelState.items.find(item => item.id === id);
    if (!level) return;
    if (updateURL) {
        const url = new URL(location.href);
        if (url.searchParams.get("level") !== id) {
            url.searchParams.set("level", id);
            url.searchParams.delete("list");
            history.pushState(null, "", url);
        }
    }
    document.getElementById("selection-status").hidden = true;
    const detail = document.getElementById("level-detail");
    const title = element("h2", "", String(level.name || "Unnamed level").trim());
    title.id = "detail-title";
    const meta = element("dl", "detail-meta");
    for (const [label, value] of [["Record requirement", `${minimumProgress(level)}%`], ["Creator", level.creator], ["Verifier", level.verifier], ["Difficulty / category", level.category || level.difficulty], ["Points", level.points]]) {
        const group = element("div");
        group.append(element("dt", "", label), element("dd", "", value ?? "—"));
        meta.append(group);
    }
    detail.replaceChildren(element("p", "eyebrow", rankLabel(level)), title, thumbnail(level), meta);
    if (level.description) detail.append(element("p", "level-description", level.description));
    const links = element("div", "detail-actions");
    const permanent = element("a", "", "Permanent link");
    permanent.href = `?level=${encodeURIComponent(id)}`;
    links.append(permanent);
    for (const [value, label] of [[level.levelUrl, "Open level ↗"], [level.proofUrl, "Watch verification ↗"]]) {
        const link = externalLink(value, label);
        if (link) links.append(link);
    }
    const copy = element("button", "secondary-button", "Copy link");
    copy.type = "button";
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(permanent.href); copy.textContent = "Copied"; } catch { copy.textContent = "Use permanent link"; } });
    links.append(copy);
    const neighbors = element("nav","detail-neighbors");
    neighbors.setAttribute("aria-label","Adjacent rankings");
    const [previous,next] = adjacentLevels(levelState.items,id);
    if (previous) neighbors.append(levelLink(previous.id,"← " + rankLabel(previous) + " " + (previous.name || "Unnamed level")));
    if (next) neighbors.append(levelLink(next.id,rankLabel(next) + " " + (next.name || "Unnamed level") + " →"));
    detail.append(links, neighbors, renderHistory(level), element("h3", "", "Approved victors"));
    if (updateURL) dialog.scrollTop = 0;
    if (recordState.status === "ready") {
        const names = victorNames(recordState.items, id);
        if (names.length) {
            const list = element("ul", "victor-list");
            for (const name of names) list.append(element("li", "", name));
            detail.append(list);
            const recordsLink = element("a", "", "View completion records →");
            recordsLink.href = `records.html?level=${encodeURIComponent(id)}`;
            detail.append(recordsLink);
        } else detail.append(element("p", "muted", "No approved completions have been recorded."));
    } else detail.append(element("p", "muted", recordState.status === "error" ? dataMessage(recordState.error, "approved records") : "Loading approved records…"));
    if (!dialog.open) dialog.showModal();
}

window.addEventListener("offline", connectionStatus);
window.addEventListener("online", () => { connectionStatus(); retryData("levels"); retryData("records"); });
search.addEventListener("input", render);
sort.addEventListener("change", render);
for (const id of ["rank-filter", "saved-filter", "category-filter", "completion-filter", "recent-filter"]) document.getElementById(id).addEventListener("change", render);
document.getElementById("reset-filters").addEventListener("click", () => { search.value = ""; sort.value = "position"; document.getElementById("rank-filter").value = "all"; document.getElementById("saved-filter").checked = false; category.value = ""; completion.value = "all"; recentFilter.checked = false; render(); search.focus(); });
function closeDetails() {
    const url = new URL(location.href);
    url.searchParams.delete("level");
    history.replaceState(history.state, "", url);
    if (dialog.open) dialog.close();
}
document.getElementById("close-dialog").addEventListener("click", closeDetails);
dialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeDetails();
});
window.addEventListener("popstate", syncDetails);
dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDetails();
});
subscribeData("levels", value => { levelState = value; render(); });
subscribeData("records", value => { recordState = value; render(); });

