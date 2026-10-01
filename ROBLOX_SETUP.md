# Activate Roblox login

The public Owner/Google sign-in UI has been replaced by Roblox Login and a profile page. Existing Firebase security rules and custom claims have not been changed. Roblox login here is a read-only profile session, not Firebase authentication or permission to edit the database.

1. In Roblox Creator Dashboard, create an OAuth 2.0 app under your account. You must review/accept its terms yourself.
2. Enable identity scopes `openid` and `profile` only.
3. Register this exact redirect URL:
   `https://neppyza.github.io/GD-1.1-demonlist-early-versionA/profile.html`
4. Configure the app for a public/browser client using authorization code with PKCE. Copy its public Client ID into `roblox-config.js`. Never add a Client Secret to the repository.
5. Test login, cancellation, profile display, expiry, and logout with the registered app. Live OAuth and cross-origin calls cannot be verified until a Client ID is configured. If Roblox rejects browser-origin token/userinfo requests or requires a confidential client, use a trusted backend for token exchange rather than exposing secrets or bypassing CORS.
6. Roblox apps start in private testing mode. Roblox review is required to open sign-in to more users; follow the current Creator Hub registration instructions.

Profiles use Roblox's authenticated userinfo response. Tokens are held only in page memory; reloading requires sign-in again. The pending state and PKCE verifier use session storage and are removed on callback. Users never enter Roblox passwords on this website.

Admin editing now remains available through Firebase Console to authorized project users. The old owner-role setup files do not grant ordinary Roblox users administration.
