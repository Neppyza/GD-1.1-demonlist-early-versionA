import { robloxConfig } from "./roblox-config.js";
const endpoint = "https://apis.roblox.com/oauth/v1/";
const storageKey = "gd11.roblox.oauth.pending";
const status = document.getElementById("profile-status");
const login = document.getElementById("roblox-login");
const logout = document.getElementById("roblox-logout");
const profile = document.getElementById("roblox-profile");
let accessToken = null, expiryTimer = null;
const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
function clearProfile(message) {
    accessToken = null;
    clearTimeout(expiryTimer);
    profile.hidden = true; logout.hidden = true; login.hidden = false;
    document.getElementById("roblox-avatar").removeAttribute("src");
    document.getElementById("roblox-avatar").hidden=true;
    for(const id of ["roblox-display-name","roblox-username","roblox-id"]) document.getElementById(id).textContent="";
    document.getElementById("roblox-profile-link").removeAttribute("href");
    status.textContent = message;
}
async function signIn() {
    if (!robloxConfig.clientId) {status.textContent="Roblox login is awaiting configuration by the site owner."; return;}
    login.disabled=true;
    try {
        const verifier=random(), state=random();
        const challenge=encode(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))));
        sessionStorage.setItem(storageKey,JSON.stringify({verifier,state,createdAt:Date.now()}));
        const params=new URLSearchParams({client_id:robloxConfig.clientId,redirect_uri:robloxConfig.redirectUri,response_type:"code",scope:"openid profile",state,code_challenge:challenge,code_challenge_method:"S256"});
        location.assign(endpoint+"authorize?"+params);
    }catch(error){status.textContent="Could not start Roblox login. Allow session storage and try again.";login.disabled=false;}
}
async function callback() {
    const params=new URLSearchParams(location.search);
    if(!params.has("code") && !params.has("error"))return;
    // Remove the one-use code from browser history before loading profile media.
    history.replaceState(null,"",location.pathname);
    let pending;
    try {pending=JSON.parse(sessionStorage.getItem(storageKey));}catch{}
    sessionStorage.removeItem(storageKey);
    if(!pending || !params.get("state") || params.get("state")!==pending.state || Date.now()-pending.createdAt>600000 || Date.now()<pending.createdAt) {
        clearProfile("This sign-in request is invalid or expired. Please sign in again.");return;
    }
    if(params.has("error")){clearProfile("Roblox sign-in was cancelled or denied. You can try again.");return;}
    login.disabled=true;status.textContent="Verifying your Roblox account…";
    try {
        if(!robloxConfig.clientId)throw Error("Roblox login is not configured.");
        const response=await fetch(endpoint+"token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:robloxConfig.clientId,redirect_uri:robloxConfig.redirectUri,code:params.get("code"),code_verifier:pending.verifier})});
        if(!response.ok)throw Error("Roblox could not complete sign-in. Please try again.");
        const tokens=await response.json();
        if(typeof tokens.access_token!=="string" || !Number.isFinite(Number(tokens.expires_in)) || Number(tokens.expires_in)<=0)throw Error("Roblox returned an invalid sign-in response.");
        accessToken=tokens.access_token;
        const info=await fetch(endpoint+"userinfo",{headers:{Authorization:"Bearer "+accessToken}});
        if(!info.ok)throw Error("Could not retrieve your Roblox profile.");
        const user=await info.json();
        if(!/^\d+$/.test(String(user.sub)))throw Error("Roblox returned an invalid profile.");
        document.getElementById("roblox-display-name").textContent=user.nickname || user.name || user.preferred_username || "Roblox player";
        document.getElementById("roblox-username").textContent="@"+(user.preferred_username || user.name || user.sub);
        document.getElementById("roblox-id").textContent="Roblox ID: "+user.sub;
        document.getElementById("roblox-profile-link").href="https://www.roblox.com/users/"+user.sub+"/profile";
        if(user.picture){
            try {
                const url=new URL(user.picture);
                if(url.protocol==="https:" && (url.hostname.endsWith(".rbxcdn.com") || url.hostname==="rbxcdn.com" || url.hostname.endsWith(".roblox.com") || url.hostname==="roblox.com")) {
                    const image=document.getElementById("roblox-avatar");image.src=url.href;image.hidden=false;image.onerror=()=>{image.hidden=true;};
                }
            }catch{}
        }
        profile.hidden=false;login.hidden=true;logout.hidden=false;
        status.textContent="Signed in with Roblox. This profile belongs to your authenticated account.";
        expiryTimer=setTimeout(()=>clearProfile("Your Roblox session expired. Please sign in again."),Math.min(Number(tokens.expires_in)*1000,900000));
        // Access token is kept only in memory; refresh tokens are never stored.
    }catch(error){clearProfile(error.message || "Could not complete sign-in.");}finally{login.disabled=false;}
}
login.addEventListener("click",signIn);
logout.addEventListener("click",async()=>{
    const token=accessToken;
    sessionStorage.removeItem(storageKey);
    clearProfile("Signed out.");
    if(token) {
        try {await fetch(endpoint+"token/revoke",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:robloxConfig.clientId,token})});}catch{}
    }
});
if(!robloxConfig.clientId)status.textContent="Roblox login is awaiting configuration by the site owner.";
await callback();
