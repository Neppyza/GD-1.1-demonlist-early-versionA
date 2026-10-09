import { subscribeAuth, requireStaff } from "./auth.js";
import { dataMessage } from "./messages.js";
import { sortLevels } from "./list-model.js";
import { element, externalLink, setBusy } from "./ui.js";
import { countryName } from "./countries.js";

const tools = document.getElementById("staff-tools");
const queue = document.getElementById("review-queue");
const status = document.getElementById("staff-status");
const select = document.getElementById("victor-level");
let identity;
let generation = 0;
let staffId = null;

subscribeAuth(state => {
    if (!state.ready) return;
    const key = `${state.user?.uid || ""}:${state.staff}`;
    if (identity === key) return;
    identity = key;
    ++generation;
    staffId = state.staff ? state.user.uid : null;
    tools.hidden = true;
    queue.replaceChildren();
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
            const option = element("option", "", level.name || "Unnamed level");
            option.value = level.id;
            select.append(option);
        }
        queue.replaceChildren();
        for (const doc of results[1].docs) queue.append(renderSubmission(doc.id, doc.data(), turn));
        if (results[1].empty) queue.append(element("p", "muted", "There are no pending submissions."));
        status.textContent = "Administrator access verified.";
    } catch (error) {
        if (turn === generation) {
            tools.hidden = true;
            status.textContent = dataMessage(error, "the staff review queue");
        }
    }
}
document.getElementById("refresh-queue").addEventListener("click", () => loadStaff(++generation));
document.getElementById("staff-retry").addEventListener("click", () => loadStaff(++generation));

function renderSubmission(id, data, turn) {
    const card = element("article", "review-item");
    card.append(element("h3", "", data.levelName || "Untitled level"), element("p", "muted", `Submitted by ${data.submittedBy || "—"} · Creator: ${data.creator || "—"} · Verifier: ${data.verifier || "—"}`));
    if (countryName(data.country)) card.append(element("p", "muted", `Submitter country: ${countryName(data.country)}`));
    const links = element("div", "detail-actions");
    for (const [url, label] of [[data.levelUrl, "Open level ↗"], [data.proofUrl, "Watch proof ↗"]]) {
        const link = externalLink(url, label);
        if (link) links.append(link);
    }
    card.append(links);
    if (data.notes) card.append(element("p", "", data.notes));
    const form = element("form", "review-form");
    for (const [name, label, type] of [["position", "Position", "number"], ["points", "Points", "number"], ["difficulty", "Difficulty (optional)", "text"]]) {
        const group = element("label", "", label);
        const input = element("input");
        input.name = name; input.type = type;
        if (type === "number") { input.min = name === "position" ? "1" : "0"; input.step = name === "position" ? "1" : "0.01"; input.required = true; }
        else input.maxLength = 60;
        group.append(input); form.append(group);
    }
    const approve = element("button", "", "Approve and publish");
    approve.type = "submit";
    const reject = element("button", "secondary-button", "Reject");
    reject.type = "button";
    const output = element("p", "form-status");
    output.setAttribute("role", "status");
    form.append(approve, reject, output);
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (form.dataset.busy === "true") return;
        const rank = Number(form.elements.position.value);
        const points = Number(form.elements.points.value);
        const difficulty = form.elements.difficulty.value.trim();
        if (!Number.isInteger(rank) || rank < 1 || !Number.isFinite(points) || points < 0) { output.textContent = "Enter a positive whole-number placement and non-negative points."; return; }
        setBusy(form, true);
        output.textContent = "Checking access and publishing…";
        try {
            const client = await requireStaff();
            if (turn !== generation || client.user.uid !== staffId) throw { code: "auth/requires-login" };
            const sdk = client.storeSDK;
            const submission = sdk.doc(client.db, "submissions", id);
            const level = sdk.doc(sdk.collection(client.db, "levels"));
            await sdk.runTransaction(client.db, async transaction => {
                const snapshot = await transaction.get(submission);
                if (!snapshot.exists() || snapshot.data().status !== "pending") throw new Error("This submission has already been reviewed. Refresh the queue.");
                const saved = snapshot.data();
                const entry = { name: saved.levelName, position: rank, points, creator: saved.creator, verifier: saved.verifier, levelUrl: saved.levelUrl, proofUrl: saved.proofUrl };
                if (difficulty) entry.difficulty = difficulty;
                transaction.set(level, entry);
                transaction.update(submission, { status: "approved", levelId: level.id, reviewedBy: client.user.uid, reviewedAt: sdk.serverTimestamp() });
            });
            if (turn === generation) { status.textContent = "Level published."; await loadStaff(turn); }
        } catch (error) {
            if (turn === generation) output.textContent = error.code ? dataMessage(error, "this level") : error.message || "Could not publish this level.";
        } finally { setBusy(form, false); }
    });
    reject.addEventListener("click", async () => {
        if (form.dataset.busy === "true") return;
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
        const key = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([playerId, levelId])))), byte => byte.toString(16).padStart(2, "0")).join("");
        // Existing stable pair key and record fields are preserved.
        await client.storeSDK.setDoc(client.storeSDK.doc(client.db, "records", key), { player, playerId, levelId, progress: 100, approved: true });
        if (turn === generation) { form.reset(); output.textContent = "Completion approved. It now appears in Records and Players."; }
    } catch (error) {
        if (turn === generation) output.textContent = dataMessage(error, "this completion");
    } finally { setBusy(form, false); }
});
