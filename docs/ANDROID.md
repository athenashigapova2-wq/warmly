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

Local build verification on this Windows machine stopped at dependency resolution: Google's Maven repository returned HTTP 404 for Android Gradle Plugin 8.13.0. No local APK has been verified. The native project and web-assets sync succeeded. On Windows with non-ASCII temporary paths, Java's local socket initialization can also require an ASCII `jdk.net.unixdomain.tmpdir`.

The first GitHub Actions attempt (run 43019447051) failed in `android-actions/setup-android@v3`, before app compilation. GitHub denied log retrieval with an API rate-limit error, so its exact SDK setup failure is not yet diagnosed. No downloadable APK is claimed from that run.

Run `npm run configure` once before building. Google authentication opens the system browser and returns through `app.warmly.messenger://auth/callback`; allow that redirect in Supabase as described in GOOGLE_SIGN_IN.md. Sessions persist in the app. Native OAuth needs a physical-device test; push notifications remain future work.

Manual test on an emulator and a phone: create two accounts, accept friendship, exchange direct messages, create a group, add a friend, leave as a non-owner, restart the app and verify restored session/history. Check soft-keyboard behavior and safe areas on the target phone. A successful Gradle build does not replace a physical-device test.
