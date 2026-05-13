# 🏛️ Denolith

Backend monolithic production-ready trên **Deno 2.x** + **Hono** + **PostgreSQL
native** — không ORM, không `node_modules`.

---

## Tech Stack

- **Runtime**: Deno 2.x
- **Framework**: Hono 4.x (`jsr:@hono/hono`)
- **Database**: `@db/postgres` (raw SQL + custom Migrator)
- **Cache/Queue**: `@db/redis` (memory fallback)
- **Validation**: Valibot 1.x

---

## Quick Start

```bash
cp .env.example .env    # Cấu hình DATABASE_URL, JWT_SECRET, ...
deno task dev           # Migration tự động chạy khi startup
deno task seed          # Seed roles, users, permissions mẫu
```

**Default users sau seed:**

| Email                | Password       | Role    |
| -------------------- | -------------- | ------- |
| `owner@denolith.dev` | `Owner@123456` | `owner` |
| `admin@denolith.dev` | `Admin@123456` | `admin` |
| `user1@denolith.dev` | `User1@123456` | `user`  |

---

## Deno Tasks

| Command            | Mô tả                                       |
| ------------------ | ------------------------------------------- |
| `dev`              | Development mode (hot-reload, auto-migrate) |
| `start`            | Production mode                             |
| `seed`             | Seed dữ liệu mẫu                            |
| `migrate`          | Apply pending migrations                    |
| `migrate:down`     | Rollback 1 migration                        |
| `migrate:reset`    | Rollback toàn bộ                            |
| `migrate:status`   | Xem trạng thái migrations                   |
| `migrate:generate` | Tạo file migration mới                      |
| `test`             | Chạy test suite                             |
| `format`           | fmt + lint                                  |
| `compile`          | Build binary (macOS)                        |
| `compile:linux`    | Build binary (Linux x86_64)                 |

---

## API

| Prefix                               | Guard                | Mô tả                                |
| ------------------------------------ | -------------------- | ------------------------------------ |
| `POST /api/auth/*`                   | Rate limit           | register, login, refresh, logout     |
| `GET/POST/PATCH/DELETE /api/users/*` | admin tier           | User CRUD, soft/hard delete, restore |
| `/api/permissions/*`                 | `permissions.manage` | Profiles, codes, user overrides      |
| `/api/roles/*`                       | `permissions.manage` | Role CRUD                            |
| `GET /health`                        | —                    | Ping DB + Redis                      |

---

## Architecture

```
AppContainer.init()
  → connectRedis → connectDB
  → Repositories (raw SQL, extends BaseRepository)
  → Services (inject Repositories)

main.ts
  → container.init()
  → migrator.migrate(allMigrations)   ← auto on startup
  → initWorkers() + Queue.startWorkerLoop()
  → initCrons()
  → Hono app + routes
  → Deno.serve()
```

**Phân quyền 3-tier:**

- `owner` → bypass tất cả
- `admin` / `user` → Permission Profiles + Individual Overrides

**Migration**: versioned SQL (`src/migrations/`), transaction-safe, auto-apply
khi startup.

---

## Env Variables

| Biến           | Bắt buộc       | Mặc định                               |
| -------------- | -------------- | -------------------------------------- |
| `DATABASE_URL` | ✅             | —                                      |
| `JWT_SECRET`   | ✅ (≥32 ký tự) | —                                      |
| `PORT`         | ❌             | `3000`                                 |
| `DENO_ENV`     | ❌             | `development`                          |
| `REDIS_URL`    | ❌             | memory fallback                        |
| `FRONTEND_URL` | ❌             | `http://localhost:5173`                |
| `TRUST_PROXY`  | ❌             | `false`                                |
| `SMTP_HOST`    | ❌             | — (email bị skip)                      |
| `STORAGE_TYPE` | ❌             | `supabase` (`local`\|`supabase`\|`s3`) |

---

## License

Proprietary / Closed Source.
