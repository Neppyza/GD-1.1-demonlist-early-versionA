import { getFirebase } from "./firebase.js";

// Shared by list, players and records views. One listener per collection, including
// when more than one component subscribes. No orderBy excludes incomplete levels.
const sources = new Map();
function source(name) {
    if (!sources.has(name)) sources.set(name, { listeners: new Set(), value: { status: "loading", items: [], error: null }, generation: 0, stop: null, started: false });
    return sources.get(name);
}
function publish(entry, value) {
    entry.value = value;
    for (const listener of entry.listeners) listener(value);
}
async function connect(name) {
    const entry = source(name);
    if (entry.started) return;
    entry.started = true;
    const generation = ++entry.generation;
    publish(entry, { status: "loading", items: [], error: null });
    try {
        const { db, storeSDK } = await getFirebase();
        if (generation !== entry.generation || !entry.listeners.size) return;
        const reference = name === "records" ? storeSDK.query(storeSDK.collection(db, name), storeSDK.where("approved", "==", true)) : storeSDK.collection(db, name);
        entry.stop = storeSDK.onSnapshot(reference, snapshot => {
            if (generation === entry.generation) publish(entry, { status: "ready", items: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })), error: null });
        }, error => {
            if (generation === entry.generation) publish(entry, { status: "error", items: [], error });
        });
    } catch (error) {
        if (generation === entry.generation) publish(entry, { status: "error", items: [], error });
    }
}
export function subscribeData(name, listener) {
    if (!["levels", "records", "players"].includes(name)) throw new Error("Unsupported public collection");
    const entry = source(name);
    entry.listeners.add(listener);
    listener(entry.value);
    connect(name);
    return () => {
        entry.listeners.delete(listener);
        if (!entry.listeners.size) {
            ++entry.generation;
            entry.stop?.();
            entry.stop = null;
            entry.started = false;
            entry.value = { status: "loading", items: [], error: null };
        }
    };
}
export function retryData(name) {
    const entry = source(name);
    ++entry.generation;
    entry.stop?.();
    entry.stop = null;
    entry.started = false;
    connect(name);
}
