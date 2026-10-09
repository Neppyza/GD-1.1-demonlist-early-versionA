# GD 1.1 Demonlist: Firebase and staff setup

The website keeps the existing `gd11-demonlist` Firebase project and Google sign-in. New Google users create their Firebase account through the same **Continue with Google** button. Email/password and Roblox OAuth are not configured by this website.

## Authentication blocker found on 9 October 2026

A read-only request to the Firebase Authentication project-configuration endpoint, using the existing public web API key, returned HTTP 400 with `CONFIGURATION_NOT_FOUND`. Clicking the redesigned login button with the real modular Firebase SDK returns `auth/configuration-not-found` and keeps the user signed out.

This is a project-side configuration blocker. The previous handler hid it behind “Google sign-in did not finish.” The private Firebase Console is needed to determine whether Authentication has never been initialized or the web API key belongs to a differently configured project. The endpoint cannot confirm provider or authorized-domain settings while this configuration is missing. The old SDK imports were consistent, and Firebase's default browser persistence was already local; those were not established causes of this failure.

## Complete these steps in the existing project

1. Open [Firebase Console](https://console.firebase.google.com/project/gd11-demonlist/authentication) and confirm the selected project is **gd11-demonlist**. In Authentication, choose **Get started** if setup has not been completed.
2. Under **Authentication → Sign-in method**, enable **Google**, select a project support email, and save. Follow [Firebase's Google sign-in setup](https://firebase.google.com/docs/auth/web/google-signin).
3. Under **Authentication → Settings → Authorized domains**, add **neppyza.github.io**. Enter the hostname only, without `https://` or the repository path. Add your custom hostname if you use one. Add `localhost` only if you want to test Google sign-in locally; it may not be authorized by default.
4. Under **Project settings → General → Your apps**, compare the existing web application's configuration with `firebase.js`. Check `apiKey`, `projectId`, `authDomain`, and `appId` together. Preserve this project and app; do not substitute a newly created Firebase project. A public Firebase web API key is not a service-account credential.
5. If configuration is still missing after saving, check that the key belongs to this project and that its API restrictions permit Firebase Authentication. Do not broadly disable restrictions as a workaround. Confirm the sign-in error and project settings with Firebase support if they still disagree.
6. Compare the currently deployed Firestore rules with `firestore.rules`. The redesign does **not** modify or automatically deploy rules. The included rules require Google authentication and current community-rule acceptance for member writes, and `owner: true` or `admin: true` custom claims for staff writes. Preserve any legitimate production rules when reviewing a deployment.

No new frontend environment variables are required: this remains a static site using the existing public configuration. Never add a service-account JSON file, private key, Google client secret, or Admin SDK credentials to frontend code or GitHub.

## Staff access

1. After Google sign-in works, sign in with the staff account at `admin.html` and copy the displayed Firebase UID.
2. In a trusted local/server environment, install `firebase-admin` and provide Application Default Credentials for **gd11-demonlist**. Run `node scripts/grant-owner.cjs YOUR_UID`. The existing script preserves other custom claims. Do not commit credentials or put this script in browser code.
3. Sign out and sign in again to refresh claims. The Staff link appears after Firebase verifies the claim. Staff can review pending submissions and add approved completions at `admin.html`.

Website claims grant website privileges only. They do not grant Firebase Console or Google Cloud IAM access. An existing project administrator manages Console permissions separately.

## Existing data and moderation

- `levels`: existing public level documents and fields are preserved, including numeric strings for positions and points. Missing positions are displayed as unranked after ranked entries. No migration is required.
- `records`: public reads query `approved == true`. Full completions use `progress: 100`, `playerId`, `player`, and `levelId`; duplicate player/level completions count once in Players and victors. Partial completions award no points in this version. Optional proof links are shown only when already present.
- `profiles/{uid}`: private saved player name and bio. Only that user can read or edit the profile under the existing rules.
- `agreements/{uid}`: private acceptance of community rules version **2026-10-05**. This version is unchanged.
- `submissions`: the existing pending submission fields remain unchanged. A saved player name, verifier, HTTPS level link, HTTPS video proof, and rules confirmation are required. Pending submissions are visible only to their submitter and staff.

Staff must review proof and reject inappropriate names or content. Approval publishes a staff-assigned position and points; rejection keeps the submission private. Transactions prevent two reviews from publishing the same pending submission twice. Neither the redesign nor its tests writes to the production database.

## Manual verification after configuration and deployment

- Sign in with a new Google account and with an existing account. Confirm Account appears in the navbar, refresh, and confirm the same session returns. Sign out and confirm private forms and fields clear.
- Close the Google window before completion; verify the page remains signed out with an understandable message. Invalid Google credentials are handled by Google's own account window; this site has no password form.
- Accept the rules, save your profile, and submit a level. Verify exactly one private pending document is created and public rankings remain unchanged.
- With an ordinary account, confirm Staff is unavailable and Firestore rejects direct administrative writes. With an approved staff account, verify queue access. Review a real submission only when you intend to publish or reject it.
- Verify the live Firestore rules match the reviewed rules, then check ranks, search, record links, mobile layout, and the browser console on the deployed GitHub Pages URL.

Successful live Google sign-in, live session restoration, live logout, private-account reads, and real staff workflows could not be verified while Authentication returned `CONFIGURATION_NOT_FOUND`. The repository's browser fixtures and Firestore emulator tests cover these UI and permission paths without pretending to authenticate against production.
