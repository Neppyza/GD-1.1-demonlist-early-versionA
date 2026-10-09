import { subscribeAuth, signInGoogle, signOutUser, returnDestination } from "./auth.js";

const page = location.pathname.split("/").pop() || "index.html";
const next = returnDestination(new URLSearchParams(location.search).get("next"));
let lastUser = null;
let redirecting = false;
function returnAfterLogin() {
    if (next && !redirecting) { redirecting = true; location.assign(next); }
}

for (const button of document.querySelectorAll("[data-auth-login]")) {
    button.addEventListener("click", async () => {
        const result = await signInGoogle();
        if (result?.user) returnAfterLogin();
    });
}
for (const button of document.querySelectorAll("[data-auth-logout]")) button.addEventListener("click", signOutUser);

subscribeAuth(state => {
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
        link.setAttribute("aria-label", state.user ? "Your Crux account" : "Sign in to Crux");
    }
    for (const link of document.querySelectorAll("[data-staff-link]")) link.hidden = !state.staff;
    for (const status of document.querySelectorAll("[data-auth-status]")) {
        status.textContent = state.error || (!state.ready ? "Restoring your session…" : state.user ? `Signed in as ${state.user.displayName || "Google user"}.` : "Use your Google account to sign in or create an account.");
        status.dataset.tone = state.error ? "error" : "normal";
    }
    const banner = document.getElementById("site-auth-status");
    if (banner) {
        banner.hidden = !state.error || Boolean(document.querySelector("[data-auth-status]"));
        banner.textContent = state.error;
    }
    if (state.ready && state.user && !lastUser && next && page === "community.html") returnAfterLogin();
    lastUser = state.user?.uid || null;
});
