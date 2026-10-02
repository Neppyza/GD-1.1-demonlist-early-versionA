import { auth, db } from "./firebase.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, where, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const signInButton = document.getElementById("google-sign-in");
const signOutButton = document.getElementById("google-sign-out");
const status = document.getElementById("account-status");
const memberContent = document.getElementById("member-content");
let member = null;

signInButton.addEventListener("click", async () => {
    signInButton.disabled = true;
    status.textContent = "Opening Google sign-in…";
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
        status.textContent = error.code === "auth/popup-blocked"
            ? "Your browser blocked the sign-in window. Allow popups and try again."
            : "Google sign-in did not finish. Please try again.";
    } finally {
        signInButton.disabled = false;
    }
});
signOutButton.addEventListener("click", () => signOut(auth).catch(() => {
    status.textContent = "Could not sign out. Please try again.";
}));

onAuthStateChanged(auth, async user => {
    member = user;
    memberContent.hidden = !user;
    signInButton.hidden = Boolean(user);
    signOutButton.hidden = !user;
    if (!user) {
        status.textContent = "Sign in to continue.";
        return;
    }
    status.textContent = `Signed in as ${user.displayName || "Google user"}.`;
    await loadMemberData(user);
});

async function loadMemberData(user) {
    const profileStatus = document.getElementById("profile-status");
    const submissionsBox = document.getElementById("my-submissions");
    try {
        const snapshot = await getDoc(doc(db, "profiles", user.uid));
        const saved = snapshot.exists() ? snapshot.data() : {};
        document.getElementById("display-name").value = saved.displayName || user.displayName || "";
        document.getElementById("profile-bio").value = saved.bio || "";
        profileStatus.textContent = snapshot.exists()
            ? "Your profile is private and saved."
            : "Choose a Demonlist name to use with your submissions.";
    } catch {
        profileStatus.textContent = "Could not load your private profile.";
    }
    try {
        const snapshot = await getDocs(query(collection(db, "submissions"), where("ownerUid", "==", user.uid)));
        submissionsBox.replaceChildren();
        if (snapshot.empty) {
            submissionsBox.textContent = "You have no submissions yet.";
            return;
        }
        const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        items.sort((a, b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0));
        for (const item of items) {
            const card = document.createElement("article");
            card.className = "submission-item";
            const title = document.createElement("h3");
            title.textContent = item.levelName || "Level submission";
            const details = document.createElement("p");
            details.textContent = `Creator: ${item.creator} · Verifier: ${item.verifier}`;
            const state = document.createElement("p");
            state.textContent = `Status: ${item.status || "pending"}`;
            card.append(title, details, state);
            submissionsBox.append(card);
        }
    } catch {
        submissionsBox.textContent = "Could not load your submissions.";
    }
}

document.getElementById("profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!member) return;
    const name = document.getElementById("display-name").value.trim();
    const bio = document.getElementById("profile-bio").value.trim();
    const output = document.getElementById("profile-status");
    if (name.length < 3 || name.length > 24) {
        output.textContent = "Choose a name between 3 and 24 characters.";
        return;
    }
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    output.textContent = "Saving your private profile…";
    try {
        await setDoc(doc(db, "profiles", member.uid), {
            displayName: name,
            bio,
            updatedAt: serverTimestamp()
        });
        output.textContent = "Saved. Only you can view these profile details.";
    } catch {
        output.textContent = "Could not save your profile. Please try again.";
    } finally {
        button.disabled = false;
    }
});

document.getElementById("submission-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!member) return;
    const output = document.getElementById("submission-status");
    const profileName = document.getElementById("display-name").value.trim();
    if (profileName.length < 3) {
        output.textContent = "Save your Demonlist name in Your private profile first.";
        return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const levelUrl = document.getElementById("level-url").value.trim();
    const proofUrl = document.getElementById("proof-url").value.trim();
    if (!safeHttps(levelUrl) || !safeHttps(proofUrl)) {
        output.textContent = "Add valid HTTPS links for the level and completion video.";
        return;
    }
    if (!document.getElementById("rules-accepted").checked) {
        output.textContent = "Please confirm the submission rules first.";
        return;
    }
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    output.textContent = "Sending your submission for review…";
    try {
        await addDoc(collection(db, "submissions"), {
            ownerUid: member.uid,
            submittedBy: profileName,
            levelName: String(values.levelName || "").trim(),
            levelUrl,
            creator: String(values.creator || "").trim(),
            verifier: String(values.verifier || "").trim(),
            proofUrl,
            notes: String(values.notes || "").trim(),
            status: "pending",
            submittedAt: serverTimestamp()
        });
        event.currentTarget.reset();
        output.textContent = "Submission received. It remains private until the list team reviews it.";
        await loadMemberData(member);
    } catch (error) {
        output.textContent = error.code === "permission-denied"
            ? "Your submission was blocked by the database rules. Contact the list owner."
            : "Could not send the submission. Please try again.";
    } finally {
        button.disabled = false;
    }
});

function safeHttps(value) {
    try { return new URL(value).protocol === "https:"; }
    catch { return false; }
}
