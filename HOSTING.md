# Hosting outside OpenAI

The application is a static Angular build talking directly to Supabase. Run `npm run build` and publish `dist/warmly/browser` with an HTTPS static host of your choice. Sites integration has been removed. No OpenAI deployment commands remain in package.json.

Configure only the public Supabase URL and publishable/anon key using `Client/public/config.json` (see README). Never put `.env`, secret/service-role keys or Android signing keys in the public folder. Add your real web URL to Supabase Authentication URL Configuration for email confirmation.

`npm start` is a local static preview at http://localhost:3000; Supabase access is entirely browser-side with RLS. The old guest tables are retained only for historical data and are not the new messenger's storage.
