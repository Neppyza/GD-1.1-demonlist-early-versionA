import { placementPreview, queueMatches } from "./admin-model.js";
import { element } from "./ui.js";

export function renderPlacementPreview(node, levels, id, target, type) {
    node.replaceChildren();
    if (!Number.isSafeInteger(target) || target < 1) { node.textContent = "Enter a valid placement to preview changes."; return; }
    try {
        const changes = placementPreview(levels, id, target, type);
        node.append(element("strong", "", changes.length ? `${changes.length} other level(s) will move` : "No other placements will change"));
        if (changes.length > 450) node.append(element("p", "muted", "This exceeds the safe transaction limit."));
        if (changes.length) {
            const list = element("ul");
            for (const change of changes.slice(0, 6)) list.append(element("li", "", `${change.name} · ${change.list}: #${change.from} → #${change.to}`));
            node.append(list);
            if (changes.length > 6) node.append(element("p", "muted", `And ${changes.length - 6} more.`));
        }
        node.append(element("small", "muted", "Preview uses the last loaded rankings. Saving checks the latest database state."));
    } catch (error) { node.textContent = error.message; }
}

export function filterQueue(container, search, order, count) {
    const cards = [...container.querySelectorAll(".review-item[data-review-search]")];
    let visible = 0;
    for (const card of cards) {
        card.hidden = !queueMatches([card.dataset.reviewSearch], search.value);
        if (!card.hidden) visible++;
    }
    const sorted = [...cards].sort((a,b) => {
        const first = Number(a.dataset.reviewTime), second = Number(b.dataset.reviewTime);
        if (!first || !second) return first ? -1 : second ? 1 : 0;
        return order.value === "newest" ? second-first : first-second;
    });
    if (sorted.some((card,i) => card !== cards[i])) for (const card of sorted) container.append(card);
    count.textContent = cards.length ? `${visible} of ${cards.length} pending · ${visible ? "shown" : "no matches"}` : "";
}
