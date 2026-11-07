import { getFirebase } from "./firebase.js";
import { subscribeAuth, signInGoogle, requireUser, requireStaff } from "./auth.js";
import { element } from "./ui.js";
import { dataMessage } from "./messages.js";

const main = document.querySelector("main");
const account = document.querySelector(".account-nav");
const switchAccount = element("button", "text-button", "⇄ Switch account");
switchAccount.type = "button";
switchAccount.hidden = true;
switchAccount.addEventListener("click", signInGoogle);
account?.append(switchAccount);
subscribeAuth(state => {
    switchAccount.hidden = !state.user;
    switchAccount.disabled = !state.ready || state.busy;
});
for (const button of document.querySelectorAll("[data-auth-logout]")) button.textContent = "↪ Sign out";

const notices = element("section", "announcements");
notices.setAttribute("aria-label", "Announcements");
notices.hidden = true;
main?.prepend(notices);
getFirebase().then(client => {
    client.storeSDK.onSnapshot(client.storeSDK.collection(client.db, "announcements"), snapshot => {
        notices.replaceChildren();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        for (const item of items) {
            const article = element("article");
            article.append(element("h2", "", item.title || "Announcement"), element("p", "", item.body || ""));
            notices.append(article);
        }
        notices.hidden = !items.length;
    }, () => { notices.hidden = true; });
}).catch(() => { notices.hidden = true; });

function messageForm(title, fields, save) {
    const section = element("section", "section-block");
    section.append(element("h2", "", title));
    const form = element("form", "stack-form narrow-form");
    for (const [name, labelText, limit] of fields) {
        const label = element("label", "", labelText);
        const input = element(name === "title" ? "input" : "textarea");
        input.name = name; input.maxLength = limit; input.required = true;
        label.append(input); form.append(label);
    }
    const button = element("button", "", "Save");
    button.type = "submit";
    const status = element("p", "form-status");
    status.setAttribute("role", "status");
    form.append(button, status); section.append(form);
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (button.disabled) return;
        const values = Object.fromEntries(new FormData(form));
        if (Object.values(values).some(value => !value.trim())) {
            status.textContent = "Please complete every field."; return;
        }
        button.disabled = true;
        try { await save(values); status.textContent = "Saved."; }
        catch (error) { status.textContent = dataMessage(error, title.toLowerCase()); }
        finally { button.disabled = false; }
    });
    return section;
}
if (location.pathname.endsWith("community.html")) {
    main?.append(messageForm("Feedback", [["message", "Tell the staff what needs improving", 2000]], async values => {
        const client = await requireUser();
        await client.storeSDK.setDoc(client.storeSDK.doc(client.db, "feedback", client.user.uid),
            { message: values.message.trim(), updatedAt: client.storeSDK.serverTimestamp() });
    }));
}
if (location.pathname.endsWith("admin.html")) {
    const section = messageForm("Announcement", [["title", "Title", 100], ["body", "Message", 2000]], async values => {
        const client = await requireStaff();
        await client.storeSDK.setDoc(client.storeSDK.doc(client.db, "announcements", "current"),
            { title: values.title.trim(), body: values.body.trim(), updatedAt: client.storeSDK.serverTimestamp() });
    });
    const hide = element("button", "secondary-button", "Remove announcement");
    hide.type = "button";
    hide.addEventListener("click", async () => {
        hide.disabled = true;
        try {
            const client = await requireStaff();
            await client.storeSDK.deleteDoc(client.storeSDK.doc(client.db, "announcements", "current"));
            section.querySelector(".form-status").textContent = "Announcement removed.";
        } catch (error) { section.querySelector(".form-status").textContent = dataMessage(error, "announcement"); }
        finally { hide.disabled = false; }
    });
    section.append(hide);
    const feedback = element("section", "section-block");
    const refresh = element("button", "secondary-button", "Load feedback");
    refresh.type = "button";
    const inbox = element("div");
    feedback.append(element("h2", "", "Feedback inbox"), refresh, inbox);
    let generation = 0;
    subscribeAuth(state => {
        ++generation;
        section.hidden = feedback.hidden = !state.staff;
        inbox.replaceChildren();
    });
    refresh.addEventListener("click", async () => {
        const turn = generation;
        refresh.disabled = true;
        inbox.textContent = "Loading feedback…";
        try {
            const client = await requireStaff();
            const snapshot = await client.storeSDK.getDocs(client.storeSDK.collection(client.db, "feedback"));
            if (turn !== generation) return;
            inbox.replaceChildren();
            for (const doc of snapshot.docs) {
                const article = element("article", "management-row");
                article.append(element("strong", "", doc.id), element("p", "", doc.data().message));
                inbox.append(article);
            }
            if (!snapshot.docs.length) inbox.textContent = "No feedback yet.";
        } catch (error) { if (turn === generation) inbox.textContent = dataMessage(error, "feedback"); }
        finally { refresh.disabled = false; }
    });
    main?.append(section, feedback);
}
