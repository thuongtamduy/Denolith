import * as v from "valibot";

const metadataSchema = v.object({
  social: v.optional(v.record(v.string(), v.string())),
  facilities: v.optional(v.array(v.string())),
});

const dayHoursSchema = v.object({
  open: v.string(),
  close: v.string(),
});

const workingHoursSchema = v.object({
  monday: v.optional(dayHoursSchema),
  tuesday: v.optional(dayHoursSchema),
  wednesday: v.optional(dayHoursSchema),
  thursday: v.optional(dayHoursSchema),
  friday: v.optional(dayHoursSchema),
  saturday: v.optional(dayHoursSchema),
  sunday: v.optional(dayHoursSchema),
});

export const createStoreSchema = v.object({
  code: v.pipe(v.string(), v.maxLength(50)),
  name: v.pipe(v.string(), v.minLength(1)),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  metadata: v.optional(metadataSchema),
  workingHours: v.optional(workingHoursSchema),
  status: v.optional(v.picklist(["active", "inactive", "pending"]), "pending"),
});

export const updateStoreSchema = v.partial(
  v.object({
    code: v.pipe(v.string(), v.maxLength(50)),
    name: v.pipe(v.string(), v.minLength(1)),
    latitude: v.number(),
    longitude: v.number(),
    metadata: metadataSchema,
    workingHours: workingHoursSchema,
    status: v.picklist(["active", "inactive", "pending"]),
  }),
);

export type CreateStoreInput = v.InferOutput<typeof createStoreSchema>;
export type UpdateStoreInput = v.InferOutput<typeof updateStoreSchema>;
