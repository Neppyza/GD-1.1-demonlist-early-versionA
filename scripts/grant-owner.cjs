// Run only in a trusted Firebase administrator environment, never in the browser.
const usage = 'Usage: node scripts/grant-owner.cjs FIREBASE_UID [--dry-run]\n       node scripts/grant-owner.cjs --email EMAIL [EMAIL ...] [--dry-run]';

function parseArgs(args) {
  const dryRun = args.includes('--dry-run');
  const values = args.filter(value => value !== '--dry-run');
  if (values[0] === '--email') {
    const targets = [...new Set(values.slice(1).map(value => value.trim().toLowerCase()))];
    if (!targets.length || targets.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error(usage);
    return {byEmail: true, targets, dryRun};
  }
  if (values.length !== 1 || !values[0].trim() || values[0].startsWith('--')) throw new Error(usage);
  return {byEmail: false, targets: [values[0].trim()], dryRun};
}

async function grantOwners(auth, options, log = console.log) {
  // Resolve and validate every target before granting any account access.
  const users = [];
  for (const target of options.targets) {
    const user = options.byEmail ? await auth.getUserByEmail(target) : await auth.getUser(target);
    if (user.disabled || !user.emailVerified || !user.providerData?.some(provider => provider.providerId === 'google.com')) {
      throw new Error('Account ' + target + ' must be an enabled, verified Google account. Sign in to the website with Google first.');
    }
    if (options.byEmail && user.email?.toLowerCase() !== target) throw new Error('Email lookup did not match ' + target);
    users.push(user);
  }
  for (const user of users) {
    const identity = (user.email || 'Google account') + ' (UID ' + user.uid + ')';
    if (options.dryRun) {
      log('Verified owner target: ' + identity + '. Dry run; no claims changed.');
      continue;
    }
    await auth.setCustomUserClaims(user.uid, {...user.customClaims, owner: true, admin: true});
    log('Owner access assigned to ' + identity + '. Select Retry access check on the Admin page, or sign out and in again.');
  }
}

module.exports = {parseArgs, grantOwners};
if (require.main === module) {
  (async () => {
    const options = parseArgs(process.argv.slice(2));
    const {initializeApp, applicationDefault} = require('firebase-admin/app');
    const {getAuth} = require('firebase-admin/auth');
    initializeApp({credential: applicationDefault(), projectId: 'gd11-demonlist'});
    await grantOwners(getAuth(), options);
  })().catch(error => {console.error(error.message); process.exitCode = 1;});
}
