# 🏗️ Denolith — Requirements & Architecture Guide

> **Version:** 5.0 · **Last Updated:** 2026-04-28 **Mục đích:** File này là "bản
> hiến pháp" cho dự án Denolith. Mọi AI assistant và developer **PHẢI** tuân thủ
> 100% các quy tắc bên dưới.

---

## 🎯 Tầm Nhìn Dự Án

**Denolith** là một backend framework được xây dựng hoàn toàn trên nền tảng Deno
2.x, hướng tới:

- **Zero Node.js dependency** — Không có `npm:`, không có `node_modules`
- **Single binary deployment** — Compile thành 1 file binary duy nhất
- **Production-grade** — Clean Architecture, type-safe, auto-migration-ready
- **JSR-native** — Tận dụng 100% JavaScript Registry

---

## 🏛️ 4 Trụ Cột Công Nghệ

| Trụ Cột             | Công Nghệ                 | JSR Specifier      |
| ------------------- | ------------------------- | ------------------ |
| **1. 100% JSR**     | Mọi dependency qua `jsr:` | —                  |
| **2. Deno Compile** | Single binary deployment  | Built-in           |
| **3. Hono**         | Web framework             | `jsr:@hono/hono`   |
| **4. PostgreSQL**   | Database Driver           | `jsr:@db/postgres` |

---

## 📦 Import Map Chuẩn (deno.json)

```json
{
  "name": "denolith",
  "version": "3.0.0",
  "exports": "./main.ts",
  "tasks": {
    "dev": "deno run -A --env --watch main.ts",
    "start": "deno run -A --env main.ts",
    "migrate": "deno run -A --env scripts/migrate.ts up",
    "migrate:down": "deno run -A --env scripts/migrate.ts down",
    "migrate:status": "deno run -A --env scripts/migrate.ts status",
    "migrate:reset": "deno run -A --env scripts/migrate.ts reset",
    "migrate:generate": "deno run -A --env scripts/generate-migration.ts",
    "seed": "deno run -A --env scripts/seed.ts",
    "compile": "deno compile -A --env --output ./dist/denolith main.ts",
    "compile:linux": "deno compile -A --env --target x86_64-unknown-linux-gnu --output ./dist/denolith-linux main.ts"
  },
  "imports": {
    "@hono/core": "jsr:@hono/hono",
    "@hono/jwt": "jsr:@hono/hono/jwt",
    "@hono/http-status": "jsr:@hono/hono/utils/http-status",
    "@hono/valibot-validator": "jsr:@hono/valibot-validator",
    "@hono/cors": "jsr:@hono/hono/cors",
    "@hono/secure-headers": "jsr:@hono/hono/secure-headers",
    "@hono/cookie": "jsr:@hono/hono/cookie",
    "@db/postgres": "jsr:@db/postgres",
    "@db/redis": "jsr:@db/redis",
    "valibot": "jsr:@valibot/valibot"
  }
}
```

### Quy Tắc Import

1. Source code chỉ import từ alias (`@hono/core`, `@db/postgres`, `valibot`)
2. KHÔNG viết `jsr:` trực tiếp trong source files
3. Thêm dependency mới → thêm vào `imports` trước, rồi mới import. Các package
   JSR không cần chỉ định version để tự động dùng bản mới nhất được lock trong
   `deno.lock`.

---

## 📁 Cấu Trúc Dự Án

```text
Denolith/
├── main.ts                          # Entry point
├── deno.json                        # Import map & tasks
├── .env / .env.example              # Environment variables
├── .gitignore
├── Denolith_Requirements.md
│
├── src/
│   ├── core/
│   │   ├── database.ts              # Postgres Client Singleton
│   │   ├── migrator.ts              # Migration engine
│   │   ├── schema.ts                # Types for Schema definition
│   │   ├── schema-diff.ts           # Postgres Schema diffing engine
│   │   └── logger.ts                # Logging utility
│   │
│   ├── shared/
│   │   ├── errors/
│   │   │   ├── AppError.ts          # Custom error class
│   │   │   └── error.handler.ts     # Global Hono error handler
│   │   └── schemas/                 # Valibot validation schemas
│   │
│   └── modules/
│       └── user/
│           ├── user.entity.ts       # Interface (pure TS, UUIDs)
│           ├── user.schema.ts       # Declarative PG table schema
│           ├── user.repository.ts   # PG async queries ($1, $2)
│           ├── user.service.ts      # Business logic
│           └── user.routes.ts       # Hono controllers
│
├── scripts/
│   ├── migrate.ts                   # Run migrations
│   ├── generate-migration.ts        # Auto-generate migrations
│   └── seed.ts                      # Seed data
│
└── dist/                            # Compiled binaries (gitignored)
```

### Luồng Dependency (một chiều)

```text
Routes → Service → Repository → Database
                        ↓
                    Entity (interface)
```

---

## ✍️ Quy Tắc Viết Code

### Entity — Pure TypeScript Interface (UUID)

```typescript
export interface User {
  id: string; // UUID
  username: string;
  email: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### Repository — Async PostgreSQL Queries

```typescript
import type { Client } from "@db/postgres";
import type { User } from "./user.entity.ts";

export class UserRepository {
  constructor(private db: Client) {}

  async findAll(): Promise<User[]> {
    const res = await this.db.queryObject<User>("SELECT * FROM users");
    return res.rows;
  }

  async findById(id: string): Promise<User | undefined> {
    const res = await this.db.queryObject<User>(
      "SELECT * FROM users WHERE id = $1",
      [id],
    );
    return res.rows[0];
  }

  async create(data: { username: string; email: string }): Promise<User> {
    const res = await this.db.queryObject<User>(
      "INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *",
      [data.username, data.email],
    );
    return res.rows[0];
  }
}
```

### Service — Business Logic Only

```typescript
import type { UserRepository } from "./user.repository.ts";
import { AppError } from "../../shared/errors/AppError.ts";

export class UserService {
  constructor(private repo: UserRepository) {}

  async create(data: { username: string; email: string }) {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) throw AppError.conflict("Email already exists");
    return this.repo.create(data);
  }
}
```

### Routes — Thin Async Hono Controllers

```typescript
import { Hono } from "@hono/core";
import { vValidator } from "@hono/valibot-validator";
import type { UserService } from "./user.service.ts";

export const createUserRoutes = (service: UserService) => {
  const router = new Hono();
  router.get(
    "/",
    async (c) => c.json({ success: true, data: await service.findAll() }),
  );
  return router;
};
```

### File Extension — Luôn có `.ts`

```typescript
// ✅ ĐÚNG
import { User } from "./user.entity.ts";

// ❌ SAI
import { User } from "./user.entity";
```

---

## 🚫 Danh Sách Cấm

| ❌ CẤM                    | ✅ THAY THẾ BẰNG                    |
| ------------------------- | ----------------------------------- |
| `npm:` specifier          | `jsr:` specifier                    |
| `node_modules/`           | Deno global cache                   |
| `package.json`            | `deno.json`                         |
| ORM decorators            | Schema declarations in `.schema.ts` |
| DB calls đồng bộ          | `async/await` với `@db/postgres`    |
| Route gọi DB trực tiếp    | Route → Service → Repository        |
| Service import Hono types | Service phải framework-agnostic     |

---

## ✅ Checklist Trước Khi Commit

- [ ] `deno check main.ts scripts/migrate.ts scripts/seed.ts` — 0 errors
- [ ] Zero `npm:` specifiers trong codebase
- [ ] Zero `node_modules/`
- [ ] Mọi import qua alias trong `deno.json`
- [ ] Mọi local import có đuôi `.ts`
- [ ] Architecture: Routes → Service → Repository → Entity (1 chiều)
- [ ] Các tác vụ DB phải có `await`
- [ ] `.env` trong `.gitignore`

---

## 📚 JSR Packages Reference

| Package                            | Alias                     | Mục Đích            |
| ---------------------------------- | ------------------------- | ------------------- |
| `jsr:@hono/hono`                   | `@hono/core`              | Web framework       |
| `jsr:@hono/hono/utils/http-status` | `@hono/http-status`       | HTTP status types   |
| `jsr:@hono/valibot-validator`      | `@hono/valibot-validator` | Request validation  |
| `jsr:@db/postgres`                 | `@db/postgres`            | PostgreSQL database |
| `jsr:@db/redis`                    | `@db/redis`               | Redis cache/queue   |
| `jsr:@valibot/valibot`             | `valibot`                 | Schema validation   |

---

## 🌟 Enterprise Upgrades (Thành tựu đã đạt được)

Dự án đã trải qua 9 Phase nâng cấp toàn diện để đạt chuẩn Production-Ready:

1. **Clean Architecture & Container DI:** Phân tách hoàn toàn các logic, sử dụng Dependency Injection (`AppContainer`).
2. **Hệ Thống Migration Tự Động:** Quản lý cấu trúc Database bằng các file script độc lập (`001_users`, `002_refresh_tokens`).
3. **Web Crypto Security:** Băm mật khẩu bằng module Native PBKDF2 của Deno.
4. **Multi-layer Rate Limiting:** Chống Spam/DDoS bằng Redis, tự động Graceful Fallback về Memory Cache khi mất mạng.
5. **Advanced Authentication:** Triển khai Refresh Token Rotation, bảo mật tối đa bằng `HttpOnly` & `Secure` Cookie (chống XSS).
6. **Role-Based Access Control (RBAC):** Middleware phân quyền mạnh mẽ (`requireRole('ADMIN')`).
7. **API Caching:** Tối ưu hiệu năng lên gấp 10 lần nhờ Middleware Caching API bằng Redis.
8. **Background Job Queue:** Đưa các tác vụ nặng (VD: gửi Email) vào hàng đợi Redis List và dùng Worker xử lý ngầm.
9. **CI/CD & Dockerization:** Tích hợp `docker-compose.yml`, Unit Testing (`deno test`), và Github Actions Pipeline tự động kiểm duyệt code.

---

> **🔒 File này là Single Source of Truth cho dự án Denolith.**
