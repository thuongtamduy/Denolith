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

  await t.step("Hash length phải đúng chuẩn PBKDF2-SHA256 (64 hex chars)", async () => {
    const hash = await hashPassword("test");
    const [, hashPart] = hash.split(":");
    assertEquals(hashPart.length, 64); // SHA-256 = 256 bits = 64 hex chars
  });

  await t.step("Hai lần hash cùng password phải tạo hash KHÁC nhau (random salt)", async () => {
    const hash1 = await hashPassword("SamePassword");
    const hash2 = await hashPassword("SamePassword");
    assertNotEquals(hash1, hash2); // Salt ngẫu nhiên => hash khác nhau
  });

  await t.step("Hash bị tamper phải trả về false (Tamper Detection)", async () => {
    const hash = await hashPassword("original");
    const tampered = hash.slice(0, -1) + "X"; // Sửa 1 ký tự cuối
    assertEquals(await verifyPassword("original", tampered), false);
  });

  await t.step("Hash rỗng hoặc không có salt phải trả về false", async () => {
    assertEquals(await verifyPassword("anything", ""), false);
    assertEquals(await verifyPassword("anything", "nocolonhere"), false);
  });
});

Deno.test("Security: Validate UUID Middleware", async (t) => {
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  await t.step("UUID v4 hợp lệ phải pass", () => {
    const validUUIDs = [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
    ];
    for (const uuid of validUUIDs) {
      assertEquals(UUID_REGEX.test(uuid), true, `Should pass: ${uuid}`);
    }
  });

  await t.step("Giá trị không phải UUID phải bị reject", () => {
    const invalidValues = [
      "abc",
      "123",
      "not-a-uuid",
      "../../../etc/passwd",   // Path traversal attempt
      "' OR 1=1--",           // SQL Injection attempt
      "<script>alert(1)</script>", // XSS attempt
      "",
    ];
    for (const val of invalidValues) {
      assertEquals(UUID_REGEX.test(val), false, `Should reject: ${val}`);
    }
  });
});
