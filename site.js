import { subscribeAuth, signInGoogle, signOutUser, returnDestination, requireUser } from "./auth.js";
import { validPlayerProfile } from "./player-profile.js";
import { dataMessage } from "./messages.js";

const page = location.pathname.split("/").pop() || "index.html";
const next = returnDestination(new URLSearchParams(location.search).get("next"));
let lastUser;
let profileGeneration = 0;
let profileError = "";
let redirecting = false;
function navigate(destination) {
    if (!redirecting) { redirecting = true; location.assign(destination); }
}
async function checkProfile(uid, turn) {
    // Account owns onboarding, and Rules/Staff remain available during setup.
    if (!uid || ["community.html", "rules.html", "admin.html"].includes(page)) return;
    try {
        const client = await requireUser();
        if (turn !== profileGeneration || client.user.uid !== uid) return;
        const snapshot = await client.storeSDK.getDoc(client.storeSDK.doc(client.db, "players", uid));
        if (turn !== profileGeneration || client.auth.currentUser?.uid !== uid) return;
        const complete = snapshot.exists() && validPlayerProfile(snapshot.data());
        if (!complete) navigate(`community.html?next=${encodeURIComponent(page + location.search)}`);
    } catch (error) {
        if (turn !== profileGeneration) return;
        profileError = dataMessage(error, "your player profile") + " Open Account to retry setup.";
        const banner = document.getElementById("site-auth-status");
        if (banner) { banner.hidden = false; banner.textContent = profileError; }
    }
}
// Account emits this only after a real database read or a committed profile batch.
window.addEventListener("player-profile-ready", event => {
    if (page === "community.html" && next && event.detail?.uid === lastUser) navigate(next);
});

for (const button of document.querySelectorAll("[data-auth-login]")) {
    button.addEventListener("click", async () => {
        await signInGoogle();
    });
}
for (const button of document.querySelectorAll("[data-auth-logout]")) button.addEventListener("click", signOutUser);

subscribeAuth(state => {
    const uid = state.user?.uid || null;
    const identityChanged = state.ready && uid !== lastUser;
    if (identityChanged) profileError = "";
    for (const button of document.querySelectorAll("[data-auth-login]")) {
        button.disabled = !state.ready || state.busy;
        button.hidden = Boolean(state.user);
        button.textContent = state.busy ? "Opening Google…" : "Continue with Google";
    }
    for (const button of document.querySelectorAll("[data-auth-logout]")) {
        button.disabled = !state.ready || state.busy;
        button.hidden = !state.user;
    }
    for (const link of document.querySelectorAll("[data-account-link]")) {
        link.textContent = state.user ? "Account" : "Sign in";
        link.href = state.user || page === "community.html" ? "community.html" : `community.html?next=${encodeURIComponent(page)}`;
        link.setAttribute("aria-label", state.user ? "Your Demonlist account" : "Sign in to the Demonlist");
    }
    for (const link of document.querySelectorAll("[data-staff-link]")) link.hidden = !state.staff;
    for (const status of document.querySelectorAll("[data-auth-status]")) {
        status.textContent = state.error || (!state.ready ? "Restoring your session…" : state.user ? `Signed in as ${state.user.displayName || "Google user"}.` : "Use your Google account to sign in or create an account.");
        status.dataset.tone = state.error ? "error" : "normal";
    }
    const banner = document.getElementById("site-auth-status");
    if (banner) {
        banner.hidden = !profileError && (!state.error || Boolean(document.querySelector("[data-auth-status]")));
        banner.textContent = profileError || state.error;
    }
    if (identityChanged) {
        lastUser = uid;
        checkProfile(uid, ++profileGeneration);
    }
});
