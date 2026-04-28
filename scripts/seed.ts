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
    {
      username: "john_doe",
      email: "john@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "jane_doe",
      email: "jane@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "superman",
      email: "superman@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "batman",
      email: "batman@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "spiderman",
      email: "spiderman@denolith.dev",
      password: "[PASSWORD]",
    },
    { username: "hulk", email: "hulk@denolith.dev", password: "[PASSWORD]" },
    {
      username: "ironman",
      email: "ironman@denolith.dev",
      password: "[PASSWORD]",
    },
    { username: "thor", email: "thor@denolith.dev", password: "[PASSWORD]" },
    {
      username: "blackwidow",
      email: "blackwidow@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "captainamerica",
      email: "captainamerica@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "blackpanther",
      email: "blackpanther@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "doctorstrange",
      email: "doctorstrange@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "deadpool",
      email: "deadpool@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "wolverine",
      email: "wolverine@denolith.dev",
      password: "[PASSWORD]",
    },
    { username: "xmen", email: "xmen@denolith.dev", password: "[PASSWORD]" },
    {
      username: "avengers",
      email: "avengers@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "guardiansofthegalaxy",
      email: "guardiansofthegalaxy@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "fantasticfour",
      email: "fantasticfour@denolith.dev",
      password: "[PASSWORD]",
    },
    {
      username: "xforce",
      email: "xforce@denolith.dev",
      password: "[PASSWORD]",
    },
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
