import { rankingHealth, submissionTime } from "./admin-model.js";
import { renderPlacementPreview, filterQueue } from "./admin-workspace.js";
import { positionHistory } from "./rank-history.js";
import { readRanking, writeRanking } from "./level-ranking.js";
import { subscribeAuth, requireStaff, refreshStaffAccess } from "./auth.js";
import { completionKey } from "./completion-model.js";
import { dataMessage } from "./messages.js";
import { sortLevels, levelList, listLabel, listTypes } from "./list-model.js";
import { element, externalLink, safeURL, setBusy } from "./ui.js";

const tools = document.getElementById("staff-tools");
const queue = document.getElementById("review-queue");
const status = document.getElementById("staff-status");
const select = document.getElementById("victor-level");
let identity;
let generation = 0;
let staffId = null;
let suggestedRanks = {main:1,legacy:1,platformer:1};
let loadedLevels = [];
const directForm = document.getElementById("direct-level-form");
const directStatus = document.getElementById("direct-level-status");
const health = document.getElementById("ranking-health");
const healthStatus = document.getElementById("ranking-health-status");
const queueSearch = document.getElementById("level-queue-search");
const queueOrder = document.getElementById("level-queue-order");
const queueCount = document.getElementById("level-queue-count");
const filterSubmissions = () => filterQueue(queue, queueSearch, queueOrder, queueCount);
queueSearch.addEventListener("input", filterSubmissions);
queueOrder.addEventListener("change", filterSubmissions);
function directPreview() {
    renderPlacementPreview(document.getElementById("direct-preview"), loadedLevels, "", Number(directForm.elements.position.value), directForm.elements.listType.value);
}
function updateOverview(levels) {
    loadedLevels = levels;
    suggestedRanks = Object.fromEntries(listTypes.map(type => [type, levels.reduce((max,level) => {
        const rank = Number(level.position);
        return levelList(level) === type && level.rankingApplied !== false && Number.isSafeInteger(rank) && rank > max ? rank : max;
    },0)+1]));
    health.replaceChildren();
    for (const item of rankingHealth(levels)) {
        const box = element("div", "staff-metric");
        box.append(element("span", "muted", listLabel(item.type)), element("strong", "", item.count), element("span", "muted", "Published levels"));
        if (item.pending) box.append(element("p", "", `${item.pending} pending console insert(s)`));
        if (item.invalid) box.append(element("p", "", `${item.invalid} invalid/unranked position(s)`));
        if (item.duplicates.length) box.append(element("p", "", `Duplicate ranks: ${item.duplicates.slice(0,8).map(rank => "#" + rank).join(", ")}${item.duplicates.length > 8 ? "…" : ""}`));
        if (item.gaps) box.append(element("p", "", `${item.gaps} missing rank(s)`));
        if (!item.pending && !item.invalid && !item.duplicates.length && !item.gaps) box.append(element("p", "muted", "No placement issues detected"));
        health.append(box);
    }
    healthStatus.textContent = "Last refreshed " + new Date().toLocaleTimeString();
    if (!directForm.elements.position.value) directForm.elements.position.value = String(suggestedRanks[directForm.elements.listType.value]);
    directPreview();
    for (const input of queue.querySelectorAll("input[name=position]")) input.dispatchEvent(new Event("input"));
}
directForm.elements.listType.addEventListener("change", () => {
    directForm.elements.position.value = String(suggestedRanks[directForm.elements.listType.value]); directPreview();
});
directForm.elements.position.addEventListener("input", directPreview);
document.getElementById("refresh-overview").addEventListener("click", async () => {
    const turn = generation;
    healthStatus.textContent = "Refreshing rankings…";
    try {
        const client = await requireStaff(), sdk = client.storeSDK;
        const snapshot = await sdk.getDocs(sdk.collection(client.db, "levels"));
        if (turn === generation && client.user.uid === staffId) updateOverview(snapshot.docs.map(doc => ({...doc.data(),id:doc.id})));
    } catch (error) { if (turn === generation) healthStatus.textContent = dataMessage(error, "ranking overview"); }
});

subscribeAuth(state => {
    if (!state.ready) return;
    const key = `${state.user?.uid || ""}:${state.staff}:${state.owner}:${state.role || ""}`;
    if (identity === key) return;
    identity = key;
    ++generation;
    staffId = state.staff ? state.user.uid : null;
    tools.hidden = true;
    queue.replaceChildren();
    queueSearch.value = ""; queueCount.textContent = ""; health.replaceChildren(); healthStatus.textContent = ""; loadedLevels = [];
    directForm.reset(); directStatus.textContent = ""; document.getElementById("direct-preview").replaceChildren();
    select.replaceChildren();
    document.getElementById("victor-form").reset();
    document.getElementById("victor-status").textContent = "";
    document.getElementById("staff-uid").textContent = state.user ? `Firebase UID: ${state.user.uid}` : "";
    if (!state.user) { status.textContent = "Sign in with your approved staff Google account."; return; }
    if (!state.staff) { status.textContent = "This account does not have administrator access."; return; }
    loadStaff(generation);
});

async function loadStaff(turn) {
    status.textContent = "Checking administrator permissions…";
    try {
        const client = await requireStaff();
        if (turn !== generation || client.user.uid !== staffId) return;
        const sdk = client.storeSDK;
        const results = await Promise.all([
            sdk.getDocs(sdk.collection(client.db, "levels")),
            sdk.getDocs(sdk.query(sdk.collection(client.db, "submissions"), sdk.where("status", "==", "pending")))
        ]);
        if (turn !== generation || client.auth.currentUser?.uid !== client.user.uid) return;
        tools.hidden = false;
        select.replaceChildren();
        const placeholder = element("option", "", "Choose a level");
        placeholder.value = "";
        select.append(placeholder);
        for (const level of sortLevels(results[0].docs.map(doc => ({ ...doc.data(), id: doc.id })))) {
            const option = element("option", "", `${level.name || "Unnamed level"} · ${listLabel(levelList(level))}`);
            option.value = level.id;
            select.append(option);
        }
        updateOverview(results[0].docs.map(doc => ({...doc.data(), id:doc.id})));
        queue.replaceChildren();
        for (const doc of results[1].docs) queue.append(renderSubmission(doc.id, doc.data(), turn));
        if (results[1].empty) queue.append(element("p", "muted", "There are no pending submissions."));
        filterSubmissions();
        status.textContent = `${client.role || "Staff"} access verified.`;
    } catch (error) {
        if (turn === generation) {
            tools.hidden = true;
            status.textContent = dataMessage(error, "the staff review queue");
        }
    }
}
document.getElementById("refresh-queue").addEventListener("click", () => loadStaff(++generation));
document.getElementById("staff-retry").addEventListener("click", async () => {
    const before = identity;
    status.textContent = "Refreshing your administrator access…";
    try {
        await refreshStaffAccess();
        if (before === identity) {
            if (staffId) await loadStaff(++generation);
            else status.textContent = "This account does not have administrator access.";
        }
    } catch (error) { status.textContent = dataMessage(error, "administrator access"); }
});

function renderSubmission(id, data, turn) {
    const card = element("article", "review-item");
    card.dataset.reviewSearch = [data.levelName,data.creator,data.verifier,data.submittedBy].join(" ");
    card.dataset.reviewTime = String(submissionTime(data));
    card.append(element("h3", "", data.levelName || "Untitled level"), element("p", "muted", `Submitted by ${data.submittedBy || "—"} · Creator: ${data.creator || "—"} · Verifier: ${data.verifier || "—"}`));
    const links = element("div", "detail-actions");
    for (const [url, label] of [[data.levelUrl, "Open level ↗"], [data.proofUrl, "Watch proof ↗"]]) {
        const link = externalLink(url, label);
        if (link) links.append(link);
    }
    card.append(links);
    if (data.notes) card.append(element("p", "", data.notes));
    const form = element("form", "review-form");
    for (const [name, label, type] of [["position", "Position", "number"], ["points", "Points", "number"], ["difficulty", "Difficulty (optional)", "text"], ["thumbnail", "Thumbnail URL (optional)", "url"]]) {
        const group = element("label", "", label);
        const input = element("input");
        input.name = name; input.type = type;
        if (type === "number") { input.value = name === "position" ? String(suggestedRanks.main) : "0"; input.min = name === "position" ? "1" : "0"; input.step = name === "position" ? "1" : "0.01"; input.required = true; }
        else if (type === "url") { input.maxLength = 2000; input.placeholder = "https://example.com/thumbnail.jpg"; }
        else input.maxLength = 60;
        group.append(input);
        if (name === "position") group.append(element("small", "muted", "Active rankings shift within the selected list. Legacy positions are historical and do not shift."));
        form.append(group);
    }
    const approve = element("button", "", "Approve and publish");
    approve.type = "submit";
    const reject = element("button", "secondary-button", "Reject");
    reject.type = "button";
    const output = element("p", "form-status");
    output.setAttribute("role", "status");
    const listGroup=element("label","","Ranking list");
    const listSelect=element("select"); listSelect.name="listType";
    for(const [value,label] of [["main","Main List"],["legacy","Legacy List"],["platformer","Platformer List"]]) {const option=element("option","",label);option.value=value;listSelect.append(option);}
    listGroup.append(listSelect);form.prepend(listGroup);form.append(approve,reject,output);
    const preview = element("div", "staff-preview staff-wide");
    preview.setAttribute("aria-live","polite");
    form.insertBefore(preview, approve);
    const updatePreview = () => renderPlacementPreview(preview, loadedLevels, "", Number(form.elements.position.value), listSelect.value);
    listSelect.addEventListener("change",()=>{form.elements.position.value=String(suggestedRanks[listSelect.value]);updatePreview();});
    form.elements.position.addEventListener("input", updatePreview);
    updatePreview();
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (form.dataset.busy === "true") return;
        const rank = Number(form.elements.position.value);
        const type = form.elements.listType.value;
        const points = Number(form.elements.points.value);
        const difficulty = form.elements.difficulty.value.trim();
        const thumbnailURL = form.elements.thumbnail.value.trim();
        if (!Number.isSafeInteger(rank) || rank < 1 || !Number.isFinite(points) || points < 0) { output.textContent = "Enter a positive whole-number placement and non-negative points."; return; }
        if (difficulty.length > 60) { output.textContent = "Keep difficulty to 60 characters or fewer."; return; }
        if (thumbnailURL && (thumbnailURL.length > 2000 || !thumbnailURL.startsWith("https://") || !safeURL(thumbnailURL))) { output.textContent = "Use a public HTTPS image link for the thumbnail, or leave it empty."; return; }
        setBusy(form, true);
        output.textContent = "Checking access and publishing…";
        try {
            const client = await requireStaff();
            if (turn !== generation || client.user.uid !== staffId) throw { code: "auth/requires-login" };
            const sdk = client.storeSDK;
            const submission = sdk.doc(client.db, "submissions", id);
            const level = sdk.doc(sdk.collection(client.db, "levels"));
            await sdk.runTransaction(client.db, async transaction => {
                const ranking = await readRanking(client, transaction);
                const snapshot = await transaction.get(submission);
                if (!snapshot.exists() || snapshot.data().status !== "pending") throw new Error("This submission has already been reviewed. Refresh the queue.");
                const saved = snapshot.data();
                for (const [field, label, limit] of [["levelName","Level name",80],["creator","Creator",60],["verifier","Verifier",60]]) {
                    if (typeof saved[field] !== "string" || !saved[field].trim() || saved[field].length > limit) throw new Error(`${label} is missing or invalid in this submission. Ask the submitter to correct it.`);
                }
                for (const field of ["levelUrl","proofUrl"]) if (typeof saved[field] !== "string" || !saved[field].startsWith("https://") || saved[field].length > 2000 || !safeURL(saved[field])) throw new Error(`Invalid ${field} in submission; a public HTTPS link is required.`);
                const entry = { rankingApplied: true, listType: type, name: saved.levelName, position: rank, points, creator: saved.creator, verifier: saved.verifier, levelUrl: saved.levelUrl, proofUrl: saved.proofUrl };
                if (difficulty) entry.difficulty = difficulty;
                if (thumbnailURL) entry.thumbnail = thumbnailURL;
                if (turn !== generation || client.auth.currentUser?.uid !== staffId) throw { code: "auth/requires-login" };
                writeRanking(client, transaction, ranking, level.id, rank, entry.listType);
                transaction.set(level, { ...entry, positionHistory: positionHistory(null, rank) });
                transaction.update(submission, { status: "approved", levelId: level.id, reviewedBy: client.user.uid, reviewedAt: sdk.serverTimestamp() });
            });
            if (turn === generation) { await loadStaff(turn); if (turn === generation && !tools.hidden) status.textContent = "Level published successfully."; }
        } catch (error) {
            if (turn === generation) output.textContent = error.code === "permission-denied"
                ? "Publishing was denied. Ask the Firebase project administrator to deploy the current firestore.rules, including rankingState access and legacy rank updates. Your submission is still pending."
                : error.code ? dataMessage(error, "this level") : error.message || "Could not publish this level.";
        } finally { setBusy(form, false); }
    });
    reject.addEventListener("click", async () => {
        if (form.dataset.busy === "true" || !confirm(`Reject ${data.levelName || "this submission"}?`)) return;
        setBusy(form, true);
        output.textContent = "Checking access and rejecting…";
        try {
            const client = await requireStaff();
            if (turn !== generation || client.user.uid !== staffId) throw { code: "auth/requires-login" };
            const sdk = client.storeSDK;
            const reference = sdk.doc(client.db, "submissions", id);
            await sdk.runTransaction(client.db, async transaction => {
                const snapshot = await transaction.get(reference);
                if (!snapshot.exists() || snapshot.data().status !== "pending") throw new Error("This submission has already been reviewed. Refresh the queue.");
                transaction.update(reference, { status: "rejected", reviewedBy: client.user.uid, reviewedAt: sdk.serverTimestamp() });
            });
            if (turn === generation) await loadStaff(turn);
        } catch (error) {
            if (turn === generation) output.textContent = error.code ? dataMessage(error, "this submission") : error.message || "Could not reject this submission.";
        } finally { setBusy(form, false); }
    });
    card.append(form);
    return card;
}

document.getElementById("victor-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.busy === "true") return;
    const output = document.getElementById("victor-status");
    const player = form.elements.player.value.trim();
    const playerId = form.elements.playerId.value.trim();
    const levelId = form.elements.levelId.value;
    if (!player || player.length > 60 || !playerId || playerId.length > 100 || !levelId || !form.elements.checkedProof.checked) { output.textContent = "Complete the player and level fields and confirm the proof check."; return; }
    const turn = generation;
    setBusy(form, true);
    output.textContent = "Checking access and saving the completion…";
    try {
        const client = await requireStaff();
        if (turn !== generation || client.user.uid !== staffId) throw { code: "auth/requires-login" };
        const key = await completionKey(playerId, levelId);
        // Existing stable pair key and record fields are preserved.
        const sdk = client.storeSDK;
        await sdk.runTransaction(client.db, async transaction => {
            const reference = sdk.doc(client.db, "records", key);
            const existing = await transaction.get(reference);
            if (existing.exists() && existing.data().approved === true) throw new Error("This completion is already approved.");
            transaction.set(reference, { player, playerId, levelId, progress: 100, approved: true }, { merge: true });
        });
        if (turn === generation) { form.reset(); output.textContent = "Completion approved. It now appears in Records and Players."; }
    } catch (error) {
        if (turn === generation) output.textContent = error.code ? dataMessage(error, "this completion") : error.message;
    } finally { setBusy(form, false); }
});

directForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (directForm.dataset.busy === "true") return;
    const fields = directForm.elements;
    const entry = { rankingApplied: true, listType: fields.listType.value, name: fields.levelName.value.trim(), creator: fields.creator.value.trim(), verifier: fields.verifier.value.trim(), levelUrl: fields.levelUrl.value.trim(), proofUrl: fields.proofUrl.value.trim(), position: Number(fields.position.value), points: Number(fields.points.value) };
    const difficulty = fields.difficulty.value.trim(), thumbnail = fields.thumbnail.value.trim();
    const validLink = value => value.startsWith("https://") && value.length <= 2000 && !!safeURL(value);
    if (!entry.name || entry.name.length > 80 || !entry.creator || entry.creator.length > 60 || !entry.verifier || entry.verifier.length > 60 || !validLink(entry.levelUrl) || !validLink(entry.proofUrl) || (thumbnail && !validLink(thumbnail)) || difficulty.length > 60 || !listTypes.includes(entry.listType) || !Number.isSafeInteger(entry.position) || entry.position < 1 || !fields.points.value.trim() || !Number.isFinite(entry.points) || entry.points < 0 || !fields.checkedProof.checked) {
        directStatus.textContent = "Check all fields, HTTPS links, placement, points and verification confirmation."; return;
    }
    if (difficulty) entry.difficulty = difficulty;
    if (thumbnail) entry.thumbnail = thumbnail;
    if (!confirm(`Publish ${entry.name} at #${entry.position} in ${listLabel(entry.listType)}? Active rankings will update automatically.`)) return;
    const turn = generation;
    setBusy(directForm, true);
    directStatus.textContent = "Publishing level…";
    try {
        const client = await requireStaff(), sdk = client.storeSDK;
        if (turn !== generation || client.user.uid !== staffId) throw {code:"auth/requires-login"};
        const ref = sdk.doc(sdk.collection(client.db,"levels"));
        await sdk.runTransaction(client.db, async transaction => {
            const ranking = await readRanking(client, transaction);
            if (turn !== generation || client.auth.currentUser?.uid !== staffId) throw {code:"auth/requires-login"};
            if (ranking.levels.some(level => String(level.name ?? "").trim().toLowerCase() === entry.name.toLowerCase() && levelList(level) === entry.listType)) throw new Error("A level with this name already exists in this list. Use Manage levels to edit it.");
            writeRanking(client, transaction, ranking, ref.id, entry.position, entry.listType);
            transaction.set(ref, {...entry, positionHistory:positionHistory(null,entry.position)});
        });
        if (turn === generation) {
            directForm.reset();
            directStatus.textContent = `${entry.name} published successfully.`;
            await loadStaff(turn);
            if (turn === generation) document.getElementById("refresh-levels").click();
        }
    } catch (error) {
        if (turn === generation) directStatus.textContent = error.code ? dataMessage(error,"direct publishing") : error.message || "Could not publish the level.";
    } finally { setBusy(directForm,false); }
});
