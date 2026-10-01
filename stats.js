import { buildStats } from "./stats-model.js";
const status = document.getElementById("stats-status");
const rows = document.getElementById("players");
const search = document.getElementById("player-search");
let levels = [], records = [], levelsReady = false, recordsReady = false, failed = false;
const text = (tag,value) => { const el = document.createElement(tag); el.textContent = String(value); return el; };
function render() {
    if (failed || !levelsReady || !recordsReady) return;
    const all = buildStats(levels,records);
    const filtered = all.map((player,index) => ({...player, rank:index+1})).filter(player => player.name.toLowerCase().includes(search.value.toLowerCase().trim()));
    rows.replaceChildren();
    document.getElementById("player-details").replaceChildren();
    status.textContent = all.length ? `${filtered.length} of ${all.length} players` : "No approved completions yet.";
    document.getElementById("stats-summary").textContent = `${all.length} players · ${all.reduce((sum,p)=>sum+p.completed.length,0)} completions`;
    for (const player of filtered) {
        const row = document.createElement("tr"), name = document.createElement("td"), button = text("button",player.name);
        button.addEventListener("click",()=>{
            const detail=document.getElementById("player-details"), list=document.createElement("ul");
            player.completed.forEach(level=>list.append(text("li",`${level.name || "Unnamed Level"} — ${level.points ?? 0} points`)));
            detail.replaceChildren(text("h2",player.name),list);
        });
        name.append(button);
        row.append(text("td",player.rank),name,text("td",player.points.toLocaleString(undefined,{maximumFractionDigits:2})),text("td",player.completed.length),text("td",player.completed[0]?.name || "—"));
        rows.append(row);
    }
    if(all.length && !filtered.length) status.textContent="No players match your search.";
}
search.addEventListener("input",render);
function error(err) { failed=true; rows.replaceChildren(); document.getElementById("stats-summary").replaceChildren(); document.getElementById("player-details").replaceChildren(); status.textContent=`Stats unavailable (${err.code || "connection error"}). Check Firestore read permissions and reload.`; }
try {
    const [{db},{collection,query,where,onSnapshot}] = await Promise.all([import("./firebase.js"),import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")]);
    onSnapshot(collection(db,"levels"),snapshot=>{levels=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));levelsReady=true;render();},error);
    onSnapshot(query(collection(db,"records"),where("approved","==",true)),snapshot=>{records=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));recordsReady=true;render();},error);
} catch(err) { error(err); }
