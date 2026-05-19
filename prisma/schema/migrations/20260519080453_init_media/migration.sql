-- CreateTable
CREATE TABLE "media_folders" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "store_id" UUID,
    "path" TEXT NOT NULL DEFAULT '/',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL,
    "folder_id" UUID,
    "store_id" UUID,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_type" TEXT NOT NULL DEFAULT 'local',
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT,
    "alt_text" TEXT,
    "title" TEXT,
    "description" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "variants" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_folders_store_id_idx" ON "media_folders"("store_id");

-- CreateIndex
CREATE INDEX "media_folders_parent_id_idx" ON "media_folders"("parent_id");

-- CreateIndex
CREATE INDEX "media_files_store_id_idx" ON "media_files"("store_id");

-- CreateIndex
CREATE INDEX "media_files_folder_id_idx" ON "media_files"("folder_id");

-- CreateIndex
CREATE INDEX "media_files_storage_type_idx" ON "media_files"("storage_type");

-- AddForeignKey
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
