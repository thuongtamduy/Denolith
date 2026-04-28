import { jwt } from "@hono/jwt";
import { config } from "../../core/config.ts";

export const authMiddleware = jwt({
  secret: config.jwtSecret,
  alg: "HS256",
});
