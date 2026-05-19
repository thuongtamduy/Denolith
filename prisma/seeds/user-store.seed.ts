import type { PrismaClient } from "@db";

export async function seedUserStores(prisma: PrismaClient) {
  console.log("Seeding User Stores...");

  // 1. Lấy danh sách users KHÔNG phải owner
  const nonOwnerUsers = await prisma.user.findMany({
    where: {
      role: {
        tier: { not: "owner" },
      },
    },
  });

  if (nonOwnerUsers.length === 0) {
    console.log("⚠️ No non-owner users found to assign stores.");
    return;
  }

  // 2. Lấy danh sách stores có sẵn
  const stores = await prisma.store.findMany();

  if (stores.length === 0) {
    console.log("⚠️ No stores found to assign to users.");
    return;
  }

  // Lấy 2 cửa hàng đầu tiên (nếu có) để test
  const store1 = stores[0];
  const store2 = stores.length > 1 ? stores[1] : null;

  // 3. Tiến hành gán store cho user
  for (const user of nonOwnerUsers) {
    // Luôn gán vào store 1
    const existing1 = await prisma.userStore.findFirst({
      where: { userId: user.id, storeId: store1.id },
    });

    if (!existing1) {
      await prisma.userStore.create({
        data: {
          userId: user.id,
          storeId: store1.id,
        },
      });
    }

    // Nếu là admin, gán thêm store 2 (để test case 1 người dùng nhiều store)
    if (user.roleCode === "admin" && store2) {
      const existing2 = await prisma.userStore.findFirst({
        where: { userId: user.id, storeId: store2.id },
      });

      if (!existing2) {
        await prisma.userStore.create({
          data: {
            userId: user.id,
            storeId: store2.id,
          },
        });
      }
    }
  }

  console.log("✅ User Stores seeded");
}
