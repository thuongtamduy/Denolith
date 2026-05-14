-- CreateTable
CREATE TABLE "app_menus" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'vi',
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "store_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_menus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_menus_code_key" ON "app_menus"("code");

-- CreateIndex
CREATE INDEX "app_menus_code_idx" ON "app_menus"("code");

-- CreateIndex
CREATE INDEX "app_menus_lang_idx" ON "app_menus"("lang");

-- CreateIndex
CREATE INDEX "app_menus_store_id_idx" ON "app_menus"("store_id");

-- CreateIndex
CREATE INDEX "app_menus_active_idx" ON "app_menus"("active");
