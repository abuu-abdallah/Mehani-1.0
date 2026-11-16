-- ============================================================================
-- Mehani Sudan (مهني) - Non-Destructive Upgrade Migration
-- Run this in phpMyAdmin -> SQL tab on your existing database (e.g. if0_43444236_mehani)
-- to add unique user emails & 6-digit password reset codes WITHOUT losing existing data.
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Add nullable unique email column to existing users table
ALTER TABLE `users`
  ADD COLUMN `email` VARCHAR(191) NULL AFTER `phone`,
  ADD UNIQUE KEY `uniq_users_email` (`email`);

-- 2. Create password_resets table for 15-minute 6-digit verification codes
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
