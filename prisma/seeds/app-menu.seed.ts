import type { PrismaClient } from "@db";

// Permissions cho module App Menu
const APP_MENU_PERMISSIONS = [
  ["app_menu.read", "app_menu", "View app menu list and details"],
  ["app_menu.create", "app_menu", "Create a new app menu"],
  ["app_menu.update", "app_menu", "Update an existing app menu"],
  ["app_menu.delete", "app_menu", "Delete an app menu"],
] as const;

// Menu mẫu cho Admin
const SAMPLE_MENU_DATA = JSON.stringify([
  {
    item: {
      title: "Trang chủ",
      type: "LINK-CUSTOM",
      router: "/dashboard",
      description: "",
      permission: "",
      search: "",
      banner: [{ file: "", type: "IMAGE" }],
      banner_mobile: [{ file: "", type: "IMAGE" }],
      icon: [{ file: "", type: "IMAGE" }],
      icon_mobile: [{ file: "", type: "IMAGE" }],
      icon_class_box: "home",
      is_img: 0,
      is_status: 1,
      is_title: 0,
      user_group: [],
      type_display: "",
    },
    key: "0",
    children: [],
  },
  {
    item: {
      title: "Người dùng & phân quyền",
      type: "ADMIN-ROUTE",
      router: "/auth/user/groups",
      description: "",
      permission: "MENU-USER-PERMISSION",
      search: "",
      banner: [{ file: "", type: "IMAGE" }],
      banner_mobile: [{ file: "", type: "IMAGE" }],
      icon: [{ file: "", type: "IMAGE" }],
      icon_mobile: [{ file: "", type: "IMAGE" }],
      icon_class_box: "id-card",
      is_img: 0,
      is_status: 1,
      is_title: 0,
      user_group: [],
      type_display: "",
    },
    key: "1",
    children: [
      {
        item: {
          title: "Nhóm khách hàng",
          type: "ADMIN-ROUTE",
          router: "/auth/user/groups",
          description: "",
          permission: "MENU-USER-GROUP",
          search: "",
          banner: [{ file: "", type: "IMAGE" }],
          banner_mobile: [{ file: "", type: "IMAGE" }],
          icon: [{ file: "", type: "IMAGE" }],
          icon_mobile: [{ file: "", type: "IMAGE" }],
          icon_class_box: "",
          is_img: 0,
          is_status: 1,
          is_title: 0,
          user_group: [],
          type_display: "",
        },
        key: "1-0",
        children: [],
      },
      {
        item: {
          title: "Phân quyền",
          type: "ADMIN-ROUTE",
          router: "/auth/permission",
          description: "",
          permission: "MENU-PERMISSION",
          search: "",
          banner: [{ file: "", type: "IMAGE" }],
          banner_mobile: [{ file: "", type: "IMAGE" }],
          icon: [{ file: "", type: "IMAGE" }],
          icon_mobile: [{ file: "", type: "IMAGE" }],
          icon_class_box: "",
          is_img: 0,
          is_status: 1,
          is_title: 0,
          user_group: [],
          type_display: "",
        },
        key: "1-1",
        children: [],
      },
    ],
  },
]);

export async function seedAppMenus(prisma: PrismaClient) {
  console.log("Seeding app menu permissions...");

  // 1. Upsert permissions
  for (const [code, module, description] of APP_MENU_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, module, description },
    });
  }
  console.log(`✅ Seeded ${APP_MENU_PERMISSIONS.length} app_menu permissions.`);

  // 2. Upsert menu mẫu
  console.log("Seeding sample app menus...");

  const viLang = await prisma.language.findUnique({ where: { code: "vi" } });
  if (!viLang) {
    throw new Error(
      "Default language 'vi' not found. Please run seedLanguages first.",
    );
  }

  // Find or create the AppMenu (Master)
  let menu = await prisma.appMenu.findFirst({
    where: { code: "MENU-ADMIN", storeId: null },
  });

  if (!menu) {
    menu = await prisma.appMenu.create({
      data: {
        code: "MENU-ADMIN",
        active: true,
      },
    });
  }

  // Create or update the translation for 'vi'
  await prisma.appMenuTranslation.upsert({
    where: {
      menuId_lang: {
        menuId: menu.id,
        lang: "vi",
      },
    },
    update: {
      name: "Menu Admin",
      data: SAMPLE_MENU_DATA,
      isLangRef: false,
    },
    create: {
      menuId: menu.id,
      langId: viLang.id,
      lang: "vi",
      name: "Menu Admin",
      data: SAMPLE_MENU_DATA,
      isLangRef: false,
    },
  });

  // Create or update translation for 'en'
  const enLang = await prisma.language.findUnique({ where: { code: "en" } });
  if (enLang) {
    // English menu data (we translate key words for testing)
    const englishMenuData = SAMPLE_MENU_DATA
      .replace("Trang chủ", "Home")
      .replace("Người dùng & phân quyền", "Users & Permissions")
      .replace("Nhóm khách hàng", "Customer Groups")
      .replace("Phân quyền", "Permissions");

    await prisma.appMenuTranslation.upsert({
      where: {
        menuId_lang: {
          menuId: menu.id,
          lang: "en",
        },
      },
      update: {
        name: "Admin Menu",
        data: englishMenuData,
        isLangRef: true,
      },
      create: {
        menuId: menu.id,
        langId: enLang.id,
        lang: "en",
        name: "Admin Menu",
        data: englishMenuData,
        isLangRef: true,
      },
    });
  }

  console.log(
    `✅ Seeded sample app menus (Vietnamese and English translations).`,
  );
}
