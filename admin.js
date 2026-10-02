import { auth, db } from "./firebase.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const status = document.getElementById("staff-status");
const queue = document.getElementById("review-queue");
const login = document.getElementById("staff-sign-in");
const logout = document.getElementById("staff-sign-out");
let staffUser = null;

login.addEventListener("click", async () => {
    login.disabled = true;
    status.textContent = "Opening Google sign-in…";
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch { status.textContent = "Google sign-in did not finish. Please try again."; }
    finally { login.disabled = false; }
});
logout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
    staffUser = user;
    queue.hidden = true;
    login.hidden = Boolean(user);
    logout.hidden = !user;
    if (!user) {
        status.textContent = "Sign in with your staff Google account.";
        return;
    }
    try {
        const token = await getIdTokenResult(user, true);
        if (token.claims.owner !== true && token.claims.admin !== true) {
            status.textContent = "This Google account does not have staff access.";
            return;
        }
        status.textContent = `Staff access enabled for ${user.displayName || "your account"}.`;
        queue.hidden = false;
        await loadQueue();
    } catch {
        status.textContent = "Could not check staff access.";
    }
});

async function loadQueue() {
    queue.replaceChildren();
    const loading = document.createElement("p");
    loading.textContent = "Loading pending submissions…";
    queue.append(loading);
    try {
        const snapshot = await getDocs(query(collection(db, "submissions"), where("status", "==", "pending")));
        queue.replaceChildren();
        if (snapshot.empty) {
            const empty = document.createElement("p");
            empty.textContent = "There are no pending submissions.";
            queue.append(empty);
            return;
        }
        for (const result of snapshot.docs) queue.append(renderSubmission(result.id, result.data()));
    } catch {
        queue.replaceChildren();
        const error = document.createElement("p");
        error.textContent = "Could not load the review queue. Check Firestore rules.";
        queue.append(error);
    }
}

function renderSubmission(id, data) {
    const card = document.createElement("article");
    card.className = "submission-item";
    const title = document.createElement("h2");
    title.textContent = data.levelName || "Untitled level";
    const submittedBy = document.createElement("p");
    submittedBy.textContent = `Submitted by ${data.submittedBy || "Unknown player"}`;
    const info = document.createElement("p");
    info.textContent = `Creator: ${data.creator || "—"} · Verifier: ${data.verifier || "—"}`;
    const links = document.createElement("p");
    const levelLink = safeLink(data.levelUrl, "Open level link");
    const proofLink = safeLink(data.proofUrl, "Watch completion proof");
    if (levelLink) links.append(levelLink, document.createTextNode(" · "));
    if (proofLink) links.append(proofLink);
    const notes = document.createElement("p");
    notes.textContent = data.notes ? `Notes: ${data.notes}` : "No reviewer notes.";
    const form = document.createElement("form");
    form.className = "review-form";
    const positionLabel = document.createElement("label");
    positionLabel.textContent = "Position";
    const position = document.createElement("input");
    position.type = "number"; position.min = "1"; position.step = "1"; position.required = true;
    positionLabel.append(position);
    const pointsLabel = document.createElement("label");
    pointsLabel.textContent = "Points";
    const points = document.createElement("input");
    points.type = "number"; points.min = "0"; points.step = "0.01"; points.required = true;
    pointsLabel.append(points);
    const approve = document.createElement("button");
    approve.type = "submit"; approve.textContent = "Approve and publish";
    const reject = document.createElement("button");
    reject.type = "button"; reject.className = "secondary-button"; reject.textContent = "Reject";
    const result = document.createElement("p");
    result.setAttribute("role", "status");
    form.append(positionLabel, pointsLabel, approve, reject, result);
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const rank = Number(position.value);
        const score = Number(points.value);
        if (!Number.isInteger(rank) || rank < 1 || !Number.isFinite(score) || score < 0) {
            result.textContent = "Enter a positive whole-number position and non-negative points.";
            return;
        }
        approve.disabled = reject.disabled = true;
        try {
            const levelRef = doc(collection(db, "levels"));
            const batch = writeBatch(db);
            batch.set(levelRef, {
                name: data.levelName,
                position: rank,
                points: score,
                creator: data.creator,
                verifier: data.verifier,
                levelUrl: data.levelUrl,
                proofUrl: data.proofUrl,
                difficulty: "Demon"
            });
            batch.update(doc(db, "submissions", id), {
                status: "approved",
                levelId: levelRef.id,
                reviewedBy: staffUser.uid,
                reviewedAt: serverTimestamp()
            });
            await batch.commit();
            card.remove();
            status.textContent = "Level approved and added to the public Demonlist.";
            if (!queue.children.length) {
                const empty = document.createElement("p");
                empty.textContent = "There are no pending submissions.";
                queue.append(empty);
            }
        } catch {
            result.textContent = "Could not publish this level. Check the required level fields and Firestore rules.";
            approve.disabled = reject.disabled = false;
        }
    });
    reject.addEventListener("click", async () => {
        reject.disabled = approve.disabled = true;
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, "submissions", id), {
                status: "rejected",
                reviewedBy: staffUser.uid,
                reviewedAt: serverTimestamp()
            });
            await batch.commit();
            card.remove();
            if (!queue.children.length) {
                const empty = document.createElement("p");
                empty.textContent = "There are no pending submissions.";
                queue.append(empty);
            }
        } catch {
            result.textContent = "Could not reject this submission.";
            approve.disabled = reject.disabled = false;
        }
    });
    card.append(title, submittedBy, info, links, notes, form);
    return card;
}

function safeLink(value, label) {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return null;
        const anchor = document.createElement("a");
        anchor.href = url.href;
        anchor.textContent = label;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        return anchor;
    } catch { return null; }
}
