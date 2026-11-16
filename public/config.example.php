<?php
/**
 * InfinityFree MySQL Configuration Template
 *
 * 1. Rename/copy this file to "config.php" in the same folder as api.php (htdocs/).
 * 2. Fill in your MySQL Host, Database Name, Username, and Password from
 *    InfinityFree Client Area -> Control Panel -> MySQL Databases.
 * 3. Change AUTH_SECRET to a long random string before going live.
 */

return [
    'db_host' => 'sqlXXX.infinityfree.com', // Replace with your InfinityFree MySQL Host Name
    'db_name' => 'if0_XXXXXXXX_mahara',     // Replace with your InfinityFree MySQL DB Name
    'db_user' => 'if0_XXXXXXXX',            // Replace with your InfinityFree MySQL User Name
    'db_pass' => 'YOUR_MYSQL_PASSWORD',     // Replace with your InfinityFree vPanel/MySQL Password
    'db_charset' => 'utf8mb4',
    'auth_secret' => 'change-this-to-a-long-random-secret-key-mahara-sudan-2026',
    'token_ttl_seconds' => 60 * 60 * 24 * 30, // 30 days

    // Password Reset Email Delivery (InfinityFree disables standard PHP mail())
    // Set 'mail_driver' to 'webhook' OR 'smtp'.
    'mail_driver' => 'none', // 'webhook' | 'smtp' | 'none'

    // Option A: External Webhook URL (receives JSON POST: to, name, code, expiresMinutes, subject, text, html)
    'mail_webhook_url' => '',
    'mail_webhook_secret' => '', // Optional: sent as X-Webhook-Secret HTTP header

    // Option B: External SMTP Relay (e.g., Brevo, Mailjet, Resend, Gmail App Password)
    'smtp_host' => '',
    'smtp_port' => 465,         // 465 (ssl) or 587 (tls)
    'smtp_encryption' => 'ssl', // 'ssl' | 'tls'
    'smtp_user' => '',
    'smtp_pass' => '',
    'smtp_from_email' => '',
    'smtp_from_name' => 'Mehani Sudan | مهني',
];
