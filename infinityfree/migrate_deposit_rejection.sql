-- ============================================================================
-- Mehani Sudan (مهني) - Thursday Deposits Rejection & Re-upload Migration
-- Optional manual SQL (api.php also runs this upgrade automatically).
-- ============================================================================

SET NAMES utf8mb4;

ALTER TABLE `thursday_deposits`
  MODIFY COLUMN `status` ENUM('pending_verification', 'verified', 'rejected') NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN `rejection_reason` TEXT NULL AFTER `status`,
  ADD COLUMN `reviewed_at` VARCHAR(64) NULL AFTER `rejection_reason`;
