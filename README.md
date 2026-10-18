# GD1.1 Demonlist

A community-maintained Roblox Geometry Dash 1.1 Demonlist using vanilla HTML/CSS/JavaScript, the existing Firebase project, and GitHub Pages. No runtime build step is required.

**Public website:** [GD1.1 Demonlist](https://neppyza.github.io/GD-1.1-demonlist-early-versionA/).

The public site uses consistent GD1.1 Demonlist branding, a refreshed blue layout, self-hosted Montserrat, and responsive light/dark themes. Level detail links update the URL and support browser Back/Forward. Canonical URLs, social preview metadata, a public sitemap and a recovery page are included.

Join the community through the **Join our Discord** section on the list page or **Join Discord** in every page footer: [Discord server](https://discord.gg/BKFhzNkBW).

## Accounts and moderation

Players sign in with Google, accept the community rules, choose their country or territory, and publish their name, bio and self-described tags. The picker includes 250 countries and territories. Local SVG flags and country names appear in the leaderboard and public player details, and Players search also matches countries. Existing players keep their points and completion history; they choose a country the next time they complete account setup. New profiles start with zero points. Approved 100% completion records determine leaderboard scores.

The **Admin** panel at `admin.html` supports:

- Reviewing and publishing pending level submissions.
- Adding an optional public HTTPS thumbnail link when publishing a level.
- Watching proof, accepting or rejecting pending completion submissions.
- Approving a completion manually using the existing stable player/level record key, preserving stored proof when reapproving.
- Editing published level names, positions, optional difficulty labels, and points (including 0) in **Manage levels**. Scores recalculate automatically. Position edits apply only to the selected level; other levels keep their positions. Existing level IDs, links, and completion history are preserved. If another moderator edits the level first, refresh before saving.
- Removing a victor from a level by revoking all loaded approved records for that player/level, including legacy duplicates. Records and proofs are retained; manual approval can restore the completion. Refresh levels to see recent changes.
- Searching registered and legacy players, removing them from Players, and restoring them.
- Adding and revoking moderators from the owner’s Team section.

Owners are identified by a trusted Firebase `owner: true` custom claim. The owner chooses an existing registered player to add to `team/{uid}` as a moderator. Moderators can review submissions and manage players; they cannot grant roles or manage the team. Existing admin claims continue working unless the owner explicitly revokes that user through a team entry. Firestore rules enforce the permissions independently of the interface.

Removing a player sets a moderation flag in their public `players/{id}` document. It hides both their profile and record-derived leaderboard entry, preserves their approved completion history, and prevents them from deleting the flag or republishing their profile. Restore makes their existing scores visible again. Removal does not delete the Google account.

Completion proofs are stored privately in `completionSubmissions`. Accepting a proof updates its review state and creates an approved record in a transaction. Repeated proof submissions for the same player/level share the existing record key and do not duplicate points or overwrite a previously accepted proof. Submitters can follow review status in Account.

## Deploy and enable owner access

1. Review and publish this repository’s `firestore.rules` in the existing **gd11-demonlist** project. The update adds required `countryCode` fields on profile writes alongside the existing `team`, `completionSubmissions` and player moderation permissions. Deploy the rules before merging the country feature so country choices can be saved. A GitHub Pages deployment does not publish Firebase rules.
2. Deploy the website through its existing GitHub Pages setup.
3. Open Admin, sign in with your owner Google account, and copy your Firebase UID.
4. Have an administrator of the Firebase project run the trusted `scripts/grant-owner.cjs` script for that UID, or use `--email OWNER_EMAIL [OTHER_OWNER_EMAIL ...]` to resolve existing Google accounts directly. `--dry-run` verifies targets without changing claims. Select **Retry access check** afterward.
5. Teammates sign in and save their player profile. As owner, open Admin → Team, select the correct player/UID and choose **Add moderator**. They can open Admin and retry access.

See [OWNER_SETUP.md](OWNER_SETUP.md) for owner setup, deployment, data fields and Google sign-in troubleshooting. Firebase project administration and website ownership are separate permissions.

For the exact Submit → Admin publishing workflow and thumbnail examples, see [Add levels and thumbnails](OWNER_SETUP.md#add-levels-and-thumbnails).

## Implementation

- `countries.js`, `flags/`: country-code catalog and local SVG flags with included MIT licenses.
- `auth.js`, `site.js`: Google authentication, session restoration, refreshed owner/moderator permissions and profile onboarding.
- `admin.js`, `admin-management.js`: level review, manual records, completion review, player moderation and owner-only team management.
- `community.js`, `completion-model.js`: account/profile setup, private submissions, completion validation and stable record keys.
- `data.js`, `list-model.js`, `stats-model.js`, `victors.js`: shared public listeners, filtering/sorting, deduplicated scores and removed-player exclusion.
- `style.css`, `theme.js`, `fonts/`: shared responsive styles, themes and Montserrat with its OFL license.
- `firestore.rules`: enforced member, moderator and owner permissions.

Firebase configuration, private profile access, images, stable record identities and the rule agreement version are retained. Profile writes now include the required `countryCode` field in both private `profiles/{uid}` and public `players/{uid}` documents. The new moderation fields and collections are documented in owner setup.

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

- All 13 model tests passed, including country catalog coverage, required country setup, country changes that preserve scores, and removed-player restoration, proof validation and collision-safe completion keys.
- All 6 owner setup tests passed, including multiple email targets, claim preservation, missing/invalid identities, verified Google accounts, dry-run behavior and the existing UID invocation.
- The full browser suite passed: completion submission/review/rejection, duplicate proof preservation, denied-write recovery, owner-only moderator management, access refresh/revocation, removal/restoration with history retained, font loading, authentication and seven pages at six viewport widths.
- All 90 Firestore emulator permission checks passed, including invalid/missing countries, atomic private/public country changes, privilege escalation attempts, private proof access, moderation bypasses and revoked moderator/admin access.
- Desktop/mobile layouts were visually inspected. Syntax and whitespace checks passed.

Production owner claims and rules deployment require access to the Firebase project and were not changed by these tests.

## Connection status and watchdog

The list includes connection status and retries when the browser comes back online. See [SECURITY_OPERATIONS.md](SECURITY_OPERATIONS.md) for activating the scheduled watchdog, deploying the rule updates, backup setup and incident response. These operational steps require owner action; adding this source alone does not activate Firebase protections.

## Correct an individual player's points

Deploy the updated `firestore.rules` to `gd11-demonlist` **before publishing this frontend**. The leaderboard now reads `pointAdjustments`; older rules deny that collection. During a failed or pending correction load, the directory remains visible with explicitly labelled completion-only scores and provisional ranks; Admin hides point correction forms until the collection can be read.

As an owner, admin or active team moderator, open Admin → Players, find the player, and enter **Point correction (+ / −)**. Example: if completion points are 100 and the correct total is 90, enter `-10`. Save the correction. Enter `0` to reset. This replaces the previous correction, rather than adding it repeatedly. Future completions and level point changes continue to affect the total. Totals are clamped at zero.

Corrections are stored separately from profiles and completion records; profile updates cannot erase them. Owners, trusted Firebase admins and active team moderators can write corrections. Ordinary players and revoked staff cannot. Team membership management remains owner-only. Amount, last editor UID and server timestamp are public, with no private notes. Concurrent edits to the correction require refreshing. For an incorrect completion itself, revoke its record instead.
