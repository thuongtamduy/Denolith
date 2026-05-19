import * as v from "valibot";

export const createAppMenuSchema = v.object({
  code: v.pipe(
    v.string("Code phải là chuỗi ký tự."),
    v.minLength(2, "Code phải có ít nhất 2 ký tự."),
    v.maxLength(100, "Code không được vượt quá 100 ký tự."),
    v.regex(
      /^[A-Z0-9_-]+$/,
      "Code chỉ được chứa chữ hoa, số, dấu gạch dưới hoặc gạch ngang.",
    ),
  ),
  lang: v.optional(
    v.pipe(
      v.string(),
      v.minLength(2, "Lang phải có ít nhất 2 ký tự."),
      v.maxLength(10, "Lang không được vượt quá 10 ký tự."),
    ),
    "vi",
  ),
  name: v.pipe(
    v.string("Name phải là chuỗi ký tự."),
    v.minLength(2, "Name phải có ít nhất 2 ký tự."),
    v.maxLength(200, "Name không được vượt quá 200 ký tự."),
  ),
  data: v.pipe(
    v.string("Data phải là chuỗi JSON."),
    v.minLength(2, "Data không được để trống."),
  ),
  storeId: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(100, "Store ID không được vượt quá 100 ký tự."),
    ),
  ),
  active: v.optional(v.boolean("Active phải là boolean."), true),
});

export const updateAppMenuSchema = v.object({
  code: v.optional(
    v.pipe(
      v.string("Code phải là chuỗi ký tự."),
      v.minLength(2, "Code phải có ít nhất 2 ký tự."),
      v.maxLength(100, "Code không được vượt quá 100 ký tự."),
      v.regex(
        /^[A-Z0-9_-]+$/,
        "Code chỉ được chứa chữ hoa, số, dấu gạch dưới hoặc gạch ngang.",
      ),
    ),
  ),
  lang: v.optional(
    v.pipe(
      v.string(),
      v.minLength(2, "Lang phải có ít nhất 2 ký tự."),
      v.maxLength(10, "Lang không được vượt quá 10 ký tự."),
    ),
  ),
  name: v.optional(
    v.pipe(
      v.string(),
      v.minLength(2, "Name phải có ít nhất 2 ký tự."),
      v.maxLength(200, "Name không được vượt quá 200 ký tự."),
    ),
  ),
  data: v.optional(
    v.pipe(
      v.string(),
      v.minLength(2, "Data không được để trống."),
    ),
  ),
  storeId: v.optional(
    v.union([
      v.pipe(
        v.string(),
        v.maxLength(100, "Store ID không được vượt quá 100 ký tự."),
      ),
      v.null_(),
    ]),
  ),
  active: v.optional(v.boolean("Active phải là boolean.")),
});

export const createAppMenuTranslationSchema = v.object({
  lang: v.pipe(
    v.string("Lang phải là chuỗi ký tự."),
    v.minLength(2, "Lang phải có ít nhất 2 ký tự."),
    v.maxLength(10, "Lang không được vượt quá 10 ký tự."),
  ),
  name: v.pipe(
    v.string("Name phải là chuỗi ký tự."),
    v.minLength(2, "Name phải có ít nhất 2 ký tự."),
    v.maxLength(200, "Name không được vượt quá 200 ký tự."),
  ),
  data: v.pipe(
    v.string("Data phải là chuỗi JSON."),
    v.minLength(2, "Data không được để trống."),
  ),
});

// Type extraction
export type CreateAppMenuInput = v.InferOutput<typeof createAppMenuSchema>;
export type UpdateAppMenuInput = v.InferOutput<typeof updateAppMenuSchema>;
export type CreateAppMenuTranslationInput = v.InferOutput<
  typeof createAppMenuTranslationSchema
>;
