import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { hashPassword, verifyPassword } from "./hash.ts";

Deno.test("Security: Password Hashing", async (t) => {
  await t.step("Phải băm được mật khẩu và có chứa Salt", async () => {
    const raw = "Admin@123";
    const hashed = await hashPassword(raw);

    assertNotEquals(raw, hashed); // Không được lưu plain text
    assertEquals(hashed.includes(":"), true); // Định dạng của hàm băm là 'salt:hash'
  });

  await t.step("Xác thực đúng mật khẩu", async () => {
    const raw = "SuperSecret#2026";
    const hashed = await hashPassword(raw);

    const isValid = await verifyPassword(raw, hashed);
    assertEquals(isValid, true);
  });

  await t.step("Từ chối mật khẩu sai", async () => {
    const raw = "SuperSecret#2026";
    const hashed = await hashPassword(raw);

    const isValid = await verifyPassword("WrongPassword123", hashed);
    assertEquals(isValid, false);
  });
});
