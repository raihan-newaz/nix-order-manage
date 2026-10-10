CREATE TABLE IF NOT EXISTS `LandingCheckoutDraft` (
  `storePageId` VARCHAR(191) NOT NULL,
  `blocks` LONGTEXT NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `metaTitle` VARCHAR(160) NULL,
  `metaDescription` VARCHAR(320) NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`storePageId`),
  CONSTRAINT `LandingCheckoutDraft_storePageId_fkey` FOREIGN KEY (`storePageId`) REFERENCES `StorePage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
