import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWatchdog } from '../scripts/watchdog.js';
import { readWatchlist, writeWatchlist } from '../watchlist.js';
test('watchdog checks private gets, lists and unapproved queries without credentials or writes', async () => {
    const requests = [];
    const result = await runWatchdog(async (url, options) => {
        requests.push({url, options});
        return new Response(null, {status: url.includes('github.io') || url.includes('/levels?') ? 200 : 403});
    });
    assert.equal(result.length, 13);
    assert.ok(result.every(x => x.ok));
    assert.ok(requests.every(x => !x.options.headers?.Authorization));
    assert.ok(requests.every(x => !x.options.method || (x.options.method === 'POST' && x.url.endsWith(':runQuery'))));
});
test('watchdog flags exposure, unexpected status and network failure', async () => {
    assert.ok((await runWatchdog(async () => new Response(null, {status:200}))).some(x => !x.ok));
    assert.ok((await runWatchdog(async () => new Response(null, {status:401}))).every(x => !x.ok));
    assert.ok((await runWatchdog(async () => { throw Error('secret response'); })).every(x => x.status === 'network-error'));
});
test('watchlist tolerates malformed or blocked storage and preserves IDs', () => {
    assert.deepEqual([...readWatchlist({getItem:()=>'{broken'})], []);
    assert.deepEqual([...readWatchlist({getItem:()=>'{"bad":true}'})], []);
    assert.deepEqual([...readWatchlist({getItem:()=> '["alpha",1,"alpha","beta"]'})], ['alpha','beta']);
    assert.equal(writeWatchlist(new Set(['alpha']), {setItem(){throw Error('blocked')}}), false);
    let value; assert.equal(writeWatchlist(new Set(['alpha']), {setItem(k,v){value=v}}), true);
    assert.equal(value, '["alpha"]');
});
