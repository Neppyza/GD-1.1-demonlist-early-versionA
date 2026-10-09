# Crux

A community-maintained Roblox Geometry Dash 1.1 Demonlist. **Crux** names the hardest part of a challenge: a short, ordinary community name rather than a product slogan.

The existing vanilla HTML/CSS/JavaScript project and Firebase backend are retained. There is no runtime build step, replacement database, demo dataset, schema migration, or new Firebase project. Serve the repository over HTTP or publish through its existing GitHub Pages setup.

## Pages and implementation

The Demonlist has a thumbnail-led ranking rows and a separate ranking index, real thumbnails with fallbacks, creator/verifier/category metadata, points, approved victor counts, search, placement/name/points sorting, and linked level details. Players, Records, Submit, Rules, Account, and Staff share the same typography, blue accent, accessible navigation, light/dark palettes, and responsive layout. Missing fields are displayed explicitly rather than filled with fictional data.

- `firebase.js`, `auth.js`, `messages.js`, `site.js`: one modular Firebase SDK version, shared actual authentication state, explicit local persistence, Google login/logout, visible failures, safe return destinations, and refreshed staff-claim checks.
- `data.js`, `list-model.js`, `ui.js`: shared public collection listeners, real-data filtering/sorting, safe DOM rendering, validated external links, and loading/error/empty states.
- `app.js`, `stats.js`, `records.js`, `victors.js`: ranking/details, Players, approved records, and deduplicated full completions. Existing `stats-model.js` is retained.
- `community.js`, `admin.js`: private profiles, unchanged rule agreements and pending submissions, staff review transactions, and the existing stable completion-record keys. Private fields clear when identity changes or the user signs out.
- `index.html`, `stats.html`, `records.html`, `submit.html`, `rules.html`, `community.html`, `admin.html`, `profile.html`: Crux branding and metadata throughout; the legacy profile route still redirects to Account.
- `style.css`, `theme.js`, `favicon.svg`: shared visual system and text logo. Existing theme preferences are respected.
- `OWNER_SETUP.md`, `ROBLOX_SETUP.md`: setup, current authentication blocker, preserved data fields, and manual checks.
- `package.json`, `package-lock.json`, `.gitignore`, `firebase.json`, `tests/`: development-only verification tools. `firestore.rules`, the project IDs, collection names, existing images, and `scripts/grant-owner.cjs` are unchanged.

## Authentication setup

The existing project's real Auth configuration endpoint returned **CONFIGURATION_NOT_FOUND** on 9 October 2026. The previous popup handler concealed this with a generic failure message. The redesign exposes the error and never treats it as a successful login. The existing default persistence was already local; the redesign makes it explicit and tests restoration behavior.

An owner must initialize Authentication, enable Google, authorize the deployed hostname, and compare the existing web-app settings in Firebase Console. See [OWNER_SETUP.md](OWNER_SETUP.md) for exact steps. No frontend environment variables or private credentials are needed.

## Run checks

Use Node 22 or later. Install development dependencies with `npm ci`.

```sh
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite starts its own local HTTP server. It deliberately uses browser-only SDK fixtures so tests never write to production or fake a successful production login. It exercises search/sorting, ranked/unranked section filters, one public listener per collection, record deduplication, detail routes, explicit auth failures, duplicate-action prevention, private-field cleanup, protected submissions/staff flows, and seven pages at widths 320, 390, 540, 768, 1024, and 1440. It saves screenshots to ignored `test-output/`.

For permission checks, install Java 17 and use the Firebase CLI's local emulator:

```sh
npx firebase-tools@14.17.0 emulators:exec --only firestore --project demo-crux 'npm run test:rules'
```

`demo-crux` is an emulator-only namespace. No Firebase project is created. The suite loads the unchanged `firestore.rules`, seeds only local fixtures, and asserts public-read, private-data, member-write, provider, agreement, and administrator permissions. Never run these rule fixtures against production.

For a preinstalled browser in a constrained environment, `CRUX_CHROMIUM` supplies its executable and `CRUX_PLAYWRIGHT_MODULE` supplies an existing Playwright module. `CRUX_TEST_OUTPUT` changes the screenshot directory. These variables are test tools only, not site configuration.

## Verification performed

- Six model tests passed: numeric legacy rankings, sorting, search, deduplication, safe redirects, and readable error messages.
- All browser assertions passed, including seven pages at six widths, local routes, light/dark themes, and no uncaught JavaScript errors. Authentication restoration and successful staff UI paths in this suite use SDK fixtures.
- All 28 Firestore emulator permission assertions passed against the unchanged rules, including rejecting administrative writes from guests, ordinary members, and accounts using the wrong provider.
- A separate read-only browser run with the actual Firebase modular SDK loaded the existing project's three real level documents and zero approved records, verified search/sorting, and confirmed the actual `auth/configuration-not-found` failure displays clearly while the user remains signed out. No uncaught JavaScript errors occurred in that run.
- Syntax and whitespace checks passed. Production data was not modified.

Successful production Google sign-in, production refresh restoration/logout, private data, deployed rules, and staff operations still require the Firebase Console setup and manual checks in `OWNER_SETUP.md`. They are not claimed as passed.
