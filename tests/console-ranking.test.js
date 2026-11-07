import test from 'node:test';
import assert from 'node:assert/strict';
import { applyConsoleInsertion } from '../functions/ranking.js';

function fixture(data, sameCreation = true) {
    const snapshot = id => ({ id, ref: id, exists: !!data[id], data: () => ({...data[id]}), createTime: { isEqual: () => sameCreation } });
    const event = snapshot('new');
    // Event snapshots are immutable, including on repeated delivery.
    const original = event.data(); event.data = () => original;
    let writes = 0;
    const db = { doc: path => path, collection: () => 'levels', runTransaction: async callback => {
        const pending = [];
        await callback({
            get: async ref => ref === 'levels' ? { docs: Object.keys(data).map(snapshot) } : snapshot(ref),
            update: (ref, value) => pending.push(() => { Object.assign(data[ref], value); writes++; }),
            set: () => pending.push(() => { writes++; })
        });
        pending.forEach(write => write());
    }};
    return { data, event, db, writes: () => writes };
}

test('console insertion shifts #3 and below, preserves metadata, and is idempotent', async () => {
    const f = fixture({ first:{position:1}, third:{position:3,proofUrl:'proof'}, fourth:{position:'4'}, unranked:{}, new:{position:3} });
    await applyConsoleInsertion(f.db,f.event,()=>0);
    assert.equal(f.data.first.position,1);
    assert.equal(f.data.third.position,4);
    assert.equal(f.data.fourth.position,5);
    assert.equal(f.data.third.proofUrl,'proof');
    assert.equal(f.data.new.rankingApplied,true);
    assert.deepEqual(f.data.unranked,{});
    const count=f.writes();
    await applyConsoleInsertion(f.db,f.event,()=>0);
    assert.equal(f.writes(),count);
});
test('website-created and website-placed levels are not shifted again', async () => {
    for (const appliedAtCreation of [true,false]) {
        const f=fixture({new:{position:1,rankingApplied:appliedAtCreation},old:{position:2}});
        f.data.new.rankingApplied=true;
        await applyConsoleInsertion(f.db,f.event,()=>0);
        assert.equal(f.writes(),0);
    }
});
test('deleted or recreated levels ignore old delivery', async () => {
    for (const deleted of [true,false]) {
        const f=fixture({new:{position:1},old:{position:2}},false);
        if(deleted) delete f.data.new;
        await applyConsoleInsertion(f.db,f.event,()=>0);
        assert.equal(f.writes(),0);
    }
});
test('invalid positions and overflowing ranks produce no partial writes', async () => {
    for(const position of [0,-1,1.5,'3']) {
        const f=fixture({new:{position},old:{position:3}});
        await assert.rejects(applyConsoleInsertion(f.db,f.event,()=>0));
        assert.equal(f.writes(),0);
    }
    const f=fixture({new:{position:1},old:{position:Number.MAX_SAFE_INTEGER}});
    await assert.rejects(applyConsoleInsertion(f.db,f.event,()=>0));
    assert.equal(f.writes(),0);
});
