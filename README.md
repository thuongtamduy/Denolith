# 🏛️ Denolith

Denolith (Deno + Monolith) is a modern, high-performance, and type-safe
monolithic backend framework designed for enterprise-grade scalability. It
leverages the raw speed of Deno, the flexibility of Hono, and the type-safety of
Prisma ORM to provide an unparalleled developer experience.

## ✨ Features

- **🚀 Ultra-Fast Routing**: Powered by `Hono`, achieving incredible performance
  on Deno.
- **🛡️ 100% Type-Safe**: End-to-end type safety from the Database (Prisma) to
  the API layer (Valibot).
- **🏰 Enterprise Architecture**: Modular structure (`src/modules`) with a
  Lightweight Lazy DI Container (`src/core/container.ts`).
- **🔐 Granular RBAC & Permissions**: Built-in Role-Based Access Control
  (`OWNER`, `ADMIN`, `USER`) and granular permission parsing.
- **☁️ Background Workers**: Dedicated queue system and cronjobs running
  parallel to the main HTTP cycle.
- **⚡ Built-in Caching & Rate Limiting**: Redis-powered response caching and
  global rate limiting.
- **🚦 API Versioning**: Clean namespace separation (`/api/v1` for protected
  APIs, `/api/v0` for public APIs).
- **🗃️ Soft Delete & Audit Logs**: Safely recover deleted records and track all
  user actions via `AuditService`.
- **🛑 Graceful Shutdown**: Flawless handling of OS signals to cleanly drain
  connections without hanging the event loop.

## 🛠️ Technology Stack

- **Runtime**: [Deno 2.x](https://deno.land/)
- **API Framework**: [Hono](https://hono.dev/)
- **ORM**: [Prisma 7.x](https://www.prisma.io/) (with `@prisma/adapter-pg`)
- **Database**: PostgreSQL (pg)
- **Cache & Queue**: Redis
- **Validation**: [Valibot](https://valibot.dev/)

## 📂 Architecture & Directory Structure

```text
Denolith/
├── prisma/               # Prisma Schema, Migrations, and Seeders
├── src/
│   ├── core/             # Core utilities (Config, Logger, Container, DB, Redis, Queue, Cron)
│   ├── modules/          # Domain-driven modules (Self-contained business logic)
│   │   ├── auth/         # Authentication (Register, Login, Tokens)
│   │   ├── user/         # User Management (CRUD, Soft Delete)
│   │   ├── role/         # Role Definitions
│   │   └── permission/   # Granular Permission Policies
│   ├── shared/           # Cross-module shared resources
│   │   ├── errors/       # Global AppError definitions
│   │   ├── middlewares/  # Auth, Cache, RBAC, Validate-UUID
│   │   └── utils/        # Hash, Pagination, Sanitize, Validation
│   ├── app.router.ts     # Central Router & Lazy DI Injection
│   └── workers/          # Background worker processors
├── main.ts               # Application Entrypoint (Bootstrap)
└── deno.json             # Deno configurations & Tasks
```

### Dependency Injection (Lazy Singleton Container)

Denolith implements a 10/10 Lightweight Lazy DI Container in
`src/core/container.ts`. Services are never instantiated until they are
explicitly requested, saving memory and eliminating circular dependency crashes.

## 🚀 Getting Started

### 1. Prerequisites

- [Deno 2.x](https://deno.com/)
- PostgreSQL Server
- Redis Server (Optional but recommended, will fallback to memory if not found)

### 2. Environment Setup

Clone the `.env.example` file and configure your credentials:

```bash
cp .env.example .env
```

### 3. Database Migration

Apply the Prisma schema to your PostgreSQL database:

```bash
deno task prisma:generate
deno task migrate:dev
```

### 4. Run the Server

For local development with hot-reload:

```bash
deno task dev
```

For production execution:

```bash
deno task start
```

## 📜 Available Scripts

Run any of the following tasks using `deno task <script>`:

### Application

| Command         | Description                                          |
| --------------- | ---------------------------------------------------- |
| `dev`           | Start the server in development mode with `--watch`. |
| `start`         | Start the server in production mode.                 |
| `format`        | Run formatter + linter + Prisma format.              |
| `compile`       | Compile into standalone macOS binary (`./dist/`).    |
| `compile:linux` | Cross-compile for Linux x86_64.                      |

### Prisma & Database

| Command           | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `prisma:generate` | Generate Prisma Client types. **Run after every schema change.**         |
| `prisma:format`   | Format all `.prisma` schema files.                                       |
| `prisma:push`     | Push schema directly to DB (no migration file). Dùng để prototype nhanh. |
| `migrate:dev`     | **[DEV]** Tạo migration mới + apply + auto generate client.              |
| `migrate`         | **[PROD]** Chỉ apply các migration đã có sẵn. Không tạo mới.             |
| `migrate:reset`   | ⚠️ **Xóa toàn bộ DB** + chạy lại tất cả migration từ đầu.                |
| `migrate:status`  | Kiểm tra migration nào đã/chưa apply.                                    |
| `seed`            | Seed database với dữ liệu mẫu (roles, users, permissions).               |

---

## 🗄️ Prisma & Database Guide

### Schema Structure

Prisma schema được chia thành nhiều file trong `prisma/schema/`:

```text
prisma/
├── schema/
│   ├── base.prisma          # Generator & Datasource config
│   ├── user.prisma          # Role, User, RefreshToken models
│   ├── permission.prisma    # Permission, Profile, UserPermission models
│   ├── audit.prisma         # AuditLog model
│   └── migrations/          # Migration history (auto-generated)
├── seeds/
│   ├── index.ts             # Seed entrypoint
│   ├── role.seed.ts         # System roles (owner, admin, user)
│   ├── user.seed.ts         # Default users
│   ├── permission.seed.ts   # Permission definitions
│   └── profile.seed.ts      # Permission profiles & assignments
└── prisma.config.ts         # Prisma config (env, adapter)
```

### Development Workflow

Quy trình chuẩn khi phát triển:

```bash
# 1. Sửa schema (.prisma files)
# 2. Format schema
deno task prisma:format

# 3. Tạo migration + apply vào DB + generate client
deno task migrate:dev
# → Prisma sẽ hỏi tên migration, tạo file SQL, và apply luôn

# 4. (Tùy chọn) Seed lại data nếu cần
deno task seed
```

### Production Deployment

```bash
# 1. Pull code mới (đã có sẵn migration files từ dev)
git pull

# 2. Generate Prisma Client
deno task prisma:generate

# 3. Apply pending migrations (KHÔNG tạo mới, KHÔNG hỏi gì)
deno task migrate

# 4. Start server
deno task start
```

### `migrate:dev` vs `migrate` — Khi nào dùng gì?

|                           | `migrate:dev`           | `migrate` (deploy)               |
| ------------------------- | ----------------------- | -------------------------------- |
| **Dùng khi**              | Đang phát triển (local) | Deploy lên server (prod/staging) |
| **Tạo file migration?**   | ✅ Có                   | ❌ Không                         |
| **Interactive?**          | ✅ Hỏi tên migration    | ❌ Chạy tự động                  |
| **Có thể reset data?**    | ⚠️ Có (nếu drift)       | ❌ Không bao giờ                 |
| **Auto generate client?** | ✅ Có                   | ❌ Không                         |
| **An toàn cho prod?**     | ❌ Không                | ✅ Rất an toàn                   |

### Common Scenarios

#### Thêm field mới vào model

```bash
# 1. Sửa file .prisma (vd: thêm field vào user.prisma)
# 2. Tạo migration
deno task migrate:dev
# → Nhập tên: "add_phone_to_users"
# → File SQL được tạo tại prisma/schema/migrations/<timestamp>_add_phone_to_users/
```

#### Gộp migration vào init (fresh project)

Khi dự án chưa lên production, có thể gộp nhiều migration thành 1:

```bash
# 1. Copy nội dung migration mới vào file _init/migration.sql
# 2. Xóa thư mục migration mới
rm -rf prisma/schema/migrations/<timestamp>_<name>
# 3. Reset DB với migration đã gộp
deno task migrate:reset
# 4. Seed lại data
deno task seed
```

#### Reset toàn bộ database

```bash
# ⚠️ XÓA SẠCH toàn bộ data + chạy lại tất cả migration
deno task migrate:reset

# Seed lại data
deno task seed
```

#### Kiểm tra trạng thái migration

```bash
deno task migrate:status
# → Hiển thị danh sách migration đã/chưa apply
```

#### Prototype nhanh (không cần migration file)

```bash
# Đẩy schema trực tiếp vào DB, không tạo file migration
# Chỉ dùng khi thử nghiệm nhanh, KHÔNG dùng cho production
deno task prisma:push
```

## 💡 How to create a new Module?

Denolith follows a strict Modular Architecture. To add a new feature (e.g.,
`Product`):

1. **Schema**: Define the `Product` model in `prisma/schema`. Run
   `deno task prisma:generate`.
2. **Directory**: Create `src/modules/product`.
3. **Validation**: Create `product.validation.ts` using Valibot.
4. **Service**: Create `product.service.ts` encapsulating Prisma queries.
5. **Routes**: Create `product.routes.ts` defining endpoints and middlewares.
6. **Container**: Register the service in `src/core/container.ts`.
7. **Router**: Mount the router in `src/app.router.ts`.

## 🛡️ License

Proprietary / Closed Source.
