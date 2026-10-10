CREATE TABLE IF NOT EXISTS `BuilderSubmission` (
  `id` VARCHAR(191) NOT NULL,
  `pageId` VARCHAR(191) NOT NULL,
  `formId` VARCHAR(191) NOT NULL,
  `formName` VARCHAR(160) NOT NULL,
  `pageVersion` INTEGER NOT NULL,
  `data` LONGTEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'NEW',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `BuilderSubmission_pageId_createdAt_idx` (`pageId`, `createdAt`),
  INDEX `BuilderSubmission_pageId_formId_status_idx` (`pageId`, `formId`, `status`),
  CONSTRAINT `BuilderSubmission_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `BuilderPage` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
