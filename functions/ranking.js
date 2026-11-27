const listType = data => ["legacy","platformer"].includes(data.listType) ? data.listType : "main";
// Uses the same revision document as website publishing to serialize rank changes.
export async function applyConsoleInsertion(db, eventSnapshot, timestamp) {
    if (!eventSnapshot || eventSnapshot.data().rankingApplied === true) return;
    return db.runTransaction(async transaction => {
        const revision = db.doc('rankingState/main');
        await transaction.get(revision);
        const current = await transaction.get(eventSnapshot.ref);
        // A delayed event must not act on a deleted or recreated document.
        if (!current.exists || !current.createTime.isEqual(eventSnapshot.createTime)
            || current.data().rankingApplied === true) return;
        const target = current.data().position;
        const type = listType(current.data());
        if (!Number.isSafeInteger(target) || target < 1) {
            throw new Error('New console levels need a positive integer position. Correct the document to allow retry.');
        }
        const snapshot = await transaction.get(db.collection('levels'));
        const updates = snapshot.docs.filter(doc => doc.id !== current.id && doc.data().rankingApplied !== false && type !== "legacy" && listType(doc.data()) === type)
            .map(doc => ({ ref: doc.ref, data: doc.data(), position: Number(doc.data().position) }))
            .filter(item => Number.isSafeInteger(item.position) && item.position >= target);
        if (updates.length > 450 || updates.some(item => !Number.isSafeInteger(item.position + 1))) {
            throw new Error('Ranking exceeds safe automatic insertion limits; no ranks were changed.');
        }
        const at = new Date().toISOString();
        for (const item of updates) {
            const data = item.data;
            const history = Array.isArray(data.positionHistory) ? data.positionHistory : [];
            transaction.update(item.ref, { position: item.position + 1, positionHistory: [...history, { from: item.position, to: item.position + 1, at }].slice(-100) });
        }
        transaction.update(current.ref, { rankingApplied: true, positionHistory: [{ from: null, to: target, at }] });
        transaction.set(revision, { updatedAt: timestamp() });
    });
}
