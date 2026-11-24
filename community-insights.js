import { element } from "./ui.js";
export function communityInsights(levels, players) {
    const counts = new Map(levels.map(level => [level.id, 0]));
    for (const player of players) for (const id of new Set(player.completed.map(level => level.id))) if (counts.has(id)) counts.set(id, counts.get(id) + 1);
    const demons = levels.map(level => ({ ...level, completions: counts.get(level.id) }));
    return { demons, cleared: demons.filter(d => d.completions > 0).length, total: demons.reduce((sum,d) => sum+d.completions,0), active: players.filter(p => p.completed.length).length, countries: new Set(players.map(p => p.countryCode).filter(Boolean)).size };
}
export function renderInsights(root, levels, players) {
    const data = communityInsights(levels, players);
    root.replaceChildren(element("h2", "", "Community statistics"));
    const summary = element("div", "insight-grid");
    for (const [label,value] of [["Active victors",data.active],["Unique completions",data.total],["Demons cleared",data.cleared + "/" + levels.length],["Countries represented",data.countries]]) {
        const card = element("div"); card.append(element("strong","",value),element("span","muted",label)); summary.append(card);
    }
    root.append(summary,element("h3","","Most completed demons"));
    const list = element("ol","insight-ranking");
    const sorted = data.demons.filter(d => d.completions > 0).sort((a,b) => b.completions-a.completions || String(a.name).localeCompare(String(b.name))).slice(0,5);
    for (const demon of sorted) {
        const row=element("li"); const link=element("a","",demon.name || "Unnamed level"); link.href="index.html?level="+encodeURIComponent(demon.id);
        const meter=element("progress"); meter.max=sorted[0].completions; meter.value=demon.completions; meter.setAttribute("aria-label",demon.completions+" unique victors");
        row.append(link,meter,element("span","",demon.completions)); list.append(row);
    }
    root.append(sorted.length ? list : element("p","muted","No approved completions yet."));
    root.hidden=false;
}
