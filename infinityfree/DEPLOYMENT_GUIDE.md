# InfinityFree MySQL + PHP REST Bridge Deployment Guide

Follow these steps to host **Mehani Sudan (مهني)** with your free InfinityFree MySQL database and view live tables in **phpMyAdmin**.
*(Tip: To swap the brand logo anytime, replace `public/logo.png` before building or overwrite `htdocs/logo.png` directly on InfinityFree.)*

---

## Step 1: Create Your MySQL Database in InfinityFree
1. Log in to your **InfinityFree Client Area** → open your hosting account → open **Control Panel (VistaPanel)**.
2. Click **MySQL Databases**.
3. Create a new database (e.g., `mahara`).
4. Note down the 4 values shown in VistaPanel:
   - **MySQL Host Name** (e.g., `sql302.infinityfree.com`)
   - **MySQL Database Name** (e.g., `if0_12345678_mahara`)
   - **MySQL User Name** (e.g., `if0_12345678`)
   - **MySQL Password** (your vPanel / hosting password)

---

## Step 2: Import the Tables & Initial Seed Data (`schema.sql`)
1. In VistaPanel, click **phpMyAdmin**, then click **Connect Now** next to your `mahara` database.
2. In phpMyAdmin, select your database on the left sidebar and open the **Import** tab.
3. Choose the file `infinityfree/schema.sql` from this project and click **Import / Go**.
4. You will immediately see all **8 relational tables**:
   - `users` (pre-seeded with default Admin: phone `0900000000`, password `admin123`)
   - `categories` (pre-seeded with the 11 official Sudanese service categories)
   - `provider_categories`
   - `provider_custom_services`
   - `provider_portfolio`
   - `service_requests`
   - `thursday_deposits`
   - `service_suggestions`

---

## Step 3: Build & Upload Frontend + PHP API to `htdocs/`
> **Why same-origin upload matters:** InfinityFree runs an automatic browser JavaScript cookie check (`aes.js`). Uploading both the built frontend and `api.php` into the same InfinityFree `htdocs/` domain lets browsers pass that check automatically and send same-origin `fetch('/api.php')` calls without CORS or bot-protection errors.

1. Run `npm run build` in this project — Vite generates the `dist/` folder, which already includes `api.php` and `config.example.php`.
2. Copy `dist/config.example.php` to `dist/config.php` and fill in your 4 InfinityFree MySQL values plus a random `auth_secret`.
3. Upload the entire contents of `dist/` (including `index.html`, `assets/`, `api.php`, and `config.php`) into your InfinityFree `htdocs/` directory via **Online File Manager** or **FileZilla (FTP)**.
4. Open your InfinityFree website URL, sign in as Admin (`0900000000` / `admin123`), or register new customers/providers — every change now writes directly to your MySQL tables and is immediately visible in **phpMyAdmin**.

---

## Step 4: Upgrading an Existing Database (Email & Password Reset)
If you already imported `schema.sql` earlier and want to keep your existing users and data:
1. Open **phpMyAdmin** → click your database on the left sidebar → open the **SQL** tab (or **Import** tab).
2. Run the contents of `infinityfree/migrate_add_email_and_resets.sql`. This safely adds the unique `email` column to `users` and creates the `password_resets` table without deleting any existing records.

---

## Step 5: Configure Password Reset Email Delivery (`config.php`)
InfinityFree free accounts disable PHP's built-in `mail()` function. To send 6-digit password reset codes, set either a **Webhook URL** or an **External SMTP Relay** in `htdocs/config.php` (see `config.example.php`):
- **Option A (`mail_driver => 'webhook'`)**: Set `mail_webhook_url` to your Make.com, Zapier, Google Apps Script, or custom HTTP mail relay endpoint. `api.php` sends a `POST` JSON payload containing `{ to, name, code, expiresMinutes, subject, text, html }`.
- **Option B (`mail_driver => 'smtp'`)**: Set `smtp_host`, `smtp_port` (`465` for `ssl` or `587` for `tls`), `smtp_user`, `smtp_pass`, and `smtp_from_email` (for example Brevo SMTP, Mailjet SMTP, Resend SMTP, or Gmail App Password).

