import { getCountry } from "./countries.js";

export function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
}

export function countryIndicator(code) {
    const country = getCountry(code);
    const badge = element("span", "player-country");
    if (!country) { badge.append(element("span", "muted", "Not set")); return badge; }
    const flag = element("img");
    flag.src = `flags/${country.code.toLowerCase()}.svg`;
    flag.alt = "";
    flag.width = 24; flag.height = 18;
    flag.loading = "lazy"; flag.decoding = "async";
    flag.addEventListener("error", () => { flag.hidden = true; }, { once: true });
    badge.append(flag, element("span", "", country.name));
    return badge;
}

export function safeURL(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
        const url = new URL(value, location.href);
        return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
}

export function externalLink(value, label) {
    const href = safeURL(value);
    if (!href) return null;
    const link = element("a", "", label);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
}

export function thumbnail(level) {
    const box = element("div", "thumbnail");
    const fallback = () => box.replaceChildren(element("span", "", "No preview"));
    const url = safeURL(level.thumbnail);
    if (!url) fallback();
    else {
        const img = element("img");
        img.src = url;
        img.alt = `${String(level.name || "Level").trim()} preview`;
        img.loading = "lazy";
        img.addEventListener("error", fallback, { once: true });
        box.append(img);
    }
    return box;
}

export function stateRow(body, columns, title, message, retry) {
    const row = element("tr");
    const cell = element("td", "table-state");
    cell.colSpan = columns;
    cell.append(element("strong", "", title));
    if (message) cell.append(element("p", "", message));
    if (retry) {
        const button = element("button", "secondary-button", "Try again");
        button.type = "button";
        button.addEventListener("click", retry);
        cell.append(button);
    }
    row.append(cell);
    body.replaceChildren(row);
}

export function setBusy(form, busy) {
    form.dataset.busy = String(busy);
    form.setAttribute("aria-busy", String(busy));
    for (const button of form.querySelectorAll("button")) button.disabled = busy;
}
