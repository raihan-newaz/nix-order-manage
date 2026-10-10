-- Additive, repeatable installation for existing db-push-managed MySQL databases.
CREATE TABLE IF NOT EXISTS `BuilderPage` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `publishedSlug` VARCHAR(120) NULL,
  `draft` LONGTEXT NOT NULL,
  `published` LONGTEXT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `publishedVersion` INTEGER NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `updatedBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BuilderPage_slug_key` (`slug`),
  UNIQUE INDEX `BuilderPage_publishedSlug_key` (`publishedSlug`),
  INDEX `BuilderPage_updatedAt_idx` (`updatedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `BuilderRevision` (
  `id` VARCHAR(191) NOT NULL,
  `pageId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `document` LONGTEXT NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `authorName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BuilderRevision_pageId_version_key` (`pageId`, `version`),
  INDEX `BuilderRevision_pageId_createdAt_idx` (`pageId`, `createdAt`),
  CONSTRAINT `BuilderRevision_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `BuilderPage` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `BuilderTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `document` LONGTEXT NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `BuilderTemplate_updatedAt_idx` (`updatedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
