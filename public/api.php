<?php
/**
 * Mehani Sudan (مهني) - PHP REST API Bridge for InfinityFree MySQL
 *
 * Deployed alongside the built Vite frontend inside InfinityFree htdocs/.
 * Requires config.php (copied from config.example.php) in the same directory.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function sendJson(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    sendJson([
        'ok' => false,
        'code' => 'CONFIG_MISSING',
        'error' => 'Database configuration file (config.php) is missing. Copy config.example.php to config.php with your InfinityFree MySQL credentials.',
    ], 500);
}

$config = require $configPath;
if (!is_array($config) || empty($config['db_host']) || empty($config['db_name']) || empty($config['db_user'])) {
    sendJson([
        'ok' => false,
        'code' => 'CONFIG_INVALID',
        'error' => 'Invalid database configuration in config.php.',
    ], 500);
}

try {
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $config['db_host'],
        $config['db_name']
    );
    $pdoOptions = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
        $pdoOptions[PDO::MYSQL_ATTR_INIT_COMMAND] = 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci';
    }
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'] ?? '', $pdoOptions);
    $pdo->exec('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
} catch (Throwable $e) {
    error_log('[Mehani API] MySQL connection failed: ' . $e->getMessage());
    sendJson([
        'ok' => false,
        'code' => 'DB_CONNECTION_ERROR',
        'error' => 'Unable to connect to MySQL database. Verify credentials in config.php.',
    ], 500);
}

// ============================================================================
// Helpers: Input, Phone Validation, Hashing & HMAC Tokens
// ============================================================================

function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function normalizeNumerals(string $raw): string {
    $cleaned = str_replace(
        ["\u{200E}", "\u{200F}", "\u{202A}", "\u{202B}", "\u{202C}", "\u{202D}", "\u{202E}", "\u{2066}", "\u{2067}", "\u{2068}", "\u{2069}", "\u{00A0}"],
        '',
        trim($raw)
    );
    $from = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    $to   = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return str_replace($from, $to, $cleaned);
}

function normalizeSudanPhone(string $raw): ?string {
    $ascii = normalizeNumerals($raw);
    $digits = preg_replace('/[^0-9]/', '', $ascii);
    if ($digits === null || $digits === '') return null;

    if (strpos($digits, '00249') === 0) {
        $digits = '0' . substr($digits, 5);
    } elseif (strpos($digits, '249') === 0 && strlen($digits) >= 12) {
        $digits = '0' . substr($digits, 3);
    } elseif (strlen($digits) === 9 && ($digits[0] === '9' || $digits[0] === '1')) {
        $digits = '0' . $digits;
    }

    if (preg_match('/^(09|01)[0-9]{8}$/', $digits)) {
        return $digits;
    }
    return null;
}

function buildSudanPhoneVariants(string $raw): array {
    $ascii = normalizeNumerals($raw);
    $digits = preg_replace('/[^0-9]/', '', $ascii) ?? '';
    $variants = [];

    if ($ascii !== '') {
        $variants[] = $ascii;
    }
    if ($digits !== '') {
        $variants[] = $digits;
    }

    $normalized = normalizeSudanPhone($ascii);
    if ($normalized !== null) {
        $core9 = substr($normalized, 1); // 9xxxxxxxx or 1xxxxxxxx
        $variants[] = $normalized;
        $variants[] = $core9;
        $variants[] = '249' . $core9;
        $variants[] = '+249' . $core9;
        $variants[] = '00249' . $core9;
    }

    $unique = array_values(array_unique(array_filter($variants, static fn ($v) => $v !== '')));
    return $unique;
}

function validateSudanPhoneOrFail(string $raw): string {
    $clean = normalizeSudanPhone($raw);
    if ($clean === null) {
        sendJson([
            'ok' => false,
            'error' => 'رقم الهاتف غير صالح. يرجى إدخال رقم سوداني صحيح مكون من 10 أرقام يبدأ بـ 09 أو 01',
        ], 400);
    }
    return $clean;
}

function normalizeEmail(string $raw): ?string {
    $trimmed = trim($raw);
    if ($trimmed === '') return null;
    $lower = function_exists('mb_strtolower') ? mb_strtolower($trimmed, 'UTF-8') : strtolower($trimmed);
    if (strlen($lower) > 191) return null;
    if (!filter_var($lower, FILTER_VALIDATE_EMAIL)) return null;
    return $lower;
}

function validateEmailOrFail(string $raw, bool $required = true): ?string {
    $trimmed = trim($raw);
    if ($trimmed === '') {
        if ($required) {
            sendJson([
                'ok' => false,
                'error' => 'يرجى إدخال البريد الإلكتروني',
            ], 400);
        }
        return null;
    }
    $clean = normalizeEmail($trimmed);
    if ($clean === null) {
        sendJson([
            'ok' => false,
            'error' => 'صيغة البريد الإلكتروني غير صحيحة (مثال: name@example.com)',
        ], 400);
    }
    return $clean;
}

function assertUniqueEmail(PDO $pdo, string $cleanEmail, ?string $excludeUserId = null): void {
    if ($excludeUserId !== null) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ? LIMIT 1');
        $stmt->execute([$cleanEmail, $excludeUserId]);
    } else {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1');
        $stmt->execute([$cleanEmail]);
    }
    if ($stmt->fetch()) {
        sendJson([
            'ok' => false,
            'error' => 'البريد الإلكتروني مسجل بالفعل مسبقاً في حساب آخر',
        ], 409);
    }
}

function ensurePasswordResetsTable(PDO $pdo): void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS `password_resets` (
        `id` VARCHAR(64) NOT NULL,
        `user_id` VARCHAR(64) NOT NULL,
        `email` VARCHAR(191) NOT NULL,
        `code_hash` VARCHAR(128) NOT NULL,
        `attempts` INT NOT NULL DEFAULT 0,
        `expires_at` BIGINT NOT NULL,
        `used_at` BIGINT NULL,
        `created_at` BIGINT NOT NULL,
        PRIMARY KEY (`id`),
        KEY `idx_pr_email_exp` (`email`, `expires_at`),
        KEY `idx_pr_user` (`user_id`),
        CONSTRAINT `fk_pr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function ensureNotificationsTable(PDO $pdo): void {
    static $checked = false;
    if ($checked) return;
    $checked = true;
    try {
        $pdo->exec('CREATE TABLE IF NOT EXISTS `notifications` (
            `id` VARCHAR(80) NOT NULL,
            `user_id` VARCHAR(64) NOT NULL,
            `event_key` VARCHAR(191) NOT NULL,
            `category` VARCHAR(24) NOT NULL DEFAULT "booking",
            `title_ar` VARCHAR(191) NOT NULL,
            `title_en` VARCHAR(191) NOT NULL,
            `body_ar` TEXT NOT NULL,
            `body_en` TEXT NOT NULL,
            `target_tab` VARCHAR(32) NOT NULL DEFAULT "home",
            `is_read` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at_ms` BIGINT NOT NULL,
            `created_at` VARCHAR(32) NOT NULL,
            `read_at` VARCHAR(32) NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_notif_user_event` (`user_id`, `event_key`),
            KEY `idx_notif_user_time` (`user_id`, `created_at_ms`),
            KEY `idx_notif_user_read` (`user_id`, `is_read`),
            CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    } catch (Throwable $e) {
        error_log('[Mehani API] ensureNotificationsTable error: ' . $e->getMessage());
    }
}

function createNotificationRecord(
    PDO $pdo,
    string $userId,
    string $eventKey,
    string $category,
    string $titleAr,
    string $titleEn,
    string $bodyAr,
    string $bodyEn,
    string $targetTab = 'home'
): void {
    if ($userId === '' || $eventKey === '') return;
    ensureNotificationsTable($pdo);
    $nowMs = (int) round(microtime(true) * 1000);
    $nowStr = date('Y-m-d H:i');
    $id = 'ntf-' . substr(sha1($userId . ':' . $eventKey), 0, 24);
    try {
        $stmt = $pdo->prepare('INSERT IGNORE INTO `notifications` (`id`, `user_id`, `event_key`, `category`, `title_ar`, `title_en`, `body_ar`, `body_en`, `target_tab`, `is_read`, `created_at_ms`, `created_at`, `read_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)');
        $stmt->execute([
            $id,
            $userId,
            substr($eventKey, 0, 190),
            $category,
            mb_substr($titleAr, 0, 190, 'UTF-8'),
            mb_substr($titleEn, 0, 190, 'UTF-8'),
            $bodyAr,
            $bodyEn,
            $targetTab,
            $nowMs,
            $nowStr,
        ]);
    } catch (Throwable $e) {
        error_log('[Mehani API] createNotificationRecord error: ' . $e->getMessage());
    }
}

function notifyAllAdmins(
    PDO $pdo,
    string $eventKeyPrefix,
    string $category,
    string $titleAr,
    string $titleEn,
    string $bodyAr,
    string $bodyEn,
    string $targetTab = 'admin'
): void {
    try {
        $admins = $pdo->query("SELECT id FROM users WHERE role = 'admin'")->fetchAll();
        foreach ($admins as $adm) {
            $aid = (string) ($adm['id'] ?? '');
            if ($aid !== '') {
                createNotificationRecord($pdo, $aid, $eventKeyPrefix . ':' . $aid, $category, $titleAr, $titleEn, $bodyAr, $bodyEn, $targetTab);
            }
        }
    } catch (Throwable $e) {
        error_log('[Mehani API] notifyAllAdmins error: ' . $e->getMessage());
    }
}

function hydrateNotificationRow(array $r): array {
    return [
        'id' => (string) $r['id'],
        'userId' => (string) $r['user_id'],
        'eventKey' => (string) $r['event_key'],
        'category' => (string) $r['category'],
        'titleAr' => (string) $r['title_ar'],
        'titleEn' => (string) $r['title_en'],
        'bodyAr' => (string) $r['body_ar'],
        'bodyEn' => (string) $r['body_en'],
        'targetTab' => (string) $r['target_tab'],
        'isRead' => ((int) $r['is_read']) === 1,
        'createdAtMs' => (int) $r['created_at_ms'],
        'createdAt' => (string) $r['created_at'],
        'readAt' => $r['read_at'] !== null ? (string) $r['read_at'] : null,
    ];
}

function syncBackgroundCheckNotifications(PDO $pdo, array $viewer): void {
    $uid = (string) ($viewer['id'] ?? '');
    $role = (string) ($viewer['role'] ?? '');
    if ($uid === '' || $role !== 'provider') return;

    ensureThursdayDepositsSchema($pdo);
    ensureNotificationsTable($pdo);

    if (($viewer['nid_status'] ?? '') === 'reupload_requested') {
        $reason = trim((string) ($viewer['nid_rejection_reason'] ?? ''));
        $reasonAr = $reason !== '' ? $reason : 'الصورة غير واضحة';
        $reasonEn = $reason !== '' ? $reason : 'Unclear photo';
        $sig = (string) ($viewer['nid_submitted_at'] ?? '') . ':' . $reason;
        createNotificationRecord(
            $pdo,
            $uid,
            'nid_reupload:' . $sig,
            'urgent',
            'مطلوب إعادة رفع الرقم الوطني أو جواز السفر',
            'ID / Passport Re-upload Required',
            "إدارة مهني: يرجى إعادة رفع صورة الرقم الوطني أو جواز السفر ($reasonAr).",
            "Mehani Admin: Please re-upload your National ID or Passport ($reasonEn).",
            'profile'
        );
    }

    $depStmt = $pdo->prepare('SELECT id, amount_sdg, status, rejection_reason, reviewed_at FROM thursday_deposits WHERE provider_id = ? AND status IN ("rejected", "pending_verification")');
    $depStmt->execute([$uid]);
    $hasPendingDep = false;
    foreach ($depStmt->fetchAll() as $d) {
        if ($d['status'] === 'pending_verification') {
            $hasPendingDep = true;
        } elseif ($d['status'] === 'rejected') {
            $amt = number_format((int) $d['amount_sdg']);
            $depReason = trim((string) ($d['rejection_reason'] ?? ''));
            $reasonAr = $depReason !== '' ? $depReason : 'يرجى إرفاق إشعار صحيح';
            $reasonEn = $depReason !== '' ? $depReason : 'Please re-upload valid receipt';
            $sig = (string) $d['id'] . ':' . (string) ($d['reviewed_at'] ?? '') . ':' . $depReason;
            createNotificationRecord(
                $pdo,
                $uid,
                'deposit_reupload:' . $sig,
                'urgent',
                'مطلوب إعادة رفع إشعار العمولة (بنكك)',
                'Deposit Proof Re-upload Needed',
                "تم رفض إشعار توريد $amt ج.س ($reasonAr).",
                "Your $amt SDG deposit proof was rejected ($reasonEn).",
                'commission'
            );
        }
    }

    $dueAmount = (int) ($viewer['pending_commission_due_sdg'] ?? 0);
    if ((int) date('w') === 4 && $dueAmount > 0 && !$hasPendingDep) {
        $todayKey = date('Y-m-d');
        $amtFormatted = number_format($dueAmount);
        createNotificationRecord(
            $pdo,
            $uid,
            "thursday_due:$todayKey:$dueAmount",
            'booking',
            'تذكير توريد عمولات وغرامات الخميس',
            'Thursday Commission & Penalty Deposit Due',
            "اليوم الخميس: لديك مبلغ مستحق بقيمة $amtFormatted ج.س (العمولة + الغرامات المحصلة). يرجى التحويل عبر بنكك ورفع الإشعار.",
            "It's Thursday: You have $amtFormatted SDG due (8% commission + collected penalties). Please deposit via Bankak and upload proof.",
            'commission'
        );
    }
}

function fetchUserNotificationsSummary(PDO $pdo, string $userId, int $sinceMs = 0): array {
    ensureNotificationsTable($pdo);
    if ($sinceMs > 0) {
        $stmt = $pdo->prepare('SELECT * FROM `notifications` WHERE `user_id` = ? AND `created_at_ms` > ? ORDER BY `created_at_ms` ASC LIMIT 50');
        $stmt->execute([$userId, $sinceMs]);
    } else {
        $stmt = $pdo->prepare('SELECT * FROM `notifications` WHERE `user_id` = ? ORDER BY `created_at_ms` DESC LIMIT 80');
        $stmt->execute([$userId]);
    }
    $items = array_map('hydrateNotificationRow', $stmt->fetchAll());

    $cntStmt = $pdo->prepare('SELECT COUNT(*) FROM `notifications` WHERE `user_id` = ? AND `is_read` = 0');
    $cntStmt->execute([$userId]);
    $unreadCount = (int) $cntStmt->fetchColumn();

    return [
        'notifications' => $items,
        'unreadCount' => $unreadCount,
    ];
}

function ensureThursdayDepositsSchema(PDO $pdo): void {
    static $checked = false;
    if ($checked) return;
    $checked = true;
    try {
        $cols = $pdo->query('SHOW COLUMNS FROM `thursday_deposits`')->fetchAll();
        $byName = [];
        foreach ($cols as $c) {
            $byName[(string) $c['Field']] = $c;
        }
        $statusType = strtolower((string) ($byName['status']['Type'] ?? ''));
        if (strpos($statusType, "'rejected'") === false) {
            $pdo->exec("ALTER TABLE `thursday_deposits` MODIFY COLUMN `status` ENUM('pending_verification', 'verified', 'rejected') NOT NULL DEFAULT 'pending_verification'");
        }
        if (!isset($byName['rejection_reason'])) {
            $pdo->exec("ALTER TABLE `thursday_deposits` ADD COLUMN `rejection_reason` TEXT NULL AFTER `status`");
        }
        if (!isset($byName['reviewed_at'])) {
            $pdo->exec("ALTER TABLE `thursday_deposits` ADD COLUMN `reviewed_at` VARCHAR(64) NULL AFTER `rejection_reason`");
        }
    } catch (Throwable $e) {
        error_log('[Mehani API] thursday_deposits schema upgrade check: ' . $e->getMessage());
    }
}

function ensureTutorCategoryUpdated(PDO $pdo): void {
    static $checked = false;
    if ($checked) return;
    $checked = true;
    try {
        $stmt = $pdo->prepare('SELECT description_ar FROM categories WHERE id = ? LIMIT 1');
        $stmt->execute(['tutor']);
        $row = $stmt->fetch();
        if ($row && strpos((string) $row['description_ar'], 'تأسيس شهادة سودانية، رياضيات') !== false) {
            $pdo->prepare('UPDATE categories SET description_ar = ?, description_en = ? WHERE id = ?')->execute([
                'دروس وتأسيس لجميع المراحل الدراسية (الابتدائي، المتوسط، الثانوي والشهادة السودانية) في كل المواد',
                'Private tutoring for all school classes and grade levels (Primary, Intermediate, Secondary & Sudanese Certificate)',
                'tutor',
            ]);
        }
    } catch (Throwable $e) {
        error_log('[Mehani API] tutor category update check: ' . $e->getMessage());
    }
}

function ensureUtf8mb4TextColumns(PDO $pdo): void {
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $tableSpecs = [
        'users' => [
            'name' => ['VARCHAR(191)', false, null],
            'state' => ['VARCHAR(191)', false, "'الخرطوم'"],
            'city' => ['VARCHAR(191)', false, "'الخرطوم'"],
            'neighborhood' => ['VARCHAR(191)', false, "'الرياض'"],
            'deactivated_reason' => ['TEXT', true, null],
            'trade_title_ar' => ['VARCHAR(191)', true, null],
            'trade_title_en' => ['VARCHAR(191)', true, null],
            'bio_ar' => ['TEXT', true, null],
            'bio_en' => ['TEXT', true, null],
            'nid_rejection_reason' => ['TEXT', true, null],
            'covered_neighborhoods_json' => ['TEXT', true, null],
        ],
        'service_requests' => [
            'client_name' => ['VARCHAR(191)', false, null],
            'provider_name' => ['VARCHAR(191)', false, null],
            'provider_trade_ar' => ['VARCHAR(191)', false, null],
            'provider_trade_en' => ['VARCHAR(191)', false, null],
            'scheduled_time_note' => ['VARCHAR(191)', false, null],
            'address_details' => ['TEXT', false, null],
            'city' => ['VARCHAR(191)', false, null],
            'neighborhood' => ['VARCHAR(191)', false, null],
            'problem_description' => ['TEXT', false, null],
            'client_review_comment' => ['TEXT', true, null],
            'cancel_reason' => ['TEXT', true, null],
        ],
    ];

    foreach ($tableSpecs as $table => $columns) {
        try {
            $rows = $pdo->query("SHOW FULL COLUMNS FROM `$table`")->fetchAll();
            $existing = [];
            foreach ($rows as $row) {
                $existing[(string) $row['Field']] = $row;
            }

            $alterClauses = [];
            foreach ($columns as $colName => [$targetType, $nullable, $defaultSql]) {
                if (!isset($existing[$colName])) continue;
                $col = $existing[$colName];
                $collation = strtolower((string) ($col['Collation'] ?? ''));
                $curType = strtolower((string) ($col['Type'] ?? ''));

                $needsCharset = strpos($collation, 'utf8mb4') !== 0;
                $needsWiderVarchar = false;
                if ($targetType === 'VARCHAR(191)' && preg_match('/^varchar\((\d+)\)/i', $curType, $m)) {
                    if ((int) $m[1] < 191) {
                        $needsWiderVarchar = true;
                    }
                }

                if ($needsCharset || $needsWiderVarchar) {
                    $nullSql = $nullable ? 'NULL' : 'NOT NULL';
                    $defPart = $defaultSql !== null ? " DEFAULT $defaultSql" : ($nullable ? ' DEFAULT NULL' : '');
                    $alterClauses[] = "MODIFY COLUMN `$colName` $targetType CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci $nullSql$defPart";
                }
            }

            if ($alterClauses) {
                $pdo->exec("ALTER TABLE `$table` " . implode(', ', $alterClauses));
            }
        } catch (Throwable $e) {
            error_log("[Mehani API] utf8mb4 check failed for $table: " . $e->getMessage());
        }
    }
}

function resolveMailDriver(array $config): string {
    $driver = strtolower(trim((string) ($config['mail_driver'] ?? 'none')));
    if ($driver === 'webhook' && !empty($config['mail_webhook_url'])) return 'webhook';
    if ($driver === 'smtp' && !empty($config['smtp_host'])) return 'smtp';
    if ($driver === 'none' || $driver === '') {
        if (!empty($config['mail_webhook_url'])) return 'webhook';
        if (!empty($config['smtp_host'])) return 'smtp';
    }
    return 'none';
}

function smtpReadResponse($fp): array {
    $lines = '';
    $code = 0;
    while (($line = fgets($fp, 1024)) !== false) {
        $lines .= $line;
        if (strlen($line) >= 3 && is_numeric(substr($line, 0, 3))) {
            $code = (int) substr($line, 0, 3);
        }
        if (strlen($line) < 4 || $line[3] === ' ') {
            break;
        }
    }
    return [$code, trim($lines)];
}

function smtpCommand($fp, string $command, array $expectedCodes): array {
    if ($command !== '') {
        fwrite($fp, $command . "\r\n");
    }
    [$code, $msg] = smtpReadResponse($fp);
    if (!in_array($code, $expectedCodes, true)) {
        return [false, "SMTP error ($code): $msg"];
    }
    return [true, $msg];
}

function sendViaSmtp(array $config, string $toEmail, string $subject, string $htmlBody, string $textBody): array {
    $host = trim((string) ($config['smtp_host'] ?? ''));
    $port = (int) ($config['smtp_port'] ?? 465);
    $enc = strtolower(trim((string) ($config['smtp_encryption'] ?? ($port === 465 ? 'ssl' : 'tls'))));
    $user = trim((string) ($config['smtp_user'] ?? ''));
    $pass = (string) ($config['smtp_pass'] ?? '');
    $fromEmail = trim((string) ($config['smtp_from_email'] ?? $user));
    $fromName = trim((string) ($config['smtp_from_name'] ?? 'Mehani Sudan'));

    if ($host === '' || $fromEmail === '') {
        return ['ok' => false, 'error' => 'إعدادات خادم SMTP غير مكتملة في config.php'];
    }

    $remote = ($enc === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $errno = 0;
    $errstr = '';
    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if (!$fp) {
        return ['ok' => false, 'error' => "تعذر الاتصال بخادم البريد SMTP: $errstr ($errno)"];
    }
    stream_set_timeout($fp, 15);

    try {
        [$ok, $err] = smtpCommand($fp, '', [220]);
        if (!$ok) return ['ok' => false, 'error' => $err];

        $ehloHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
        [$ok, $err] = smtpCommand($fp, 'EHLO ' . preg_replace('/[^a-zA-Z0-9.-]/', '', (string) $ehloHost), [250]);
        if (!$ok) return ['ok' => false, 'error' => $err];

        if ($enc === 'tls') {
            [$ok, $err] = smtpCommand($fp, 'STARTTLS', [220]);
            if (!$ok) return ['ok' => false, 'error' => $err];
            $cryptoOk = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if (!$cryptoOk) {
                return ['ok' => false, 'error' => 'فشل تفعيل تشفير TLS مع خادم SMTP'];
            }
            [$ok, $err] = smtpCommand($fp, 'EHLO ' . preg_replace('/[^a-zA-Z0-9.-]/', '', (string) $ehloHost), [250]);
            if (!$ok) return ['ok' => false, 'error' => $err];
        }

        if ($user !== '' && $pass !== '') {
            [$ok, $err] = smtpCommand($fp, 'AUTH LOGIN', [334]);
            if (!$ok) return ['ok' => false, 'error' => $err];
            [$ok, $err] = smtpCommand($fp, base64_encode($user), [334]);
            if (!$ok) return ['ok' => false, 'error' => $err];
            [$ok, $err] = smtpCommand($fp, base64_encode($pass), [235]);
            if (!$ok) return ['ok' => false, 'error' => 'فشل مصادقة SMTP: تأكد من اسم المستخدم وكلمة المرور'];
        }

        [$ok, $err] = smtpCommand($fp, 'MAIL FROM:<' . $fromEmail . '>', [250]);
        if (!$ok) return ['ok' => false, 'error' => $err];

        [$ok, $err] = smtpCommand($fp, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
        if (!$ok) return ['ok' => false, 'error' => $err];

        [$ok, $err] = smtpCommand($fp, 'DATA', [354]);
        if (!$ok) return ['ok' => false, 'error' => $err];

        $boundary = 'mahara_' . bin2hex(random_bytes(8));
        $encodedFrom = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

        $mime = "From: $encodedFrom <$fromEmail>\r\n"
            . "To: <$toEmail>\r\n"
            . "Subject: $encodedSubject\r\n"
            . "MIME-Version: 1.0\r\n"
            . "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n"
            . "\r\n"
            . "--$boundary\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($textBody)) . "\r\n"
            . "--$boundary\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($htmlBody)) . "\r\n"
            . "--$boundary--\r\n";

        $mime = preg_replace('/^\./m', '..', $mime);
        fwrite($fp, $mime . "\r\n.\r\n");
        [$code, $msg] = smtpReadResponse($fp);
        if ($code !== 250) {
            return ['ok' => false, 'error' => "فشل إرسال الرسالة عبر SMTP ($code): $msg"];
        }
        @fwrite($fp, "QUIT\r\n");
        return ['ok' => true];
    } finally {
        @fclose($fp);
    }
}

function sendViaWebhook(array $config, string $toEmail, string $userName, string $code, string $subject, string $htmlBody, string $textBody): array {
    $url = trim((string) ($config['mail_webhook_url'] ?? ''));
    if ($url === '') {
        return ['ok' => false, 'error' => 'رابط Webhook لإرسال البريد غير مضبوط في config.php'];
    }
    $payload = json_encode([
        'to' => $toEmail,
        'name' => $userName,
        'code' => $code,
        'expiresMinutes' => 15,
        'subject' => $subject,
        'text' => $textBody,
        'html' => $htmlBody,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $headers = [
        'Content-Type: application/json; charset=utf-8',
        'Accept: application/json',
    ];
    $secret = trim((string) ($config['mail_webhook_secret'] ?? ''));
    if ($secret !== '') {
        $headers[] = 'X-Webhook-Secret: ' . $secret;
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $resp = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);
        if ($resp === false || $httpCode < 200 || $httpCode >= 300) {
            return ['ok' => false, 'error' => 'تعذر إرسال البريد عبر Webhook: ' . ($curlErr ?: "HTTP $httpCode")];
        }
        return ['ok' => true];
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $payload ?: '{}',
            'timeout' => 15,
            'ignore_errors' => true,
        ],
    ]);
    $resp = @file_get_contents($url, false, $ctx);
    if ($resp === false) {
        return ['ok' => false, 'error' => 'تعذر الاتصال بخدمة Webhook لإرسال البريد'];
    }
    return ['ok' => true];
}

function sendPasswordResetEmail(array $config, string $toEmail, string $userName, string $code): array {
    $driver = resolveMailDriver($config);
    if ($driver === 'none') {
        return [
            'ok' => false,
            'code' => 'MAIL_NOT_CONFIGURED',
            'error' => 'خدمة إرسال البريد غير مهيأة في config.php. يرجى إعداد mail_webhook_url أو إعدادات SMTP.',
        ];
    }

    $safeName = htmlspecialchars($userName ?: 'مستخدم مهني', ENT_QUOTES, 'UTF-8');
    $subject = 'رمز استعادة كلمة المرور - مهني | Mehani Password Reset';
    $textBody = "مرحباً $userName،\n\nرمز التحقق لاستعادة كلمة المرور في منصة مهني هو: $code\nهذا الرمز صالح لمدة 15 دقيقة فقط.\n\nHello $userName,\nYour Mehani password reset code is: $code (valid for 15 minutes).";
    $htmlBody = "<div dir=\"rtl\" style=\"font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;color:#0f172a;\">"
        . "<h2 style=\"margin:0 0 12px;color:#0f766e;\">مهني · استعادة كلمة المرور</h2>"
        . "<p style=\"font-size:14px;line-height:1.6;\">مرحباً <strong>$safeName</strong>،</p>"
        . "<p style=\"font-size:14px;line-height:1.6;\">استخدم رمز التحقق التالي لإعادة تعيين كلمة المرور الخاصة بك. الرمز صالح لمدة <strong>15 دقيقة</strong>:</p>"
        . "<div style=\"margin:20px 0;padding:16px;text-align:center;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;font-size:28px;font-weight:bold;letter-spacing:8px;font-family:monospace;color:#0f766e;\">$code</div>"
        . "<p style=\"font-size:12px;color:#64748b;\">إذا لم تطلب استعادة كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.</p>"
        . "</div>";

    if ($driver === 'webhook') {
        return sendViaWebhook($config, $toEmail, $userName, $code, $subject, $htmlBody, $textBody);
    }
    return sendViaSmtp($config, $toEmail, $subject, $htmlBody, $textBody);
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    $pad = strlen($data) % 4;
    if ($pad) {
        $data .= str_repeat('=', 4 - $pad);
    }
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function signToken(string $userId, string $role, array $config): string {
    $secret = (string) ($config['auth_secret'] ?? 'mahara-default-secret');
    $ttl = (int) ($config['token_ttl_seconds'] ?? 2592000);
    $payload = json_encode([
        'sub' => $userId,
        'role' => $role,
        'exp' => time() + $ttl,
    ]);
    $b64 = base64UrlEncode($payload ?: '{}');
    $sig = base64UrlEncode(hash_hmac('sha256', $b64, $secret, true));
    return $b64 . '.' . $sig;
}

function verifyToken(string $token, array $config): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 2) return null;
    [$b64, $sig] = $parts;
    $secret = (string) ($config['auth_secret'] ?? 'mahara-default-secret');
    $expectedSig = base64UrlEncode(hash_hmac('sha256', $b64, $secret, true));
    if (!hash_equals($expectedSig, $sig)) return null;

    $payload = json_decode(base64UrlDecode($b64), true);
    if (!is_array($payload) || empty($payload['sub']) || empty($payload['exp'])) return null;
    if ((int) $payload['exp'] < time()) return null;
    return $payload;
}

function getBearerToken(): ?string {
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim((string) $_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$authHeader && function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            if (strtolower((string) $k) === 'authorization') {
                $authHeader = (string) $v;
                break;
            }
            if (strtolower((string) $k) === 'x-auth-token') {
                return trim((string) $v);
            }
        }
    }
    if ($authHeader && stripos($authHeader, 'Bearer ') === 0) {
        return trim(substr($authHeader, 7));
    }
    return null;
}

function getAuthenticatedUser(PDO $pdo, array $config): ?array {
    $token = getBearerToken();
    if (!$token) return null;
    $claims = verifyToken($token, $config);
    if (!$claims) return null;
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$claims['sub']]);
    $user = $stmt->fetch();
    return $user ?: null;
}

function requireAuth(PDO $pdo, array $config): array {
    $user = getAuthenticatedUser($pdo, $config);
    if (!$user) {
        sendJson(['ok' => false, 'error' => 'يرجى تسجيل الدخول أولاً'], 401);
    }
    return $user;
}

function requireAdmin(PDO $pdo, array $config): array {
    $user = requireAuth($pdo, $config);
    if (($user['role'] ?? '') !== 'admin') {
        sendJson(['ok' => false, 'error' => 'صلاحية الإدارة مطلوبة'], 403);
    }
    return $user;
}

function verifyUserPassword(PDO $pdo, array $userRow, string $plainPassword): bool {
    $stored = (string) ($userRow['password_hash'] ?? '');
    if (strpos($stored, 'sha256:') === 0) {
        $expectedHex = substr($stored, 7);
        $actualHex = hash('sha256', $plainPassword);
        if (hash_equals($expectedHex, $actualHex)) {
            // Seamlessly upgrade SHA-256 seed hash to bcrypt
            $newHash = password_hash($plainPassword, PASSWORD_BCRYPT);
            $upd = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $upd->execute([$newHash, $userRow['id']]);
            return true;
        }
        return false;
    }
    return password_verify($plainPassword, $stored);
}

// ============================================================================
// Hydration Helpers (MySQL Rows -> Exact Frontend TypeScript Shapes)
// ============================================================================

function hydrateCategory(array $row): array {
    $locations = json_decode((string) ($row['popular_locations_json'] ?? '[]'), true);
    return [
        'id' => (string) $row['id'],
        'nameAr' => (string) $row['name_ar'],
        'nameEn' => (string) $row['name_en'],
        'iconName' => (string) $row['icon_name'],
        'descriptionAr' => (string) $row['description_ar'],
        'descriptionEn' => (string) $row['description_en'],
        'averageRateSDG' => (int) $row['average_rate_sdg'],
        'popularLocations' => is_array($locations) ? $locations : [],
    ];
}

function hydrateAllUsers(PDO $pdo, ?array $viewer): array {
    $viewerId = $viewer['id'] ?? null;
    $isAdmin = ($viewer['role'] ?? '') === 'admin';

    $userRows = $pdo->query('SELECT * FROM users ORDER BY created_at DESC, id ASC')->fetchAll();
    if (!$userRows) return [];

    $catMap = [];
    foreach ($pdo->query('SELECT provider_id, category_id FROM provider_categories')->fetchAll() as $pc) {
        $catMap[$pc['provider_id']][] = (string) $pc['category_id'];
    }

    $svcMap = [];
    foreach ($pdo->query('SELECT * FROM provider_custom_services')->fetchAll() as $cs) {
        $svcMap[$cs['provider_id']][] = [
            'id' => (string) $cs['id'],
            'nameAr' => (string) $cs['name_ar'],
            'nameEn' => $cs['name_en'] !== null ? (string) $cs['name_en'] : null,
            'priceSDG' => (int) $cs['price_sdg'],
            'categoryId' => $cs['category_id'] !== null ? (string) $cs['category_id'] : null,
        ];
    }

    $portMap = [];
    foreach ($pdo->query('SELECT * FROM provider_portfolio')->fetchAll() as $pp) {
        $portMap[$pp['provider_id']][] = [
            'id' => (string) $pp['id'],
            'titleAr' => (string) $pp['title_ar'],
            'titleEn' => (string) $pp['title_en'],
            'imageUrl' => (string) $pp['image_url'],
            'descriptionAr' => $pp['description_ar'] !== null ? (string) $pp['description_ar'] : null,
            'descriptionEn' => $pp['description_en'] !== null ? (string) $pp['description_en'] : null,
        ];
    }

    // Track providers with an active (pending/accepted/in_progress) request from the viewer
    $activeProviderIdsForViewer = [];
    if ($viewerId && !$isAdmin) {
        $actStmt = $pdo->prepare("SELECT DISTINCT provider_id FROM service_requests WHERE client_id = ? AND status IN ('pending', 'accepted', 'in_progress')");
        $actStmt->execute([$viewerId]);
        foreach ($actStmt->fetchAll() as $ar) {
            $activeProviderIdsForViewer[(string) $ar['provider_id']] = true;
        }
    }

    $result = [];
    foreach ($userRows as $row) {
        $uid = (string) $row['id'];
        $role = (string) $row['role'];
        $isSelf = $viewerId === $uid;

        // Unauthenticated / non-admin viewers only receive providers + their own user profile
        if (!$isAdmin && !$isSelf && $role !== 'provider') {
            continue;
        }

        $includeSensitive = $isAdmin || $isSelf;
        $canSeePhone = $isAdmin || $isSelf || isset($activeProviderIdsForViewer[$uid]);
        $covered = json_decode((string) ($row['covered_neighborhoods_json'] ?? '[]'), true);

        $item = [
            'id' => $uid,
            'name' => (string) $row['name'],
            'phone' => ($role === 'provider' && !$canSeePhone) ? '' : (string) $row['phone'],
            'role' => $role,
            'avatarUrl' => (string) ($row['avatar_url'] ?? ''),
            'state' => (string) $row['state'],
            'city' => (string) $row['city'],
            'neighborhood' => (string) $row['neighborhood'],
            'createdAt' => (string) $row['created_at'],
            'isActive' => ((int) $row['is_active']) === 1,
            'deactivatedReason' => $row['deactivated_reason'],
            'unpaidCancellationFeeSDG' => (int) ($row['unpaid_cancellation_fee_sdg'] ?? 0),
        ];

        if ($includeSensitive && !empty($row['email'])) {
            $item['email'] = (string) $row['email'];
        }

        if ($role === 'provider') {
            $serviceCatIds = $catMap[$uid] ?? ($row['trade_category_id'] ? [(string) $row['trade_category_id']] : []);
            $item += [
                'tradeCategoryId' => $row['trade_category_id'],
                'serviceCategoryIds' => $serviceCatIds,
                'customServices' => $svcMap[$uid] ?? [],
                'tradeTitleAr' => $row['trade_title_ar'],
                'tradeTitleEn' => $row['trade_title_en'],
                'bioAr' => $row['bio_ar'],
                'bioEn' => $row['bio_en'],
                'basePriceSDG' => $row['base_price_sdg'] !== null ? (int) $row['base_price_sdg'] : null,
                'pricingType' => $row['pricing_type'] ?? 'fixed',
                'isAvailable' => ((int) $row['is_available']) === 1,
                'activeServicesCount' => (int) $row['active_services_count'],
                'rating' => (float) $row['rating'],
                'reviewCount' => (int) $row['review_count'],
                'coveredNeighborhoods' => is_array($covered) ? $covered : [],
                'portfolio' => $portMap[$uid] ?? [],
            ];

            if ($includeSensitive) {
                $item['nidUrl'] = $row['nid_url'];
                $item['nidNumber'] = $row['nid_number'];
                $item['nidStatus'] = $row['nid_status'];
                $item['nidRejectionReason'] = $row['nid_rejection_reason'];
                $item['nidSubmittedAt'] = $row['nid_submitted_at'];
                $item['totalEarningsSDG'] = (int) $row['total_earnings_sdg'];
                $item['pendingCommissionDueSDG'] = (int) $row['pending_commission_due_sdg'];
                $item['lastThursdayDepositDate'] = $row['last_thursday_deposit_date'];
            }
        }

        $result[] = $item;
    }

    return $result;
}

function hydrateSingleUser(PDO $pdo, string $userId, bool $includeSensitive = true): ?array {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $fakeViewer = $includeSensitive ? ['id' => $userId, 'role' => $row['role']] : null;
    $all = hydrateAllUsers($pdo, $fakeViewer);
    foreach ($all as $u) {
        if ($u['id'] === $userId) return $u;
    }
    return null;
}

function hydrateRequest(array $row, ?array $viewer = null): array {
    $itemIds = json_decode((string) ($row['selected_service_item_ids_json'] ?? '[]'), true);
    $itemNames = json_decode((string) ($row['selected_service_names_json'] ?? '[]'), true);
    $viewerId = $viewer['id'] ?? null;
    $isAdmin = ($viewer['role'] ?? '') === 'admin';
    $status = (string) $row['status'];
    $hideProviderPhone = !$isAdmin
        && $viewerId === (string) $row['client_id']
        && in_array($status, ['completed', 'cancelled'], true);

    $out = [
        'id' => (string) $row['id'],
        'clientId' => (string) $row['client_id'],
        'clientName' => (string) $row['client_name'],
        'clientPhone' => (string) $row['client_phone'],
        'providerId' => (string) $row['provider_id'],
        'providerName' => (string) $row['provider_name'],
        'providerPhone' => $hideProviderPhone ? '' : (string) $row['provider_phone'],
        'providerTradeAr' => (string) $row['provider_trade_ar'],
        'providerTradeEn' => (string) $row['provider_trade_en'],
        'status' => $status,
        'createdAt' => (string) $row['created_at'],
        'scheduledTimeNote' => (string) $row['scheduled_time_note'],
        'addressDetails' => (string) $row['address_details'],
        'city' => (string) $row['city'],
        'neighborhood' => (string) $row['neighborhood'],
        'problemDescription' => (string) $row['problem_description'],
        'selectedServiceItemIds' => is_array($itemIds) ? $itemIds : [],
        'selectedServiceNames' => is_array($itemNames) ? $itemNames : [],
        'agreedPriceSDG' => (int) $row['agreed_price_sdg'],
        'cancellationFeePenaltySDG' => (int) $row['cancellation_fee_penalty_sdg'],
        'commissionRatePercent' => (int) $row['commission_rate_percent'],
        'commissionFeeSDG' => (int) $row['commission_fee_sdg'],
        'isPaidByClient' => ((int) $row['is_paid_by_client']) === 1,
    ];
    if ($row['payment_method'] !== null) $out['paymentMethod'] = (string) $row['payment_method'];
    if ($row['client_rating'] !== null) $out['clientRating'] = (int) $row['client_rating'];
    if ($row['client_review_comment'] !== null) $out['clientReviewComment'] = (string) $row['client_review_comment'];
    if ($row['rated_at'] !== null) $out['ratedAt'] = (string) $row['rated_at'];
    if ($row['cancelled_by'] !== null) $out['cancelledBy'] = (string) $row['cancelled_by'];
    if ($row['cancel_reason'] !== null) $out['cancelReason'] = (string) $row['cancel_reason'];
    if ($row['cancelled_at'] !== null) $out['cancelledAt'] = (string) $row['cancelled_at'];
    if ($row['completed_at'] !== null) $out['completedAt'] = (string) $row['completed_at'];
    return $out;
}

function hydrateDeposit(array $row): array {
    return [
        'id' => (string) $row['id'],
        'providerId' => (string) $row['provider_id'],
        'providerName' => (string) $row['provider_name'],
        'amountSDG' => (int) $row['amount_sdg'],
        'depositDate' => (string) $row['deposit_date'],
        'bankakReferenceNumber' => (string) $row['bankak_reference_number'],
        'receiptFileUrl' => (string) $row['receipt_file_url'],
        'notes' => $row['notes'],
        'status' => (string) $row['status'],
        'rejectionReason' => $row['rejection_reason'] ?? null,
        'reviewedAt' => $row['reviewed_at'] ?? null,
        'submittedAt' => (string) $row['submitted_at'],
    ];
}

function hydrateSuggestion(array $row): array {
    return [
        'id' => (string) $row['id'],
        'providerId' => (string) $row['provider_id'],
        'providerName' => (string) $row['provider_name'],
        'providerPhone' => (string) $row['provider_phone'],
        'nameAr' => (string) $row['name_ar'],
        'nameEn' => (string) $row['name_en'],
        'descriptionAr' => (string) $row['description_ar'],
        'descriptionEn' => (string) $row['description_en'],
        'suggestedRateSDG' => (int) $row['suggested_rate_sdg'],
        'iconName' => $row['icon_name'],
        'status' => (string) $row['status'],
        'rejectionReason' => $row['rejection_reason'],
        'createdAt' => (string) $row['created_at'],
        'reviewedAt' => $row['reviewed_at'],
    ];
}

// ============================================================================
// Action Router
// ============================================================================

$action = (string) ($_GET['action'] ?? '');
$body = getJsonBody();

try {
    switch ($action) {
        case 'health': {
            $pdo->query('SELECT 1');
            sendJson([
                'ok' => true,
                'database' => 'mysql',
                'timestamp' => date('c'),
            ]);
        }

        case 'bootstrap': {
            $viewer = getAuthenticatedUser($pdo, $config);
            ensureUtf8mb4TextColumns($pdo);
            ensureTutorCategoryUpdated($pdo);
            $catRows = $pdo->query('SELECT * FROM categories')->fetchAll();
            $categories = array_map('hydrateCategory', $catRows);
            $users = hydrateAllUsers($pdo, $viewer);

            $currentUserOut = null;
            if ($viewer) {
                $currentUserOut = hydrateSingleUser($pdo, (string) $viewer['id'], true);
            }

            // Requests visibility: admin sees all; customer/provider sees their own + active status counts for capacity
            $requestsOut = [];
            if ($viewer) {
                if ($viewer['role'] === 'admin') {
                    $reqRows = $pdo->query('SELECT * FROM service_requests ORDER BY id DESC')->fetchAll();
                } else {
                    $stmt = $pdo->prepare('SELECT * FROM service_requests WHERE client_id = ? OR provider_id = ? ORDER BY id DESC');
                    $stmt->execute([$viewer['id'], $viewer['id']]);
                    $reqRows = $stmt->fetchAll();
                }
                $requestsOut = array_map(static fn ($r) => hydrateRequest($r, $viewer), $reqRows);
            }

            // Also include active job counts per provider so availability badges are accurate even for guests/other clients
            $activeCountsRows = $pdo->query("SELECT provider_id, COUNT(*) AS cnt FROM service_requests WHERE status IN ('accepted', 'in_progress') GROUP BY provider_id")->fetchAll();
            $activeCountsByProvider = [];
            foreach ($activeCountsRows as $ac) {
                $activeCountsByProvider[(string) $ac['provider_id']] = (int) $ac['cnt'];
            }

            // Public reviews (completed rated requests without client contact info)
            $reviewRows = $pdo->query('SELECT id, provider_id, client_name, client_rating, client_review_comment, rated_at FROM service_requests WHERE client_rating IS NOT NULL ORDER BY id DESC')->fetchAll();

            // Deposits visibility
            $depositsOut = [];
            if ($viewer) {
                ensureThursdayDepositsSchema($pdo);
                if ($viewer['role'] === 'admin') {
                    $depRows = $pdo->query('SELECT * FROM thursday_deposits ORDER BY id DESC')->fetchAll();
                } elseif ($viewer['role'] === 'provider') {
                    $stmt = $pdo->prepare('SELECT * FROM thursday_deposits WHERE provider_id = ? ORDER BY id DESC');
                    $stmt->execute([$viewer['id']]);
                    $depRows = $stmt->fetchAll();
                } else {
                    $depRows = [];
                }
                $depositsOut = array_map('hydrateDeposit', $depRows);
            }

            // Suggestions visibility
            $suggestionsOut = [];
            if ($viewer) {
                if ($viewer['role'] === 'admin') {
                    $sugRows = $pdo->query('SELECT * FROM service_suggestions ORDER BY id DESC')->fetchAll();
                } elseif ($viewer['role'] === 'provider') {
                    $stmt = $pdo->prepare('SELECT * FROM service_suggestions WHERE provider_id = ? ORDER BY id DESC');
                    $stmt->execute([$viewer['id']]);
                    $sugRows = $stmt->fetchAll();
                } else {
                    $sugRows = [];
                }
                $suggestionsOut = array_map('hydrateSuggestion', $sugRows);
            }

            $notifSummary = ['notifications' => [], 'unreadCount' => 0];
            if ($viewer) {
                syncBackgroundCheckNotifications($pdo, $viewer);
                $notifSummary = fetchUserNotificationsSummary($pdo, (string) $viewer['id'], 0);
            }

            sendJson([
                'ok' => true,
                'serverNowMs' => (int) round(microtime(true) * 1000),
                'currentUser' => $currentUserOut,
                'users' => $users,
                'categories' => $categories,
                'requests' => $requestsOut,
                'deposits' => $depositsOut,
                'serviceSuggestions' => $suggestionsOut,
                'activeCountsByProvider' => $activeCountsByProvider,
                'publicReviews' => $reviewRows,
                'notifications' => $notifSummary['notifications'],
                'unreadNotificationsCount' => $notifSummary['unreadCount'],
            ]);
        }

        case 'auth_login': {
            $rawIdentifier = normalizeNumerals((string) ($body['phone'] ?? $body['identifier'] ?? $body['email'] ?? ''));
            $password = (string) ($body['password'] ?? '');

            if ($rawIdentifier === '' || $password === '') {
                sendJson(['ok' => false, 'error' => 'يرجى إدخال رقم الهاتف أو البريد الإلكتروني وكلمة المرور'], 400);
            }

            $user = false;
            $emailCandidate = normalizeEmail($rawIdentifier);
            if ($emailCandidate !== null) {
                $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1');
                $stmt->execute([$emailCandidate]);
                $user = $stmt->fetch();
            }

            if (!$user) {
                $variants = buildSudanPhoneVariants($rawIdentifier);
                if ($variants) {
                    $placeholders = implode(', ', array_fill(0, count($variants), '?'));
                    $sql = "SELECT * FROM users WHERE TRIM(phone) IN ($placeholders) OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(phone), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') IN ($placeholders) LIMIT 1";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute(array_merge($variants, $variants));
                    $user = $stmt->fetch();
                }
            }

            if (!$user) {
                $notFoundMsg = $emailCandidate !== null
                    ? 'البريد الإلكتروني غير مسجل في مهني'
                    : 'رقم الهاتف غير مسجل في مهني';
                sendJson(['ok' => false, 'error' => $notFoundMsg], 401);
            }
            if (!verifyUserPassword($pdo, $user, $password)) {
                sendJson(['ok' => false, 'error' => 'كلمة المرور غير صحيحة'], 401);
            }

            $token = signToken((string) $user['id'], (string) $user['role'], $config);
            sendJson([
                'ok' => true,
                'token' => $token,
                'serverNowMs' => (int) round(microtime(true) * 1000),
                'user' => hydrateSingleUser($pdo, (string) $user['id'], true),
            ]);
        }

        case 'auth_register_customer': {
            ensureUtf8mb4TextColumns($pdo);
            $name = trim((string) ($body['name'] ?? ''));
            $cleanPhone = validateSudanPhoneOrFail((string) ($body['phone'] ?? ''));
            $cleanEmail = validateEmailOrFail((string) ($body['email'] ?? ''), true);
            $password = (string) ($body['password'] ?? '');
            $state = trim((string) ($body['state'] ?? 'الخرطوم'));
            $city = trim((string) ($body['city'] ?? 'الخرطوم'));
            $neighborhood = trim((string) ($body['neighborhood'] ?? 'الرياض'));
            $avatarUrl = trim((string) ($body['avatarUrl'] ?? ''));

            if ($name === '' || $password === '') {
                sendJson(['ok' => false, 'error' => 'يرجى تعبئة جميع الحقول المطلوبة'], 400);
            }

            $check = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
            $check->execute([$cleanPhone]);
            if ($check->fetch()) {
                sendJson(['ok' => false, 'error' => 'رقم الهاتف مسجل بالفعل مسبقاً'], 409);
            }
            assertUniqueEmail($pdo, $cleanEmail);

            $newId = 'c-' . round(microtime(true) * 1000);
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $avatar = $avatarUrl !== '' ? $avatarUrl : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
            $today = date('Y-m-d');

            $ins = $pdo->prepare('INSERT INTO users (id, name, phone, email, password_hash, role, avatar_url, state, city, neighborhood, created_at, is_active, unpaid_cancellation_fee_sdg) VALUES (?, ?, ?, ?, ?, "customer", ?, ?, ?, ?, ?, 1, 0)');
            $ins->execute([$newId, $name, $cleanPhone, $cleanEmail, $hash, $avatar, $state, $city, $neighborhood, $today]);

            $token = signToken($newId, 'customer', $config);
            sendJson([
                'ok' => true,
                'token' => $token,
                'serverNowMs' => (int) round(microtime(true) * 1000),
                'user' => hydrateSingleUser($pdo, $newId, true),
            ]);
        }

        case 'auth_register_provider': {
            ensureUtf8mb4TextColumns($pdo);
            $name = trim((string) ($body['name'] ?? ''));
            $cleanPhone = validateSudanPhoneOrFail((string) ($body['phone'] ?? ''));
            $cleanEmail = validateEmailOrFail((string) ($body['email'] ?? ''), true);
            $password = (string) ($body['password'] ?? '');
            $state = trim((string) ($body['state'] ?? 'الخرطوم'));
            $city = trim((string) ($body['city'] ?? 'الخرطوم'));
            $neighborhood = trim((string) ($body['neighborhood'] ?? 'الرياض'));
            $tradeCategoryId = trim((string) ($body['tradeCategoryId'] ?? 'tailor'));
            $serviceCategoryIds = is_array($body['serviceCategoryIds'] ?? null) ? $body['serviceCategoryIds'] : [$tradeCategoryId];
            $tradeTitleAr = trim((string) ($body['tradeTitleAr'] ?? 'مقدم خدمة'));
            $tradeTitleEn = trim((string) ($body['tradeTitleEn'] ?? 'Service Provider'));
            $bioAr = trim((string) ($body['bioAr'] ?? ''));
            $basePriceSDG = (int) ($body['basePriceSDG'] ?? 25000);
            $nidUrl = (string) ($body['nidUrl'] ?? '');
            $nidNumber = trim((string) ($body['nidNumber'] ?? 'نسخة مستند مرفقة'));
            $covered = is_array($body['coveredNeighborhoods'] ?? null) ? $body['coveredNeighborhoods'] : [$neighborhood];
            $avatarUrl = trim((string) ($body['avatarUrl'] ?? ''));

            if ($name === '' || $password === '' || $nidUrl === '') {
                sendJson(['ok' => false, 'error' => 'يرجى إكمال بيانات الحساب وإرفاق صورة الرقم الوطني أو جواز السفر'], 400);
            }

            $check = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
            $check->execute([$cleanPhone]);
            if ($check->fetch()) {
                sendJson(['ok' => false, 'error' => 'رقم الهاتف مسجل بالفعل مسبقاً'], 409);
            }
            assertUniqueEmail($pdo, $cleanEmail);

            $pdo->beginTransaction();
            $newId = 'p-' . round(microtime(true) * 1000);
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $avatar = $avatarUrl !== '' ? $avatarUrl : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80';
            $today = date('Y-m-d');
            $nowIso = date('c');

            $ins = $pdo->prepare('INSERT INTO users (id, name, phone, email, password_hash, role, avatar_url, state, city, neighborhood, created_at, is_active, deactivated_reason, trade_category_id, trade_title_ar, trade_title_en, bio_ar, base_price_sdg, pricing_type, is_available, active_services_count, rating, review_count, nid_url, nid_number, nid_status, nid_submitted_at, covered_neighborhoods_json, total_earnings_sdg, pending_commission_due_sdg) VALUES (?, ?, ?, ?, ?, "provider", ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, "fixed", 0, 0, 5.00, 0, ?, ?, "pending", ?, ?, 0, 0)');
            $ins->execute([
                $newId,
                $name,
                $cleanPhone,
                $cleanEmail,
                $hash,
                $avatar,
                $state,
                $city,
                $neighborhood,
                $today,
                'بانتظار مراجعة واعتماد الرقم الوطني أو جواز السفر من قبل إدارة المنصة',
                $tradeCategoryId,
                $tradeTitleAr,
                $tradeTitleEn,
                $bioAr,
                $basePriceSDG,
                $nidUrl,
                $nidNumber,
                $nowIso,
                json_encode(array_values($covered), JSON_UNESCAPED_UNICODE),
            ]);

            $catIns = $pdo->prepare('INSERT IGNORE INTO provider_categories (provider_id, category_id) VALUES (?, ?)');
            foreach ($serviceCategoryIds as $cid) {
                if ($cid) $catIns->execute([$newId, (string) $cid]);
            }
            $pdo->commit();

            notifyAllAdmins(
                $pdo,
                "admin_nid:$newId:$nowIso",
                'booking',
                'طلب مراجعة هوية مهني جديد',
                'Provider ID / Passport Pending Review',
                "المهني $name أرفق الرقم الوطني أو جواز السفر بانتظار المراجعة والتفعيل.",
                "Provider $name submitted an ID/Passport for review.",
                'admin'
            );

            $token = signToken($newId, 'provider', $config);
            sendJson([
                'ok' => true,
                'token' => $token,
                'serverNowMs' => (int) round(microtime(true) * 1000),
                'isPendingApproval' => true,
                'user' => hydrateSingleUser($pdo, $newId, true),
            ]);
        }

        case 'auth_request_password_reset': {
            $cleanEmail = validateEmailOrFail((string) ($body['email'] ?? ''), true);
            if (resolveMailDriver($config) === 'none') {
                sendJson([
                    'ok' => false,
                    'code' => 'MAIL_NOT_CONFIGURED',
                    'error' => 'خدمة إرسال البريد الإلكتروني غير مهيأة بعد في config.php. يرجى ضبط Webhook URL أو إعدادات SMTP.',
                ], 503);
            }

            ensurePasswordResetsTable($pdo);

            $uStmt = $pdo->prepare('SELECT id, name, email FROM users WHERE LOWER(email) = ? LIMIT 1');
            $uStmt->execute([$cleanEmail]);
            $targetUser = $uStmt->fetch();

            if ($targetUser) {
                $now = time();
                $recentStmt = $pdo->prepare('SELECT created_at FROM password_resets WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1');
                $recentStmt->execute([$cleanEmail]);
                $recent = $recentStmt->fetch();
                if ($recent && ((int) $recent['created_at']) > ($now - 60)) {
                    sendJson([
                        'ok' => false,
                        'error' => 'تم إرسال رمز تحقق مؤخراً. يرجى الانتظار دقيقة واحدة قبل طلب رمز جديد.',
                    ], 429);
                }

                $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                $secret = (string) ($config['auth_secret'] ?? 'mahara-default-secret');
                $codeHash = hash_hmac('sha256', $cleanEmail . '|' . $code, $secret);
                $resetId = 'pr-' . bin2hex(random_bytes(10));
                $expiresAt = $now + 900; // 15 minutes

                $pdo->prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
                    ->execute([$now, $targetUser['id']]);
                $pdo->prepare('INSERT INTO password_resets (id, user_id, email, code_hash, attempts, expires_at, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
                    ->execute([$resetId, $targetUser['id'], $cleanEmail, $codeHash, $expiresAt, $now]);

                $mailResult = sendPasswordResetEmail($config, $cleanEmail, (string) $targetUser['name'], $code);
                if (empty($mailResult['ok'])) {
                    $pdo->prepare('UPDATE password_resets SET used_at = ? WHERE id = ?')->execute([$now, $resetId]);
                    sendJson([
                        'ok' => false,
                        'error' => $mailResult['error'] ?? 'تعذر إرسال رسالة استعادة كلمة المرور، يرجى المحاولة لاحقاً.',
                    ], 502);
                }
            }

            sendJson([
                'ok' => true,
                'message' => 'إذا كان البريد الإلكتروني مسجلاً لدينا، فقد تم إرسال رمز تحقق مكون من 6 أرقام صالح لمدة 15 دقيقة.',
            ]);
        }

        case 'auth_reset_password': {
            $cleanEmail = validateEmailOrFail((string) ($body['email'] ?? ''), true);
            $code = preg_replace('/\s+/', '', (string) ($body['code'] ?? ''));
            $newPassword = (string) ($body['newPassword'] ?? '');

            if (!preg_match('/^[0-9]{6}$/', (string) $code)) {
                sendJson(['ok' => false, 'error' => 'يرجى إدخال رمز التحقق المكون من 6 أرقام'], 400);
            }
            if (strlen($newPassword) < 6) {
                sendJson(['ok' => false, 'error' => 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل'], 400);
            }

            ensurePasswordResetsTable($pdo);
            $now = time();

            $rStmt = $pdo->prepare('SELECT * FROM password_resets WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1');
            $rStmt->execute([$cleanEmail]);
            $resetRow = $rStmt->fetch();

            if (!$resetRow) {
                sendJson(['ok' => false, 'error' => 'لا يوجد طلب استعادة نشط لهذا البريد الإلكتروني أو تم استخدام الرمز مسبقاً'], 400);
            }
            if ((int) $resetRow['expires_at'] < $now) {
                sendJson(['ok' => false, 'error' => 'انتهت صلاحية رمز التحقق (15 دقيقة). يرجى طلب رمز جديد.'], 400);
            }
            if ((int) $resetRow['attempts'] >= 5) {
                sendJson(['ok' => false, 'error' => 'تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى طلب رمز تحقق جديد.'], 429);
            }

            $secret = (string) ($config['auth_secret'] ?? 'mahara-default-secret');
            $expectedHash = hash_hmac('sha256', $cleanEmail . '|' . $code, $secret);
            if (!hash_equals((string) $resetRow['code_hash'], $expectedHash)) {
                $pdo->prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?')
                    ->execute([$resetRow['id']]);
                sendJson(['ok' => false, 'error' => 'رمز التحقق غير صحيح، يرجى التأكد والمحاولة مرة أخرى'], 400);
            }

            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
            $pdo->beginTransaction();
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                ->execute([$newHash, $resetRow['user_id']]);
            $pdo->prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
                ->execute([$now, $resetRow['user_id']]);
            $pdo->commit();

            sendJson([
                'ok' => true,
                'message' => 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول برقم الهاتف وكلمة المرور الجديدة.',
            ]);
        }

        case 'update_profile': {
            $authUser = requireAuth($pdo, $config);
            ensureUtf8mb4TextColumns($pdo);
            $uid = (string) $authUser['id'];

            $fields = [];
            $params = [];

            if (isset($body['name']) && trim((string) $body['name']) !== '') {
                $fields[] = 'name = ?';
                $params[] = trim((string) $body['name']);
            }
            if (isset($body['phone']) && trim((string) $body['phone']) !== '') {
                $cleanPhone = validateSudanPhoneOrFail((string) $body['phone']);
                $dup = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1');
                $dup->execute([$cleanPhone, $uid]);
                if ($dup->fetch()) {
                    sendJson(['ok' => false, 'error' => 'رقم الهاتف الجديد مسجل لمستخدم آخر بالفعل'], 409);
                }
                $fields[] = 'phone = ?';
                $params[] = $cleanPhone;
            }
            if (array_key_exists('email', $body)) {
                $rawEmail = trim((string) ($body['email'] ?? ''));
                if ($rawEmail !== '') {
                    $cleanEmail = validateEmailOrFail($rawEmail, true);
                    assertUniqueEmail($pdo, $cleanEmail, $uid);
                    $fields[] = 'email = ?';
                    $params[] = $cleanEmail;
                } elseif (!empty($authUser['email'])) {
                    sendJson(['ok' => false, 'error' => 'لا يمكن إزالة البريد الإلكتروني المسجل؛ يمكنك تغييره إلى بريد إلكتروني آخر'], 400);
                }
            }
            if (isset($body['password']) && trim((string) $body['password']) !== '') {
                $fields[] = 'password_hash = ?';
                $params[] = password_hash((string) $body['password'], PASSWORD_BCRYPT);
            }
            foreach ([
                'city' => 'city',
                'state' => 'state',
                'neighborhood' => 'neighborhood',
                'avatarUrl' => 'avatar_url',
                'bioAr' => 'bio_ar',
                'tradeTitleAr' => 'trade_title_ar',
                'tradeTitleEn' => 'trade_title_en',
                'tradeCategoryId' => 'trade_category_id',
                'lastThursdayDepositDate' => 'last_thursday_deposit_date',
            ] as $jsonKey => $col) {
                if (array_key_exists($jsonKey, $body)) {
                    $fields[] = "$col = ?";
                    $params[] = $body[$jsonKey];
                }
            }
            foreach ([
                'basePriceSDG' => 'base_price_sdg',
                'unpaidCancellationFeeSDG' => 'unpaid_cancellation_fee_sdg',
                'pendingCommissionDueSDG' => 'pending_commission_due_sdg',
                'totalEarningsSDG' => 'total_earnings_sdg',
            ] as $jsonKey => $col) {
                if (array_key_exists($jsonKey, $body)) {
                    $fields[] = "$col = ?";
                    $params[] = (int) $body[$jsonKey];
                }
            }
            if (array_key_exists('isAvailable', $body)) {
                $fields[] = 'is_available = ?';
                $params[] = $body['isAvailable'] ? 1 : 0;
            }

            if ($fields) {
                $params[] = $uid;
                $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $pdo->prepare($sql)->execute($params);
            }

            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $uid, true)]);
        }

        case 'provider_reupload_nid': {
            $authUser = requireAuth($pdo, $config);
            $targetUserId = (string) ($body['userId'] ?? $authUser['id']);
            if ($targetUserId !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }
            $newNidUrl = (string) ($body['newNidUrl'] ?? '');
            $newNidNumber = trim((string) ($body['newNidNumber'] ?? 'مستند هوية محدث'));
            if ($newNidUrl === '') {
                sendJson(['ok' => false, 'error' => 'يرجى إرفاق صورة المستند الجديد'], 400);
            }

            $submittedAtIso = date('c');
            $upd = $pdo->prepare('UPDATE users SET nid_url = ?, nid_number = ?, nid_status = "pending", nid_submitted_at = ?, is_active = 0, deactivated_reason = ? WHERE id = ?');
            $upd->execute([
                $newNidUrl,
                $newNidNumber,
                $submittedAtIso,
                'تم استلام صورة الرقم الوطني / جواز السفر المحدثة وهي قيد مراجعة وتدقيق الإدارة',
                $targetUserId,
            ]);

            $uStmt = $pdo->prepare('SELECT name FROM users WHERE id = ? LIMIT 1');
            $uStmt->execute([$targetUserId]);
            $uRow = $uStmt->fetch();
            $pName = (string) ($uRow['name'] ?? $targetUserId);
            notifyAllAdmins(
                $pdo,
                "admin_nid:$targetUserId:$submittedAtIso",
                'booking',
                'طلب مراجعة هوية مهني جديد',
                'Provider ID / Passport Pending Review',
                "أعاد المهني $pName إرفاق الرقم الوطني أو جواز السفر بانتظار المراجعة والتفعيل.",
                "Provider $pName re-uploaded an ID/Passport for review.",
                'admin'
            );

            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $targetUserId, true)]);
        }

        case 'toggle_availability': {
            $authUser = requireAuth($pdo, $config);
            $providerId = (string) ($body['providerId'] ?? $authUser['id']);
            if ($providerId !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }
            $pdo->prepare('UPDATE users SET is_available = IF(is_available = 1, 0, 1) WHERE id = ?')->execute([$providerId]);
            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $providerId, true)]);
        }

        case 'add_portfolio': {
            $authUser = requireAuth($pdo, $config);
            $providerId = (string) ($body['providerId'] ?? $authUser['id']);
            if ($providerId !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }
            $newId = 'port-' . round(microtime(true) * 1000);
            $ins = $pdo->prepare('INSERT INTO provider_portfolio (id, provider_id, title_ar, title_en, image_url, description_ar, description_en) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $ins->execute([
                $newId,
                $providerId,
                trim((string) ($body['titleAr'] ?? '')),
                trim((string) ($body['titleEn'] ?? $body['titleAr'] ?? '')),
                (string) ($body['imageUrl'] ?? ''),
                $body['descriptionAr'] ?? null,
                $body['descriptionEn'] ?? null,
            ]);
            sendJson(['ok' => true, 'id' => $newId]);
        }

        case 'add_provider_service': {
            $authUser = requireAuth($pdo, $config);
            $providerId = (string) ($body['providerId'] ?? '');
            $categoryId = (string) ($body['categoryId'] ?? '');
            if ($providerId !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }
            $pdo->prepare('INSERT IGNORE INTO provider_categories (provider_id, category_id) VALUES (?, ?)')->execute([$providerId, $categoryId]);
            $pdo->prepare('UPDATE users SET trade_category_id = COALESCE(trade_category_id, ?) WHERE id = ?')->execute([$categoryId, $providerId]);
            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $providerId, true)]);
        }

        case 'remove_provider_service': {
            $authUser = requireAuth($pdo, $config);
            $providerId = (string) ($body['providerId'] ?? '');
            $categoryId = (string) ($body['categoryId'] ?? '');
            if ($providerId !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }
            $cntStmt = $pdo->prepare('SELECT category_id FROM provider_categories WHERE provider_id = ?');
            $cntStmt->execute([$providerId]);
            $cats = $cntStmt->fetchAll(PDO::FETCH_COLUMN);
            if (count($cats) <= 1) {
                sendJson(['ok' => false, 'error' => 'لا يمكن حذف هذه الخدمة؛ يجب أن يقدم الحرفي خدمة واحدة على الأقل في حسابه.'], 400);
            }
            $pdo->prepare('DELETE FROM provider_categories WHERE provider_id = ? AND category_id = ?')->execute([$providerId, $categoryId]);
            $remaining = array_values(array_filter($cats, fn($c) => $c !== $categoryId));
            $nextPrimary = $remaining[0] ?? null;
            $pdo->prepare('UPDATE users SET trade_category_id = IF(trade_category_id = ?, ?, trade_category_id) WHERE id = ?')->execute([$categoryId, $nextPrimary, $providerId]);
            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $providerId, true)]);
        }

        case 'add_custom_service': {
            $authUser = requireAuth($pdo, $config);
            $providerId = (string) ($body['providerId'] ?? $authUser['id']);
            if ($providerId !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }
            $nameAr = trim((string) ($body['nameAr'] ?? ''));
            $price = (int) ($body['priceSDG'] ?? 0);
            if ($nameAr === '' || $price <= 0) {
                sendJson(['ok' => false, 'error' => 'يرجى إدخال اسم الخدمة وسعر صحيح'], 400);
            }
            $newId = 'cs-' . round(microtime(true) * 1000);
            $ins = $pdo->prepare('INSERT INTO provider_custom_services (id, provider_id, category_id, name_ar, name_en, price_sdg) VALUES (?, ?, ?, ?, ?, ?)');
            $ins->execute([
                $newId,
                $providerId,
                $body['categoryId'] ?? null,
                $nameAr,
                trim((string) ($body['nameEn'] ?? $nameAr)),
                $price,
            ]);
            sendJson(['ok' => true, 'id' => $newId, 'user' => hydrateSingleUser($pdo, $providerId, true)]);
        }

        case 'update_custom_service': {
            $authUser = requireAuth($pdo, $config);
            $providerId = (string) ($body['providerId'] ?? $authUser['id']);
            $serviceId = (string) ($body['serviceId'] ?? '');
            if ($providerId !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }
            $fields = [];
            $params = [];
            if (isset($body['nameAr'])) { $fields[] = 'name_ar = ?'; $params[] = trim((string) $body['nameAr']); }
            if (isset($body['nameEn'])) { $fields[] = 'name_en = ?'; $params[] = trim((string) $body['nameEn']); }
            if (isset($body['priceSDG'])) { $fields[] = 'price_sdg = ?'; $params[] = (int) $body['priceSDG']; }
            if (array_key_exists('categoryId', $body)) { $fields[] = 'category_id = ?'; $params[] = $body['categoryId']; }
            if ($fields) {
                $params[] = $serviceId;
                $params[] = $providerId;
                $pdo->prepare('UPDATE provider_custom_services SET ' . implode(', ', $fields) . ' WHERE id = ? AND provider_id = ?')->execute($params);
            }
            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $providerId, true)]);
        }

        case 'delete_custom_service': {
            $authUser = requireAuth($pdo, $config);
            $providerId = (string) ($body['providerId'] ?? $authUser['id']);
            $serviceId = (string) ($body['serviceId'] ?? '');
            if ($providerId !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }
            $pdo->prepare('DELETE FROM provider_custom_services WHERE id = ? AND provider_id = ?')->execute([$serviceId, $providerId]);
            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $providerId, true)]);
        }

        case 'book_service': {
            $client = requireAuth($pdo, $config);
            ensureUtf8mb4TextColumns($pdo);
            $providerId = (string) ($body['providerId'] ?? '');
            $provStmt = $pdo->prepare('SELECT * FROM users WHERE id = ? AND role = "provider" LIMIT 1');
            $provStmt->execute([$providerId]);
            $provider = $provStmt->fetch();

            if (!$provider) {
                sendJson(['ok' => false, 'error' => 'مقدم الخدمة غير موجود'], 404);
            }
            if (((int) $provider['is_active']) !== 1) {
                sendJson(['ok' => false, 'error' => 'عذراً، تم تجميد حساب هذا المهني حالياً بواسطة إدارة المنصة.'], 400);
            }

            $pdo->beginTransaction();
            $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM service_requests WHERE provider_id = ? AND status IN ('accepted', 'in_progress')");
            $cntStmt->execute([$providerId]);
            if ((int) $cntStmt->fetchColumn() >= 3) {
                $pdo->rollBack();
                sendJson(['ok' => false, 'error' => 'عذراً، هذا المهني وصل للحد الأقصى المسموح للخدمات الجارية (3 خدمات في نفس الوقت). يرجى اختيار مهني آخر متاح.'], 400);
            }

            $agreedPrice = (int) ($body['agreedPriceSDG'] ?? 0);
            $clientPenalty = (int) ($client['unpaid_cancellation_fee_sdg'] ?? 0);
            $commissionFee = (int) round($agreedPrice * 0.08);
            $newId = 'req-' . round(microtime(true) * 1000);
            $createdAt = date('Y-m-d H:i');

            $ins = $pdo->prepare('INSERT INTO service_requests (id, client_id, client_name, client_phone, provider_id, provider_name, provider_phone, provider_trade_ar, provider_trade_en, status, created_at, scheduled_time_note, address_details, city, neighborhood, problem_description, selected_service_item_ids_json, selected_service_names_json, agreed_price_sdg, cancellation_fee_penalty_sdg, commission_rate_percent, commission_fee_sdg, is_paid_by_client) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 8, ?, 0)');
            $ins->execute([
                $newId,
                $client['id'],
                $client['name'],
                $client['phone'],
                $provider['id'],
                $provider['name'],
                $provider['phone'],
                $provider['trade_title_ar'] ?: ($provider['trade_category_id'] ?: 'حرفي'),
                $provider['trade_title_en'] ?: 'Service Provider',
                $createdAt,
                trim((string) ($body['scheduledTimeNote'] ?? '')),
                trim((string) ($body['addressDetails'] ?? '')),
                trim((string) ($body['city'] ?? '')),
                trim((string) ($body['neighborhood'] ?? '')),
                trim((string) ($body['problemDescription'] ?? '')),
                json_encode($body['selectedServiceItemIds'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($body['selectedServiceNames'] ?? [], JSON_UNESCAPED_UNICODE),
                $agreedPrice,
                $clientPenalty,
                $commissionFee,
            ]);

            if ($clientPenalty > 0) {
                $pdo->prepare('UPDATE users SET unpaid_cancellation_fee_sdg = 0 WHERE id = ?')->execute([$client['id']]);
            }
            $pdo->commit();

            $priceFmt = number_format($agreedPrice);
            $reqCity = trim((string) ($body['city'] ?? ''));
            $reqNeigh = trim((string) ($body['neighborhood'] ?? ''));
            createNotificationRecord(
                $pdo,
                (string) $provider['id'],
                "req_new:$newId",
                'booking',
                'طلب خدمة جديد!',
                'New Service Request!',
                "طلب جديد من {$client['name']} ($reqCity - $reqNeigh) بقيمة $priceFmt ج.س.",
                "New request from {$client['name']} ($reqCity - $reqNeigh) for $priceFmt SDG.",
                'bookings'
            );

            $rowStmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = ?');
            $rowStmt->execute([$newId]);
            sendJson(['ok' => true, 'request' => hydrateRequest($rowStmt->fetch(), $client)]);
        }

        case 'cancel_service': {
            $authUser = requireAuth($pdo, $config);
            $requestId = (string) ($body['requestId'] ?? '');
            $reason = trim((string) ($body['reason'] ?? 'تم الإلغاء بواسطة العميل'));

            $stmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = ? LIMIT 1');
            $stmt->execute([$requestId]);
            $req = $stmt->fetch();
            if (!$req) sendJson(['ok' => false, 'error' => 'الطلب غير موجود'], 404);

            if ($authUser['role'] !== 'admin' && $authUser['id'] !== $req['client_id'] && $authUser['id'] !== $req['provider_id']) {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }

            $penalty = (int) round(((int) $req['agreed_price_sdg']) * 0.05);
            $pdo->beginTransaction();
            $pdo->prepare('UPDATE service_requests SET status = "cancelled", cancelled_by = "client", cancel_reason = ?, cancelled_at = ? WHERE id = ?')
                ->execute([$reason, date('Y-m-d H:i'), $requestId]);
            $pdo->prepare('UPDATE users SET unpaid_cancellation_fee_sdg = unpaid_cancellation_fee_sdg + ? WHERE id = ?')
                ->execute([$penalty, $req['client_id']]);
            $pdo->commit();

            $reasonSuffix = $reason !== '' ? " ($reason)" : '';
            createNotificationRecord(
                $pdo,
                (string) $req['provider_id'],
                "req_cancelled:$requestId:{$req['provider_id']}",
                'urgent',
                'تم إلغاء طلب الخدمة',
                'Service Request Cancelled',
                "تم إلغاء الطلب #$requestId من العميل {$req['client_name']}$reasonSuffix.",
                "Request #$requestId with client {$req['client_name']} was cancelled$reasonSuffix.",
                'bookings'
            );
            createNotificationRecord(
                $pdo,
                (string) $req['client_id'],
                "req_cancelled:$requestId:{$req['client_id']}",
                'urgent',
                'تم إلغاء طلب الخدمة',
                'Service Request Cancelled',
                "تم إلغاء طلبك #$requestId مع المهني {$req['provider_name']}$reasonSuffix.",
                "Your request #$requestId with {$req['provider_name']} was cancelled$reasonSuffix.",
                'bookings'
            );

            sendJson(['ok' => true, 'penaltyAmount' => $penalty]);
        }

        case 'update_request_status': {
            $authUser = requireAuth($pdo, $config);
            $requestId = (string) ($body['requestId'] ?? '');
            $newStatus = (string) ($body['newStatus'] ?? '');
            $paymentMethod = $body['paymentMethod'] ?? null;

            $stmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = ? LIMIT 1');
            $stmt->execute([$requestId]);
            $req = $stmt->fetch();
            if (!$req) sendJson(['ok' => false, 'error' => 'الطلب غير موجود'], 404);

            if ($authUser['role'] !== 'admin' && $authUser['id'] !== $req['provider_id'] && $authUser['id'] !== $req['client_id']) {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }

            $pdo->beginTransaction();
            if ($newStatus === 'accepted' && $req['status'] === 'pending') {
                $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM service_requests WHERE provider_id = ? AND status IN ('accepted', 'in_progress')");
                $cntStmt->execute([$req['provider_id']]);
                if ((int) $cntStmt->fetchColumn() >= 3) {
                    $pdo->rollBack();
                    sendJson(['ok' => false, 'error' => 'تم الوصول للحد الأقصى للخدمات الجارية (3 خدمات)'], 400);
                }
            }

            $completedAt = $newStatus === 'completed' ? date('Y-m-d H:i') : $req['completed_at'];
            $isPaid = $paymentMethod ? 1 : (int) $req['is_paid_by_client'];
            $payCol = $paymentMethod ?: $req['payment_method'];

            $pdo->prepare('UPDATE service_requests SET status = ?, payment_method = ?, is_paid_by_client = ?, completed_at = ? WHERE id = ?')
                ->execute([$newStatus, $payCol, $isPaid, $completedAt, $requestId]);

            if ($newStatus === 'completed' && $req['status'] !== 'completed') {
                $comm = (int) ($req['commission_fee_sdg'] ?: round(((int) $req['agreed_price_sdg']) * 0.08));
                $collectedPenalty = (int) ($req['cancellation_fee_penalty_sdg'] ?? 0);
                $dueIncrement = $comm + $collectedPenalty;
                $agreed = (int) $req['agreed_price_sdg'];
                $pdo->prepare('UPDATE users SET pending_commission_due_sdg = pending_commission_due_sdg + ?, total_earnings_sdg = total_earnings_sdg + ? WHERE id = ?')
                    ->execute([$dueIncrement, $agreed, $req['provider_id']]);
            }
            $pdo->commit();

            if ($newStatus !== $req['status']) {
                $provName = (string) $req['provider_name'];
                $clientName = (string) $req['client_name'];
                $priceFmt = number_format((int) $req['agreed_price_sdg']);
                if ($newStatus === 'accepted') {
                    createNotificationRecord(
                        $pdo,
                        (string) $req['client_id'],
                        "req_accepted:$requestId",
                        'booking',
                        'تم قبول طلب خدمتك',
                        'Service Request Accepted',
                        "قبل المهني $provName طلبك وجاري التنسيق للموعد.",
                        "$provName accepted your service request and will coordinate timing.",
                        'bookings'
                    );
                } elseif ($newStatus === 'in_progress') {
                    createNotificationRecord(
                        $pdo,
                        (string) $req['client_id'],
                        "req_started:$requestId",
                        'booking',
                        'بدأ المهني تنفيذ الخدمة',
                        'Service Work Started',
                        "بدأ $provName العمل على طلبك رقم #$requestId.",
                        "$provName has started working on request #$requestId.",
                        'bookings'
                    );
                } elseif ($newStatus === 'completed') {
                    createNotificationRecord(
                        $pdo,
                        (string) $req['client_id'],
                        "req_completed:$requestId",
                        'booking',
                        'تم إنهاء الخدمة — يرجى التقييم',
                        'Service Ended — Please Rate',
                        "قام المهني $provName بإنهاء الخدمة وتأكيد السداد ($priceFmt ج.س). اضغط لتقييم الخدمة.",
                        "$provName marked your service ($priceFmt SDG) as completed. Tap to rate your worker.",
                        'bookings'
                    );
                } elseif ($newStatus === 'cancelled') {
                    createNotificationRecord(
                        $pdo,
                        (string) $req['provider_id'],
                        "req_cancelled:$requestId:{$req['provider_id']}",
                        'urgent',
                        'تم إلغاء طلب الخدمة',
                        'Service Request Cancelled',
                        "تم إلغاء الطلب #$requestId من العميل $clientName.",
                        "Request #$requestId with client $clientName was cancelled.",
                        'bookings'
                    );
                    createNotificationRecord(
                        $pdo,
                        (string) $req['client_id'],
                        "req_cancelled:$requestId:{$req['client_id']}",
                        'urgent',
                        'تم إلغاء طلب الخدمة',
                        'Service Request Cancelled',
                        "تم إلغاء طلبك #$requestId مع المهني $provName.",
                        "Your request #$requestId with $provName was cancelled.",
                        'bookings'
                    );
                }
            }

            sendJson(['ok' => true]);
        }

        case 'submit_rating': {
            $authUser = requireAuth($pdo, $config);
            $requestId = (string) ($body['requestId'] ?? '');
            $rating = (int) ($body['rating'] ?? 0);
            $comment = trim((string) ($body['comment'] ?? ''));

            if ($rating < 1 || $rating > 5) {
                sendJson(['ok' => false, 'error' => 'يرجى اختيار عدد النجوم من 1 إلى 5'], 400);
            }

            $stmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = ? LIMIT 1');
            $stmt->execute([$requestId]);
            $req = $stmt->fetch();
            if (!$req) sendJson(['ok' => false, 'error' => 'طلب الخدمة غير موجود'], 404);
            if ($req['status'] !== 'completed') {
                sendJson(['ok' => false, 'error' => 'يمكن تقييم الخدمات المكتملة فقط'], 400);
            }
            if ($req['client_id'] !== $authUser['id'] && $authUser['role'] !== 'admin') {
                sendJson(['ok' => false, 'error' => 'غير مصرح'], 403);
            }

            $pdo->beginTransaction();
            $pdo->prepare('UPDATE service_requests SET client_rating = ?, client_review_comment = ?, rated_at = ? WHERE id = ?')
                ->execute([$rating, $comment !== '' ? $comment : null, date('Y-m-d H:i'), $requestId]);

            $agg = $pdo->prepare('SELECT AVG(client_rating) AS avg_rating, COUNT(*) AS cnt FROM service_requests WHERE provider_id = ? AND client_rating IS NOT NULL');
            $agg->execute([$req['provider_id']]);
            $stats = $agg->fetch();
            $avg = round((float) ($stats['avg_rating'] ?? 5.0), 1);
            $cnt = (int) ($stats['cnt'] ?? 1);

            $pdo->prepare('UPDATE users SET rating = ?, review_count = ? WHERE id = ?')->execute([$avg, $cnt, $req['provider_id']]);
            $pdo->commit();

            $commentSuffix = $comment !== '' ? ": \"$comment\"" : '.';
            createNotificationRecord(
                $pdo,
                (string) $req['provider_id'],
                "req_rated:$requestId",
                'success',
                "تقييم جديد {$rating}/5 نجوم ⭐",
                "New {$rating}/5 Star Rating ⭐",
                "قيّم العميل {$req['client_name']} خدمتك بـ $rating نجوم$commentSuffix",
                "{$req['client_name']} rated your work $rating stars$commentSuffix",
                'bookings'
            );

            sendJson(['ok' => true, 'rating' => $avg, 'reviewCount' => $cnt]);
        }

        case 'submit_deposit': {
            $authUser = requireAuth($pdo, $config);
            ensureThursdayDepositsSchema($pdo);

            $amount = (int) ($body['amountSDG'] ?? 0);
            $depositDate = trim((string) ($body['depositDate'] ?? date('Y-m-d')));
            $bankakRef = trim((string) ($body['bankakReferenceNumber'] ?? ''));
            $receiptUrl = trim((string) ($body['receiptFileUrl'] ?? ''));
            $notes = trim((string) ($body['notes'] ?? ''));
            $resubmitId = trim((string) ($body['resubmitDepositId'] ?? ''));

            if ($amount <= 0) {
                sendJson(['ok' => false, 'error' => 'يرجى إدخال مبلغ توريد صحيح'], 400);
            }
            if ($bankakRef === '' || $bankakRef === 'BK-') {
                sendJson(['ok' => false, 'error' => 'يرجى إدخال الرقم المرجعي لعملية بنكك'], 400);
            }
            if ($receiptUrl === '') {
                sendJson(['ok' => false, 'error' => 'يرجى إرفاق صورة إشعار التحويل من بنكك'], 400);
            }

            $nowStr = date('Y-m-d H:i');
            if ($resubmitId !== '') {
                $existingStmt = $pdo->prepare('SELECT * FROM thursday_deposits WHERE id = ? LIMIT 1');
                $existingStmt->execute([$resubmitId]);
                $existing = $existingStmt->fetch();
                if (!$existing) {
                    sendJson(['ok' => false, 'error' => 'إشعار التوريد المراد تعديله غير موجود'], 404);
                }
                if ($existing['provider_id'] !== $authUser['id'] && $authUser['role'] !== 'admin') {
                    sendJson(['ok' => false, 'error' => 'غير مصرح بتعديل هذا الإشعار'], 403);
                }
                if ($existing['status'] === 'verified') {
                    sendJson(['ok' => false, 'error' => 'لا يمكن إعادة رفع إشعار تم اعتماده بالفعل'], 400);
                }

                $pdo->prepare('UPDATE thursday_deposits SET amount_sdg = ?, deposit_date = ?, bankak_reference_number = ?, receipt_file_url = ?, notes = ?, status = "pending_verification", rejection_reason = NULL, reviewed_at = NULL, submitted_at = ? WHERE id = ?')
                    ->execute([$amount, $depositDate, $bankakRef, $receiptUrl, $notes !== '' ? $notes : null, $nowStr, $resubmitId]);

                $amtFmt = number_format($amount);
                notifyAllAdmins(
                    $pdo,
                    "admin_dep:$resubmitId:$nowStr",
                    'booking',
                    'إشعار توريد عمولة محدّث (بنكك)',
                    'Updated Commission Deposit Proof',
                    "أعاد {$authUser['name']} رفع إشعار بمبلغ $amtFmt ج.س للمراجعة.",
                    "{$authUser['name']} re-uploaded a $amtFmt SDG deposit proof.",
                    'admin'
                );

                sendJson(['ok' => true, 'id' => $resubmitId]);
            }

            $newId = 'dep-' . round(microtime(true) * 1000);
            $pdo->prepare('INSERT INTO thursday_deposits (id, provider_id, provider_name, amount_sdg, deposit_date, bankak_reference_number, receipt_file_url, notes, status, rejection_reason, reviewed_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending_verification", NULL, NULL, ?)')
                ->execute([$newId, $authUser['id'], $authUser['name'], $amount, $depositDate, $bankakRef, $receiptUrl, $notes !== '' ? $notes : null, $nowStr]);

            $amtFmt = number_format($amount);
            notifyAllAdmins(
                $pdo,
                "admin_dep:$newId:$nowStr",
                'booking',
                'إشعار توريد عمولة جديد (بنكك)',
                'New Commission Deposit Proof',
                "رفع {$authUser['name']} إشعاراً بمبلغ $amtFmt ج.س للمراجعة.",
                "{$authUser['name']} uploaded a $amtFmt SDG deposit proof.",
                'admin'
            );

            sendJson(['ok' => true, 'id' => $newId]);
        }

        case 'suggest_service': {
            $authUser = requireAuth($pdo, $config);
            $nameAr = trim((string) ($body['nameAr'] ?? ''));
            if ($nameAr === '') sendJson(['ok' => false, 'error' => 'اسم الحرفة أو الخدمة بالعربية مطلوب'], 400);

            $nameEn = trim((string) ($body['nameEn'] ?? $nameAr));
            $newId = 'sug-' . round(microtime(true) * 1000);
            $pdo->prepare('INSERT INTO service_suggestions (id, provider_id, provider_name, provider_phone, name_ar, name_en, description_ar, description_en, suggested_rate_sdg, icon_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", ?)')
                ->execute([
                    $newId,
                    $authUser['id'],
                    $authUser['name'],
                    $authUser['phone'],
                    $nameAr,
                    $nameEn,
                    trim((string) ($body['descriptionAr'] ?? '')),
                    trim((string) ($body['descriptionEn'] ?? $body['descriptionAr'] ?? '')),
                    (int) ($body['suggestedRateSDG'] ?? 25000),
                    (string) ($body['iconName'] ?? 'Wrench'),
                    date('Y-m-d H:i'),
                ]);

            notifyAllAdmins(
                $pdo,
                "admin_sug:$newId",
                'booking',
                'مقترح خدمة جديدة من مهني',
                'New Service Category Suggestion',
                "اقترح {$authUser['name']} خدمة جديدة: $nameAr.",
                "{$authUser['name']} suggested a new service: $nameEn.",
                'admin'
            );

            sendJson(['ok' => true, 'id' => $newId]);
        }

        // ====================================================================
        // Admin-Only Endpoints
        // ====================================================================

        case 'admin_add_user': {
            requireAdmin($pdo, $config);
            ensureUtf8mb4TextColumns($pdo);
            $cleanPhone = validateSudanPhoneOrFail((string) ($body['phone'] ?? ''));
            $dup = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
            $dup->execute([$cleanPhone]);
            if ($dup->fetch()) sendJson(['ok' => false, 'error' => 'رقم الهاتف مسجل بالفعل مسبقاً'], 409);

            $cleanEmail = validateEmailOrFail((string) ($body['email'] ?? ''), false);
            if ($cleanEmail !== null) {
                assertUniqueEmail($pdo, $cleanEmail);
            }

            $role = (string) ($body['role'] ?? 'customer');
            $prefix = $role === 'provider' ? 'p-' : ($role === 'admin' ? 'admin-' : 'c-');
            $newId = $prefix . round(microtime(true) * 1000);
            $hash = password_hash((string) ($body['password'] ?? 'password123'), PASSWORD_BCRYPT);
            $catIds = is_array($body['serviceCategoryIds'] ?? null) ? $body['serviceCategoryIds'] : (!empty($body['tradeCategoryId']) ? [$body['tradeCategoryId']] : []);

            $pdo->beginTransaction();
            $ins = $pdo->prepare('INSERT INTO users (id, name, phone, email, password_hash, role, avatar_url, state, city, neighborhood, created_at, is_active, deactivated_reason, trade_category_id, trade_title_ar, trade_title_en, bio_ar, base_price_sdg, pricing_type, is_available, rating, review_count, nid_url, nid_number, covered_neighborhoods_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "fixed", ?, ?, ?, ?, ?, ?)');
            $ins->execute([
                $newId,
                trim((string) ($body['name'] ?? 'مستخدم جديد')),
                $cleanPhone,
                $cleanEmail,
                $hash,
                $role,
                $body['avatarUrl'] ?? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
                $body['state'] ?? 'الخرطوم',
                $body['city'] ?? 'الخرطوم',
                $body['neighborhood'] ?? 'الرياض',
                date('Y-m-d'),
                array_key_exists('isActive', $body) ? ($body['isActive'] ? 1 : 0) : 1,
                $body['deactivatedReason'] ?? null,
                $body['tradeCategoryId'] ?? null,
                $body['tradeTitleAr'] ?? null,
                $body['tradeTitleEn'] ?? null,
                $body['bioAr'] ?? null,
                $role === 'provider' ? (int) ($body['basePriceSDG'] ?? 25000) : null,
                array_key_exists('isAvailable', $body) ? ($body['isAvailable'] ? 1 : 0) : 1,
                (float) ($body['rating'] ?? 5.0),
                (int) ($body['reviewCount'] ?? 0),
                $body['nidUrl'] ?? null,
                $body['nidNumber'] ?? null,
                json_encode($body['coveredNeighborhoods'] ?? [$body['neighborhood'] ?? 'الرياض'], JSON_UNESCAPED_UNICODE),
            ]);
            if ($role === 'provider') {
                $cIns = $pdo->prepare('INSERT IGNORE INTO provider_categories (provider_id, category_id) VALUES (?, ?)');
                foreach ($catIds as $cid) {
                    if ($cid) $cIns->execute([$newId, (string) $cid]);
                }
            }
            $pdo->commit();
            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $newId, true)]);
        }

        case 'admin_update_user': {
            requireAdmin($pdo, $config);
            ensureUtf8mb4TextColumns($pdo);
            $id = (string) ($body['id'] ?? '');
            $updates = is_array($body['updates'] ?? null) ? $body['updates'] : $body;
            $fields = [];
            $params = [];

            $strMap = [
                'name' => 'name', 'role' => 'role', 'avatarUrl' => 'avatar_url',
                'state' => 'state', 'city' => 'city', 'neighborhood' => 'neighborhood',
                'deactivatedReason' => 'deactivated_reason', 'tradeCategoryId' => 'trade_category_id',
                'tradeTitleAr' => 'trade_title_ar', 'tradeTitleEn' => 'trade_title_en',
                'bioAr' => 'bio_ar', 'nidUrl' => 'nid_url', 'nidNumber' => 'nid_number',
                'nidStatus' => 'nid_status', 'nidRejectionReason' => 'nid_rejection_reason',
            ];
            foreach ($strMap as $k => $col) {
                if (array_key_exists($k, $updates)) {
                    $fields[] = "$col = ?";
                    $params[] = $updates[$k];
                }
            }
            if (!empty($updates['phone'])) {
                $cleanPhone = validateSudanPhoneOrFail((string) $updates['phone']);
                $dupPhone = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1');
                $dupPhone->execute([$cleanPhone, $id]);
                if ($dupPhone->fetch()) {
                    sendJson(['ok' => false, 'error' => 'رقم الهاتف مسجل لمستخدم آخر بالفعل'], 409);
                }
                $fields[] = 'phone = ?';
                $params[] = $cleanPhone;
            }
            if (array_key_exists('email', $updates)) {
                $cleanEmail = validateEmailOrFail((string) ($updates['email'] ?? ''), false);
                if ($cleanEmail !== null) {
                    assertUniqueEmail($pdo, $cleanEmail, $id);
                }
                $fields[] = 'email = ?';
                $params[] = $cleanEmail;
            }
            if (!empty($updates['password'])) {
                $fields[] = 'password_hash = ?';
                $params[] = password_hash((string) $updates['password'], PASSWORD_BCRYPT);
            }
            if (array_key_exists('isActive', $updates)) {
                $fields[] = 'is_active = ?';
                $params[] = $updates['isActive'] ? 1 : 0;
            }
            if (array_key_exists('isAvailable', $updates)) {
                $fields[] = 'is_available = ?';
                $params[] = $updates['isAvailable'] ? 1 : 0;
            }
            if (array_key_exists('basePriceSDG', $updates)) {
                $fields[] = 'base_price_sdg = ?';
                $params[] = (int) $updates['basePriceSDG'];
            }
            if (array_key_exists('unpaidCancellationFeeSDG', $updates)) {
                $fields[] = 'unpaid_cancellation_fee_sdg = ?';
                $params[] = max(0, (int) $updates['unpaidCancellationFeeSDG']);
            }
            $prevStmt = $pdo->prepare('SELECT role, is_active, nid_status, unpaid_cancellation_fee_sdg, nid_submitted_at FROM users WHERE id = ? LIMIT 1');
            $prevStmt->execute([$id]);
            $prevUser = $prevStmt->fetch();

            if ($fields) {
                $params[] = $id;
                $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
            }
            if (isset($updates['serviceCategoryIds']) && is_array($updates['serviceCategoryIds'])) {
                $pdo->prepare('DELETE FROM provider_categories WHERE provider_id = ?')->execute([$id]);
                $cIns = $pdo->prepare('INSERT IGNORE INTO provider_categories (provider_id, category_id) VALUES (?, ?)');
                foreach ($updates['serviceCategoryIds'] as $cid) {
                    if ($cid) $cIns->execute([$id, (string) $cid]);
                }
            }

            if ($prevUser) {
                $afterStmt = $pdo->prepare('SELECT role, is_active, nid_status, deactivated_reason, unpaid_cancellation_fee_sdg, nid_submitted_at FROM users WHERE id = ? LIMIT 1');
                $afterStmt->execute([$id]);
                $afterUser = $afterStmt->fetch();
                if ($afterUser) {
                    if (($afterUser['role'] ?? '') === 'provider') {
                        $becameApproved = (($prevUser['nid_status'] ?? '') !== 'approved' && ($afterUser['nid_status'] ?? '') === 'approved')
                            || (((int) ($prevUser['is_active'] ?? 1)) === 0 && ((int) ($afterUser['is_active'] ?? 1)) === 1);
                        $becameDeactivated = ((int) ($prevUser['is_active'] ?? 1)) === 1 && ((int) ($afterUser['is_active'] ?? 1)) === 0 && ($afterUser['nid_status'] ?? '') !== 'reupload_requested';
                        if ($becameApproved) {
                            $stamp = (string) ($afterUser['nid_submitted_at'] ?: round(microtime(true) * 1000));
                            createNotificationRecord(
                                $pdo,
                                $id,
                                "account_approved:$stamp",
                                'success',
                                'تم اعتماد هويتك وتفعيل حسابك!',
                                'ID Approved & Account Activated!',
                                'تهانينا! أصبح ملفك المهني وخدماتك ظاهرين الآن للعملاء لاستقبال الطلبات.',
                                'Congratulations! Your worker profile and services are now live for clients.',
                                'profile'
                            );
                        } elseif ($becameDeactivated) {
                            $deactReason = trim((string) ($afterUser['deactivated_reason'] ?? ''));
                            $bodyAr = $deactReason !== '' ? $deactReason : 'تم تعليق ظهور ملفك المهني مؤقتاً. راجع إدارة المنصة.';
                            $bodyEn = $deactReason !== '' ? $deactReason : 'Your account was deactivated by platform admin.';
                            createNotificationRecord(
                                $pdo,
                                $id,
                                'account_deactivated:' . round(microtime(true) * 1000),
                                'urgent',
                                'تنبيه: تم إيقاف تفعيل الحساب',
                                'Account Temporarily Deactivated',
                                $bodyAr,
                                $bodyEn,
                                'profile'
                            );
                        }
                    }
                    $oldFine = (int) ($prevUser['unpaid_cancellation_fee_sdg'] ?? 0);
                    $newFine = (int) ($afterUser['unpaid_cancellation_fee_sdg'] ?? 0);
                    if ($oldFine > 0 && $newFine === 0) {
                        $oldFmt = number_format($oldFine);
                        createNotificationRecord(
                            $pdo,
                            $id,
                            'fine_exempted:user:' . round(microtime(true) * 1000),
                            'success',
                            'تم إعفائك من غرامة الإلغاء',
                            'Cancellation Penalty Exempted',
                            "قامت إدارة مهني بإعفائك من غرامة الإلغاء السابقة ($oldFmt ج.س) ولن تُضاف على طلباتك القادمة.",
                            "Mehani Admin has exempted your previous cancellation penalty ($oldFmt SDG).",
                            'bookings'
                        );
                    }
                }
            }

            sendJson(['ok' => true, 'user' => hydrateSingleUser($pdo, $id, true)]);
        }

        case 'admin_delete_user': {
            requireAdmin($pdo, $config);
            $id = (string) ($body['id'] ?? '');
            $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
            sendJson(['ok' => true]);
        }

        case 'admin_toggle_user_active': {
            requireAdmin($pdo, $config);
            $id = (string) ($body['id'] ?? '');
            $reason = trim((string) ($body['reason'] ?? 'تم تعطيل الحساب من قِبل إدارة المنصة'));
            $stmt = $pdo->prepare('SELECT role, is_active, nid_submitted_at FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) sendJson(['ok' => false, 'error' => 'المستخدم غير موجود'], 404);
            $nextActive = ((int) $row['is_active']) === 1 ? 0 : 1;
            $pdo->prepare('UPDATE users SET is_active = ?, deactivated_reason = ? WHERE id = ?')
                ->execute([$nextActive, $nextActive === 1 ? null : $reason, $id]);

            if (($row['role'] ?? '') === 'provider') {
                if ($nextActive === 1) {
                    $stamp = (string) ($row['nid_submitted_at'] ?: round(microtime(true) * 1000));
                    createNotificationRecord(
                        $pdo,
                        $id,
                        "account_approved:$stamp",
                        'success',
                        'تم اعتماد هويتك وتفعيل حسابك!',
                        'ID Approved & Account Activated!',
                        'تهانينا! أصبح ملفك المهني وخدماتك ظاهرين الآن للعملاء لاستقبال الطلبات.',
                        'Congratulations! Your worker profile and services are now live for clients.',
                        'profile'
                    );
                } else {
                    createNotificationRecord(
                        $pdo,
                        $id,
                        'account_deactivated:' . round(microtime(true) * 1000),
                        'urgent',
                        'تنبيه: تم إيقاف تفعيل الحساب',
                        'Account Temporarily Deactivated',
                        $reason !== '' ? $reason : 'تم تعليق ظهور ملفك المهني مؤقتاً. راجع إدارة المنصة.',
                        $reason !== '' ? $reason : 'Your account was deactivated by platform admin.',
                        'profile'
                    );
                }
            }

            sendJson(['ok' => true]);
        }

        case 'admin_request_nid_reupload': {
            requireAdmin($pdo, $config);
            $userId = (string) ($body['userId'] ?? '');
            $reason = trim((string) ($body['reason'] ?? 'المستند المرفق غير واضح أو غير مطابق، يرجى إعادة رفع صورة واضحة للرقم الوطني أو جواز السفر'));
            $pdo->prepare('UPDATE users SET is_active = 0, nid_status = "reupload_requested", nid_rejection_reason = ?, deactivated_reason = ? WHERE id = ?')
                ->execute([$reason, $reason, $userId]);

            $uStmt = $pdo->prepare('SELECT nid_submitted_at FROM users WHERE id = ? LIMIT 1');
            $uStmt->execute([$userId]);
            $uRow = $uStmt->fetch();
            $sig = (string) ($uRow['nid_submitted_at'] ?? '') . ':' . $reason;
            createNotificationRecord(
                $pdo,
                $userId,
                "nid_reupload:$sig",
                'urgent',
                'مطلوب إعادة رفع الرقم الوطني أو جواز السفر',
                'ID / Passport Re-upload Required',
                "إدارة مهني: يرجى إعادة رفع صورة الرقم الوطني أو جواز السفر ($reason).",
                "Mehani Admin: Please re-upload your National ID or Passport ($reason).",
                'profile'
            );

            sendJson(['ok' => true]);
        }

        case 'add_category': {
            requireAdmin($pdo, $config);
            $newId = 'cat-' . round(microtime(true) * 1000);
            $pdo->prepare('INSERT INTO categories (id, name_ar, name_en, icon_name, description_ar, description_en, average_rate_sdg, popular_locations_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([
                    $newId,
                    trim((string) ($body['nameAr'] ?? '')),
                    trim((string) ($body['nameEn'] ?? '')),
                    trim((string) ($body['iconName'] ?? 'Wrench')),
                    trim((string) ($body['descriptionAr'] ?? '')),
                    trim((string) ($body['descriptionEn'] ?? '')),
                    (int) ($body['averageRateSDG'] ?? 25000),
                    json_encode($body['popularLocations'] ?? ['الخرطوم', 'أم درمان'], JSON_UNESCAPED_UNICODE),
                ]);
            sendJson(['ok' => true, 'id' => $newId]);
        }

        case 'update_category': {
            requireAdmin($pdo, $config);
            $id = (string) ($body['id'] ?? '');
            $updates = is_array($body['updates'] ?? null) ? $body['updates'] : $body;
            $fields = [];
            $params = [];
            foreach ([
                'nameAr' => 'name_ar', 'nameEn' => 'name_en', 'iconName' => 'icon_name',
                'descriptionAr' => 'description_ar', 'descriptionEn' => 'description_en',
            ] as $k => $col) {
                if (isset($updates[$k])) { $fields[] = "$col = ?"; $params[] = $updates[$k]; }
            }
            if (isset($updates['averageRateSDG'])) {
                $fields[] = 'average_rate_sdg = ?';
                $params[] = (int) $updates['averageRateSDG'];
            }
            if (isset($updates['popularLocations'])) {
                $fields[] = 'popular_locations_json = ?';
                $params[] = json_encode($updates['popularLocations'], JSON_UNESCAPED_UNICODE);
            }
            if ($fields) {
                $params[] = $id;
                $pdo->prepare('UPDATE categories SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
            }
            sendJson(['ok' => true]);
        }

        case 'delete_category': {
            requireAdmin($pdo, $config);
            $id = (string) ($body['id'] ?? '');
            $pdo->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
            sendJson(['ok' => true]);
        }

        case 'verify_deposit': {
            requireAdmin($pdo, $config);
            ensureThursdayDepositsSchema($pdo);
            $id = (string) ($body['id'] ?? '');
            $status = (string) ($body['status'] ?? 'verified');
            $rejectionReason = trim((string) ($body['rejectionReason'] ?? ''));

            if (!in_array($status, ['pending_verification', 'verified', 'rejected'], true)) {
                sendJson(['ok' => false, 'error' => 'حالة التوريد غير صالحة'], 400);
            }

            $stmt = $pdo->prepare('SELECT * FROM thursday_deposits WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $dep = $stmt->fetch();
            if (!$dep) {
                sendJson(['ok' => false, 'error' => 'إشعار التوريد غير موجود'], 404);
            }

            $oldStatus = (string) $dep['status'];
            $amount = (int) $dep['amount_sdg'];
            $providerId = (string) $dep['provider_id'];

            if ($status === 'rejected' && $rejectionReason === '') {
                $rejectionReason = 'إشعار التحويل المرفق غير صالح أو غير مطابق، يرجى إعادة رفع إشعار بنكك الصحيح';
            }

            $reasonToSave = $status === 'rejected' ? $rejectionReason : null;
            $reviewedAt = ($status === 'verified' || $status === 'rejected') ? date('Y-m-d H:i') : null;

            $pdo->beginTransaction();
            $pdo->prepare('UPDATE thursday_deposits SET status = ?, rejection_reason = ?, reviewed_at = ? WHERE id = ?')
                ->execute([$status, $reasonToSave, $reviewedAt, $id]);

            if ($status === 'verified' && $oldStatus !== 'verified') {
                $pdo->prepare('UPDATE users SET pending_commission_due_sdg = GREATEST(0, pending_commission_due_sdg - ?), last_thursday_deposit_date = ? WHERE id = ?')
                    ->execute([$amount, (string) $dep['deposit_date'], $providerId]);
            } elseif ($status !== 'verified' && $oldStatus === 'verified') {
                $pdo->prepare('UPDATE users SET pending_commission_due_sdg = pending_commission_due_sdg + ? WHERE id = ?')
                    ->execute([$amount, $providerId]);
            }
            $pdo->commit();

            $amtFmt = number_format($amount);
            $refNo = (string) ($dep['bankak_reference_number'] ?? '');
            if ($status === 'verified') {
                createNotificationRecord(
                    $pdo,
                    $providerId,
                    "deposit_verified:$id:" . ($reviewedAt ?? ''),
                    'success',
                    'تم اعتماد توريد العمولة بنجاح',
                    'Commission Deposit Verified',
                    "تم التحقق واعتماد إشعار التوريد بمبلغ $amtFmt ج.س (مرجع: $refNo).",
                    "Your $amtFmt SDG deposit (Ref: $refNo) has been verified.",
                    'commission'
                );
            } elseif ($status === 'rejected') {
                createNotificationRecord(
                    $pdo,
                    $providerId,
                    "deposit_reupload:$id:" . ($reviewedAt ?? '') . ':' . $rejectionReason,
                    'urgent',
                    'مطلوب إعادة رفع إشعار العمولة (بنكك)',
                    'Deposit Proof Re-upload Needed',
                    "تم رفض إشعار توريد $amtFmt ج.س ($rejectionReason).",
                    "Your $amtFmt SDG deposit proof was rejected ($rejectionReason).",
                    'commission'
                );
            }

            sendJson(['ok' => true]);
        }

        case 'delete_deposit': {
            requireAdmin($pdo, $config);
            ensureThursdayDepositsSchema($pdo);
            $id = (string) ($body['id'] ?? '');

            $stmt = $pdo->prepare('SELECT * FROM thursday_deposits WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $dep = $stmt->fetch();

            $pdo->beginTransaction();
            if ($dep && ($dep['status'] ?? '') === 'verified') {
                $pdo->prepare('UPDATE users SET pending_commission_due_sdg = pending_commission_due_sdg + ? WHERE id = ?')
                    ->execute([(int) $dep['amount_sdg'], (string) $dep['provider_id']]);
            }
            $pdo->prepare('DELETE FROM thursday_deposits WHERE id = ?')->execute([$id]);
            $pdo->commit();

            sendJson(['ok' => true]);
        }

        case 'admin_delete_request': {
            requireAdmin($pdo, $config);
            $id = (string) ($body['id'] ?? '');
            $pdo->prepare('DELETE FROM service_requests WHERE id = ?')->execute([$id]);
            sendJson(['ok' => true]);
        }

        case 'admin_cancel_request': {
            requireAdmin($pdo, $config);
            $id = (string) ($body['id'] ?? '');
            $reason = trim((string) ($body['reason'] ?? 'تم الإلغاء بواسطة الإدارة العامة'));
            $rStmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = ? LIMIT 1');
            $rStmt->execute([$id]);
            $reqRow = $rStmt->fetch();

            $pdo->prepare('UPDATE service_requests SET status = "cancelled", cancelled_by = "provider", cancel_reason = ?, cancelled_at = ? WHERE id = ?')
                ->execute([$reason, date('Y-m-d H:i'), $id]);

            if ($reqRow) {
                $reasonSuffix = $reason !== '' ? " ($reason)" : '';
                createNotificationRecord(
                    $pdo,
                    (string) $reqRow['provider_id'],
                    "req_cancelled:$id:{$reqRow['provider_id']}",
                    'urgent',
                    'تم إلغاء طلب الخدمة',
                    'Service Request Cancelled',
                    "تم إلغاء الطلب #$id مع العميل {$reqRow['client_name']}$reasonSuffix.",
                    "Request #$id with client {$reqRow['client_name']} was cancelled$reasonSuffix.",
                    'bookings'
                );
                createNotificationRecord(
                    $pdo,
                    (string) $reqRow['client_id'],
                    "req_cancelled:$id:{$reqRow['client_id']}",
                    'urgent',
                    'تم إلغاء طلبك',
                    'Service Request Cancelled',
                    "تم إلغاء طلبك #$id مع المهني {$reqRow['provider_name']}$reasonSuffix.",
                    "Your request #$id with {$reqRow['provider_name']} was cancelled$reasonSuffix.",
                    'bookings'
                );
            }

            sendJson(['ok' => true]);
        }

        case 'admin_waive_fine': {
            $adminUser = requireAdmin($pdo, $config);
            $userId = trim((string) ($body['userId'] ?? ''));
            $requestId = trim((string) ($body['requestId'] ?? ''));
            $includeActiveRequests = array_key_exists('includeActiveRequests', $body)
                ? (bool) $body['includeActiveRequests']
                : ($userId !== '' && $requestId === '');

            if ($userId === '' && $requestId === '') {
                sendJson(['ok' => false, 'error' => 'يرجى تحديد المستخدم أو الطلب المطلوب إعفائه من الغرامة'], 400);
            }

            $updatedUser = null;
            $updatedRequest = null;

            if ($userId !== '') {
                $uStmt = $pdo->prepare('SELECT id, name, unpaid_cancellation_fee_sdg FROM users WHERE id = ? LIMIT 1');
                $uStmt->execute([$userId]);
                $uRow = $uStmt->fetch();
                if (!$uRow) {
                    sendJson(['ok' => false, 'error' => 'المستخدم غير موجود'], 404);
                }

                $pdo->beginTransaction();
                $accountFine = (int) ($uRow['unpaid_cancellation_fee_sdg'] ?? 0);
                if ($accountFine > 0) {
                    $pdo->prepare('UPDATE users SET unpaid_cancellation_fee_sdg = 0 WHERE id = ?')->execute([$userId]);
                }

                $waivedActiveReqs = [];
                if ($includeActiveRequests) {
                    $activeFineStmt = $pdo->prepare('SELECT id, provider_id, client_name, cancellation_fee_penalty_sdg FROM service_requests WHERE client_id = ? AND status IN ("pending", "accepted", "in_progress") AND cancellation_fee_penalty_sdg > 0');
                    $activeFineStmt->execute([$userId]);
                    $waivedActiveReqs = $activeFineStmt->fetchAll();
                    if ($waivedActiveReqs) {
                        $pdo->prepare('UPDATE service_requests SET cancellation_fee_penalty_sdg = 0 WHERE client_id = ? AND status IN ("pending", "accepted", "in_progress") AND cancellation_fee_penalty_sdg > 0')
                            ->execute([$userId]);
                    }
                }
                $pdo->commit();

                $totalWaivedForUser = $accountFine;
                foreach ($waivedActiveReqs as $wr) {
                    $wPenalty = (int) ($wr['cancellation_fee_penalty_sdg'] ?? 0);
                    $totalWaivedForUser += $wPenalty;
                    $wFmt = number_format($wPenalty);
                    createNotificationRecord(
                        $pdo,
                        (string) $wr['provider_id'],
                        'fine_exempted:req:' . $wr['id'] . ':' . round(microtime(true) * 1000),
                        'booking',
                        'تم إعفاء العميل من غرامة الإلغاء',
                        'Client Cancellation Penalty Exempted',
                        "أعفت الإدارة العميل {$wr['client_name']} من غرامة الإلغاء ($wFmt ج.س) على الطلب #{$wr['id']} — لن يتم تحصيلها أو توريدها.",
                        "Admin exempted {$wr['client_name']}'s cancellation penalty ($wFmt SDG) on request #{$wr['id']} — no penalty due.",
                        'bookings'
                    );
                }

                if ($totalWaivedForUser > 0) {
                    $tFmt = number_format($totalWaivedForUser);
                    createNotificationRecord(
                        $pdo,
                        $userId,
                        'fine_exempted:user:' . round(microtime(true) * 1000),
                        'success',
                        'تم إعفائك من غرامة الإلغاء',
                        'Cancellation Penalty Exempted',
                        "قامت إدارة مهني بإعفائك من غرامة الإلغاء ($tFmt ج.س) ولن تُطبق على طلباتك.",
                        "Mehani Admin has exempted your cancellation penalty ($tFmt SDG).",
                        'bookings'
                    );
                }

                $updatedUser = hydrateSingleUser($pdo, $userId, true);
            }

            if ($requestId !== '') {
                $rStmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = ? LIMIT 1');
                $rStmt->execute([$requestId]);
                $reqRow = $rStmt->fetch();
                if (!$reqRow) {
                    sendJson(['ok' => false, 'error' => 'الطلب غير موجود'], 404);
                }

                $oldPenalty = (int) ($reqRow['cancellation_fee_penalty_sdg'] ?? 0);
                $pdo->beginTransaction();
                $pdo->prepare('UPDATE service_requests SET cancellation_fee_penalty_sdg = 0 WHERE id = ?')->execute([$requestId]);
                if ($reqRow['status'] === 'completed' && $oldPenalty > 0) {
                    $pdo->prepare('UPDATE users SET pending_commission_due_sdg = GREATEST(0, pending_commission_due_sdg - ?) WHERE id = ?')
                        ->execute([$oldPenalty, $reqRow['provider_id']]);
                }
                $pdo->commit();

                if ($oldPenalty > 0) {
                    $pFmt = number_format($oldPenalty);
                    $stamp = (string) round(microtime(true) * 1000);
                    createNotificationRecord(
                        $pdo,
                        (string) $reqRow['client_id'],
                        "fine_exempted:req_client:$requestId:$stamp",
                        'success',
                        'تم إعفاء غرامة الإلغاء على طلبك',
                        'Booking Cancellation Penalty Exempted',
                        "تم إعفائك من غرامة الإلغاء ($pFmt ج.س) المضافة على الطلب #$requestId.",
                        "Your cancellation penalty ($pFmt SDG) on booking #$requestId has been exempted.",
                        'bookings'
                    );
                    createNotificationRecord(
                        $pdo,
                        (string) $reqRow['provider_id'],
                        "fine_exempted:req_prov:$requestId:$stamp",
                        'booking',
                        'تم إعفاء العميل من غرامة الإلغاء',
                        'Client Cancellation Penalty Exempted',
                        "أعفت الإدارة العميل {$reqRow['client_name']} من غرامة الإلغاء ($pFmt ج.س) على الطلب #$requestId — تم تحديث المستحقات تلقائياً.",
                        "Admin exempted {$reqRow['client_name']}'s cancellation penalty ($pFmt SDG) on request #$requestId.",
                        'bookings'
                    );
                }

                $rStmt2 = $pdo->prepare('SELECT * FROM service_requests WHERE id = ? LIMIT 1');
                $rStmt2->execute([$requestId]);
                $reqRow2 = $rStmt2->fetch();
                if ($reqRow2) {
                    $updatedRequest = hydrateRequest($reqRow2, $adminUser);
                }
            }

            sendJson([
                'ok' => true,
                'user' => $updatedUser,
                'request' => $updatedRequest,
            ]);
        }

        case 'approve_suggestion': {
            requireAdmin($pdo, $config);
            $suggestionId = (string) ($body['suggestionId'] ?? '');
            $stmt = $pdo->prepare('SELECT * FROM service_suggestions WHERE id = ? LIMIT 1');
            $stmt->execute([$suggestionId]);
            $sug = $stmt->fetch();
            if (!$sug) sendJson(['ok' => false, 'error' => 'الطلب المقترح غير موجود'], 404);

            $pdo->beginTransaction();
            $newCatId = 'cat_' . round(microtime(true) * 1000);
            $pdo->prepare('INSERT INTO categories (id, name_ar, name_en, icon_name, description_ar, description_en, average_rate_sdg, popular_locations_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([
                    $newCatId,
                    $sug['name_ar'],
                    $sug['name_en'] ?: $sug['name_ar'],
                    $sug['icon_name'] ?: 'Wrench',
                    $sug['description_ar'],
                    $sug['description_en'] ?: $sug['description_ar'],
                    (int) $sug['suggested_rate_sdg'],
                    json_encode(['الخرطوم', 'أم درمان', 'بورتسودان'], JSON_UNESCAPED_UNICODE),
                ]);
            $pdo->prepare('INSERT IGNORE INTO provider_categories (provider_id, category_id) VALUES (?, ?)')->execute([$sug['provider_id'], $newCatId]);
            $pdo->prepare('UPDATE service_suggestions SET status = "approved", reviewed_at = ? WHERE id = ?')->execute([date('Y-m-d H:i'), $suggestionId]);
            $pdo->commit();

            $sNameEn = $sug['name_en'] ?: $sug['name_ar'];
            createNotificationRecord(
                $pdo,
                (string) $sug['provider_id'],
                "suggestion_approved:$suggestionId",
                'success',
                'تمت الموافقة على خدمتك المقترحة',
                'Suggested Service Approved',
                "تمت إضافة \"{$sug['name_ar']}\" إلى تصنيفات منصة مهني المعتمدة.",
                "\"$sNameEn\" has been added to Mehani service categories.",
                'profile'
            );

            sendJson(['ok' => true, 'categoryId' => $newCatId]);
        }

        case 'reject_suggestion': {
            requireAdmin($pdo, $config);
            $suggestionId = (string) ($body['suggestionId'] ?? '');
            $reason = trim((string) ($body['reason'] ?? 'لم يتم استيفاء معايير التصنيف المعتمدة بالمنصة'));
            $stmt = $pdo->prepare('SELECT provider_id, name_ar, name_en FROM service_suggestions WHERE id = ? LIMIT 1');
            $stmt->execute([$suggestionId]);
            $sug = $stmt->fetch();

            $pdo->prepare('UPDATE service_suggestions SET status = "rejected", rejection_reason = ?, reviewed_at = ? WHERE id = ?')
                ->execute([$reason, date('Y-m-d H:i'), $suggestionId]);

            if ($sug) {
                $sNameEn = $sug['name_en'] ?: $sug['name_ar'];
                createNotificationRecord(
                    $pdo,
                    (string) $sug['provider_id'],
                    "suggestion_rejected:$suggestionId",
                    'urgent',
                    'تحديث حول مقترح الخدمة',
                    'Service Suggestion Update',
                    "لم يتم اعتماد مقترح \"{$sug['name_ar']}\"" . ($reason !== '' ? ": $reason" : '.'),
                    "Suggestion \"$sNameEn\" was not approved" . ($reason !== '' ? ": $reason" : '.'),
                    'profile'
                );
            }

            sendJson(['ok' => true]);
        }

        case 'mark_notification_read': {
            $authUser = requireAuth($pdo, $config);
            ensureNotificationsTable($pdo);
            $notifId = trim((string) ($body['notificationId'] ?? ''));
            if ($notifId === '') {
                sendJson(['ok' => false, 'error' => 'معرف الإشعار مطلوب'], 400);
            }
            $pdo->prepare('UPDATE `notifications` SET `is_read` = 1, `read_at` = ? WHERE `id` = ? AND `user_id` = ?')
                ->execute([date('Y-m-d H:i'), $notifId, $authUser['id']]);
            $summary = fetchUserNotificationsSummary($pdo, (string) $authUser['id'], 0);
            sendJson([
                'ok' => true,
                'unreadNotificationsCount' => $summary['unreadCount'],
            ]);
        }

        case 'mark_all_notifications_read': {
            $authUser = requireAuth($pdo, $config);
            ensureNotificationsTable($pdo);
            $pdo->prepare('UPDATE `notifications` SET `is_read` = 1, `read_at` = ? WHERE `user_id` = ? AND `is_read` = 0')
                ->execute([date('Y-m-d H:i'), $authUser['id']]);
            sendJson([
                'ok' => true,
                'unreadNotificationsCount' => 0,
            ]);
        }

        case 'notifications_feed': {
            $user = requireAuth($pdo, $config);
            ensureThursdayDepositsSchema($pdo);
            syncBackgroundCheckNotifications($pdo, $user);
            $uid = (string) $user['id'];
            $role = (string) $user['role'];
            $sinceMs = isset($_GET['since_ms']) ? (int) $_GET['since_ms'] : (int) ($body['sinceMs'] ?? 0);

            $notifSummary = fetchUserNotificationsSummary($pdo, $uid, $sinceMs);

            $userOut = [
                'id' => $uid,
                'role' => $role,
                'nidStatus' => $user['nid_status'] ?? null,
                'nidRejectionReason' => $user['nid_rejection_reason'] ?? null,
                'nidSubmittedAt' => $user['nid_submitted_at'] ?? null,
                'isActive' => ((int) ($user['is_active'] ?? 1)) === 1,
                'deactivatedReason' => $user['deactivated_reason'] ?? null,
                'pendingCommissionDueSDG' => (int) ($user['pending_commission_due_sdg'] ?? 0),
            ];

            // Include lightweight snapshot arrays only if not doing a delta since_ms poll (for backward compatibility)
            $requestsFeed = [];
            $depositsFeed = [];
            $suggestionsFeed = [];
            $pendingNidProviders = [];

            if ($sinceMs <= 0) {
                if ($role === 'admin') {
                    $reqRows = $pdo->query('SELECT id, status, client_id, provider_id, client_name, provider_name, agreed_price_sdg, cancellation_fee_penalty_sdg, client_rating, client_review_comment, cancel_reason FROM service_requests ORDER BY id DESC LIMIT 60')->fetchAll();
                } else {
                    $stmt = $pdo->prepare('SELECT id, status, client_id, provider_id, client_name, provider_name, agreed_price_sdg, cancellation_fee_penalty_sdg, client_rating, client_review_comment, cancel_reason FROM service_requests WHERE client_id = ? OR provider_id = ? ORDER BY id DESC LIMIT 60');
                    $stmt->execute([$uid, $uid]);
                    $reqRows = $stmt->fetchAll();
                }
                $requestsFeed = array_map(static fn ($r) => [
                    'id' => (string) $r['id'],
                    'status' => (string) $r['status'],
                    'clientId' => (string) $r['client_id'],
                    'providerId' => (string) $r['provider_id'],
                    'clientName' => (string) $r['client_name'],
                    'providerName' => (string) $r['provider_name'],
                    'agreedPriceSDG' => (int) $r['agreed_price_sdg'],
                    'cancellationFeePenaltySDG' => (int) ($r['cancellation_fee_penalty_sdg'] ?? 0),
                    'clientRating' => $r['client_rating'] !== null ? (int) $r['client_rating'] : null,
                    'clientReviewComment' => $r['client_review_comment'] !== null ? (string) $r['client_review_comment'] : null,
                    'cancelReason' => $r['cancel_reason'] !== null ? (string) $r['cancel_reason'] : null,
                ], $reqRows);

                if ($role === 'admin') {
                    $depRows = $pdo->query('SELECT id, provider_id, provider_name, amount_sdg, bankak_reference_number, status, rejection_reason, reviewed_at, submitted_at FROM thursday_deposits ORDER BY id DESC LIMIT 60')->fetchAll();
                } elseif ($role === 'provider') {
                    $stmt = $pdo->prepare('SELECT id, provider_id, provider_name, amount_sdg, bankak_reference_number, status, rejection_reason, reviewed_at, submitted_at FROM thursday_deposits WHERE provider_id = ? ORDER BY id DESC LIMIT 40');
                    $stmt->execute([$uid]);
                    $depRows = $stmt->fetchAll();
                } else {
                    $depRows = [];
                }
                foreach ($depRows as $d) {
                    $depositsFeed[] = [
                        'id' => (string) $d['id'],
                        'providerId' => (string) $d['provider_id'],
                        'providerName' => (string) $d['provider_name'],
                        'amountSDG' => (int) $d['amount_sdg'],
                        'bankakReferenceNumber' => (string) $d['bankak_reference_number'],
                        'status' => (string) $d['status'],
                        'rejectionReason' => $d['rejection_reason'] ?? null,
                        'reviewedAt' => $d['reviewed_at'] ?? null,
                        'submittedAt' => (string) $d['submitted_at'],
                    ];
                }

                if ($role === 'admin') {
                    $sugRows = $pdo->query('SELECT id, provider_id, provider_name, name_ar, name_en, status, rejection_reason, created_at FROM service_suggestions ORDER BY id DESC LIMIT 40')->fetchAll();
                } elseif ($role === 'provider') {
                    $stmt = $pdo->prepare('SELECT id, provider_id, provider_name, name_ar, name_en, status, rejection_reason, created_at FROM service_suggestions WHERE provider_id = ? ORDER BY id DESC LIMIT 40');
                    $stmt->execute([$uid]);
                    $sugRows = $stmt->fetchAll();
                } else {
                    $sugRows = [];
                }
                foreach ($sugRows as $s) {
                    $suggestionsFeed[] = [
                        'id' => (string) $s['id'],
                        'providerId' => (string) $s['provider_id'],
                        'providerName' => (string) $s['provider_name'],
                        'nameAr' => (string) $s['name_ar'],
                        'nameEn' => (string) $s['name_en'],
                        'status' => (string) $s['status'],
                        'rejectionReason' => $s['rejection_reason'] ?? null,
                        'createdAt' => (string) $s['created_at'],
                    ];
                }

                if ($role === 'admin') {
                    $nidRows = $pdo->query("SELECT id, name, nid_submitted_at, created_at FROM users WHERE role = 'provider' AND nid_status = 'pending' ORDER BY id DESC LIMIT 40")->fetchAll();
                    foreach ($nidRows as $p) {
                        $pendingNidProviders[] = [
                            'id' => (string) $p['id'],
                            'name' => (string) $p['name'],
                            'nidSubmittedAt' => $p['nid_submitted_at'] ?? null,
                            'createdAt' => (string) $p['created_at'],
                        ];
                    }
                }
            }

            sendJson([
                'ok' => true,
                'serverNowMs' => (int) round(microtime(true) * 1000),
                'user' => $userOut,
                'notifications' => $notifSummary['notifications'],
                'unreadNotificationsCount' => $notifSummary['unreadCount'],
                'requests' => $requestsFeed,
                'deposits' => $depositsFeed,
                'suggestions' => $suggestionsFeed,
                'pendingNidProviders' => $pendingNidProviders,
            ]);
        }

        default: {
            sendJson(['ok' => false, 'error' => 'Unknown API action'], 404);
        }
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[Mehani API Error] ' . $e->getMessage());
    sendJson([
        'ok' => false,
        'error' => 'حدث خطأ في الخادم أثناء معالجة الطلب، يرجى المحاولة مرة أخرى.',
    ], 500);
}
