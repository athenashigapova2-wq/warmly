# Publish Warmly on Vercel

Import the existing GitHub repository, branch main. No Supabase integration or new database is needed.

Project Settings > Environment Variables: add SUPABASE_URL (existing Supabase Project URL) and SUPABASE_PUBLISHABLE_KEY (publishable key, or legacy anon key) for Production. Add Preview only if you want preview deployments to use the same database. Never add a service_role key or Google Client Secret.

The repository vercel.json sets the build command to npm run build:vercel, install command npm ci, and output directory dist/warmly/browser. Root Directory is the repository root. Use Node.js 24.x in Build and Deployment settings. The cloud build generates config.json from the two public variables and stops if they are missing or unsafe. The ignored local config.json is not uploaded through Git.

Deploy the latest main commit. For an existing deployment use Deployments > latest deployment > Redeploy after saving variables. Ensure the deployment uses the latest commit; if not, deploy main again.

After obtaining the production domain:

1. Supabase > Authentication > URL Configuration: set Site URL to https://YOUR-DOMAIN.vercel.app and add https://YOUR-DOMAIN.vercel.app/ to Redirect URLs. Keep localhost entries if local testing is still needed.
2. Google Cloud > Google Auth Platform > Clients > your Web client: add https://YOUR-DOMAIN.vercel.app to Authorized JavaScript origins. Keep the existing Supabase /auth/v1/callback URL under Authorized redirect URIs.
3. For friends using Google, add their accounts to Google Auth Platform Audience test users while the OAuth app is in Testing, or complete the appropriate production publishing setup.
4. Open the production link in an incognito browser. If Vercel requires a Vercel account, review Settings > Deployment Protection for production access. Verify Google sign-in, username creation, and messaging between two accounts.

No database migration is run by deployment. Existing Supabase users and conversations stay in the same project. This is a static web deployment; the local Express preview server is not deployed.
