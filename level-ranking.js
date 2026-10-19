import { placementUpdates } from "./list-model.js";

// The shared revision serializes placements, including concurrent publications
// into an empty list. Re-read the collection on every transaction retry.
export async function readRanking(client, transaction) {
    const sdk = client.storeSDK;
    const revision = sdk.doc(client.db, "rankingState", "main");
    await transaction.get(revision);
    const snapshot = await sdk.getDocs(sdk.collection(client.db, "levels"));
    const refs = snapshot.docs.map(item => sdk.doc(client.db, "levels", item.id));
    const saved = await Promise.all(refs.map(ref => transaction.get(ref)));
    const levels = saved.flatMap((item, index) => item.exists() ? [{ ...item.data(), id: refs[index].id }] : []);
    return { levels, revision };
}

export function writeRanking(client, transaction, ranking, levelId, target) {
    const sdk = client.storeSDK;
    const updates = placementUpdates(ranking.levels, levelId, target);
    // Leave room for the level, submission and shared revision in one commit.
    if (updates.length > 450) throw new Error("Too many levels need moving in one save. Ask a database administrator to reorder this list.");
    for (const update of updates) transaction.update(sdk.doc(client.db, "levels", update.id), { position: update.position });
    transaction.set(ranking.revision, { updatedAt: sdk.serverTimestamp() });
    return updates;
}
