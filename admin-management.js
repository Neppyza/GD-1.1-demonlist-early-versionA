import { subscribeAuth, requireStaff, requireOwner } from "./auth.js";
import { buildStats } from "./stats-model.js";
import { validPlayerProfile } from "./player-profile.js";
import { completionKey } from "./completion-model.js";
import { element, externalLink, setBusy } from "./ui.js";
import { dataMessage } from "./messages.js";

const playerList = document.getElementById("admin-players");
const playerStatus = document.getElementById("player-management-status");
const completionQueue = document.getElementById("completion-queue");
const completionStatus = document.getElementById("completion-review-status");
const teamSection = document.getElementById("team-management");
const moderatorList = document.getElementById("moderator-list");
const moderatorForm = document.getElementById("moderator-form");
const moderatorStatus = document.getElementById("moderator-status");
let identity, staffId, generation = 0, isOwner = false;
let players = [];
let correctionsAvailable = false;
let playerLoad = 0, completionLoad = 0, teamLoad = 0;

function current(client, turn) {
    return turn === generation && staffId === client.user.uid && client.auth.currentUser?.uid === client.user.uid;
}
function errorText(error, context) { return error.code ? dataMessage(error, context) : error.message || `Could not load ${context}.`; }

subscribeAuth(state => {
    if (!state.ready) return;
    const key = `${state.user?.uid || ""}:${state.staff}:${state.owner}`;
    if (key === identity) return;
    identity = key; ++generation;
    staffId = state.staff ? state.user.uid : null;
    isOwner = state.owner;
    players = []; playerList.replaceChildren(); completionQueue.replaceChildren(); moderatorList.replaceChildren();
    for (const output of [playerStatus, completionStatus, moderatorStatus]) output.textContent = "";
    moderatorForm.reset(); moderatorForm.elements.playerId.replaceChildren(element("option", "", "Choose a player"));
    teamSection.hidden = !state.owner;
    document.getElementById("team-nav").hidden = !state.owner;
    if (!state.staff) return;
    loadPlayers(generation); loadCompletions(generation);
    if (state.owner) loadTeam(generation);
});

async function loadPlayers(turn) {
    const load = ++playerLoad;
    playerStatus.textContent = "Loading players…";
    try {
        const client = await requireStaff();
        if (!current(client, turn)) return;
        const sdk = client.storeSDK;
        const results = await Promise.all(["levels", "records", "players"].map(name => sdk.getDocs(sdk.collection(client.db, name))));
        let correctionSnapshot = null;
        try { correctionSnapshot = await sdk.getDocs(sdk.collection(client.db, "pointAdjustments")); }
        catch { /* Keep existing player management usable during a rules rollout. */ }
        if (!current(client, turn) || load !== playerLoad) return;
        correctionsAvailable = correctionSnapshot !== null;
        const adjustments = correctionSnapshot ? correctionSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) : [];
        const [levels, records, profiles] = results.map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        const ranked = new Map(buildStats(levels, records, profiles.map(profile => ({ ...profile, removed: false })), adjustments).map(player => [player.id, player]));
        for (const profile of profiles) {
            if (!ranked.has(profile.id)) ranked.set(profile.id, { id: profile.id, name: profile.displayName || profile.id, points: Math.max(0, adjustments.find(a => a.id === profile.id)?.delta || 0), pointCorrection: adjustments.find(a => a.id === profile.id)?.delta || 0, tags: [] });
            ranked.get(profile.id).removed = profile.removed === true;
        }
        players = [...ranked.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        renderPlayers(turn);
        playerStatus.textContent = `${players.length} players · ${players.filter(player => player.removed).length} removed${correctionsAvailable ? "" : " · Point corrections unavailable: completion-only scores shown. Refresh after Firebase permissions are deployed."}`;
    } catch (error) {
        if (turn === generation && load === playerLoad) { players = []; playerList.replaceChildren(); playerStatus.textContent = errorText(error, "players"); }
    }
}

function pointCorrectionForm(player, turn) {
    const form = element("form", "stack-form");
    const label = element("label", "", "Point correction (+ / −)");
    const input = element("input"); input.type = "number"; input.step = "any";
    input.min = "-1000000"; input.max = "1000000"; input.required = true;
    input.value = String(player.pointCorrection || 0);
    input.setAttribute("aria-label", `Point correction for ${player.name}`);
    label.append(input);
    const help = element("p", "muted", "Added to completion points. Use 0 to reset; the displayed total cannot fall below 0. Future completions still earn points.");
    const save = element("button", "secondary-button", "Save point correction"); save.type = "submit";
    const output = element("p", "form-status"); output.setAttribute("role", "status");
    form.append(label, help, save, output);
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (form.dataset.busy === "true" || !form.reportValidity()) return;
        const delta = Number(input.value);
        if (!Number.isFinite(delta) || Math.abs(delta) > 1000000) return;
        setBusy(form, true); input.disabled = true; output.textContent = "Saving correction…";
        try {
            const client = await requireStaff(); if (!current(client, turn)) return;
            const sdk = client.storeSDK;
            await sdk.runTransaction(client.db, async transaction => {
                const ref = sdk.doc(client.db, "pointAdjustments", player.id);
                const existing = await transaction.get(ref);
                const previous = existing.exists() ? existing.data().delta : 0;
                if (previous !== (player.pointCorrection || 0)) throw new Error("The correction changed. Refresh players before saving.");
                if (!current(client, turn)) throw { code: "auth/requires-login" };
                transaction.set(ref, { delta, updatedBy: client.user.uid, updatedAt: sdk.serverTimestamp() });
            });
            if (current(client, turn)) await loadPlayers(turn);
        } catch (error) { if (turn === generation) output.textContent = errorText(error, "point corrections"); }
        finally { setBusy(form, false); input.disabled = false; }
    });
    return form;
}

function renderPlayers(turn) {
    const term = document.getElementById("admin-player-search").value.trim().toLowerCase();
    playerList.replaceChildren();
    for (const player of players.filter(player => `${player.name} ${player.id}`.toLowerCase().includes(term))) {
        const row = element("article", "management-row");
        const info = element("div", "management-info");
        info.append(element("h3", "", player.name), element("p", "player-id muted", `Player ID: ${player.id}`), element("p", "muted", `${player.points} points · ${player.removed ? "Removed" : "Active"}`));
        const button = element("button", player.removed ? "secondary-button" : "danger-button", player.removed ? "Restore player" : "Remove player");
        button.type = "button";
        button.setAttribute("aria-label", `${player.removed ? "Restore" : "Remove"} player ${player.name}`);
        const output = element("p", "form-status"); output.setAttribute("role", "status");
        button.addEventListener("click", async () => {
            if (row.dataset.busy === "true") return;
            if (!player.removed && !confirm(`Remove ${player.name} from Players? Their completion history will be kept.`)) return;
            setBusy(row, true); output.textContent = "Saving…";
            try {
                const client = await requireStaff();
                if (!current(client, turn)) return;
                const sdk = client.storeSDK;
                await sdk.runTransaction(client.db, async transaction => {
                    const reference = sdk.doc(client.db, "players", player.id);
                    const snapshot = await transaction.get(reference);
                    if (!current(client, turn)) throw { code: "auth/requires-login" };
                    const removed = snapshot.exists() && snapshot.data().removed === true;
                    if (removed !== Boolean(player.removed)) throw new Error("This player changed. Refresh players before trying again.");
                    transaction.set(reference, { removed: !removed, moderatedBy: client.user.uid, moderatedAt: sdk.serverTimestamp() }, { merge: true });
                });
                if (current(client, turn)) { await loadPlayers(turn); if (isOwner) await loadTeam(turn); }
            } catch (error) { if (turn === generation) output.textContent = errorText(error, "this player"); }
            finally { setBusy(row, false); }
        });
        row.append(info, button, output);
        if (correctionsAvailable) row.append(pointCorrectionForm(player, turn));
        playerList.append(row);
    }
    if (!playerList.childElementCount) playerList.append(element("p", "muted", players.length ? "No matching players." : "There are no players yet."));
}
document.getElementById("admin-player-search").addEventListener("input", () => renderPlayers(generation));
document.getElementById("refresh-players").addEventListener("click", () => loadPlayers(generation));

async function loadCompletions(turn) {
    const load = ++completionLoad;
    completionStatus.textContent = "Loading completion submissions…";
    try {
        const client = await requireStaff();
        if (!current(client, turn)) return;
        const sdk = client.storeSDK;
        const [snapshot, levels] = await Promise.all([
            sdk.getDocs(sdk.query(sdk.collection(client.db, "completionSubmissions"), sdk.where("status", "==", "pending"))),
            sdk.getDocs(sdk.collection(client.db, "levels"))
        ]);
        if (!current(client, turn) || load !== completionLoad) return;
        const names = new Map(levels.docs.map(doc => [doc.id, doc.data().name || "Unnamed level"]));
        completionQueue.replaceChildren();
        for (const doc of snapshot.docs) completionQueue.append(renderCompletion(doc.id, doc.data(), names.get(doc.data().levelId), turn));
        if (snapshot.empty) completionQueue.append(element("p", "muted", "There are no pending completions."));
        completionStatus.textContent = `${snapshot.docs.length} pending completions`;
    } catch (error) {
        if (turn === generation && load === completionLoad) { completionQueue.replaceChildren(); completionStatus.textContent = errorText(error, "completion submissions"); }
    }
}

function renderCompletion(id, data, levelName, turn) {
    const card = element("article", "review-item completion-review-item");
    card.append(element("h3", "", `${data.player || "Unknown player"} · ${levelName || "Level unavailable"}`), element("p", "player-id muted", `Player ID: ${data.ownerUid}`));
    const proof = externalLink(data.proofUrl, "Watch 100% proof ↗"); if (proof) card.append(proof);
    if (data.notes) card.append(element("p", "", data.notes));
    const form = element("form", "stack-form");
    const label = element("label", "check-row");
    const checkbox = element("input"); checkbox.type = "checkbox"; checkbox.name = "checkedProof"; checkbox.required = true;
    label.append(checkbox, element("span", "", "I watched and verified the 100% completion proof."));
    const actions = element("div", "auth-actions");
    const accept = element("button", "", "Accept completion"); accept.type = "submit"; accept.disabled = !levelName || !proof;
    const reject = element("button", "secondary-button", "Reject completion"); reject.type = "button";
    const output = element("p", "form-status"); output.setAttribute("role", "status");
    actions.append(accept, reject); form.append(label, actions, output); card.append(form);
    async function review(approved) {
        if (form.dataset.busy === "true") return;
        if (approved && (!checkbox.checked || !levelName || !proof)) { output.textContent = "Check the level and completion proof first."; return; }
        setBusy(form, true); output.textContent = "Saving the review…";
        try {
            const client = await requireStaff(); if (!current(client, turn)) return;
            const sdk = client.storeSDK;
            await sdk.runTransaction(client.db, async transaction => {
                const reference = sdk.doc(client.db, "completionSubmissions", id);
                const snapshot = await transaction.get(reference);
                if (!snapshot.exists() || snapshot.data().status !== "pending") throw new Error("This completion was already reviewed. Refresh completions.");
                const saved = snapshot.data();
                const update = { status: approved ? "approved" : "rejected", reviewedBy: client.user.uid, reviewedAt: sdk.serverTimestamp() };
                if (approved) {
                    const key = await completionKey(saved.ownerUid, saved.levelId);
                    const record = sdk.doc(client.db, "records", key);
                    const [existing, level] = await Promise.all([transaction.get(record), transaction.get(sdk.doc(client.db, "levels", saved.levelId))]);
                    if (!level.exists()) throw new Error("This level no longer exists.");
                    if (!current(client, turn)) throw { code: "auth/requires-login" };
                    if (!existing.exists() || existing.data().approved !== true) transaction.set(record, { player: saved.player, playerId: saved.ownerUid, levelId: saved.levelId, proofUrl: saved.proofUrl, progress: 100, approved: true });
                    update.recordId = key;
                }
                if (!current(client, turn)) throw { code: "auth/requires-login" };
                transaction.update(reference, update);
            });
            if (current(client, turn)) { await loadCompletions(turn); await loadPlayers(turn); }
        } catch (error) { if (turn === generation) output.textContent = errorText(error, "this completion"); }
        finally { setBusy(form, false); accept.disabled = !levelName || !proof; }
    }
    form.addEventListener("submit", event => { event.preventDefault(); review(true); });
    reject.addEventListener("click", () => review(false));
    return card;
}
document.getElementById("refresh-completions").addEventListener("click", () => loadCompletions(generation));

async function loadTeam(turn) {
    const load = ++teamLoad;
    try {
        const client = await requireOwner(); if (!current(client, turn)) return;
        const sdk = client.storeSDK;
        const [team, directory] = await Promise.all([sdk.getDocs(sdk.collection(client.db, "team")), sdk.getDocs(sdk.collection(client.db, "players"))]);
        if (!current(client, turn) || load !== teamLoad) return;
        const activeIds = new Set(team.docs.filter(doc => doc.data().active === true).map(doc => doc.id));
        const select = moderatorForm.elements.playerId; const selected = select.value;
        select.replaceChildren(); const placeholder = element("option", "", "Choose a player"); placeholder.value = ""; select.append(placeholder);
        const profiles = directory.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(profile => validPlayerProfile(profile) && profile.id !== client.user.uid && !activeIds.has(profile.id)).sort((a, b) => a.displayName.localeCompare(b.displayName));
        for (const profile of profiles) { const option = element("option", "", `${profile.displayName} · ${profile.id}`); option.value = profile.id; select.append(option); }
        if (profiles.some(profile => profile.id === selected)) select.value = selected;
        moderatorList.replaceChildren();
        for (const doc of team.docs.filter(doc => doc.data().active === true)) {
            const data = doc.data(); const row = element("article", "management-row moderator-row"); const info = element("div", "management-info");
            info.append(element("h3", "", data.displayName), element("p", "player-id muted", `Player ID: ${doc.id}`), element("p", "muted", "Moderator"));
            const button = element("button", "danger-button", "Remove moderator"); button.type = "button"; button.setAttribute("aria-label", `Remove moderator ${data.displayName}`);
            button.addEventListener("click", async () => {
                if (row.dataset.busy === "true" || !confirm(`Remove moderator access for ${data.displayName} (${doc.id})?`)) return;
                setBusy(row, true);
                try {
                    const fresh = await requireOwner(); if (!current(fresh, turn)) return;
                    await fresh.storeSDK.setDoc(fresh.storeSDK.doc(fresh.db, "team", doc.id), { role: "moderator", active: false, displayName: data.displayName, updatedBy: fresh.user.uid, updatedAt: fresh.storeSDK.serverTimestamp() });
                    if (current(fresh, turn)) { moderatorStatus.textContent = `${data.displayName} no longer has moderator access.`; await loadTeam(turn); }
                } catch (error) { if (turn === generation) moderatorStatus.textContent = errorText(error, "moderator access"); }
                finally { setBusy(row, false); }
            });
            row.append(info, button); moderatorList.append(row);
        }
        if (!moderatorList.childElementCount) moderatorList.append(element("p", "muted", "You have no moderators yet."));
    } catch (error) { if (turn === generation && load === teamLoad) moderatorStatus.textContent = errorText(error, "the moderator team"); }
}
moderatorForm.addEventListener("submit", async event => {
    event.preventDefault(); if (moderatorForm.dataset.busy === "true") return;
    const playerId = moderatorForm.elements.playerId.value; if (!playerId) return;
    const turn = generation; setBusy(moderatorForm, true); moderatorStatus.textContent = "Adding moderator…";
    try {
        const client = await requireOwner(); if (!current(client, turn)) return;
        const sdk = client.storeSDK;
        const profile = await sdk.getDoc(sdk.doc(client.db, "players", playerId));
        if (!profile.exists() || !validPlayerProfile(profile.data()) || playerId === client.user.uid) throw new Error("Choose an active registered teammate.");
        if (!current(client, turn)) throw { code: "auth/requires-login" };
        await sdk.setDoc(sdk.doc(client.db, "team", playerId), { role: "moderator", active: true, displayName: profile.data().displayName, updatedBy: client.user.uid, updatedAt: sdk.serverTimestamp() });
        if (current(client, turn)) { moderatorStatus.textContent = "Moderator added. They can open Admin and retry the access check."; moderatorForm.reset(); await loadTeam(turn); }
    } catch (error) { if (turn === generation) moderatorStatus.textContent = errorText(error, "moderator access"); }
    finally { setBusy(moderatorForm, false); }
});
document.getElementById("refresh-team").addEventListener("click", () => loadTeam(generation));
