import { subscribeAuth, requireUser } from "./auth.js";
import { dataMessage } from "./messages.js";
import { element, setBusy } from "./ui.js";
import { validPlayerProfile } from "./player-profile.js";
import { validCountry, fillCountries, countryName } from "./countries.js";

export const rulesVersion = "2026-10-05";
const content = document.getElementById("member-content");
const rulesPanel = document.getElementById("community-rules");
const memberStatus = document.getElementById("member-status");
const retry = document.getElementById("account-retry");
const profileForm = document.getElementById("profile-form");
const submissionForm = document.getElementById("submission-form");
let memberId;
let generation = 0;
let acceptedRules = false;
let savedName = "";
let savedCountry = "";
fillCountries(profileForm?.elements.country);
fillCountries(submissionForm?.elements.country);

function current(user, turn) { return memberId === user.uid && generation === turn; }
function clearPrivateData() {
    content.hidden = true;
    rulesPanel.hidden = true;
    acceptedRules = false;
    savedName = "";
    savedCountry = "";
    memberStatus.textContent = "";
    retry.hidden = true;
    document.getElementById("community-rules-form").reset();
    profileForm?.reset();
    const view = document.getElementById("view-profile");
    if (view) { view.hidden = true; view.removeAttribute("href"); }
    const uid = document.getElementById("player-uid");
    if (uid) uid.textContent = "";
    submissionForm?.reset();
    document.getElementById("my-submissions")?.replaceChildren();
    for (const output of document.querySelectorAll("[data-private-status]")) output.textContent = "";
    if (submissionForm) submissionForm.querySelector("fieldset").disabled = true;
}
subscribeAuth(state => {
    if (!state.ready) return;
    const id = state.user?.uid || null;
    if (id === memberId) return;
    memberId = id;
    ++generation;
    clearPrivateData();
    if (state.user) loadMember(state.user, generation);
});

async function loadMember(user, turn) {
    memberStatus.textContent = "Loading your account…";
    try {
        const client = await requireUser();
        if (!current(user, turn) || client.user.uid !== user.uid) return;
        const { db, storeSDK: sdk } = client;
        const agreement = await sdk.getDoc(sdk.doc(db, "agreements", user.uid));
        if (!current(user, turn)) return;
        acceptedRules = agreement.exists() && agreement.data().version === rulesVersion;
        memberStatus.textContent = "";
        rulesPanel.hidden = acceptedRules;
        if (!acceptedRules) return;
        const [snapshot, publicSnapshot] = await Promise.all([
            sdk.getDoc(sdk.doc(db, "profiles", user.uid)),
            sdk.getDoc(sdk.doc(db, "players", user.uid))
        ]);
        if (!current(user, turn)) return;
        const profile = snapshot.exists() ? snapshot.data() : {};
        const publicProfile = publicSnapshot.exists() ? publicSnapshot.data() : null;
        savedName = validPlayerProfile(publicProfile) ? publicProfile.displayName : "";
        savedCountry = validCountry(publicProfile?.country) ? publicProfile.country : "";
        content.hidden = false;
        if (profileForm) {
            profileForm.elements.displayName.value = savedName || profile.displayName || user.displayName || "";
            profileForm.elements.bio.value = publicProfile?.bio ?? profile.bio ?? "";
            profileForm.elements.country.value = savedCountry;
            for (const checkbox of profileForm.querySelectorAll('[name="tags"]')) checkbox.checked = (publicProfile?.tags || ["Player"]).includes(checkbox.value);
            document.getElementById("profile-status").textContent = savedName ? "Your public player profile is saved." : "Complete your player profile to join the leaderboard.";
            const view = document.getElementById("view-profile");
            view.hidden = !savedName;
            view.href = `stats.html?player=${encodeURIComponent(user.uid)}`;
            document.getElementById("player-uid").textContent = `Player ID: ${user.uid}`;
            if (savedName) window.dispatchEvent(new CustomEvent("player-profile-ready", { detail: { uid: user.uid } }));
        }
        if (submissionForm) {
            submissionForm.elements.country.value = savedCountry;
            document.getElementById("submitter-name").textContent = savedName || "No player name saved";
            document.getElementById("profile-required").hidden = Boolean(savedName);
            submissionForm.querySelector("fieldset").disabled = !savedName;
        }
        if (document.getElementById("my-submissions")) await loadSubmissions(client, turn);
    } catch (error) {
        if (!current(user, turn)) return;
        content.hidden = true;
        memberStatus.textContent = dataMessage(error, "your private account");
        retry.hidden = false;
    }
}
retry.addEventListener("click", async () => {
    try {
        const { user } = await requireUser();
        retry.hidden = true;
        await loadMember(user, ++generation);
    } catch (error) { memberStatus.textContent = dataMessage(error, "your account"); }
});

async function loadSubmissions(client, turn) {
    const box = document.getElementById("my-submissions");
    const { db, user, storeSDK: sdk } = client;
    box.textContent = "Loading your submissions…";
    try {
        const snapshot = await sdk.getDocs(sdk.query(sdk.collection(db, "submissions"), sdk.where("ownerUid", "==", user.uid)));
        if (!current(user, turn)) return;
        box.replaceChildren();
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        items.sort((a, b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0));
        if (!items.length) box.append(element("p", "muted", "You have no submissions yet."));
        for (const item of items) {
            const row = element("article", "submission-item");
            const title = element("h3", "", item.levelName || "Level submission");
            const status = element("span", "submission-status", item.status || "pending");
            row.append(title, status, element("p", "muted", `Creator: ${item.creator || "—"} · Verifier: ${item.verifier || "—"}`));
            if (validCountry(item.country)) row.append(element("p", "muted", `Submitter country: ${countryName(item.country)}`));
            box.append(row);
        }
    } catch (error) {
        if (current(user, turn)) box.textContent = dataMessage(error, "your submissions");
    }
}

document.getElementById("community-rules-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.busy === "true" || !form.elements.agreement.checked) return;
    const output = document.getElementById("agreement-status");
    const turn = generation;
    setBusy(form, true);
    output.textContent = "Saving your agreement…";
    try {
        const client = await requireUser();
        if (!current(client.user, turn)) return;
        await client.storeSDK.setDoc(client.storeSDK.doc(client.db, "agreements", client.user.uid), { version: rulesVersion, acceptedAt: client.storeSDK.serverTimestamp() });
        if (current(client.user, turn)) await loadMember(client.user, turn);
    } catch (error) {
        if (turn === generation) output.textContent = dataMessage(error, "your rules agreement");
    } finally { setBusy(form, false); }
});

profileForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.busy === "true") return;
    const output = document.getElementById("profile-status");
    const name = form.elements.displayName.value.trim();
    const bio = form.elements.bio.value.trim();
    const tags = [...form.querySelectorAll('[name="tags"]:checked')].map(input => input.value);
    const country = form.elements.country.value;
    const publicProfile = { displayName: name, bio, tags, ...(country ? { country } : {}) };
    if (!validPlayerProfile(publicProfile)) {
        output.textContent = "Use a name of 3–24 characters, a bio of at most 300 characters, and choose at least one player tag.";
        return;
    }
    const turn = generation;
    setBusy(form, true);
    output.textContent = "Saving your player profile…";
    try {
        const client = await requireUser();
        if (!current(client.user, turn) || !acceptedRules) throw { code: "auth/requires-login" };
        const sdk = client.storeSDK;
        const updatedAt = sdk.serverTimestamp();
        const batch = sdk.writeBatch(client.db);
        batch.set(sdk.doc(client.db, "profiles", client.user.uid), { displayName: name, bio, updatedAt });
        batch.set(sdk.doc(client.db, "players", client.user.uid), { ...publicProfile, updatedAt });
        await batch.commit();
        if (!current(client.user, turn)) return;
        savedName = name;
        savedCountry = country;
        output.textContent = "Profile saved. You now appear on the Players leaderboard.";
        const view = document.getElementById("view-profile");
        view.hidden = false;
        view.href = `stats.html?player=${encodeURIComponent(client.user.uid)}`;
        window.dispatchEvent(new CustomEvent("player-profile-ready", { detail: { uid: client.user.uid } }));
    } catch (error) {
        if (turn === generation) output.textContent = dataMessage(error, "your profile");
    } finally { setBusy(form, false); }
});

submissionForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.busy === "true") return;
    const output = document.getElementById("submission-status");
    const values = Object.fromEntries(new FormData(form));
    const fields = { levelName: String(values.levelName || "").trim(), creator: String(values.creator || "").trim(), verifier: String(values.verifier || "").trim(), levelUrl: String(values.levelUrl || "").trim(), proofUrl: String(values.proofUrl || "").trim(), notes: String(values.notes || "").trim() };
    const country = String(values.country || "");
    if (country && !validCountry(country)) { output.textContent = "Choose a valid country or leave it unshared."; return; }
    if (country) fields.country = country;
    const https = value => { try { return new URL(value).protocol === "https:"; } catch { return false; } };
    if (!savedName || !acceptedRules) { output.textContent = "Sign in, accept the rules, and save a player name in Account before submitting."; return; }
    if (!fields.levelName || fields.levelName.length > 80 || !fields.creator || fields.creator.length > 60 || !fields.verifier || fields.verifier.length > 60 || fields.notes.length > 500 || fields.levelUrl.length > 2000 || fields.proofUrl.length > 2000 || !https(fields.levelUrl) || !https(fields.proofUrl) || !form.elements.confirmed.checked) {
        output.textContent = "Complete the required fields, use valid HTTPS links, and confirm the submission rules.";
        return;
    }
    const turn = generation;
    setBusy(form, true);
    output.textContent = "Sending your level for review…";
    try {
        const client = await requireUser();
        if (!current(client.user, turn)) throw { code: "auth/requires-login" };
        await client.storeSDK.addDoc(client.storeSDK.collection(client.db, "submissions"), { ownerUid: client.user.uid, submittedBy: savedName, ...fields, status: "pending", submittedAt: client.storeSDK.serverTimestamp() });
        if (!current(client.user, turn)) return;
        form.reset();
        form.elements.country.value = savedCountry;
        output.textContent = "Submission received. It remains private until the list team reviews it.";
    } catch (error) {
        if (turn === generation) output.textContent = dataMessage(error, "your level submission");
    } finally { setBusy(form, false); }
});

