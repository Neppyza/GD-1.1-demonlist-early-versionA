# GD 1.1 Demonlist

A community-maintained Roblox Geometry Dash 1.1 Demonlist using vanilla HTML/CSS/JavaScript, the existing Firebase project, and GitHub Pages. No runtime build step is required.

The shared typography uses self-hosted Montserrat, regular body text and bold headings to match Pointercrate’s font treatment. Light/dark themes and mobile layouts are supported.

Join the community through the **Join our Discord** section on the list page or **Join Discord** in every page footer: [Discord server](https://discord.gg/BKFhzNkBW).

## Accounts and moderation

Players sign in with Google, accept the community rules, and publish their name, bio and self-described tags. New profiles start with zero points. Approved 100% completion records determine leaderboard scores.

The **Admin** panel at `admin.html` supports:

- Reviewing and publishing pending level submissions.
- Adding an optional public HTTPS thumbnail link when publishing a level.
- Watching proof, accepting or rejecting pending completion submissions.
- Approving a completion manually using the existing stable player/level record key.
- Searching registered and legacy players, removing them from Players, and restoring them.
- Adding and revoking moderators from the owner’s Team section.

Owners are identified by a trusted Firebase `owner: true` custom claim. The owner chooses an existing registered player to add to `team/{uid}` as a moderator. Moderators can review submissions and manage players; they cannot grant roles or manage the team. Existing admin claims continue working unless the owner explicitly revokes that user through a team entry. Firestore rules enforce the permissions independently of the interface.

Removing a player sets a moderation flag in their public `players/{id}` document. It hides both their profile and record-derived leaderboard entry, preserves their approved completion history, and prevents them from deleting the flag or republishing their profile. Restore makes their existing scores visible again. Removal does not delete the Google account.

Completion proofs are stored privately in `completionSubmissions`. Accepting a proof updates its review state and creates an approved record in a transaction. Repeated proof submissions for the same player/level share the existing record key and do not duplicate points or overwrite a previously accepted proof. Submitters can follow review status in Account.

## Deploy and enable owner access

1. Review and publish this repository’s `firestore.rules` in the existing **gd11-demonlist** project. The update adds `team` and `completionSubmissions` permissions and player moderation rules. A GitHub Pages deployment does not publish Firebase rules.
2. Deploy the website through its existing GitHub Pages setup.
3. Open Admin, sign in with your owner Google account, and copy your Firebase UID.
4. Have an administrator of the Firebase project run the trusted `scripts/grant-owner.cjs` script for that UID, or use `--email OWNER_EMAIL [OTHER_OWNER_EMAIL ...]` to resolve existing Google accounts directly. `--dry-run` verifies targets without changing claims. Select **Retry access check** afterward.
5. Teammates sign in and save their player profile. As owner, open Admin → Team, select the correct player/UID and choose **Add moderator**. They can open Admin and retry access.

See [OWNER_SETUP.md](OWNER_SETUP.md) for owner setup, deployment, data fields and Google sign-in troubleshooting. Firebase project administration and website ownership are separate permissions.

For the exact Submit → Admin publishing workflow and thumbnail examples, see [Add levels and thumbnails](OWNER_SETUP.md#add-levels-and-thumbnails).

## Implementation

- `auth.js`, `site.js`: Google authentication, session restoration, refreshed owner/moderator permissions and profile onboarding.
- `admin.js`, `admin-management.js`: level review, manual records, completion review, player moderation and owner-only team management.
- `community.js`, `completion-model.js`: account/profile setup, private submissions, completion validation and stable record keys.
- `data.js`, `list-model.js`, `stats-model.js`, `victors.js`: shared public listeners, filtering/sorting, deduplicated scores and removed-player exclusion.
- `style.css`, `theme.js`, `fonts/`: shared responsive styles, themes and Montserrat with its OFL license.
- `firestore.rules`: enforced member, moderator and owner permissions.

Existing Firebase configuration, collection fields, private profile access, images, stable record identities and rule agreement version are retained. The new moderation fields and collections are documented in owner setup.

## Run checks

Use Node 22 or later:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

For Firestore permission checks, install Java 17 and run the local emulator:

```sh
npx firebase-tools@14.17.0 emulators:exec --only firestore --project demo-demonlist 'npm run test:rules'
```

The `demo-demonlist` namespace is used only by the local emulator. Browser tests intercept the SDK with test fixtures and do not write to the production database. Test screenshots are saved in ignored `test-output/`. A preinstalled browser can be supplied with `DEMONLIST_CHROMIUM`; `DEMONLIST_PLAYWRIGHT_MODULE` and `DEMONLIST_TEST_OUTPUT` support constrained test environments.

## Verification

- All 10 model tests passed, including removed-player restoration, proof validation and collision-safe completion keys.
- All 6 owner setup tests passed, including multiple email targets, claim preservation, missing/invalid identities, verified Google accounts, dry-run behavior and the existing UID invocation.
- The full browser suite passed: completion submission/review/rejection, duplicate proof preservation, denied-write recovery, owner-only moderator management, access refresh/revocation, removal/restoration with history retained, font loading, authentication and seven pages at six viewport widths.
- All 81 Firestore emulator permission checks passed, including privilege escalation attempts, private proof access, moderation bypasses and revoked moderator/admin access.
- Desktop/mobile layouts were visually inspected. Syntax and whitespace checks passed.

Production owner claims and rules deployment require access to the Firebase project and were not changed by these tests.
