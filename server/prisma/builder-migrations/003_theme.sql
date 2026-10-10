CREATE TABLE IF NOT EXISTS `BuilderTheme` (
  `id` VARCHAR(191) NOT NULL,
  `draft` LONGTEXT NOT NULL,
  `published` LONGTEXT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `publishedVersion` INTEGER NULL,
  `updatedBy` VARCHAR(191) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `BuilderThemeRevision` (
  `id` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `document` LONGTEXT NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `authorName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BuilderThemeRevision_version_key` (`version`),
  INDEX `BuilderThemeRevision_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
