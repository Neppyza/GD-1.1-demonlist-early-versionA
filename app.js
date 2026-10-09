import { subscribeData, retryData } from "./data.js";
import { filterLevels, sortLevels, rankLabel, position } from "./list-model.js";
import { victorNames } from "./victors.js";
import { element, thumbnail, externalLink, stateRow } from "./ui.js";
import { dataMessage } from "./messages.js";

const body = document.getElementById("levels");
const table = document.getElementById("demon-table");
const search = document.getElementById("search");
const sort = document.getElementById("sort");
const status = document.getElementById("result-count");
const dialog = document.getElementById("level-dialog");
let levelState = { status: "loading", items: [] };
let recordState = { status: "loading", items: [] };
let initialSelection = true;

function levelLink(id, label, className = "") {
    const link = element("a", className, label);
    link.href = `?level=${encodeURIComponent(id)}`;
    link.addEventListener("click", event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        showDetails(id);
    });
    return link;
}

function render() {
    table.setAttribute("aria-busy", String(levelState.status === "loading"));
    if (levelState.status === "loading") {
        stateRow(body, 8, "Loading the demonlist…");
        status.textContent = "Loading levels…";
        return;
    }
    if (levelState.status === "error") {
        stateRow(body, 8, "The demonlist is unavailable", dataMessage(levelState.error, "the rankings"), () => retryData("levels"));
        status.textContent = "Rankings unavailable";
        return;
    }
    const records = recordState.status === "ready" ? recordState.items : [];
    const filtered = sortLevels(filterLevels(levelState.items, records, search.value), sort.value);
    status.textContent = `${filtered.length} of ${levelState.items.length} levels`;
    const recordNote = document.getElementById("records-note");
    recordNote.hidden = recordState.status !== "error";
    recordNote.textContent = recordState.status === "error" ? dataMessage(recordState.error, "approved records") : "";
    for (const heading of table.querySelectorAll("th[data-sort]")) {
        heading.setAttribute("aria-sort", heading.dataset.sort === sort.value ? sort.value === "points" ? "descending" : "ascending" : "none");
    }
    body.replaceChildren();
    if (!filtered.length) {
        stateRow(body, 8, levelState.items.length ? "No matching levels" : "No levels have been published yet", levelState.items.length ? "Try another name, creator, verifier, or victor." : "Approved levels will appear here.");
        if (search.value) {
            const clear = element("button", "secondary-button", "Clear search");
            clear.type = "button";
            clear.addEventListener("click", () => { search.value = ""; render(); search.focus(); });
            body.querySelector("td").append(clear);
        }
    }
    for (const level of filtered) {
        const row = element("tr", "demon-row");
        const rank = element("td", position(level.position) === Infinity ? "rank unranked" : "rank", position(level.position) === Infinity ? "—" : position(level.position));
        rank.setAttribute("aria-label", rankLabel(level));
        const preview = element("td", "preview-cell");
        const previewLink = levelLink(level.id, "");
        previewLink.setAttribute("aria-label", `Details for ${String(level.name || "Unnamed level").trim()}`);
        previewLink.append(thumbnail(level));
        preview.append(previewLink);
        const name = element("td", "level-name");
        name.append(levelLink(level.id, String(level.name || "Unnamed level").trim()));
        const creator = element("td", "", level.creator || "—");
        const verifier = element("td", "", level.verifier || "—");
        const difficulty = element("td", "difficulty", level.category || level.difficulty || "—");
        const points = element("td", "numeric", level.points ?? "—");
        const victors = element("td", "numeric", recordState.status === "ready" ? victorNames(records, level.id).length : "—");
        row.append(rank, preview, name, creator, verifier, difficulty, points, victors);
        body.append(row);
    }
    if (dialog.open) {
        if (levelState.items.some(level => level.id === dialog.dataset.levelId)) showDetails(dialog.dataset.levelId);
        else dialog.close();
    }
    if (initialSelection) {
        initialSelection = false;
        const selected = new URLSearchParams(location.search).get("level");
        if (selected && levelState.items.some(level => level.id === selected)) showDetails(selected);
        else if (selected) {
            document.getElementById("selection-status").hidden = false;
            document.getElementById("selection-status").textContent = "That level is no longer available. Browse the current list below.";
        }
    }
}

function showDetails(id) {
    const level = levelState.items.find(item => item.id === id);
    if (!level) return;
    dialog.dataset.levelId = id;
    const detail = document.getElementById("level-detail");
    const title = element("h2", "", String(level.name || "Unnamed level").trim());
    title.id = "detail-title";
    const meta = element("dl", "detail-meta");
    for (const [label, value] of [["Creator", level.creator], ["Verifier", level.verifier], ["Difficulty / category", level.category || level.difficulty], ["Points", level.points]]) {
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
    detail.append(links, element("h3", "", "Approved victors"));
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

search.addEventListener("input", render);
sort.addEventListener("change", render);
document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
subscribeData("levels", value => { levelState = value; render(); });
subscribeData("records", value => { recordState = value; render(); });

