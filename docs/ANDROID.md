# Android test build

Warmly uses Angular + Capacitor 8. The same UI and Supabase project serve desktop browsers and Android. A phone does not connect to localhost on your computer: the packaged app talks directly to Supabase over HTTPS.

Prerequisites: Android Studio 2025.2.1+, Android SDK Platform 36, Java 21 (set JAVA_HOME to an appropriate JDK), and Node 24.15+. The Gradle project is in `android/`; min SDK is 24. The application id is `app.warmly.messenger` and can be finalized before store release.

```sh
npm ci
npm run configure
npm run android:sync
npm run android:open
```

In Android Studio select the `android` directory, let Gradle sync, then use Build → Generate App Bundles or APKs → Generate APKs. CLI alternative: `npm run android:apk`.

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. This is a test build, not a signed Play Store release. Production signing keys must stay outside Git. Never distribute the debug keystore for production signing.

GitHub alternative: repository → Actions → Android test APK → Run workflow. Once successful, download the `warmly-android-debug` artifact and extract `app-debug.apk`. This uses Java 21 and SDK 36 on Linux. Set repository Actions variables SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before running. Only public configuration is bundled.

Verified locally on 2026-11-12: the production Angular build, Capacitor sync and `:app:assembleDebug` passed using Java 21, SDK 36 and Gradle 8.14.3. The 0.3.0 test APK (version code 2, 7,142,195 bytes) has a valid v2 debug signature (min SDK 24 / Android 7). Its packaged web files match the current production build byte-for-byte; the App and Browser plugins are bundled. The previous Maven 404 is no longer blocking.

The build targets the application rather than assembling every library artifact. Windows Unicode project paths are enabled in `gradle.properties`. On Windows with non-ASCII temporary paths, Java's local socket initialization can also require an ASCII `jdk.net.unixdomain.tmpdir`.

APK SHA-256: `D0A7CF9C978C48A027518B606271A138CDDD3B9239B2EBE0EBBF63DEB4D6323D`.

Google preflight on 2026-11-12: the live provider is enabled, authorization redirects to accounts.google.com, and an OAuth cancellation returns to the exact Android callback rather than the web Site URL. This checks redirect configuration, not successful user authentication. Pixel 8 emulator execution was blocked by unavailable Windows hardware acceleration. Installation, completed Google login, cold-start session persistence and physical-device layout are still pending user testing.

The first GitHub Actions attempt (run 43019447051) failed in `android-actions/setup-android@v3`, before app compilation. GitHub denied log retrieval with an API rate-limit error, so its exact SDK setup failure is not yet diagnosed. No downloadable APK is claimed from that run.

Run `npm run configure` once before building. Google authentication opens the system browser and returns through `app.warmly.messenger://auth/callback`; allow that redirect in Supabase as described in GOOGLE_SIGN_IN.md. Sessions persist in the app. Native OAuth needs a physical-device test; push notifications remain future work.

Manual test on an emulator and a phone: create two accounts, accept friendship, exchange direct messages, create a group, add a friend, leave as a non-owner, restart the app and verify restored session/history. Check soft-keyboard behavior and safe areas on the target phone. A successful Gradle build does not replace a physical-device test.

## Discover test build

People is now labelled Discover. Members enter a university during onboarding; existing accounts missing it complete the profile after sign-in. Saved university values are not requested on every sign-in. Visitors can enter the campus they want to connect with. University affiliation is self-declared and never grants the approved University role.

Discover lists universities present in member profiles, with paginated directory/member queries and literal text search. Members can filter by university, send or accept friend requests, and message existing friends. No new database migration is needed beyond the existing social/profile migration.

Validation: 14 automated tests passed. The QA browser fixture verified university filtering, request/accept actions, empty search, missing-university onboarding, and a 390px layout without horizontal overflow. Desktop and mobile screenshots were inspected. To repeat the UI checks (local fixture data only):

```sh
npx ng build --configuration=qa --output-path=dist/qa
npx playwright install chromium --only-shell
node tests/discover-ui.mjs
```

## Member profiles and visual update (0.3.0)

Names/avatars in Discover, friend/request lists, the feed and messages open a member profile. Direct-chat titles and group-member names also open it. The read-only card loads the selected member's name, username, university, program, bio and interests through the existing authenticated profile policy. It never queries email or credentials and does not expose private posts or conversations. Friendship actions retain the existing server-side rules. No migration is required.

The shared web/native stylesheet adds layered surfaces, dimensional controls, gradient artwork, hover feedback and a short profile entrance transition. Reduced-motion preferences disable transitions and animation. The native HTML dialog traps focus, closes with Escape/backdrop/close, restores focus, and locks background scrolling while open.

Validation: 14 automated tests, production Angular build, both local browser fixture suites, and Android `:app:assembleDebug` passed. APK signature v2 and packaged web assets were verified. Desktop/mobile screenshots of Home, Discover and member profiles were inspected. Member profile UI coverage includes data display, friend request/accept, opening a chat, keyboard focus, error handling and a narrow viewport. This is browser-based UI verification; physical Android testing remains pending.

```sh
npx ng build --configuration=qa --output-path=dist/qa
node tests/discover-ui.mjs
node tests/member-profile-ui.mjs
```
