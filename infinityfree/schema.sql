-- ============================================================================
-- Mehani Sudan (مهني) - InfinityFree MySQL Relational Schema & Initial Seed
-- ============================================================================
-- Import this file inside InfinityFree phpMyAdmin after selecting your database.
-- Uses utf8mb4_unicode_ci and VARCHAR(64/191) keys compatible with all MySQL/MariaDB tiers.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+02:00';

-- 1. Users Table (Customers, Providers, Admins)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `email` VARCHAR(191) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('customer', 'provider', 'admin') NOT NULL DEFAULT 'customer',
  `avatar_url` LONGTEXT NULL,
  `state` VARCHAR(100) NOT NULL DEFAULT 'الخرطوم',
  `city` VARCHAR(100) NOT NULL DEFAULT 'الخرطوم',
  `neighborhood` VARCHAR(150) NOT NULL DEFAULT 'الرياض',
  `created_at` VARCHAR(64) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `deactivated_reason` TEXT NULL,

  -- Customer-specific
  `unpaid_cancellation_fee_sdg` INT NOT NULL DEFAULT 0,

  -- Provider-specific
  `trade_category_id` VARCHAR(64) NULL,
  `trade_title_ar` VARCHAR(191) NULL,
  `trade_title_en` VARCHAR(191) NULL,
  `bio_ar` TEXT NULL,
  `bio_en` TEXT NULL,
  `base_price_sdg` INT NULL,
  `pricing_type` ENUM('fixed', 'per_hour', 'negotiable') NULL DEFAULT 'fixed',
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `active_services_count` INT NOT NULL DEFAULT 0,
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  `review_count` INT NOT NULL DEFAULT 0,
  `nid_url` LONGTEXT NULL,
  `nid_number` VARCHAR(100) NULL,
  `nid_status` ENUM('pending', 'approved', 'reupload_requested') NULL,
  `nid_rejection_reason` TEXT NULL,
  `nid_submitted_at` VARCHAR(64) NULL,
  `covered_neighborhoods_json` TEXT NULL,
  `total_earnings_sdg` INT NOT NULL DEFAULT 0,
  `pending_commission_due_sdg` INT NOT NULL DEFAULT 0,
  `last_thursday_deposit_date` VARCHAR(64) NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_phone` (`phone`),
  UNIQUE KEY `uniq_users_email` (`email`),
  KEY `idx_users_role_active` (`role`, `is_active`),
  KEY `idx_users_city` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Official Trade & Service Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(64) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `icon_name` VARCHAR(64) NOT NULL DEFAULT 'Wrench',
  `description_ar` TEXT NOT NULL,
  `description_en` TEXT NOT NULL,
  `average_rate_sdg` INT NOT NULL DEFAULT 25000,
  `popular_locations_json` TEXT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Provider <-> Categories Mapping (Supports Multiple Categories per Worker)
CREATE TABLE IF NOT EXISTS `provider_categories` (
  `provider_id` VARCHAR(64) NOT NULL,
  `category_id` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`provider_id`, `category_id`),
  KEY `idx_pc_category` (`category_id`),
  CONSTRAINT `fk_pc_provider` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pc_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Provider Custom Itemized Services & Prices
CREATE TABLE IF NOT EXISTS `provider_custom_services` (
  `id` VARCHAR(64) NOT NULL,
  `provider_id` VARCHAR(64) NOT NULL,
  `category_id` VARCHAR(64) NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `name_en` VARCHAR(191) NULL,
  `price_sdg` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_pcs_provider` (`provider_id`),
  CONSTRAINT `fk_pcs_provider` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Provider Portfolio Showcase Items
CREATE TABLE IF NOT EXISTS `provider_portfolio` (
  `id` VARCHAR(64) NOT NULL,
  `provider_id` VARCHAR(64) NOT NULL,
  `title_ar` VARCHAR(191) NOT NULL,
  `title_en` VARCHAR(191) NOT NULL,
  `image_url` LONGTEXT NOT NULL,
  `description_ar` TEXT NULL,
  `description_en` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pp_provider` (`provider_id`),
  CONSTRAINT `fk_pp_provider` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Service Requests / Bookings
CREATE TABLE IF NOT EXISTS `service_requests` (
  `id` VARCHAR(64) NOT NULL,
  `client_id` VARCHAR(64) NOT NULL,
  `client_name` VARCHAR(191) NOT NULL,
  `client_phone` VARCHAR(32) NOT NULL,
  `provider_id` VARCHAR(64) NOT NULL,
  `provider_name` VARCHAR(191) NOT NULL,
  `provider_phone` VARCHAR(32) NOT NULL,
  `provider_trade_ar` VARCHAR(191) NOT NULL,
  `provider_trade_en` VARCHAR(191) NOT NULL,
  `status` ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `created_at` VARCHAR(64) NOT NULL,
  `scheduled_time_note` VARCHAR(191) NOT NULL,
  `address_details` TEXT NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `neighborhood` VARCHAR(150) NOT NULL,
  `problem_description` TEXT NOT NULL,
  `selected_service_item_ids_json` TEXT NULL,
  `selected_service_names_json` TEXT NULL,
  `agreed_price_sdg` INT NOT NULL DEFAULT 0,
  `cancellation_fee_penalty_sdg` INT NOT NULL DEFAULT 0,
  `commission_rate_percent` INT NOT NULL DEFAULT 8,
  `commission_fee_sdg` INT NOT NULL DEFAULT 0,
  `payment_method` ENUM('cash', 'bankak', 'fawry', 'pending') NULL,
  `is_paid_by_client` TINYINT(1) NOT NULL DEFAULT 0,
  `client_rating` TINYINT NULL,
  `client_review_comment` TEXT NULL,
  `rated_at` VARCHAR(64) NULL,
  `cancelled_by` ENUM('client', 'provider') NULL,
  `cancel_reason` TEXT NULL,
  `cancelled_at` VARCHAR(64) NULL,
  `completed_at` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sr_client` (`client_id`),
  KEY `idx_sr_provider_status` (`provider_id`, `status`),
  CONSTRAINT `fk_sr_client` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sr_provider` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Thursday Commission Deposits (8% Weekly Settlements via Bankak)
CREATE TABLE IF NOT EXISTS `thursday_deposits` (
  `id` VARCHAR(64) NOT NULL,
  `provider_id` VARCHAR(64) NOT NULL,
  `provider_name` VARCHAR(191) NOT NULL,
  `amount_sdg` INT NOT NULL DEFAULT 0,
  `deposit_date` VARCHAR(64) NOT NULL,
  `bankak_reference_number` VARCHAR(100) NOT NULL,
  `receipt_file_url` LONGTEXT NOT NULL,
  `notes` TEXT NULL,
  `status` ENUM('pending_verification', 'verified', 'rejected') NOT NULL DEFAULT 'pending_verification',
  `rejection_reason` TEXT NULL,
  `reviewed_at` VARCHAR(64) NULL,
  `submitted_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_td_provider` (`provider_id`),
  CONSTRAINT `fk_td_provider` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Provider Service Category Suggestions
CREATE TABLE IF NOT EXISTS `service_suggestions` (
  `id` VARCHAR(64) NOT NULL,
  `provider_id` VARCHAR(64) NOT NULL,
  `provider_name` VARCHAR(191) NOT NULL,
  `provider_phone` VARCHAR(32) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `description_ar` TEXT NOT NULL,
  `description_en` TEXT NOT NULL,
  `suggested_rate_sdg` INT NOT NULL DEFAULT 25000,
  `icon_name` VARCHAR(64) NULL DEFAULT 'Wrench',
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `rejection_reason` TEXT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  `reviewed_at` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ss_provider` (`provider_id`),
  CONSTRAINT `fk_ss_provider` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Email Password Reset Codes (6-digit code, 15-minute expiration)
CREATE TABLE IF NOT EXISTS `password_resets` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SEED DATA: Official Categories & Default Admin Account
-- ============================================================================

INSERT IGNORE INTO `categories` (`id`, `name_ar`, `name_en`, `icon_name`, `description_ar`, `description_en`, `average_rate_sdg`, `popular_locations_json`) VALUES
('tailor', 'خياطة وتطريز', 'Tailoring & Embroidery', 'Scissors', 'تفصيل جلاليب سودانية، تياب نسائية، فساتين وملاءات بدقة عالية', 'Custom Sudanese Jalabiyas, women thobes, and alteration work', 25000, '["الخرطوم","أم درمان","بورتسودان"]'),
('henna_beauty', 'حنانات وتجميل نسائي', 'Henna & Beauticians', 'Sparkles', 'نقش حناء برواز وسادة، تصفيف شعر ومكياج للمناسبات والأعراس', 'Traditional intricate henna art, bridal prep and hair combing', 20000, '["أم درمان","الخرطوم","ود مدني"]'),
('electrician_ac', 'كهرباء وتكييف', 'Electrician & AC', 'Zap', 'صيانة مكيفات اسبلت وموية، تمديد وتصليح عدادات وطبلات كهرباء', 'Electrical wiring, breaker panels and air conditioning maintenance', 30000, '["الخرطوم","بحري","بورتسودان"]'),
('plumber', 'سباكة وتمديدات', 'Plumbing & Pipes', 'Wrench', 'تركيب وصيانة مواتير المياه، سايفونات، وتمديدات المطابخ والحمامات', 'Water pumps installation, bathroom pipe repairs and drainage', 22000, '["الخرطوم","أم درمان","عطبرة"]'),
('builder_mason', 'بناء وتشييد', 'Builders & Masons', 'Hammer', 'بناء طوب ومحارة، سيراميك وبلاط، وترميم مباني وجدران', 'Bricklaying, plastering, ceramic tiles and structural repair', 45000, '["أم درمان","بحري","ود مدني"]'),
('carpenter', 'نجارة وأثاث', 'Carpentry & Furniture', 'Axe', 'صيانة وتفصيل غرف نوم، سراير، مطابخ خشب، وأبواب وشبابيك', 'Custom beds, wooden kitchens, wardrobe assembly and door locks', 28000, '["الخرطوم","أم درمان"]'),
('painter', 'نقاشة ودهانات', 'Painting & Decor', 'Paintbrush', 'دهانات داخلية وخارجية، معجون وتعتيق، وجبصين حديث', 'Interior and exterior wall paints, decorative putty and gypsum', 35000, '["بورتسودان","الخرطوم","كسلا"]'),
('barber', 'حلاقة رجالية', 'Barbers (Home visits)', 'UserCheck', 'حلاقة شعر وذقن منزلية لكبار السن والأطفال والمناسبات', 'Home grooming, haircuts, beard trimming for events & home visits', 12000, '["الخرطوم","أم درمان","بحري"]'),
('tutor', 'دروس خصوصية', 'Private Tutors', 'BookOpen', 'تأسيس شهادة سودانية، رياضيات، لغة إنجليزية ولغة عربية', 'Sudanese certificate tutoring, math, languages, and primary stages', 18000, '["أم درمان","الخرطوم","ود مدني"]'),
('cook_catering', 'طبخ وولائم', 'Cooks & Catering', 'Utensils', 'تجهيز ولائم مناسبات، أكلات سودانية أصيلة، ومعجنات وحلويات', 'Sudanese feasts, celebration dining, catering and home baking', 50000, '["الخرطوم","بورتسودان","أم درمان"]'),
('cleaner', 'نظافة منزلية', 'Home Cleaning', 'ShieldCheck', 'غسيل سجاد ومفروشات، تعقيم وتجهيز المنازل للمناسبات', 'Deep house cleaning, carpet washing and sanitization', 20000, '["الخرطوم","بحري","بورتسودان"]');

-- Default Admin Account (Phone: 0900000000, Initial Password: admin123)
-- Note: Automatically upgraded to PHP bcrypt hash on first login via api.php.
INSERT IGNORE INTO `users` (
  `id`, `name`, `phone`, `password_hash`, `role`, `avatar_url`,
  `state`, `city`, `neighborhood`, `created_at`, `is_active`
) VALUES (
  'admin-1',
  'إدارة مهني - مدير النظام العام',
  '0900000000',
  CONCAT('sha256:', SHA2('admin123', 256)),
  'admin',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
  'الخرطوم',
  'الخرطوم',
  'المقرن',
  '2025-01-01',
  1
);
