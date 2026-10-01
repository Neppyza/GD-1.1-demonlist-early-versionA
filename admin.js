const status=document.getElementById("admin-status"),tools=document.getElementById("admin-tools"),login=document.getElementById("sign-in"),logout=document.getElementById("sign-out");
let authorized=false, auth, firestore, db, authSDK;
login.disabled=true;
try {
    const firebase=await import("./firebase.js"); db=firebase.db;
    [authSDK,firestore]=await Promise.all([import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")]);
    auth=authSDK.getAuth();login.disabled=false;
    authSDK.onAuthStateChanged(auth,async user=>{
        authorized=false;tools.hidden=true;logout.hidden=!user;login.hidden=!!user;
        if(!user){status.textContent="Sign in to manage the demonlist.";return;}
        try {
            const token=await authSDK.getIdTokenResult(user,true);
            if(auth.currentUser?.uid!==user.uid)return;
            authorized=token.claims.owner===true||token.claims.admin===true;
            tools.hidden=!authorized;
            status.textContent=authorized?`Signed in as ${user.displayName || user.email}. Owner/admin access enabled.`:`Signed in, but owner access is not assigned. Your Firebase UID: ${user.uid}`;
        }catch(err){status.textContent=`Could not verify access: ${err.code || err.message}`;}
    });
}catch(err){status.textContent=`Could not initialize login: ${err.code || err.message}`;}
login.addEventListener("click",async()=>{try{await authSDK.signInWithPopup(auth,new authSDK.GoogleAuthProvider());}catch(err){status.textContent=`Sign-in failed: ${err.code || err.message}`;}});
logout.addEventListener("click",async()=>{try{await authSDK.signOut(auth);}catch(err){status.textContent=err.code || err.message;}});
for(const kind of ["level","record"]){
    document.getElementById(`${kind}-form`).addEventListener("submit",async event=>{
        event.preventDefault();if(!authorized||!auth.currentUser)return;
        const form=event.currentTarget,values=new FormData(form),id=String(values.get("id")).trim();
        if(!id||id.includes("/")){status.textContent="Enter a valid document ID.";return;}
        const button=form.querySelector("button");button.disabled=true;
        try {
            let data;
            if(kind==="level") data={name:values.get("name").trim(),position:Number(values.get("position")),creator:values.get("creator").trim(),verifier:values.get("verifier").trim(),points:Number(values.get("points")),difficulty:values.get("difficulty").trim(),thumbnail:values.get("thumbnail").trim()};
            else {
                const levelId=values.get("levelId").trim();
                if(!(await firestore.getDoc(firestore.doc(db,"levels",levelId))).exists())throw Error("That level document does not exist.");
                data={playerId:values.get("playerId").trim(),player:values.get("player").trim(),levelId,progress:100,approved:values.has("approved")};
            }
            await firestore.setDoc(firestore.doc(db,kind==="level"?"levels":"records",id),data,{merge:true});
            status.textContent=`${kind==="level"?"Level":"Record"} saved.`;
        }catch(err){status.textContent=`Save failed: ${err.code || err.message}`;}finally{button.disabled=false;}
    });
}
