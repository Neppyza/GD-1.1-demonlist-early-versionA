import { subscribeData, retryData } from "./data.js";
import { filterLevels, sortLevels, rankLabel, position } from "./list-model.js";
import { victorNames } from "./victors.js";
import { element, thumbnail, externalLink } from "./ui.js";
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
let section = "all";
const ranking = document.getElementById("ranking-index");

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
        showDetails(id);
    });
    return link;
}

function render() {
    table.setAttribute("aria-busy", String(levelState.status === "loading"));
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
    const matching = filterLevels(levelState.items, records, search.value).filter(level => section === "all" || (section === "ranked" ? position(level.position) !== Infinity : position(level.position) === Infinity));
    const filtered = sortLevels(matching, sort.value);
    status.textContent = `${filtered.length} of ${levelState.items.length} levels`;
    const recordNote = document.getElementById("records-note");
    recordNote.hidden = recordState.status !== "error";
    recordNote.textContent = recordState.status === "error" ? dataMessage(recordState.error, "approved records") : "";
    body.replaceChildren();
    if (!filtered.length) {
        listState( levelState.items.length ? "No matching levels" : "No levels have been published yet", levelState.items.length ? "Try another name, creator, verifier, or victor." : "Approved levels will appear here.");
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
        const content = element("div", "level-summary");
        const heading = element("h2", "level-name");
        heading.append(element("span", "level-placement", `${rankLabel(level)} – `), levelLink(level.id, String(level.name || "Unnamed level").trim()));
        const creator = element("p", "level-creator");
        creator.append(document.createTextNode("Created by "), element("strong", "", level.creator || "—"));
        const verifier = element("p", "level-verifier");
        verifier.append(document.createTextNode("Verified by "), element("strong", "", level.verifier || "—"));
        const meta = element("dl", "row-meta");
        for (const [label, value, className] of [["Points", level.points ?? "—", ""], ["Difficulty / category", level.category || level.difficulty || "—", ""], ["Victors", recordState.status === "ready" ? victorNames(records, level.id).length : "—", "victor-count"]]) {
            const group = element("div");
            group.append(element("dt", "", label), element("dd", className, value));
            meta.append(group);
        }
        content.append(heading, creator, verifier, meta);
        row.append(previewLink, content); body.append(row);
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

for (const button of document.querySelectorAll("[data-section]")) button.addEventListener("click", () => {
    section = button.dataset.section;
    for (const item of document.querySelectorAll("[data-section]")) item.setAttribute("aria-pressed", String(item === button));
    render();
});
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

