import type { PrismaClient } from "@db";

export async function seedLanguages(prisma: PrismaClient) {
  console.log("Seeding system languages...");
  const languages = [
    {
      code: "vi",
      name: "Tiếng Việt",
      isDefault: true,
      active: true,
    },
    {
      code: "en",
      name: "English",
      isDefault: false,
      active: true,
    },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: {
        name: lang.name,
        isDefault: lang.isDefault,
        active: lang.active,
      },
      create: lang,
    });
  }
  console.log(`✅ Seeded ${languages.length} system languages.`);
}
