import { closeDb, connectDb } from "../src/core/database.ts";
import { logger } from "../src/core/logger.ts";
import { hashPassword } from "../src/shared/utils/hash.ts";

try {
  const db = await connectDb();
  logger.info("Seeding database...");

  const sql = `
    INSERT INTO users (username, email, password, active) 
    VALUES ($1, $2, $3, true) 
    ON CONFLICT (email) DO NOTHING
  `;

  const users = [
    { username: "admin", email: "admin@denolith.dev", password: "[PASSWORD]" },
    { username: "hulk", email: "hulk@denolith.dev", password: "[PASSWORD]" },
    { username: "thor", email: "thor@denolith.dev", password: "[PASSWORD]" },
    { username: "xmen", email: "xmen@denolith.dev", password: "[PASSWORD]" },
    { username: "xmen", email: "xmen@denolith.dev", password: "[PASSWORD]" },
  ];

  for (const user of users) {
    const hashedPw = await hashPassword(user.password);
    await db.queryObject(sql, [user.username, user.email, hashedPw]);
  }

  logger.info(`✅ Seeded users.`);
} catch (error) {
  logger.error(`Seeding failed: ${(error as Error).message}`);
} finally {
  await closeDb();
}
