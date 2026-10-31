# Console level insertion

The `shiftConsoleLevel` function handles newly created `levels/{id}` documents.
Create the document with a positive integer `position` (Firebase number type),
and the usual level fields. Leave `rankingApplied` absent. After processing,
levels at that position and below move down by one and the function sets
`rankingApplied: true`. Updates of existing documents do not trigger insertion.
Use the website's Manage levels form to move existing levels.

The website marks its own placements as already applied in the same transaction.
Publish the updated website code BEFORE enabling this function, and refresh any
open admin pages, to avoid processing a placement twice. Do not remove or copy
the `rankingApplied` flag when creating a new console level.

## Deployment

Requires Firebase project administration, the Blaze billing plan, Node 22,
and the Firebase CLI. From the repository root:

```sh
npm --prefix functions install
firebase login
firebase deploy --only functions:shiftConsoleLevel --project gd11-demonlist
```

The function uses the default us-central1 region. Verify the Firestore database
location and select an appropriate function region before deploying if needed.
Existing Firestore rules already permit staff rank updates and the shared
rankingState/main revision. No rules changes are included.

Console insertion is asynchronous. Allow it to finish before another manual
ranking edit. The transaction coordinates with website placements and repeated
event deliveries do not reapply completed shifts. A maximum of 450 affected
levels is supported per insertion. Invalid positions or oversized insertions
fail without partial rank updates; inspect function logs and correct the data.
Recreated documents are protected from delayed events for the previous creation.

Run `node --test tests/console-ranking.test.js` for isolated transaction-logic
checks. These mocks do not replace a deployed/emulator integration test. After
deployment, verify one console insertion in a staging project before live use.
