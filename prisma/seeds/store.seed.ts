import type { PrismaClient } from "@db";

export async function seedStores(prisma: PrismaClient) {
  console.log("Seeding Stores...");

  const storesData = [
    {
      code: "STORE_HCM_001",
      name: "Cửa hàng Quận 1",
      latitude: 10.7769,
      longitude: 106.7009,
      status: "active",
      metadata: {
        social: { facebook: "https://facebook.com/store-hcm-001" },
        facilities: ["wifi", "parking", "air_conditioning"],
      },
      workingHours: {
        monday: { open: "08:00", close: "22:00" },
        tuesday: { open: "08:00", close: "22:00" },
        wednesday: { open: "08:00", close: "22:00" },
        thursday: { open: "08:00", close: "22:00" },
        friday: { open: "08:00", close: "22:00" },
        saturday: { open: "09:00", close: "23:00" },
        sunday: { open: "09:00", close: "23:00" },
      },
    },
    {
      code: "STORE_HN_001",
      name: "Cửa hàng Hoàn Kiếm",
      latitude: 21.0285,
      longitude: 105.8542,
      status: "active",
      metadata: {
        social: { facebook: "https://facebook.com/store-hn-001" },
        facilities: ["wifi", "air_conditioning"],
      },
      workingHours: {
        monday: { open: "08:00", close: "22:00" },
        tuesday: { open: "08:00", close: "22:00" },
        wednesday: { open: "08:00", close: "22:00" },
        thursday: { open: "08:00", close: "22:00" },
        friday: { open: "08:00", close: "22:00" },
        saturday: { open: "09:00", close: "23:00" },
        sunday: { open: "09:00", close: "23:00" },
      },
    },
    {
      code: "STORE_DN_001",
      name: "Cửa hàng Hải Châu",
      latitude: 16.0544,
      longitude: 108.2022,
      status: "pending",
      metadata: {
        facilities: ["parking"],
      },
      workingHours: {
        monday: { open: "08:00", close: "20:00" },
        tuesday: { open: "08:00", close: "20:00" },
        wednesday: { open: "08:00", close: "20:00" },
        thursday: { open: "08:00", close: "20:00" },
        friday: { open: "08:00", close: "20:00" },
        saturday: { open: "08:00", close: "20:00" },
        sunday: { open: "closed" },
      },
    },
  ];

  for (const storeData of storesData) {
    const existing = await prisma.store.findUnique({
      where: { code: storeData.code },
    });

    if (!existing) {
      await prisma.store.create({
        data: {
          code: storeData.code,
          name: storeData.name,
          latitude: storeData.latitude,
          longitude: storeData.longitude,
          status: storeData.status,
          metadata: storeData.metadata,
          workingHours: storeData.workingHours,
        },
      });
    }
  }

  console.log("✅ Stores seeded");
}
