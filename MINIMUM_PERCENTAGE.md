# Minimum record percentage

In Firebase Console, open Firestore Database > levels > your level document.
Add minProgress with type number and a whole value from 1 to 100.
For example, minProgress: 3 accepts records from 3% through 100%.
Do not include a percent sign or choose string type. Missing values default to 100%.

The list and level details show the requirement. Players enter progress in Submit.
Firebase rules reject submissions below the minimum. Staff review the claimed
percentage. Approval preserves a better existing record and allows a later higher
result to replace it. Only 100% completions award points and count as victors.
Legacy submissions without progress mean 100%.

Deploy firestore.rules before the updated website so progress is accepted:

    firebase deploy --only firestore:rules --project gd11-demonlist

Then deploy the website through its existing GitHub Pages workflow.
This update is local and has not been deployed. The rule changes are prototypes;
review them and run tests/firestore.rules.test.cjs with the Firestore emulator
before production deployment. Java was unavailable here, so rule tests were not run.
The console rank-shifting function has separate setup in FIREBASE_RANKING.md.
