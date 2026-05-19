import * as v from "valibot";

export const createFolderSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  parentId: v.optional(v.pipe(v.string(), v.uuid())),
  storeId: v.optional(v.pipe(v.string(), v.uuid())),
});
export type CreateFolderInput = v.InferOutput<typeof createFolderSchema>;

// Download / Scale Query Parameters
export const downloadQuerySchema = v.object({
  w: v.optional(v.string()), // Lấy dạng string để tránh lỗi ép kiểu sớm
  h: v.optional(v.string()),
  fit: v.optional(
    v.picklist(["cover", "contain", "fill", "inside", "outside"]),
    "cover",
  ),
});

export const listMediaQuerySchema = v.object({
  parentId: v.optional(v.pipe(v.string(), v.uuid())),
  storeId: v.optional(v.pipe(v.string(), v.uuid())),
  page: v.optional(v.string(), "1"),
  limit: v.optional(v.string(), "50"),
  search: v.optional(v.string()),
});

export const uploadQuerySchema = v.object({
  folderId: v.optional(v.pipe(v.string(), v.uuid())),
  storeId: v.optional(v.pipe(v.string(), v.uuid())),
  storage_type: v.optional(v.picklist(["local", "s3", "supabase"]), "local"),
  altText: v.optional(v.pipe(v.string(), v.maxLength(255))),
  title: v.optional(v.pipe(v.string(), v.maxLength(255))),
  description: v.optional(v.pipe(v.string(), v.maxLength(1000))),
});
