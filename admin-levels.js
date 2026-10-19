import { readRanking, writeRanking } from "./level-ranking.js";
import { subscribeAuth, requireStaff } from "./auth.js";
import { sortLevels } from "./list-model.js";
import { element, setBusy } from "./ui.js";
import { dataMessage } from "./messages.js";

const form = document.getElementById("level-management-form");
const select = form.elements.levelId;
const points = form.elements.points;
const nameInput = form.elements.levelName;
const positionInput = form.elements.position;
const difficultyInput = form.elements.difficulty;
const editableFields = ["name", "position", "difficulty", "points", "listType"];

function renderOptions(selected = select.value) {
    const placeholder = element("option", "", "Choose a level"); placeholder.value = "";
    select.replaceChildren(placeholder);
    for (const level of sortLevels(levels)) {
        const option = element("option", "", level.name || "Unnamed level"); option.value = level.id; select.append(option);
    }
    if (levels.some(level => level.id === selected)) select.value = selected;
}
const output = document.getElementById("level-management-status");
const victors = document.getElementById("managed-victors");
let generation = 0, request = 0, staffId = null, identity, levels = [];
const current = (client, turn) => turn === generation && staffId === client.user.uid && client.auth.currentUser?.uid === staffId;
const message = error => error.code ? dataMessage(error, "level management") : error.message;

subscribeAuth(state => {
    if (!state.ready) return;
    const key = `${state.user?.uid || ""}:${state.staff}:${state.owner}`;
    if (identity === key) return;
    identity = key; ++generation; ++request;
    staffId = state.staff ? state.user.uid : null;
    levels = []; form.reset(); select.replaceChildren(); victors.replaceChildren(); output.textContent = "";
    if (state.staff) load(generation);
});

async function load(turn) {
    const ticket = ++request;
    output.textContent = "Loading levels…";
    try {
        const client = await requireStaff();
        if (!current(client, turn)) return;
        const sdk = client.storeSDK;
        const snapshot = await sdk.getDocs(sdk.collection(client.db, "levels"));
        if (!current(client, turn) || ticket !== request) return;
        const selected = select.value;
        levels = sortLevels(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        renderOptions(selected);
        output.textContent = "";
        await showLevel(turn);
    } catch (error) { if (turn === generation && ticket === request) output.textContent = message(error); }
}

async function showLevel(turn) {
    const ticket = ++request, levelId = select.value;
    const level = levels.find(level => level.id === levelId);
    points.value = level?.points ?? "";
    nameInput.value = level?.name ?? "";
    positionInput.value = level?.position ?? "";
    difficultyInput.value = level?.difficulty ?? "";
    victors.replaceChildren();
    if (!level) return;
    victors.append(element("p", "muted", "Loading victors…"));
    try {
        const client = await requireStaff();
        if (!current(client, turn)) return;
        const sdk = client.storeSDK;
        const snapshot = await sdk.getDocs(sdk.query(sdk.collection(client.db, "records"), sdk.where("levelId", "==", levelId)));
        if (!current(client, turn) || ticket !== request) return;
        const groups = new Map();
        for (const doc of snapshot.docs) {
            const record = doc.data();
            if (record.approved !== true || Number(record.progress) !== 100 || !record.playerId) continue;
            if (!groups.has(record.playerId)) groups.set(record.playerId, { player: record.player || record.playerId, ids: [] });
            groups.get(record.playerId).ids.push(doc.id);
        }
        victors.replaceChildren();
        for (const [playerId, entry] of [...groups].sort((a, b) => a[1].player.localeCompare(b[1].player))) {
            const row = element("article", "management-row");
            const info = element("div", "management-info");
            info.append(element("h3", "", entry.player), element("p", "player-id muted", `Player ID: ${playerId}`));
            const button = element("button", "danger-button", "Remove victor"); button.type = "button";
            button.setAttribute("aria-label", `Remove victor ${entry.player}`);
            button.addEventListener("click", async () => {
                if (row.dataset.busy === "true" || !confirm(`Remove ${entry.player} as a victor of ${level.name}? Their completion will stop awarding points. The record and proof will be kept.`)) return;
                setBusy(row, true);
                try {
                    const fresh = await requireStaff();
                    if (!current(fresh, turn)) return;
                    if (entry.ids.length > 400) throw new Error("Too many duplicate records. Ask a database administrator to review this player.");
                    await sdk.runTransaction(fresh.db, async transaction => {
                        const refs = entry.ids.map(id => sdk.doc(fresh.db, "records", id));
                        const saved = await Promise.all(refs.map(ref => transaction.get(ref)));
                        if (!current(fresh, turn)) throw { code: "auth/requires-login" };
                        saved.forEach((doc, index) => {
                            if (!doc.exists()) return;
                            const data = doc.data();
                            if (data.playerId !== playerId || data.levelId !== levelId) throw new Error("A record changed. Refresh levels and try again.");
                            if (data.approved === true) transaction.update(refs[index], { approved: false });
                        });
                    });
                    if (current(fresh, turn)) {
                        output.textContent = `${entry.player} removed from ${level.name}. Their points will recalculate automatically.`;
                        if (select.value === levelId) await showLevel(turn);
                    }
                } catch (error) { if (turn === generation) output.textContent = message(error); }
                finally { setBusy(row, false); }
            });
            row.append(info, button); victors.append(row);
        }
        if (!groups.size) victors.append(element("p", "muted", "This level has no approved victors."));
    } catch (error) {
        if (turn === generation && ticket === request) { victors.replaceChildren(); output.textContent = message(error); }
    }
}
select.addEventListener("change", () => { output.textContent = ""; showLevel(generation); });
document.getElementById("refresh-levels").addEventListener("click", () => load(generation));
form.addEventListener("submit", async event => {
    event.preventDefault();
    if (form.dataset.busy === "true") return;
    const levelId = select.value, turn = generation;
    const level = levels.find(level => level.id === levelId);
    const changes = { listType: "main", name: nameInput.value.trim(), position: Number(positionInput.value), difficulty: difficultyInput.value.trim(), points: Number(points.value) };
    if (!level) { output.textContent = "Choose a level first."; return; }
    if (!changes.name || changes.name.length > 80) { output.textContent = "Enter a level name between 1 and 80 characters."; return; }
    if (!Number.isSafeInteger(changes.position) || changes.position < 1) { output.textContent = "Enter a positive whole-number position."; return; }
    if (changes.difficulty.length > 60) { output.textContent = "Keep difficulty to 60 characters or fewer, or leave it empty."; return; }
    if (!points.value.trim() || !Number.isFinite(changes.points) || changes.points < 0) { output.textContent = "Enter non-negative points."; return; }
    const before = Object.fromEntries(editableFields.map(field => [field, level[field]]));
    if (!confirm(`Save changes to ${level.name}?\nName: ${changes.name}\nPosition: ${changes.position} (affected levels shift automatically)\nDifficulty: ${changes.difficulty || "Not set"}\nPoints per victor: ${changes.points}`)) return;
    setBusy(form, true); output.textContent = "Saving level changes…";
    try {
        const client = await requireStaff(); if (!current(client, turn)) return;
        const sdk = client.storeSDK;
        const result = await sdk.runTransaction(client.db, async transaction => {
            const ranking = await readRanking(client, transaction);
            const ref = sdk.doc(client.db, "levels", levelId), saved = await transaction.get(ref);
            if (!saved.exists()) throw new Error("This level no longer exists. Refresh levels.");
            if (editableFields.some(field => saved.data()[field] !== before[field])) throw new Error("This level changed since you loaded it. Refresh levels and try again.");
            if (!current(client, turn)) throw { code: "auth/requires-login" };
            const updates = writeRanking(client, transaction, ranking, levelId, changes.position);
            transaction.update(ref, changes);
            const positions = new Map(updates.map(item => [item.id, item.position]));
            return ranking.levels.map(item => item.id === levelId ? { ...item, ...changes } : { ...item, position: positions.get(item.id) ?? item.position });
        });
        if (current(client, turn)) {
            levels = result;
            renderOptions();
            output.textContent = `${changes.name} saved at position ${changes.position}. Level details and leaderboard scores update automatically.`;
        }
    } catch (error) { if (turn === generation) output.textContent = message(error); }
    finally { setBusy(form, false); }
});
