# App Store Publishing Guide — Mehani | مهني (`com.mehani.sudan`)

**Official Slogan:** `"أيّ شغلة وليها زولها.. ومِهَني بجيب ليك زولها"`

Follow this two-phase roadmap to launch **first on Uptodown (Free, $0 registration fee)** and later expand to **Google Play Store** using the **exact same release signing key**.

---

## Step 1 (Required for Both Stores): Upload Updated Web Files to InfinityFree (`htdocs/`)
Deploy your latest `dist/` build to `https://mehani.gt.tc` (keeping `htdocs/config.php` untouched) so your Privacy Policy, Account Deletion portal, and anti-fraud `deleted_accounts_archive` API are live:
- **Privacy Policy URL:** `https://mehani.gt.tc/privacy-policy.html`
- **Account Deletion URL:** `https://mehani.gt.tc/delete-account.html`

---

## Step 2 (Do Once): Generate Your Release Keystore & Add GitHub Secrets
Both **Uptodown** (signed `.apk`) and **Google Play** (signed `.aab`) require a **release-signed build** — do **not** upload `app-debug.apk` to Uptodown. Using the same `.jks` keystore for both stores also ensures your users can update cleanly later.

Run this command once on any computer with Java JDK installed (**keep `mehani-upload-keystore.jks` and passwords backed up safely; never commit `.jks` to Git**):

```bash
keytool -genkeypair -v \
  -keystore mehani-upload-keystore.jks \
  -alias mehani-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Encode the keystore file to a single-line Base64 string:
- **Linux / macOS:** `base64 -w 0 mehani-upload-keystore.jks` (or `base64 -i mehani-upload-keystore.jks | tr -d '\n'`)
- **Windows PowerShell:** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("mehani-upload-keystore.jks")) | Set-Clipboard`

In your GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**, add these **4 secrets**:
1. `ANDROID_KEYSTORE_BASE64` — Base64 string of `mehani-upload-keystore.jks`
2. `ANDROID_KEYSTORE_PASSWORD` — your keystore password
3. `ANDROID_KEY_ALIAS` — `mehani-upload`
4. `ANDROID_KEY_PASSWORD` — your key password (usually identical to keystore password)

Push to `main` (or trigger **Actions → Build Mehani Android APK & Play Store AAB → Run workflow**). You will get:
- **`mehani-sudan-uptodown-release-apk`** (`mehani-sudan-uptodown-release.apk`) → Upload to **Uptodown** now
- **`mehani-sudan-play-release-aab`** (`mehani-sudan-play-release.aab`) → Upload to **Google Play** later

---

## Phase 1: Launching First on Uptodown (Free — $0 Fee)

1. Go to [developers.uptodown.com](https://developers.uptodown.com) and create a **free Developer Account** (no $25 fee).
2. Click **Add New App** and upload **`mehani-sudan-uptodown-release.apk`** (from the GitHub Actions artifact `mehani-sudan-uptodown-release-apk`).
3. Fill in the Uptodown listing details:
   - **Package Name:** `com.mehani.sudan`
   - **App Name:** `مهني | Mehani Sudan`
   - **Slogan / Short Description (Arabic):** `أيّ شغلة وليها زولها.. ومِهَني بجيب ليك زولها — احجز أفضل الحرفيين في السودان.`
   - **Short Description (English):** `Every job has its pro.. and Mehani brings them to you. Vetted Sudanese trades & crafts.`
   - **Full Description Highlights:** Connect directly with verified plumbers, electricians, tailors, henna artists, tutors, and craftsmen across Sudan; pay via Cash, Bankak, or Fawry; upfront service rates; and admin-verified providers.
   - **Category:** Lifestyle / Business / House & Home
   - **Website & Support:** `https://mehani.gt.tc` · `ahmedmostafaomer02@gmail.com` · `+249 991 877 454`
   - **Privacy Policy URL:** `https://mehani.gt.tc/privacy-policy.html`
   - **Screenshots & Icon:** Upload `public/pwa-512x512.png` (icon) + 2–6 mobile screenshots.
4. Submit for Uptodown malware/verification review (usually approved within a few days, and your APK will be publicly downloadable with direct link sharing across Sudan).

---

## Phase 2: Expanding to Google Play Store Later ($25 Fee)

When you are ready to pay the one-time $25 Google Play Console fee:

1. Register at [play.google.com/console](https://play.google.com/console) (`ahmedmostafaomer02@gmail.com`) and complete identity verification.
   - **Personal Account Note:** Google requires **12 opted-in testers in Closed Testing for 14 continuous days** before unlocking Production.
   - **Organization Account (D-U-N-S):** Exempt from the 12-tester requirement.
2. Upload **`mehani-sudan-play-release.aab`** (from the same GitHub Actions workflow artifact `mehani-sudan-play-release-aab`).
3. Store Listing Copy:
   - **App Name (Arabic):** `مهني — سوق الحرفيين في السودان`
   - **App Name (English):** `Mehani — Sudan Trades & Services`
   - **Short Description (Arabic, <=80 chars):** `أيّ شغلة وليها زولها.. ومِهَني بجيب ليك زولها. احجز أمهر الحرفيين في حلتك.`
   - **Short Description (English, <=80 chars):** `Every job has its pro.. and Mehani brings them to you. Pay Cash or Bankak.`
   - **Graphics:** Icon `512×512` (`public/pwa-512x512.png`), Feature Graphic `1024×500`, 2–8 phone screenshots.
4. Privacy Policy, Account Deletion & Data Safety:
   - **Privacy Policy URL:** `https://mehani.gt.tc/privacy-policy.html`
   - **Delete Account URL:** `https://mehani.gt.tc/delete-account.html`
   - **In-App Deletion Path:** `Profile → Privacy Policy & Account → Delete Account Permanently`
   - Declare **HTTPS encryption in transit**, **Account deletion supported**, and disclose anti-fraud phone/ID retention upon deletion (matching our updated Privacy Policy):
     - **Personal Info:** Name, Email, Phone number, City/Neighborhood — *App Functionality, Account Management & Fraud Prevention (preventing deleted-account phone reuse).*
     - **Photos & Videos:** Avatar, Portfolio photos, Provider NID/Passport copy, Bankak receipts — *App Functionality, Verification & Fraud Prevention.*
     - **App Activity:** Bookings & Notifications — *App Functionality.*
5. Foreground Service Declaration (`FOREGROUND_SERVICE_REMOTE_MESSAGING`):
   - **Justification Summary (Ready to Paste):**
     > "Mehani uses a `remoteMessaging` foreground service to keep customers and service providers notified in real time about incoming service bookings, acceptances, and cancellations even when the app is closed—ensuring timely job coordination in regions with aggressive background battery restrictions. Signing out immediately stops the service."
   - Attach a 15–20s screen-recording demo showing sign-in, persistent service notification, closing the app, and receiving a booking alert.
6. **App Access:** Create a non-admin demo customer account in Mehani and provide its credentials in Play Console for Google reviewers.
7. *(Optional after first Play release)* Copy the **App Signing Certificate SHA-256** from Play Console → App Integrity into `public/.well-known/assetlinks.json`.
