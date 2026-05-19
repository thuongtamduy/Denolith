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
    {
      code: "ko",
      name: "한국어",
      isDefault: false,
      active: true,
    },
    {
      code: "ja",
      name: "日本語",
      isDefault: false,
      active: true,
    },
    {
      code: "zh",
      name: "中文",
      isDefault: false,
      active: true,
    },
    {
      code: "fr",
      name: "Français",
      isDefault: false,
      active: true,
    },
    {
      code: "ru",
      name: "Русский",
      isDefault: false,
      active: false, // Inactive language to test filtering
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
