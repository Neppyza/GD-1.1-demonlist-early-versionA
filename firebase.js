// Public Firebase web configuration. Admin credentials must never be stored here.
export const firebaseConfig = {
    apiKey: "AIzaSyD2TLHnVzYfD_5CWuP15dn25Qhxyhuksg4",
    authDomain: "gd11-demonlist.firebaseapp.com",
    projectId: "gd11-demonlist",
    storageBucket: "gd11-demonlist.firebasestorage.app",
    messagingSenderId: "645171215190",
    appId: "1:645171215190:web:222c39c99b1f64116e74f7"
};

let clientPromise;

// One app and one SDK version per page. Dynamic imports let the UI report SDK
// loading failures instead of leaving buttons and loading messages stuck.
export function getFirebase() {
    if (!clientPromise) {
        clientPromise = Promise.all([
            import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),
            import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")
        ]).then(([appSDK, authSDK, storeSDK]) => {
            const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(firebaseConfig);
            return { app, auth: authSDK.getAuth(app), db: storeSDK.getFirestore(app), authSDK, storeSDK };
        }).catch(error => {
            clientPromise = null;
            throw error;
        });
    }
    return clientPromise;
}
