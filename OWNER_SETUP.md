# GD 1.1 Demonlist: Firebase and staff setup

The website keeps the existing `gd11-demonlist` Firebase project and Google sign-in. New Google users create their Firebase account through the same **Continue with Google** button. Email/password and Roblox OAuth are not configured by this website.

## Deploy the admin and completion update

Review and publish the updated `firestore.rules` in the existing Firebase project's **Firestore Database → Rules** before deploying this website update. GitHub Pages cannot deploy these rules. Preserve any legitimate production-specific rules when comparing them with the repository.

The update adds `team/{uid}` for owner-managed moderator membership and `completionSubmissions/{id}` for private 100% proof review. It also adds `removed`, `moderatedBy` and `moderatedAt` fields to public player documents. Existing private profiles and approved record history keep their current access and fields. No manual profile migration or new Firebase project is needed.

Only a Google account with a trusted `owner: true` custom claim can manage the team. GitHub repository ownership does not automatically identify a Google account. Follow **Staff access** below once for your own UID. The Admin page displays the signed-in UID and can refresh access without a full sign-out.

After deployment, teammates sign in and save their player profile. Open **Admin → Team**, select the teammate by name and UID, and choose **Add moderator**. They can open `admin.html` and select **Retry access check**. Moderators can review levels, accept/reject completions, and remove/restore public players. They cannot add moderators or grant owner access.

**Remove moderator** records `active: false` in the team entry. It immediately denies new administrative requests, including requests using an old `admin: true` claim. Do not delete a revoked team entry, because its existence records that explicit revocation. Owner custom claims remain authoritative and are changed only through the trusted Firebase administrator workflow.

**Remove player** hides the public profile and leaderboard entry and blocks profile republication. Approved completion history is kept. **Restore player** makes the existing scores visible again. This action does not delete the Firebase Authentication account or revoke team membership; manage moderator access separately in Team.

Players use **Submit → Submit a completion** to select a listed level and send HTTPS video proof. They can see its status in Account. In **Admin → Completions**, watch the video, tick the proof-check box and accept or reject it. Acceptance creates the public 100% record and marks the private submission reviewed in one transaction. Repeated submissions do not duplicate scores or replace previously accepted proof.

## Earlier authentication blocker (9 October 2026)

A read-only request to the Firebase Authentication project-configuration endpoint, using the existing public web API key, returned HTTP 400 with `CONFIGURATION_NOT_FOUND`. The earlier login test with the real modular Firebase SDK returned `auth/configuration-not-found` and keeps the user signed out.

That test identified a project-side configuration blocker. The previous handler hid it behind “Google sign-in did not finish.” The private Firebase Console is needed to determine whether Authentication has never been initialized or the web API key belongs to a differently configured project. The endpoint cannot confirm provider or authorized-domain settings while this configuration is missing. The old SDK imports were consistent, and Firebase's default browser persistence was already local; those were not established causes of this failure.

The owner has since confirmed Google sign-in works. The steps below remain a troubleshooting reference.

## Google sign-in setup in the existing project

1. Open [Firebase Console](https://console.firebase.google.com/project/gd11-demonlist/authentication) and confirm the selected project is **gd11-demonlist**. In Authentication, choose **Get started** if setup has not been completed.
2. Under **Authentication → Sign-in method**, enable **Google**, select a project support email, and save. Follow [Firebase's Google sign-in setup](https://firebase.google.com/docs/auth/web/google-signin).
3. Under **Authentication → Settings → Authorized domains**, add **neppyza.github.io**. Enter the hostname only, without `https://` or the repository path. Add your custom hostname if you use one. Add `localhost` only if you want to test Google sign-in locally; it may not be authorized by default.
4. Under **Project settings → General → Your apps**, compare the existing web application's configuration with `firebase.js`. Check `apiKey`, `projectId`, `authDomain`, and `appId` together. Preserve this project and app; do not substitute a newly created Firebase project. A public Firebase web API key is not a service-account credential.
5. If configuration is still missing after saving, check that the key belongs to this project and that its API restrictions permit Firebase Authentication. Do not broadly disable restrictions as a workaround. Confirm the sign-in error and project settings with Firebase support if they still disagree.
6. Compare the currently deployed Firestore rules with `firestore.rules`. Website deployment does not publish these rules. The included rules require Google authentication and current community-rule acceptance for member writes. Administrative writes require an owner claim, active moderator membership, or an existing admin claim without an explicit team revocation. Preserve any legitimate production rules when reviewing a deployment.

No new frontend environment variables are required: this remains a static site using the existing public configuration. Never add a service-account JSON file, private key, Google client secret, or Admin SDK credentials to frontend code or GitHub.

## Enable public player profiles and the leaderboard

The player-profile update adds **one new collection**, `players/{uid}`, without changing existing `profiles`, `levels`, `records`, `agreements`, or `submissions` fields. Do not manually migrate or publish existing private profiles.

1. Review the proposed `firestore.rules`. In the existing **gd11-demonlist** project, open **Firestore Database → Rules**. Compare the deployed rules with the repository first and retain any legitimate production-specific rules.
2. Publish the reviewed rules including the new `match /players/{uid}` block. The feature cannot save player profiles under the old rules. GitHub Pages deployment alone does not deploy Firebase rules. If the deployed rules match the previous repository version, this update only adds the `players` block.
3. Merge/deploy the website update. Sign in and complete **Account**: accept the rules, choose a 3–24 character player name, review the public bio, and select at least one Player/Creator/Verifier tag. Save profile.
4. Verify that the player appears in Players with 0 points and no completions, then refresh. A new document is created by the successful save; you do not need to create the collection manually.

Name, bio and tags are explicitly public. Google email, provider credentials, and private submissions are never copied. Existing private bios are shown as an editable draft and become public only when the owner saves the clearly labeled public profile. The existing private profile and the new directory entry are written atomically, so a denied directory write cannot leave a partially saved profile. Registered users are prompted to complete setup before ordinary site navigation; Rules and Admin remain accessible during setup. Existing profiles require this one-time publication step.

`players/{uid}` contains only `displayName`, `bio`, `tags`, and `updatedAt`. Its owner must use Google sign-in, accept the existing rules version, and write values matching their private profile. Tags are self-described interests, not staff roles or certified achievements. Clients cannot add scores, claims, email, or extra fields. Approved records remain the only source of leaderboard points; zero-point profiles and legacy record-only players both remain visible.

To attach a registered player's approved completions, staff must use that user's Firebase UID as the existing record `playerId`. The UID is shown in Account. Names are not used to merge identities. Preserve older stable IDs for legacy players; linking unrelated legacy IDs to a registered user requires a separately reviewed migration and is not done automatically.

## Staff access

1. After Google sign-in works, sign in with the staff account at `admin.html` and copy the displayed Firebase UID.
2. In a trusted local/server environment, install `firebase-admin` and provide Application Default Credentials for **gd11-demonlist**. Run `node scripts/grant-owner.cjs YOUR_UID`. The existing script preserves other custom claims. Do not commit credentials or put this script in browser code.
3. Select **Retry access check** at `admin.html`, or sign out and sign in again. The Admin link and owner-only Team section appear after Firebase verifies the claim. Owners and moderators can review pending submissions, accept completions, and manage public players. Only the owner can manage moderator membership.

Website claims grant website privileges only. They do not grant Firebase Console or Google Cloud IAM access. An existing project administrator manages Console permissions separately.

### Assign owner access by email

Each intended owner must first sign in to the website with **Continue with Google**, so their account exists in this Firebase project. In a trusted administrator environment with Node.js, install the Admin SDK and configure Application Default Credentials for an account allowed to manage Firebase Authentication in **gd11-demonlist**. GitHub access and the public website API key cannot perform this step.

From the repository directory, replace the example addresses with the owners' actual Google emails:

```sh
npm install --no-save --package-lock=false firebase-admin
node scripts/grant-owner.cjs --email first-owner@example.com second-owner@example.com --dry-run
node scripts/grant-owner.cjs --email first-owner@example.com second-owner@example.com
```

The dry run verifies both existing identities without changing claims. The grant command resolves all targets before writing, requires enabled verified Google accounts, and preserves their other custom claims. If an account is missing, sign in with that Google account first. If a later write fails after an earlier grant, the script prints each completed grant; check the reported error and rerun after resolving it.

After successful assignment, both accounts can open **Admin** and select **Retry access check**, or sign out and in again. Each owner can manage players, completions and moderators. Publish the repository's Firestore rules as described above so these operations are permitted. Email addresses are supplied to the trusted script; they are not added as a frontend role shortcut.

## Add levels and thumbnails

1. Sign in with Google, accept the rules, and save your player name in **Account**. To publish a submission, your Google account also needs owner/moderator access and the current Firestore rules must be deployed.
2. Open **Submit → Submit a new level**. Enter its **Level name**, **Creator**, **Verifier**, **Level link** and **Completion video**. The level link opens the playable level; the completion video is the verifier's proof. Both links must start with `https://`. Add optional reviewer notes, tick the confirmation and choose **Send for review**.
3. Open **Admin → Levels** and choose **Refresh queue**. Find your submission and watch its proof. Enter **Position** (a whole number starting at 1), **Points** (0 or higher), optional **Difficulty**, and optional **Thumbnail URL**. Position 1 is the hardest listed level. Choose an unused placement; publishing does not automatically shift the other levels' positions.
4. For a thumbnail, paste a direct, public HTTPS image link, for example `https://your-image-host.example/level-preview.jpg`. Open it in a private browser tab first: it should display the image without signing in. A video watch page or image-sharing gallery page is not a direct image link. A screenshot of the level works well; a wide image around 16:9 suits the existing preview box. Leave the field empty if you do not have an image yet.
5. Choose **Approve and publish**. The level appears on the Demonlist with the selected rank, points and thumbnail. If its image URL is unavailable, the preview shows **No preview**. Publishing a level does not automatically award the verifier a completion: use **Submit a completion**, then review it in **Admin → Completions**, or use **Approve a completion manually** with their existing player ID.

For an already-published level, an administrator with **Firebase Console** permissions can open **Firestore Database → Data → levels**, select its existing document, and add or edit the `thumbnail` field as a **string** containing the direct HTTPS image URL. Preserve the document ID and all other fields. Refresh the website to check the image. The website's owner role does not itself grant Firebase Console access.

To host a thumbnail in this public GitHub repository, open the repository and choose **Add file → Upload files**, select a PNG/JPEG screenshot such as `my-level.png`, then commit it through a branch and merge its pull request. If the file is at the root of `main`, its direct image link is `https://raw.githubusercontent.com/Neppyza/GD-1.1-demonlist-early-versionA/main/my-level.png`. Replace `my-level.png` with the exact filename, including capitalization. Test that link before pasting it into **Thumbnail URL**. See [GitHub's upload instructions](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

If **Admin** says the account has no access, finish the owner setup above and select **Retry access check**. If saving is denied, verify the deployed Firestore rules and signed-in account. If a thumbnail shows **No preview**, check that the URL is direct, public, and still accessible; some image hosts block embeds.

## Existing data and moderation

- `levels`: existing public level documents and fields are preserved, including numeric strings for positions and points. Missing positions are displayed as unranked after ranked entries. No migration is required.
- `records`: public reads query `approved == true`. Full completions use `progress: 100`, `playerId`, `player`, and `levelId`; duplicate player/level completions count once in Players and victors. Partial completions award no points in this version. Optional proof links are shown only when already present.
- `profiles/{uid}`: existing private player name and bio, with unchanged fields and permissions.
- `players/{uid}`: new explicitly public name, bio, tags, and timestamp, keyed by Firebase UID.
- `players/{id}` moderation fields: a staff-only `removed` flag with actor/time; record-only legacy players may have a minimal moderation entry without a registered profile.
- `team/{uid}`: owner-managed moderator `role`, `active`, `displayName`, `updatedBy`, and `updatedAt`. Owners can list the roster; signed-in users can read their own membership.
- `completionSubmissions/{id}`: submitter UID/name, level ID, HTTPS proof, notes, pending status and submission time. The submitter and staff can read it; only staff can review it and record the review actor/time.
- `agreements/{uid}`: private acceptance of community rules version **2026-10-05**. This version is unchanged.
- `submissions`: the existing pending submission fields remain unchanged. A saved player name, verifier, HTTPS level link, HTTPS video proof, and rules confirmation are required. Pending submissions are visible only to their submitter and staff.

Staff must review proof and reject inappropriate names or content. Approval publishes a staff-assigned position and points; rejection keeps the submission private. Transactions prevent two reviews from publishing the same pending submission twice. Neither the redesign nor its tests writes to the production database.

## Manual verification after deployment

- Sign in with a new Google account and with an existing account. Confirm Account appears in the navbar, refresh, and confirm the same session returns. Sign out and confirm private forms and fields clear.
- Close the Google window before completion; verify the page remains signed out with an understandable message. Invalid Google credentials are handled by Google's own account window; this site has no password form.
- Accept the rules, save your profile, and submit a level. Verify your public player appears with 0 points, exactly one private pending submission is created, and level rankings remain unchanged.
- With an ordinary account, confirm Admin is unavailable and Firestore rejects direct administrative writes. With an approved staff account, verify queue access. Review a real submission only when you intend to publish or reject it.
- Verify the live Firestore rules match the reviewed rules, then check ranks, search, record links, mobile layout, and the browser console on the deployed GitHub Pages URL.

The owner reports live Google sign-in now works. The earlier live test was blocked by `CONFIGURATION_NOT_FOUND`. The new public-profile flow still needs the reviewed rules published and a real signed-in account check. The repository's browser fixtures and Firestore emulator tests cover these UI and permission paths without pretending to authenticate against production.
