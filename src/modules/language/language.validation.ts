import * as v from "valibot";

export const createLanguageSchema = v.object({
  code: v.pipe(
    v.string("Code phải là chuỗi ký tự."),
    v.minLength(2, "Code phải có ít nhất 2 ký tự."),
    v.maxLength(10, "Code không được vượt quá 10 ký tự."),
    v.regex(
      /^[a-z]+$/,
      "Code chỉ được chứa các chữ cái viết thường (ví dụ: vi, en, ja).",
    ),
  ),
  name: v.pipe(
    v.string("Name phải là chuỗi ký tự."),
    v.minLength(2, "Name phải có ít nhất 2 ký tự."),
    v.maxLength(100, "Name không được vượt quá 100 ký tự."),
  ),
  active: v.optional(v.boolean("Active phải là boolean."), true),
  isDefault: v.optional(v.boolean("IsDefault phải là boolean."), false),
});

export const updateLanguageSchema = v.object({
  name: v.optional(
    v.pipe(
      v.string("Name phải là chuỗi ký tự."),
      v.minLength(2, "Name phải có ít nhất 2 ký tự."),
      v.maxLength(100, "Name không được vượt quá 100 ký tự."),
    ),
  ),
  active: v.optional(v.boolean("Active phải là boolean.")),
  isDefault: v.optional(v.boolean("IsDefault phải là boolean.")),
});

export type CreateLanguageInput = v.InferOutput<typeof createLanguageSchema>;
export type UpdateLanguageInput = v.InferOutput<typeof updateLanguageSchema>;
