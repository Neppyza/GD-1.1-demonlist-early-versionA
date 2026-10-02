const levelsContainer = document.getElementById("levels");
const search = document.getElementById("search");
const ranking = document.getElementById("ranking");
const count = document.getElementById("level-count");
const resultCount = document.getElementById("result-count");
const dialog = document.getElementById("level-dialog");
let levels = [];
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
    for (const [label, value] of [["Creator", level.creator], ["Verifier", level.verifier], ["Points", level.points], ["Difficulty", level.difficulty], ["Level link", level.levelUrl], ["Video proof", level.proofUrl]]) {
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
    const level = levels.find(item => item.id === id);
    if (!level) return;
    const detail = document.getElementById("level-detail");
    const title = element("h2", "", level.name || "Unnamed Level");
    title.id = "detail-title";
    detail.replaceChildren(element("p", "eyebrow", `DEMONLIST · #${level.position ?? "—"}`), title, thumbnail(level), metadata(level));
    if (level.description) detail.append(element("p", "", level.description));
    if (!dialog.open) dialog.showModal();
}

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
    const filtered = levels.filter(level => [level.name, level.creator, level.verifier].some(value => String(value ?? "").toLowerCase().includes(query)));
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
    filtered.forEach(level => {
        const rank = level.position ?? "—";
        const name = level.name || "Unnamed Level";
        const card = element("article", "level-card");
        const heading = element("div", "level-heading");
        const titleGroup = element("div");
        const title = element("h3");
        const link = element("a", "", name);
        openLink(link, level.id);
        title.append(link);
        titleGroup.append(title, element("p", "", `by ${level.creator || "Unknown creator"}`));
        heading.append(element("span", "position", `#${rank}`), titleGroup);
        const body = element("div", "level-body");
        body.append(thumbnail(level), metadata(level));
        const detailLink = element("a", "detail-link", "View level details →");
        detailLink.setAttribute("aria-label", `View details for ${name}`);
        openLink(detailLink, level.id);
        card.append(heading, body, detailLink);
        levelsContainer.append(card);
        const item = element("li");
        const rankLink = element("a", "", `#${rank} — ${name}`);
        rankLink.append(element("small", "", level.creator || "Unknown creator"));
        openLink(rankLink, level.id);
        item.append(rankLink);
        ranking.append(item);
    });
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
        let firstSnapshot = true;
        unsubscribeLevels = onSnapshot(collection(db, "levels"), snapshot => {
            if (generation !== loadGeneration) return;
            levels = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            const position = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : Infinity;
            levels.sort((a, b) => position(a.position) - position(b.position) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
            loaded = true;
            displayLevels();
            levelsContainer.setAttribute("aria-busy", "false");
            if (firstSnapshot) {
                const selected = new URLSearchParams(location.search).get("level");
                if (selected) showDetails(selected);
                firstSnapshot = false;
            }
        }, error => {
            if (generation === loadGeneration) showLoadError(error);
        });
    } catch (error) {
        if (generation === loadGeneration) showLoadError(error);
    }
}

search.addEventListener("input", displayLevels);
document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
loadLevels();
