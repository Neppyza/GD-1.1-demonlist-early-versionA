# Firebase setup

The player hub uses Firebase Authentication with Google sign-in. Configure Firebase before enabling the new pages.

1. In Firebase Console → Authentication → Sign-in method, enable **Google**.
2. In Authentication → Settings → Authorized domains, add `neppyza.github.io`.
3. Review and publish `firestore.rules` in Firestore → Rules. The rules keep profiles private to their owner, let signed-in users create pending level submissions, and limit submission review and level publishing to owner/admin custom claims. Merge any legitimate existing rules before publishing.
4. After the site is published, open `community.html`, sign in with Google, and create your private profile. Submit a level with its link, creator, verifier, and video proof. Submissions are private while pending.
5. To enable staff review, sign in at `admin.html` with the staff Google account and copy its Firebase UID. Do not share passwords or tokens.
6. In a trusted local/server environment with Firebase Admin credentials for `gd11-demonlist`, install `firebase-admin` and run `node scripts/grant-owner.cjs YOUR_UID`. Never put Admin credentials in GitHub or browser code. The script preserves other custom claims.
7. Sign out and sign in again so Firebase refreshes the custom claims. Staff can review the queue at `admin.html`. Approval publishes the level with the staff-assigned position and points; rejection leaves it private.

## Privacy and moderation

- A user's profile document is stored at `profiles/{uid}`; Firestore allows only that signed-in user to read or edit it.
- Pending submissions are visible only to their submitter and staff. They become public level entries only after staff approval.
- Names must be appropriate and respectful. Staff must reject inappropriate names, content, or incomplete proof before publication.
- Every new level needs an HTTPS level link, a verifier, and an HTTPS completion video link.

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


## Theme, community rules and victors update

Deploy the updated Firestore rules with the website. Google sign-in remains the only supported provider. New and existing members must accept community rules version `2026-10-05` before editing profiles or submitting levels. Acceptance is saved privately in `agreements/{uid}` and checked by database rules. These are community guidelines plus staff review, not an automatic profanity classifier.

The header theme button follows the system preference initially, then remembers the player's light/dark choice.

Staff can use **Add a victor** at `admin.html` after checking completion proof. Victors come from approved 100% `records`, are deduplicated by player ID, and also appear in Stats. Existing levels need no schema migration.

The staff page now displays the signed-in Firebase UID. An existing project administrator must run the owner-grant script in a trusted environment. This update does not itself grant an account access or change Firebase console settings.
