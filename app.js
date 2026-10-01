const levelsContainer = document.getElementById("levels");
const search = document.getElementById("search");
const ranking = document.getElementById("ranking");
const count = document.getElementById("level-count");
const resultCount = document.getElementById("result-count");
const dialog = document.getElementById("level-dialog");
let levels = [];
let loaded = false;

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
    for (const [label, value] of [["Creator", level.creator], ["Verifier", level.verifier], ["Points", level.points], ["Difficulty", level.difficulty]]) {
        const group = element("div");
        group.append(element("dt", "", label), element("dd", "", value ?? "—"));
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

async function loadLevels() {
    loaded = false;
    levelsContainer.setAttribute("aria-busy", "true");
    levelsContainer.replaceChildren(element("div", "state", "Loading demonlist…"));
    resultCount.textContent = "Loading rankings…";
    try {
        // Import inside the try block so connection and initialization errors have a retry state.
        const [{ db }, { collection, getDocs }] = await Promise.all([
            import("./firebase.js"),
            import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")
        ]);
        const snapshot = await getDocs(collection(db, "levels"));
        levels = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        const position = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : Infinity;
        levels.sort((a, b) => position(a.position) - position(b.position) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
        loaded = true;
        displayLevels();
        const selected = new URLSearchParams(location.search).get("level");
        if (selected) showDetails(selected);
    } catch (error) {
        console.error("Could not load demonlist:", error);
        const state = element("div", "state");
        const retry = element("button", "", "Try again");
        retry.addEventListener("click", loadLevels);
        state.append(element("h3", "", "The demonlist is unavailable"), element("p", "", "We couldn’t load the rankings. Please check your connection and try again."), retry);
        levelsContainer.replaceChildren(state);
        resultCount.textContent = "Rankings unavailable";
    } finally {
        levelsContainer.setAttribute("aria-busy", "false");
    }
}

search.addEventListener("input", displayLevels);
document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
loadLevels();
