import { victorNames } from "./victors.js";
const levelsContainer = document.getElementById("levels");
const search = document.getElementById("search");
const ranking = document.getElementById("ranking");
const count = document.getElementById("level-count");
const resultCount = document.getElementById("result-count");
let selectedId = new URLSearchParams(location.search).get("level");
let levels = [];
let records = [];
let recordsState = "loading";
let loaded = false;
let unsubscribeLevels = null;
let loadGeneration = 0;

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
}

function safeURL(value) {
    if (!value) return null;
    try {
        const url = new URL(String(value), location.href);
        return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
}

function thumbnail(level) {
    const container = element("div", "thumbnail");
    const placeholder = () => container.replaceChildren(element("span", "thumbnail-placeholder", "No preview available"));
    const src = safeURL(level.thumbnail);
    if (src) {
        const image = element("img");
        image.src = src;
        image.alt = `${level.name || "Level"} preview`;
        image.loading = "lazy";
        image.addEventListener("error", placeholder, { once: true });
        container.append(image);
    } else placeholder();
    return container;
}

function metadata(level) {
    const list = element("dl", "level-meta");
    const fields = [["Creator", level.creator], ["Verifier", level.verifier], ["Victors", recordsState === "error" ? "Unavailable" : recordsState === "loading" ? "Loading…" : victorNames(records, level.id).join(", ") || "No approved victors yet"], ["Points", level.points], ["Difficulty", level.difficulty]];
    if (level.levelUrl) fields.push(["Level link", level.levelUrl]);
    if (level.proofUrl) fields.push(["Video proof", level.proofUrl]);
    for (const [label, value] of fields) {
        const group = element("div");
        const detail = element("dd");
        const href = (label === "Level link" || label === "Video proof") ? safeURL(value) : null;
        if (href) {
            const link = element("a", "", label === "Level link" ? "Open level" : "Watch proof");
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            detail.append(link);
        } else detail.textContent = value ?? "—";
        group.append(element("dt", "", label), detail);
        list.append(group);
    }
    return list;
}

function showDetails(id) {
    if (!levels.some(level => level.id === id)) return;
    selectedId = id;
    const url = new URL(location.href);
    url.searchParams.set("level", id);
    history.pushState({}, "", url);
    displayLevels();
    document.getElementById("selected-title")?.focus({ preventScroll: true });
    if (matchMedia("(max-width: 760px)").matches) levelsContainer.scrollIntoView({ behavior: "auto" });
}

window.addEventListener("popstate", () => {
    selectedId = new URLSearchParams(location.search).get("level");
    displayLevels();
});

function openLink(link, id) {
    link.href = `?level=${encodeURIComponent(id)}`;
    link.addEventListener("click", event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        showDetails(id);
    });
}

function displayLevels() {
    if (!loaded) return;
    const query = search.value.toLowerCase().trim();
    const filtered = levels.filter(level => [level.name, level.creator, level.verifier, ...victorNames(records, level.id)].some(value => String(value ?? "").toLowerCase().includes(query)));
    count.textContent = levels.length;
    resultCount.textContent = `${filtered.length} of ${levels.length} levels`;
    ranking.replaceChildren();
    levelsContainer.replaceChildren();
    if (!filtered.length) {
        const empty = element("div", "state");
        empty.append(element("h3", "", levels.length ? "No matching levels" : "No levels yet"), element("p", "", levels.length ? "Try another level name, creator, or verifier." : "The rankings will appear here when levels are added."));
        if (query) {
            const clear = element("button", "", "Clear filter");
            clear.addEventListener("click", () => { search.value = ""; displayLevels(); search.focus(); });
            empty.append(clear);
        }
        levelsContainer.append(empty);
    }
    const selected = filtered.find(level => level.id === selectedId) || filtered[0];
    filtered.forEach(level => {
        const item = element("li");
        const rankLink = element("a", "", `#${level.position ?? "—"} — ${level.name || "Unnamed Level"}`);
        rankLink.append(element("small", "", level.creator || "Unknown creator"));
        openLink(rankLink, level.id);
        if (level === selected) rankLink.setAttribute("aria-current", "true");
        item.append(rankLink);
        ranking.append(item);
    });
    if (!selected) return;
    const article = element("article", "selected-level");
    const title = element("h2", "", `#${selected.position ?? "—"} — ${selected.name || "Unnamed Level"}`);
    title.id = "selected-title";
    title.tabIndex = -1;
    article.append(title, element("p", "level-byline", `Created by ${selected.creator || "Unknown creator"}`), thumbnail(selected), metadata(selected));
    if (selected.description) article.append(element("p", "level-description", selected.description));
    const recordsHeading = element("h3", "", "Victors");
    article.append(recordsHeading);
    const names = victorNames(records, selected.id);
    if (recordsState === "ready" && names.length) {
        const list = element("ul", "victor-list");
        names.forEach(name => list.append(element("li", "", name)));
        article.append(list);
    } else article.append(element("p", "records-status", recordsState === "loading" ? "Loading records…" : recordsState === "error" ? "Records are currently unavailable." : "No approved victors yet."));
    const submit = element("a", "submit-record", "Submit a record");
    submit.href = "community.html";
    article.append(submit);
    levelsContainer.append(article);
}

function showLoadError(error) {
    console.error("Could not load demonlist:", error);
    loaded = false;
    levelsContainer.setAttribute("aria-busy", "false");
    const state = element("div", "state");
    const retry = element("button", "", "Try again");
    retry.addEventListener("click", loadLevels);
    let message = "We couldn’t load the rankings. Please check your connection and try again.";
    if (error.code === "permission-denied") {
        message = "Firestore denied access to the levels collection. Check the read rules for /levels in project gd11-demonlist.";
    } else if (error.code === "unavailable") {
        message = "Firestore is temporarily unreachable. Check your connection and try again.";
    }
    state.append(element("h3", "", "The demonlist is unavailable"), element("p", "", message));
    if (error.code) state.append(element("p", "", `Error: ${error.code}`));
    state.append(retry);
    levelsContainer.replaceChildren(state);
    ranking.replaceChildren();
    count.textContent = "—";
    resultCount.textContent = "Rankings unavailable";
}

async function loadLevels() {
    const generation = ++loadGeneration;
    if (unsubscribeLevels) unsubscribeLevels();
    unsubscribeLevels = null;
    loaded = false;
    levelsContainer.setAttribute("aria-busy", "true");
    levelsContainer.replaceChildren(element("div", "state", "Loading demonlist…"));
    resultCount.textContent = "Loading rankings…";
    try {
        const [{ db }, { collection, onSnapshot }] = await Promise.all([
            import("./firebase.js"),
            import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")
        ]);
        if (generation !== loadGeneration) return;
        unsubscribeLevels = onSnapshot(collection(db, "levels"), snapshot => {
            if (generation !== loadGeneration) return;
            levels = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            const position = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : Infinity;
            levels.sort((a, b) => position(a.position) - position(b.position) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
            loaded = true;
            displayLevels();
            levelsContainer.setAttribute("aria-busy", "false");

        }, error => {
            if (generation === loadGeneration) showLoadError(error);
        });
    } catch (error) {
        if (generation === loadGeneration) showLoadError(error);
    }
}

search.addEventListener("input", displayLevels);
loadLevels();
(async () => {
    try {
        const [{ db }, { collection, query, where, onSnapshot }] = await Promise.all([
            import("./firebase.js"), import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")
        ]);
        const refresh = () => {
            displayLevels();
        };
        onSnapshot(query(collection(db, "records"), where("approved", "==", true)), snapshot => {
            records = snapshot.docs.map(item => item.data());
            recordsState = "ready";
            refresh();
        }, () => { recordsState = "error"; refresh(); });
    } catch { recordsState = "error"; displayLevels(); }
})();

