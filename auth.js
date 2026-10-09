import { getFirebase } from "./firebase.js";
import { authMessage } from "./messages.js";

let state = { ready: false, user: null, staff: false, busy: false, error: "" };
const subscribers = new Set();
let startup;
let generation = 0;

function publish(values) {
    state = { ...state, ...values };
    for (const callback of subscribers) callback(state);
}

export function subscribeAuth(callback) {
    subscribers.add(callback);
    callback(state);
    startAuth();
    return () => subscribers.delete(callback);
}

export function startAuth() {
    if (!startup) startup = (async () => {
        try {
            const client = await getFirebase();
            await client.authSDK.setPersistence(client.auth, client.authSDK.browserLocalPersistence);
            await new Promise((resolve, reject) => {
                client.authSDK.onIdTokenChanged(client.auth, async user => {
                    const turn = ++generation;
                    try {
                        const token = user ? await client.authSDK.getIdTokenResult(user) : null;
                        if (turn !== generation || client.auth.currentUser?.uid !== user?.uid) return;
                        publish({ ready: true, user, staff: token?.claims.owner === true || token?.claims.admin === true, error: "" });
                    } catch (error) {
                        if (turn !== generation) return;
                        publish({ ready: true, user: client.auth.currentUser, staff: false, error: authMessage(error) });
                    }
                    resolve();
                }, reject);
            });
            return client;
        } catch (error) {
            publish({ ready: true, user: null, staff: false, error: authMessage(error) });
            startup = null;
            return null;
        }
    })();
    return startup;
}

export async function signInGoogle() {
    if (state.busy) return null;
    publish({ busy: true, error: "" });
    try {
        const client = await startAuth();
        if (!client) return null;
        const provider = new client.authSDK.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        // Authentication is established only by Firebase's result and observer.
        return await client.authSDK.signInWithPopup(client.auth, provider);
    } catch (error) {
        publish({ error: authMessage(error) });
        return null;
    } finally { publish({ busy: false }); }
}

export async function signOutUser() {
    if (state.busy) return false;
    publish({ busy: true, error: "" });
    try {
        const client = await startAuth();
        if (!client) return false;
        await client.authSDK.signOut(client.auth);
        return true;
    } catch (error) {
        publish({ error: authMessage(error) });
        return false;
    } finally { publish({ busy: false }); }
}

export async function requireUser() {
    const client = await startAuth();
    const user = client?.auth.currentUser;
    if (!user) throw { code: "auth/requires-login" };
    return { ...client, user };
}

export async function requireStaff() {
    const client = await requireUser();
    const token = await client.authSDK.getIdTokenResult(client.user, true);
    if (client.auth.currentUser?.uid !== client.user.uid) throw { code: "auth/requires-login" };
    if (token.claims.owner !== true && token.claims.admin !== true) throw { code: "auth/insufficient-permission" };
    return client;
}

// Only known local routes may be used as a post-login destination.
export function returnDestination(value) {
    if (!value) return null;
    try {
        const base = new URL(".", location.href);
        const url = new URL(value, base);
        const routes = ["index.html", "stats.html", "records.html", "submit.html", "rules.html", "admin.html"];
        if (url.origin !== base.origin || !routes.some(route => url.pathname === base.pathname + route)) return null;
        return url.href;
    } catch { return null; }
}
