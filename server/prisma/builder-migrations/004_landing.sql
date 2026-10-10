CREATE TABLE IF NOT EXISTS `BuilderLanding` (
  `id` VARCHAR(191) NOT NULL,
  `storePageId` VARCHAR(191) NOT NULL,
  `builderPageId` VARCHAR(191) NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BuilderLanding_storePageId_key` (`storePageId`),
  UNIQUE INDEX `BuilderLanding_builderPageId_key` (`builderPageId`),
  CONSTRAINT `BuilderLanding_storePageId_fkey` FOREIGN KEY (`storePageId`) REFERENCES `StorePage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BuilderLanding_builderPageId_fkey` FOREIGN KEY (`builderPageId`) REFERENCES `BuilderPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
