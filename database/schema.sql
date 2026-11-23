-- Buildmore Ventures LLP - Stock Updating & Inventory Management System
-- MySQL Database Schema (InnoDB, MySQL 5.7+ & 8.0+ compatible)

CREATE DATABASE IF NOT EXISTS `buildmore_inventory`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `buildmore_inventory`;

-- ---------------------------------------------------------------------------
-- 1. Users Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `username` VARCHAR(60) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `last_login` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `idx_users_role_status` (`role`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Categories Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Suppliers Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `contact_person` VARCHAR(120) NULL DEFAULT NULL,
  `phone` VARCHAR(40) NULL DEFAULT NULL,
  `email` VARCHAR(191) NULL DEFAULT NULL,
  `address` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suppliers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. Inventory Items Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sku` VARCHAR(64) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `supplier_id` INT UNSIGNED NULL DEFAULT NULL,
  `unit` VARCHAR(40) NOT NULL DEFAULT 'Pieces',
  `current_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `minimum_stock_level` DECIMAL(12, 2) NOT NULL DEFAULT 10.00,
  `unit_cost` DECIMAL(12, 2) NULL DEFAULT NULL,
  `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_items_sku` (`sku`),
  KEY `idx_items_name` (`name`),
  KEY `idx_items_category` (`category_id`),
  KEY `idx_items_status` (`status`),
  KEY `idx_items_qty_min` (`current_quantity`, `minimum_stock_level`),
  CONSTRAINT `fk_items_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_items_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5. Stock Transactions Ledger (Immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `transaction_code` VARCHAR(32) NOT NULL,
  `item_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `transaction_type` ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
  `quantity` DECIMAL(12, 2) NOT NULL,
  `previous_quantity` DECIMAL(12, 2) NOT NULL,
  `new_quantity` DECIMAL(12, 2) NOT NULL,
  `reference_number` VARCHAR(100) NULL DEFAULT NULL,
  `supplier_or_recipient` VARCHAR(150) NULL DEFAULT NULL,
  `reason` VARCHAR(255) NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `related_transaction_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tx_code` (`transaction_code`),
  KEY `idx_tx_item_date` (`item_id`, `created_at`),
  KEY `idx_tx_user_date` (`user_id`, `created_at`),
  KEY `idx_tx_type_date` (`transaction_type`, `created_at`),
  KEY `idx_tx_created_at` (`created_at`),
  CONSTRAINT `fk_tx_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_tx_related` FOREIGN KEY (`related_transaction_id`) REFERENCES `stock_transactions` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. Low-Stock & Out-of-Stock Alerts Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `alerts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_id` INT UNSIGNED NOT NULL,
  `alert_type` ENUM('LOW_STOCK', 'OUT_OF_STOCK') NOT NULL,
  `message` VARCHAR(255) NOT NULL,
  `status` ENUM('ACTIVE', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_alerts_item_status` (`item_id`, `status`),
  KEY `idx_alerts_status_type` (`status`, `alert_type`),
  CONSTRAINT `fk_alerts_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 7. Audit Logs Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL DEFAULT NULL,
  `action` VARCHAR(80) NOT NULL,
  `entity_type` VARCHAR(60) NOT NULL,
  `entity_id` VARCHAR(64) NULL DEFAULT NULL,
  `description` TEXT NOT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8. Application Settings Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` VARCHAR(80) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
