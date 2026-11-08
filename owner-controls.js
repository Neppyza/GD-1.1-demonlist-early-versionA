import { requireOwner, subscribeAuth } from "./auth.js";
import { getFirebase } from "./firebase.js";
import { dataMessage } from "./messages.js";
import { element, setBusy } from "./ui.js";

const controls = document.getElementById("owner-controls");
const availability = document.getElementById("availability-form");
const availabilityStatus = document.getElementById("availability-status");
const coOwners = document.getElementById("co-owner-controls");
const coOwnerForm = document.getElementById("co-owner-form");
const coOwnerStatus = document.getElementById("co-owner-status");
const coOwnerList = document.getElementById("co-owner-list");
let identity = "";
let generation = 0;

async function listCoOwners(client, turn) {
    const sdk = client.storeSDK;
    const members = await sdk.getDocs(sdk.collection(client.db, "coOwners"));
    if (turn !== generation) return;
    const active = members.docs.filter(member => member.data().active === true);
    coOwnerList.replaceChildren(...active.map(member => element("li", "player-id", member.id)));
    if (!active.length) coOwnerList.append(element("li", "muted", "No co-owners yet."));
}

subscribeAuth(async state => {
    if (!state.ready) return;
    const key = state.owner ? `${state.user.uid}:${state.primaryOwner}` : "";
    if (identity === key) return;
    identity = key;
    const turn = ++generation;
    controls.hidden = !state.owner;
    coOwners.hidden = !state.primaryOwner;
    setBusy(availability, false);
    setBusy(coOwnerForm, false);
    availability.querySelector("button").disabled = true;
    availabilityStatus.textContent = "";
    coOwnerStatus.textContent = "";
    coOwnerList.replaceChildren();
    coOwnerForm.reset();
    if (!state.owner) return;
    try {
        const client = await getFirebase();
        const sdk = client.storeSDK;
        const snapshot = await sdk.getDoc(sdk.doc(client.db, "siteSettings", "availability"));
        if (turn !== generation) return;
        availability.elements.availability.value = snapshot.data()?.paused === true ? "paused" : "open";
        availability.querySelector("button").disabled = false;
    } catch (error) {
        if (turn === generation) availabilityStatus.textContent = dataMessage(error, "site availability");
    }
    if (state.primaryOwner && turn === generation) {
        try { await listCoOwners(await getFirebase(), turn); }
        catch (error) { if (turn === generation) coOwnerStatus.textContent = dataMessage(error, "co-owner access"); }
    }
});

availability.addEventListener("submit", async event => {
    event.preventDefault();
    if (availability.dataset.busy === "true") return;
    const turn = generation;
    const paused = availability.elements.availability.value === "paused";
    setBusy(availability, true);
    try {
        const client = await requireOwner();
        if (turn !== generation) return;
        const sdk = client.storeSDK;
        await sdk.setDoc(sdk.doc(client.db, "siteSettings", "availability"), { paused });
        if (turn === generation) availabilityStatus.textContent = paused ? "Public Demonlist paused." : "Public Demonlist reopened.";
    } catch (error) {
        if (turn === generation) availabilityStatus.textContent = dataMessage(error, "site availability");
    } finally {
        if (turn === generation) setBusy(availability, false);
    }
});

coOwnerForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (coOwnerForm.dataset.busy === "true") return;
    const turn = generation;
    const uid = coOwnerForm.elements.uid.value.trim();
    const active = coOwnerForm.elements.action.value === "grant";
    if (!uid || uid.includes("/")) {
        coOwnerStatus.textContent = "Enter a valid Firebase UID.";
        return;
    }
    setBusy(coOwnerForm, true);
    try {
        const client = await requireOwner();
        if (turn !== generation || !client.primaryOwner) return;
        if (uid === client.user.uid) {
            coOwnerStatus.textContent = "Choose another registered player.";
            return;
        }
        const sdk = client.storeSDK;
        if (active) {
            const profile = await sdk.getDoc(sdk.doc(client.db, "players", uid));
            if (!profile.exists() || profile.data().removed === true) {
                if (turn === generation) coOwnerStatus.textContent = "That UID does not belong to an active registered player.";
                return;
            }
        }
        if (turn !== generation) return;
        await sdk.setDoc(sdk.doc(client.db, "coOwners", uid), { active });
        if (turn !== generation) return;
        coOwnerStatus.textContent = active ? "Co-owner access granted. They can sign in to Admin." : "Co-owner access revoked.";
        coOwnerForm.reset();
        try { await listCoOwners(client, turn); }
        catch (error) { if (turn === generation) coOwnerStatus.textContent += " The co-owner list could not be refreshed."; }
    } catch (error) {
        if (turn === generation) coOwnerStatus.textContent = dataMessage(error, "co-owner access");
    } finally {
        if (turn === generation) setBusy(coOwnerForm, false);
    }
});
