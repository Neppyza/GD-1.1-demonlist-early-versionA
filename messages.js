export function authMessage(error) {
    const messages = {
        "auth/configuration-not-found": "Google sign-in is not configured for this Firebase project. The site owner must initialize Authentication and enable Google in Firebase Console.",
        "auth/operation-not-allowed": "Google sign-in is disabled. The site owner must enable the Google provider in Firebase Console.",
        "auth/unauthorized-domain": "This website domain is not authorized for sign-in. The site owner must add it to Firebase Authentication’s authorized domains.",
        "auth/invalid-api-key": "The Firebase web configuration is invalid. The site owner must check the existing project’s web app settings.",
        "auth/app-not-authorized": "This website is not allowed to use the configured Firebase app. Contact the site owner.",
        "auth/popup-blocked": "Your browser blocked the Google window. Allow popups for this site and try again.",
        "auth/popup-closed-by-user": "The Google window was closed before sign-in finished. You are still signed out.",
        "auth/cancelled-popup-request": "Another sign-in window was opened. Finish that window or try again.",
        "auth/network-request-failed": "Google sign-in could not connect. Check your connection and try again.",
        "auth/invalid-credential": "Google could not verify these credentials. Choose your account and try again.",
        "auth/invalid-login-credentials": "Google could not verify these credentials. Choose your account and try again.",
        "auth/account-exists-with-different-credential": "This account already uses another sign-in method. Contact the site owner to recover access.",
        "auth/user-disabled": "This account has been disabled. Contact the site owner.",
        "auth/too-many-requests": "There have been too many attempts. Wait a moment before trying again.",
        "auth/web-storage-unsupported": "Your browser is blocking session storage. Allow site storage to stay signed in after a refresh.",
        "auth/requires-login": "Sign in with Google before continuing.",
        "auth/insufficient-permission": "Your account does not have administrator access.",
        "auth/user-token-expired": "Your session has expired. Sign out and sign in again.",
        "auth/invalid-user-token": "Your session is no longer valid. Sign out and sign in again."
    };
    const code = error?.code || "";
    return `${messages[code] || "Sign-in is unavailable. Check your connection and try again."}${code ? ` (${code})` : ""}`;
}

export function dataMessage(error, subject = "data") {
    if (error?.code?.startsWith("auth/")) return authMessage(error);
    const code = String(error?.code || "").replace("firestore/", "");
    if (code === "permission-denied") return `Access to ${subject} was denied. Check your account permissions or ask the site owner to check the Firestore rules. (permission-denied)`;
    if (code === "unavailable" || code === "deadline-exceeded") return `Could not reach ${subject}. Check your connection and try again. (${code})`;
    return `Could not load or save ${subject}. Please try again.${code ? ` (${code})` : ""}`;
}
