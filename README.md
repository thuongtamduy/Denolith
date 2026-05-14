# 🏛️ Denolith

**Denolith** (**Deno** + **Monolith**) is a high-performance, type-safe monolithic backend framework built on Deno 2.x, Hono, and Prisma 7.

---

## ✨ Features

- 🚀 **Ultra-Fast**: Powered by Hono & Deno 2.x.
- 🛡️ **100% Type-Safe**: From Database (Prisma) to API (Valibot).
- 🏰 **Modular Architecture**: Domain-driven structure with a Lazy DI Container.
- 🔐 **Advanced RBAC**: 3-tier Role System (`owner > admin > user`) + Permission Profiles.
- ☁️ **Background Workers**: Redis-backed async queues and cronjobs.
- ⚡ **Caching & Rate Limiting**: Atomic Lua-script rate limiting & response caching.
- 📦 **Multi-Storage**: Supports `local`, `supabase`, and `s3`/MinIO.
- 📖 **OpenAPI**: Auto-generated Swagger UI integration.

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

👉 **API Docs:** `http://localhost:9999/api/swagger`

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
- `deno task seed` - Seed database.
- `deno task format` - Format and lint code.
- `deno task compile` - Compile application to standalone binary.

---

## 🗄️ Database & Prisma Workflow

A quick guide on how to manage database changes efficiently.

### `migrate:dev` vs `migrate`

| Feature | `migrate:dev` | `migrate` |
| --- | --- | --- |
| **Use case** | Local development | Production deployment |
| **Creates migration files?** | ✅ Yes | ❌ No |
| **Generates Prisma Client?** | ✅ Yes | ❌ No |
| **Can drop/reset data?** | ⚠️ Yes (if schema drift) | ❌ Never |
| **Safe for Production?** | ❌ No | ✅ Yes |

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

## ⚙️ Core Structure

- `prisma/` - Database schema, migrations, and seed scripts.
- `src/core/` - Core infrastructure (Database, Redis, Queue, Cron, Mail, Storage, DI).
- `src/modules/` - Domain logic and endpoints (Auth, User, Role, Permission).
- `src/shared/` - Middlewares, Utils, and Error handlers.
- `main.ts` - Application entrypoint.

---

## 🛡️ License
Proprietary / Closed Source.
