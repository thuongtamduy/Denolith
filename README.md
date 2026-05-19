# 🏛️ Denolith

**Denolith** (**Deno** + **Monolith**) is a high-performance, type-safe
monolithic backend framework built on Deno 2.x, Hono, and Prisma 7.

---

## ✨ Features

- 🚀 **Fast Runtime**: Powered by Hono + Deno 2.x.
- 🛡️ **Type-Safe API Layer**: Valibot validation + typed service architecture.
- 🏰 **Modular Architecture**: Domain modules with lazy DI container.
- 🔐 **RBAC + Permissions**: 3-tier roles (`owner > admin > user`) + permission
  profiles + user overrides.
- ☁️ **Background Workers**: Redis queue with memory fallback + cronjobs.
- ⚡ **Caching & Rate Limiting**: Redis-first, in-memory fallback.
- 📦 **Storage Integrations**: `local`, `supabase`, `s3`/MinIO configs
  available.
- 📖 **OpenAPI**: Swagger UI endpoint auto-generated from routes.

---

## 🚀 Quick Start (Local Dev)

Requires: [Deno 2.x](https://deno.com/) & Docker Desktop (or Colima).

Run the automated setup script:

```bash
./start.local.sh
```

**This script automatically:**

1. Generates `.env` and `JWT_SECRET`.
2. Cleans up stranded ports.
3. Starts PostgreSQL 18 & Redis via `compose.local.yml`.
4. Runs database migrations and seeds.
5. Starts the dev server at `http://localhost:9999`.

👉 **API Docs:** `http://localhost:9999/swagger`

👉 **Health Check:** `GET http://localhost:9999/`

---

## 🛠️ Deployment & Docker

### Docker Compose

- **Local Dev:** `docker-compose -f compose.local.yml up -d` (DB & Redis only)
- **Production:** `docker-compose up -d --build` (API, DB, Redis)

### Deno Tasks

- `deno task dev` - Start development server (hot-reload).
- `deno task start` - Start production server.
- `deno task prisma:generate` - Generate Prisma Client.
- `deno task migrate:dev` - Create and apply new database migrations.
- `deno task migrate` - Apply pending migrations (Production).
- `deno task migrate:status` - Show migration status.
- `deno task migrate:reset` - Reset database (dev use only).
- `deno task seed` - Seed database.
- `deno task test:integration` - Run integration test suite.
- `deno task check` - Type-check entrypoint.
- `deno task format` - Format, lint, and refresh Prisma artifacts.
- `deno task compile` - Compile application to standalone binary.

---

## 🗄️ Database & Prisma Workflow

A quick guide on how to manage database changes efficiently.

### `migrate:dev` vs `migrate`

| Feature                      | `migrate:dev`            | `migrate`             |
| ---------------------------- | ------------------------ | --------------------- |
| **Use case**                 | Local development        | Production deployment |
| **Creates migration files?** | ✅ Yes                   | ❌ No                 |
| **Generates Prisma Client?** | ✅ Yes                   | ❌ No                 |
| **Can drop/reset data?**     | ⚠️ Yes (if schema drift) | ❌ Never              |
| **Safe for Production?**     | ❌ No                    | ✅ Yes                |

### 🧑‍💻 Development Workflow

```bash
# 1. Modify your schema files in prisma/schema/
# 2. Format your schema
deno task format

# 3. Create and apply a new migration to your local DB
deno task migrate:dev

# 4. (Optional) Re-seed data if you reset the database
deno task seed
```

### 🚀 Production Deployment

```bash
# 1. Pull the latest code (which includes migration files from dev)
git pull

# 2. Generate Prisma Client
deno task prisma:generate

# 3. Apply pending migrations safely (no data loss)
deno task migrate

# 4. Start the server
deno task start
```

---

## 🌐 API Route Map

Current route mounting in code:

- Public routes:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /users`
  - `GET /users/:id`
- Protected routes under `/v1`:
  - `POST /v1/auth/refresh`
  - `POST /v1/auth/logout`
  - `GET /v1/users/me` + admin user management endpoints
  - `GET/POST/PATCH/DELETE /v1/permissions/*`
  - `GET/POST/PATCH/DELETE /v1/roles/*`
  - `GET/POST/PATCH/DELETE /v1/app-menus/*`
  - `GET/POST/PATCH/DELETE /v1/stores/*`
- Swagger:
  - `GET /swagger`
  - `GET /swagger/openapi.json`

## ⚙️ Core Structure

- `prisma/` - Database schema, migrations, and seed scripts.
- `src/core/` - Core infrastructure (Database, Redis, Queue, Cron, Mail,
  Storage, DI).
- `src/modules/` - Domain logic and endpoints (`auth`, `user`, `permission`,
  `role`, `app-menu`, `store`).
- `src/shared/` - Middlewares, Utils, and Error handlers.
- `main.ts` - Application entrypoint.

---

## 🛡️ License

Proprietary / Closed Source.
