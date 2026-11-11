# Google sign-in: manual setup

The button and PKCE callback handling are implemented. Enable Google in your own Supabase project before testing real sign-in. No new SQL migration is required for this change.

## Configure the app once

In VS Code open Terminal > New Terminal in Warmly and run `npm run configure`. Enter your Supabase Project URL and publishable key, then run `npm start`. Public values are saved in ignored `Client/public/config.json` and bundled into web/Android. Users never enter them. Do not enter a service_role key or OAuth secret.

## Create the Google client

1. Supabase > Warmly > Authentication > Sign In / Providers > Google. Copy its callback URL (`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).
2. Open https://console.cloud.google.com/ and select or create your Google Cloud project.
3. Google Auth Platform > Branding: set Warmly as the app name and fill required contact details. Audience: External. While in Testing, add your Google account and friends as test users.
4. Data Access: only basic identity scopes (openid, email, profile). Warmly does not request Gmail inbox access.
5. Clients > Create client > Web application. Authorized JavaScript origins: `http://127.0.0.1:3000`, `http://localhost:3000`, and your production HTTPS origin when available. For Angular dev add `http://localhost:4200`.
6. Authorized redirect URIs: paste the exact Supabase callback from step 1. Create the client.
7. Copy Client ID and Client Secret directly into the Google provider settings in Supabase, enable Google and Save. Keep the secret only there, never in the app, Git, chat or public config.

## Allow return URLs

Supabase > Authentication > URL Configuration:

- Site URL: `http://127.0.0.1:3000` for current testing; change to your public HTTPS address when deployed.
- Redirect URLs: `http://127.0.0.1:3000/`, `http://localhost:3000/`, `http://localhost:4200/`, and `app.warmly.messenger://auth/callback` for Android. Add your exact production return URL when deployed.

Google redirects to Supabase; Supabase then returns to the app. These are different settings.

## Test

Open http://127.0.0.1:3000/ in Chrome or Edge rather than VS Code's embedded preview. Click Continue with Google, choose an allowed test account, then create your Warmly username. Google can reject embedded browser authentication.

For Android run `npm run android:sync` and rebuild/install the APK. Test sign-in and return to the app on a real device, including a cold start. Web build and native sync alone do not verify native OAuth.

Apple sign-in is deferred. Email/password remains optional. Supabase limits repeat confirmation requests (normally 60 seconds); the UI explains the wait and shows a countdown. The built-in email sender also has a low project-wide quota: configure your own SMTP for broader email testing.

Official references: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/rate-limits
