# Demonlist reliability and security operations

## What this change provides

- Connection status with reconnection when the browser comes online.
- Stricter rules: removed players cannot submit levels; reviews require the acting moderator and server timestamp, and pending reviews cannot be rewritten after approval/rejection.
- Credential-free, read-only watchdog probes: website, public levels, private collection get/list denial, and unapproved record query denial. Response bodies are discarded and never printed.

## Activation

1. Review and merge the PR to publish the frontend through the repository's existing GitHub Pages configuration.
2. A Firebase project administrator must deploy the rules to **gd11-demonlist**, after emulator tests pass:
   `firebase deploy --only firestore:rules --project gd11-demonlist`
   This requires a trusted authenticated CLI session; never commit a service-account key or paste one into chat.
3. On the default branch, enable GitHub Actions if necessary and run **Demonlist watchdog** manually. Check all 13 probes pass. Scheduled runs target every 15 minutes; they may be delayed. Public repository schedules can be disabled after 60 days without repository activity. Check the last successful run regularly; this is not guaranteed continuous monitoring.
4. Configure your own GitHub Actions failure notifications. The workflow creates failed runs and logs, not custom email or Discord messages. It needs no Firebase admin credentials.
5. In the Firebase/Google Cloud console, configure project budget alerts, usage alerts, scheduled Firestore backups and retention suitable for your data. Verify a restore in an isolated project. These settings require project access/billing and are **not enabled by this code**.

## Incident response

A failed probe is a signal to investigate, not proof of a breach. Network errors, quota limits and service outages also fail checks. The watchdog neither modifies rules nor deletes or restores production data.

If private access is unexpectedly allowed, promptly have a project administrator restore the known-good Firestore rules. Preserve relevant Cloud audit logs and deployment history. Restrict compromised IAM accounts/service accounts, revoke affected sessions and rotate compromised credentials. Review Firebase custom claims and moderator team membership. Rules do not constrain trusted Admin SDK access: IAM and credential protection are also required. Verify the source of the exposure before restoring data; test backups in isolation before any production restore. Notify affected users when required.

This monitor checks anonymous exposure only. It does not detect every authenticated access bug, account compromise, exfiltration, malicious admin action, write-rule weakness or Storage exposure. Permission tests cover selected write and role boundaries locally. No system can promise breach-proof operation or permanent uptime.

## Validation commands

```
npm ci
npm test
npx playwright install --with-deps chromium
npm run test:browser
npx firebase-tools@14.17.0 emulators:exec --only firestore --project demo-demonlist 'npm run test:rules'
node scripts/watchdog.js
```

Use Node 22 and Java 17+ for the existing emulator tooling. Production access checks do not write data. See the PR for actual check results; the commands above are not claims of success.

References:
- https://firebase.google.com/docs/firestore/security/rules-query
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
