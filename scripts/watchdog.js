// Read-only, credential-free probes. Never log response bodies or player data.
import { firebaseConfig } from '../firebase.js';
import { pathToFileURL } from 'node:url';
const base = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
export async function runWatchdog(fetcher = fetch) {
    const results = [];
    async function probe(name, url, options, expected) {
        try {
            const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(15000), redirect: 'error' });
            // Discard bodies, including unexpectedly exposed private data.
            await response.body?.cancel();
            results.push({ name, ok: response.status === expected, status: response.status });
        } catch { results.push({ name, ok: false, status: 'network-error' }); }
    }
    await probe('Website availability', 'https://neppyza.github.io/GD-1.1-demonlist-early-versionA/', {}, 200);
    await probe('Public rankings', `${base}/levels?pageSize=1`, {}, 200);
    for (const name of ['profiles', 'agreements', 'team', 'submissions', 'completionSubmissions']) {
        await probe(`Private collection ${name} denies anonymous listing`, `${base}/${name}?pageSize=1`, {}, 403);
        await probe(`Private collection ${name} denies anonymous lookup`, `${base}/${name}/watchdog-nonexistent-probe`, {}, 403);
    }
    await probe('Unapproved records deny anonymous queries', `${base}:runQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'records' }], where: { fieldFilter: { field: { fieldPath: 'approved' }, op: 'EQUAL', value: { booleanValue: false } } }, limit: 1 } })
    }, 403);
    return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const results = await runWatchdog();
    for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name} (${item.status})`);
    console.log(`Checked at ${new Date().toISOString()}. Read-only checks; this is not comprehensive breach detection.`);
    if (results.some(item => !item.ok)) process.exitCode = 1;
}
