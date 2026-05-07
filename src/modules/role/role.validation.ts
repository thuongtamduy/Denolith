import * as v from "valibot";
import type { CreateRoleData, UpdateRoleData } from "./role.entity.ts";

export const createRoleSchema = v.object({
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
});

export const updateRoleSchema = v.object({
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
});

// Type extraction (optional but good for type safety checks)
export type CreateRoleInput = CreateRoleData;
export type UpdateRoleInput = UpdateRoleData;
