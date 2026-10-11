const test = require('node:test');
const assert = require('node:assert/strict');
const {parseArgs, grantOwners} = require('../scripts/grant-owner.cjs');
const account = (uid, email, extra = {}) => ({uid, email, emailVerified: true, disabled: false, providerData: [{providerId: 'google.com'}], customClaims: {existing: 'retained'}, ...extra});
const options = () => parseArgs(['--email', 'first@example.com', 'second@example.com']);

test('email owner grants resolve both identities and preserve their existing claims', async () => {
  const users = [account('one', 'first@example.com'), account('two', 'second@example.com')];
  const calls = [], output = [];
  await grantOwners({
    getUserByEmail: async email => {calls.push(['lookup', email]); return users.find(user => user.email === email);},
    setCustomUserClaims: async (uid, claims) => {calls.push(['grant', uid, claims]);}
  }, options(), line => output.push(line));
  assert.deepEqual(calls, [['lookup', 'first@example.com'], ['lookup', 'second@example.com'], ['grant', 'one', {existing: 'retained', owner: true, admin: true}], ['grant', 'two', {existing: 'retained', owner: true, admin: true}]]);
  assert.equal(output.length, 2);
  assert.match(output[1], /second@example.com.*UID two/);
});

test('missing second identity prevents granting the first identity', async () => {
  let writes = 0;
  await assert.rejects(grantOwners({getUserByEmail: async email => {if (email === 'second@example.com') throw new Error('auth/user-not-found'); return account('one', email);}, setCustomUserClaims: async () => {writes++;}}, options(), () => {}), /user-not-found/);
  assert.equal(writes, 0);
});

test('disabled, unverified and non-Google accounts cannot receive owner claims', async () => {
  for (const extra of [{disabled: true}, {emailVerified: false}, {providerData: [{providerId: 'password'}]}]) {
    let writes = 0;
    await assert.rejects(grantOwners({getUserByEmail: async email => account('one', email, extra), setCustomUserClaims: async () => {writes++;}}, options(), () => {}), /verified Google account/);
    assert.equal(writes, 0);
  }
});

test('dry run verifies both email accounts without changing claims', async () => {
  let lookups = 0, writes = 0;
  const output = [];
  await grantOwners({getUserByEmail: async email => {lookups++; return account(email, email);}, setCustomUserClaims: async () => {writes++;}}, parseArgs(['--email', 'first@example.com', 'second@example.com', '--dry-run']), line => output.push(line));
  assert.equal(lookups, 2);
  assert.equal(writes, 0);
  assert.match(output[0], /Dry run; no claims changed/);
});

test('UID invocation stays compatible and grants the resolved Google account', async () => {
  const calls = [];
  await grantOwners({getUser: async uid => {calls.push(uid); return account(uid, 'first@example.com');}, setCustomUserClaims: async (uid, claims) => {calls.push([uid, claims]);}}, parseArgs(['caseSensitiveUID']), () => {});
  assert.deepEqual(calls, ['caseSensitiveUID', ['caseSensitiveUID', {existing: 'retained', owner: true, admin: true}]]);
});

test('invalid arguments and mismatched identities never grant claims', async () => {
  for (const args of [[], ['--email'], ['--email', 'bad-email'], ['--unknown'], ['uid', 'another-uid']]) assert.throws(() => parseArgs(args), /Usage:/);
  assert.deepEqual(parseArgs(['--email', 'FIRST@example.com', 'first@example.com']).targets, ['first@example.com']);
  let writes = 0;
  await assert.rejects(grantOwners({getUserByEmail: async () => account('other', 'wrong@example.com'), setCustomUserClaims: async () => {writes++;}}, options(), () => {}), /did not match/);
  assert.equal(writes, 0);
});
