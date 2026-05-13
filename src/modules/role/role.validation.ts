import * as v from "valibot";
import type { CreateRoleData, UpdateRoleData } from "./role.entity.ts";
import { keysToSnakeCase } from "../../shared/utils/case.ts";

export const createRoleSchema = v.pipe(
  v.object({
    code: v.pipe(
      v.string(),
      v.minLength(3, "Role code must be at least 3 characters long."),
      v.maxLength(50, "Role code must not exceed 50 characters."),
      v.regex(
        /^[a-z0-9_]+$/,
        "Role code can only contain lowercase letters, numbers, and underscores.",
      ),
    ),
    tier: v.union(
      [v.literal("admin"), v.literal("user")],
      "Tier must be 'admin' or 'user'.",
    ),
    name: v.pipe(
      v.string(),
      v.minLength(3, "Name must be at least 3 characters long."),
      v.maxLength(100, "Name must not exceed 100 characters."),
    ),
    description: v.optional(
      v.pipe(
        v.string(),
        v.maxLength(255, "Description must not exceed 255 characters."),
      ),
    ),
    color: v.optional(
      v.pipe(
        v.string(),
        v.regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex code."),
      ),
    ),
    icon: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  }),
  v.transform((val) => keysToSnakeCase(val)),
);

export const updateRoleSchema = v.pipe(
  v.object({
    name: v.optional(
      v.pipe(
        v.string(),
        v.minLength(3, "Name must be at least 3 characters long."),
        v.maxLength(100, "Name must not exceed 100 characters."),
      ),
    ),
    description: v.optional(
      v.union([
        v.pipe(
          v.string(),
          v.maxLength(255, "Description must not exceed 255 characters."),
        ),
        v.null_(),
      ]),
    ),
    active: v.optional(v.boolean("Active status must be a boolean.")),
    color: v.optional(
      v.union([
        v.pipe(
          v.string(),
          v.regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex code."),
        ),
        v.null_(),
      ]),
    ),
    icon: v.optional(v.union([v.string(), v.null_()])),
    sortOrder: v.optional(v.number()),
  }),
  v.transform((val) => keysToSnakeCase(val)),
);

// Type extraction (optional but good for type safety checks)
export type CreateRoleInput = CreateRoleData;
export type UpdateRoleInput = UpdateRoleData;
