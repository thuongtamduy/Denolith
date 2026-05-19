Deno.env.set("STORAGE_TYPE", "local");

import {
  assert,
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: media module",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);

    try {
      await ctx.cleanupUsers();

      const hashed = await ctx.hashPassword(ctx.password);

      await ctx.prisma.user.create({
        data: {
          username: `owner_${suffix}`,
          email: ctx.ownerEmail,
          password: hashed,
          roleCode: "owner",
          active: true,
        },
      });

      // Login to get token
      const loginOwner = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.ownerEmail, password: ctx.password }),
      });
      const ownerToken = String((await readJson(loginOwner)).data?.accessToken);

      // 1. Create Folder
      const createFolderRes = await ctx.app.request("/v1/media/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(ownerToken),
        },
        body: JSON.stringify({ name: "Test Folder" }),
      });
      assertEquals(createFolderRes.status, 201);
      const folderData = await readJson(createFolderRes);
      const folderId = String(
        (folderData.data as Record<string, unknown>)?.id,
      );
      assert(
        folderId && folderId !== "undefined",
        "folderId should be returned",
      );

      // 2. Upload File
      const formData = new FormData();
      // Fake image blob so it bypasses sharp gracefully (sharp will catch err)
      const blob = new Blob(["fake image content"], { type: "image/jpeg" });
      formData.append("file", blob, "test-image.jpg");

      const uploadRes = await ctx.app.request(
        `/v1/media/upload?folderId=${folderId}&altText=TestImg&storage_type=local`,
        {
          method: "POST",
          headers: {
            ...bearer(ownerToken),
          },
          // deno-lint-ignore no-explicit-any
          body: formData as any,
        },
      );
      assertEquals(uploadRes.status, 201);
      const uploadData = await readJson(uploadRes);
      const fileId = String(
        (uploadData.data as Record<string, unknown>)?.id,
      );
      assert(fileId && fileId !== "undefined", "fileId should be returned");
      assertEquals(
        (uploadData.data as Record<string, unknown>)?.storageType,
        "local",
      );
      assertEquals(
        (uploadData.data as Record<string, unknown>)?.altText,
        "TestImg",
      );

      // 3. Get Media List
      const listRes = await ctx.app.request(
        `/v1/media?parentId=${folderId}`,
        {
          method: "GET",
          headers: {
            ...bearer(ownerToken),
          },
        },
      );
      assertEquals(listRes.status, 200);
      // deno-lint-ignore no-explicit-any
      const listBody = (await readJson(listRes)) as any;
      const files = (listBody.data as Record<string, unknown>)
        ?.files as Array<Record<string, unknown>>;
      assert(
        Array.isArray(listBody.data?.files),
        "files should be an array",
      );
      assertEquals(listBody.data?.files.length, 1);
      assertEquals(listBody.data?.meta?.total, 1);
      assertEquals(listBody.data?.meta?.page, 1);
      assertEquals(listBody.data?.meta?.limit, 50);
      assertEquals(files[0].id, fileId);

      // 4. View File (Original)
      const viewRes = await ctx.app.request(`/v1/media/${fileId}/view`, {
        method: "GET",
      });
      // Should redirect
      assertEquals(viewRes.status, 302);
      const redirectUrl = viewRes.headers.get("location");
      assert(redirectUrl, "Should return a redirect location");

      // Verify that the redirected URL actually serves the file successfully (200 OK)
      const staticRes = await ctx.app.request(redirectUrl);
      assertEquals(staticRes.status, 200);
      const fileContent = await staticRes.text();
      assertEquals(fileContent, "fake image content");

      // 5. View Scaled File (triggers sharp scale which might fallback to original on fail)
      const viewScaledRes = await ctx.app.request(
        `/v1/media/${fileId}/view?w=100&h=100`,
        {
          method: "GET",
        },
      );
      assertEquals(viewScaledRes.status, 302);

      // 6. Test Delete File
      const deleteFileRes = await ctx.app.request(`/v1/media/files/${fileId}`, {
        method: "DELETE",
        headers: {
          ...bearer(ownerToken),
        },
      });
      assertEquals(deleteFileRes.status, 200);

      // Verify file is soft-deleted in DB
      const dbFile = await ctx.prisma.mediaFile.findUnique({
        where: { id: fileId },
      });
      assert(dbFile?.deleted, "File should be marked as deleted in DB");

      // 7. Test Delete Folder
      const deleteFolderRes = await ctx.app.request(
        `/v1/media/folders/${folderId}`,
        {
          method: "DELETE",
          headers: {
            ...bearer(ownerToken),
          },
        },
      );
      assertEquals(deleteFolderRes.status, 200);

      // Verify folder is soft-deleted in DB
      const dbFolder = await ctx.prisma.mediaFolder.findUnique({
        where: { id: folderId },
      });
      assert(dbFolder?.deleted, "Folder should be marked as deleted in DB");
    } finally {
      // Cleanup DB
      await ctx.prisma.mediaFile.deleteMany({});
      await ctx.prisma.mediaFolder.deleteMany({});
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
