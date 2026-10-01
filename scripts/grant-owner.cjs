const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const uid=process.argv[2];
if(!uid)throw Error('Usage: node scripts/grant-owner.cjs FIREBASE_UID');
initializeApp({credential:applicationDefault(),projectId:'gd11-demonlist'});
(async()=>{const auth=getAuth();const user=await auth.getUser(uid);await auth.setCustomUserClaims(uid,{...user.customClaims,owner:true,admin:true});console.log('Owner access assigned to UID '+uid+'. Sign out and in again.');})().catch(error=>{console.error(error.message);process.exitCode=1;});
