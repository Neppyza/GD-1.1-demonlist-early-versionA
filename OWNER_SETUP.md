# Activate owner access

The website is prepared, but authentication and authorization must be configured in Firebase before administration is secure and usable. No owner permission has been granted by this change.

1. Firebase Console → Authentication → Sign-in method: enable Google.
2. Authentication → Settings → Authorized domains: add `neppyza.github.io`.
3. Review and publish `firestore.rules` in Firestore → Rules. It allows public level and approved-record reads, restricts writes to owner/admin claims, and denies other collections. Merge any legitimate existing rules before publishing; do not replace unrelated rules blindly. Deploy these rules before using the dashboard.
4. Open `admin.html`, sign in with your own Google account, and copy the UID shown. Do not share passwords or tokens.
5. In a trusted local/server environment with Firebase Admin credentials for `gd11-demonlist`, install `firebase-admin` and run `node scripts/grant-owner.cjs YOUR_UID`. Never place Admin credentials in GitHub or browser code. The script targets this project and preserves existing claims.
6. Sign out and sign in again. The dashboard should show owner/admin access enabled. Verify unauthenticated accounts cannot write, and your owner account can save a level and an approved record.

## Stats records

Create documents in top-level `records` using the dashboard or console:

- `playerId`: stable player ID (string)
- `player`: displayed name (string)
- `levelId`: existing level document ID (string)
- `progress`: 100 (number)
- `approved`: true (boolean)

Stats sum current level points for approved full completions; duplicate records for the same player and level count once. Use consistent player names/IDs. Rank ties break by completion count then name. Partial completions do not award points in this version.

## Firebase project Owner

This differs from website owner access. An existing project Owner must open Firebase Project settings → Users and permissions, verify your Google account, and assign Owner if appropriate. Website custom claims do not grant console/IAM access. Do not grant this role to an unverified account.
