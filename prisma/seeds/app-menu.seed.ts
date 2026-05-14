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
  const menus = [
    {
      code: "MENU-ADMIN",
      lang: "vi",
      name: "Menu Admin",
      data: SAMPLE_MENU_DATA,
    },
  ];

  for (const menu of menus) {
    await prisma.appMenu.upsert({
      where: { code: menu.code },
      update: { name: menu.name, data: menu.data },
      create: menu,
    });
  }
  console.log(`✅ Seeded ${menus.length} app menus.`);
}
