# 🏛️ Denolith

**Denolith** (**Deno** + **Monolith**) là một backend framework monolithic hiệu năng cao, type-safe, và sẵn sàng cho production. Xây dựng hoàn toàn trên **Deno 2.x** + **Hono**, sử dụng **PostgreSQL native** qua `@db/postgres` — không cần ORM, không cần `node_modules`.

![Deno](https://img.shields.io/badge/Deno-2.x-black?logo=deno)
![Hono](https://img.shields.io/badge/Hono-v4-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Native-blue)
![Redis](https://img.shields.io/badge/Redis-Caching-red)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|---|---|
| 🚀 **Ultra-Fast Routing** | Powered by `Hono` — HTTP framework siêu nhanh trên Deno |
| 🛡️ **100% Type-Safe** | End-to-end type safety từ Database đến API layer (Valibot) |
| 🏰 **Clean Architecture** | Routes → Service → Repository, DI qua `AppContainer` |
| 🔐 **RBAC + Granular Permissions** | 3-tier system (`owner > admin > user`) kết hợp Permission Profiles & Individual Overrides |
| 🗃️ **Custom Migration Engine** | Tự viết `Migrator` thuần TypeScript — versioned SQL, transaction-safe, auto-run khi startup |
| ☁️ **Background Workers & Cron** | Queue system (Redis BRPOP + memory fallback) và cronjob chạy song song HTTP |
| ⚡ **Caching & Rate Limiting** | Redis-backed response cache + atomic Lua rate limiting (memory fallback) |
| 📦 **File Storage Strategy** | `local` / `supabase` / `s3`-MinIO qua Strategy Pattern |
| 📧 **SMTP Email Service** | Gửi email native qua Deno TCP + STARTTLS (không cần thư viện ngoài) |
| 🗑️ **Soft Delete & Audit Logs** | Khôi phục bản ghi đã xóa, ghi log bất đồng bộ qua Queue |
| 🛑 **Graceful Shutdown** | Guard + `removeSignalListener` đảm bảo shutdown đúng 1 lần |

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Runtime** | [Deno 2.x](https://deno.land/) |
| **API Framework** | [Hono 4.x](https://hono.dev/) (`jsr:@hono/hono`) |
| **Database Driver** | [`@db/postgres`](https://jsr.io/@db/postgres) — native PostgreSQL, không ORM |
| **Cache & Queue** | [`@db/redis`](https://jsr.io/@db/redis) với in-memory fallback |
| **Validation** | [Valibot 1.x](https://valibot.dev/) (`jsr:@valibot/valibot`) |
| **Storage** | Local / Supabase Storage / S3-MinIO (tự implement `MiniS3Client`) |
| **Email** | Deno native TCP + STARTTLS (không cần thư viện ngoài) |

---

## 📂 Cấu trúc thư mục

```text
Denolith/
├── scripts/
│   ├── migrate.ts              # CLI runner cho Migrator (up/down/reset/status)
│   ├── generate-migration.ts   # Scaffold file migration mới
│   └── seed.ts                 # Seed dữ liệu mẫu (roles, users, permissions)
│
├── src/
│   ├── core/                   # Hạ tầng cốt lõi
│   │   ├── config.ts           # Env validation & typed config (Valibot)
│   │   ├── logger.ts           # Logger
│   │   ├── database.ts         # PostgreSQL Client singleton (@db/postgres)
│   │   ├── redis.ts            # Redis client (primary + queue connection)
│   │   ├── migrator.ts         # Migration Engine (versioned SQL, transaction-safe)
│   │   ├── base.repository.ts  # BaseRepository: queryOne/queryMany/paginate/transaction
│   │   ├── queue.ts            # Background Job Queue (Redis BRPOP + memory fallback)
│   │   ├── cron.ts             # Cronjob scheduler (token cleanup, daily tasks)
│   │   ├── audit.ts            # AuditService — ghi log bất đồng bộ qua Queue
│   │   ├── email.ts            # SMTP Email Service + Email Templates
│   │   ├── storage.ts          # StorageService (Strategy: local | supabase | s3)
│   │   ├── mini-s3.ts          # MiniS3Client — S3-compatible thuần Web Crypto API
│   │   ├── context.ts          # Hono AppEnv type definition
│   │   ├── schema.ts           # Shared Valibot schemas
│   │   ├── schema-diff.ts      # Schema diffing utilities
│   │   └── container.ts        # AppContainer — DI, khởi tạo DB + Redis + Services
│   │
│   ├── migrations/
│   │   ├── index.ts            # Export tập hợp allMigrations
│   │   └── 001_init.ts         # Migration khởi tạo toàn bộ schema (SQL thuần)
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.repository.ts   # Raw SQL queries: tạo/xóa refresh token
│   │   │   ├── auth.routes.ts       # POST /register, /login, /refresh, /logout
│   │   │   ├── auth.service.ts      # JWT, refresh token rotation, blacklist
│   │   │   └── auth.validation.ts
│   │   ├── user/
│   │   │   ├── user.entity.ts       # TypeScript interface User
│   │   │   ├── user.repository.ts   # Raw SQL: findMany, findById, create, update, softDelete...
│   │   │   ├── user.routes.ts       # Admin CRUD (requires admin+)
│   │   │   ├── user.schema.ts       # Reusable Valibot schemas
│   │   │   ├── user.service.ts      # Business logic
│   │   │   └── user.validation.ts
│   │   ├── permission/
│   │   │   ├── permission.entity.ts      # TypeScript interfaces
│   │   │   ├── permission.repository.ts  # Raw SQL: profiles, profile_permissions, user_profiles, overrides
│   │   │   ├── permission.routes.ts      # Permission profiles & user overrides API
│   │   │   ├── permission.service.ts     # resolvePermissions, hasPermission
│   │   │   └── permission.validation.ts
│   │   └── role/
│   │       ├── role.entity.ts       # TypeScript interface Role
│   │       ├── role.repository.ts   # Raw SQL CRUD
│   │       ├── role.routes.ts
│   │       ├── role.service.ts
│   │       └── role.validation.ts
│   │
│   ├── shared/
│   │   ├── errors/              # AppError definitions & global error handler
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts         # JWT verify + Redis blacklist + DB user check
│   │   │   ├── rbac.middleware.ts         # requireRole() — tier-based
│   │   │   ├── permission.middleware.ts   # requirePermission() / requireAnyPermission()
│   │   │   ├── cache.middleware.ts        # cacheResponse() — Redis + memory LRU
│   │   │   ├── rate-limit.middleware.ts   # rateLimiter() — atomic Lua + memory fallback
│   │   │   └── validate-uuid.middleware.ts
│   │   └── utils/
│   │       ├── hash.ts          # Password hashing (Web Crypto PBKDF2)
│   │       ├── pagination.ts    # extractPagination, PaginationParams, PaginatedResult
│   │       ├── sanitize.ts      # sanitizeUser (strip sensitive fields)
│   │       └── validator.ts     # validateJson, validateQuery wrappers
│   │
│   └── workers/
│       └── index.ts             # Workers: send_welcome_email, audit_log
│
├── main.ts                      # Entrypoint: boot Container → Migrate → Hono → Serve
├── deno.json                    # Deno tasks, import map, version
├── Dockerfile                   # Docker image (denoland/deno:alpine)
└── compose.yml.example          # Docker Compose: API + Redis
```

---

## 🔐 Hệ thống phân quyền (3-Tier RBAC)

```
OWNER  (tier: owner)  →  Bypass hoàn toàn, không query DB/Permission gì
ADMIN  (tier: admin)  →  Gán Permission Profiles + Individual Overrides
USER   (tier: user)   →  Gán Permission Profiles + Individual Overrides
```

### Luồng xác thực (mỗi request)

```
Request
  → authMiddleware
      1. Đọc Bearer token từ Authorization header
      2. Verify JWT (signature + expiry, HS256)
      3. Redis blacklist check (nếu có Redis)
      4. DB query: SELECT role, tier FROM users WHERE id=$1 AND deleted=false
      → inject payload.role + payload.tier vào context

  → requirePermission("permission.code")
      → tier === "owner" → BYPASS ngay
      → others → resolvePermissions(userId, tier)
          = Union(PermissionProfiles assigned) MERGE UserPermission overrides
          → cached trong context (tránh query trùng)
      → hasPermission(resolved, code) → AND check
```

### Permission Resolution Logic

- **Profile permissions**: UNION quyền từ tất cả profiles được assign cho user
- **Individual overrides**: `granted=true` cấp thêm, `granted=false` thu hồi tường minh — ưu tiên cao hơn profile

---

## 🗃️ Migration Engine

Denolith tự implement `Migrator` — không dùng Prisma hay bất kỳ ORM nào.

**Cách hoạt động:**
- Mỗi migration là một file `{version}_{name}.ts` export `{ version, name, up: string, down: string }`
- Migrator duy trì bảng `_migrations` trong PostgreSQL để track lịch sử
- `up`/`down` là raw SQL string, chạy trong transaction — rollback tự động nếu lỗi
- **Auto-run khi startup**: `main.ts` gọi `migrator.migrate(allMigrations)` mỗi lần khởi động, chỉ apply các migration chưa có

**Thêm migration mới:**
```bash
deno task migrate:generate
# → Tạo file src/migrations/{timestamp}_{name}.ts với template sẵn
# → Chỉnh sửa up/down SQL
# → Import vào src/migrations/index.ts
```

---

## 🚀 Bắt đầu sử dụng

### Yêu cầu hệ thống

- [Deno 2.x](https://deno.com/)
- PostgreSQL
- Redis *(optional — tự fallback sang memory)*

### 1. Cài đặt môi trường

```bash
cp .env.example .env
# Chỉnh sửa .env với thông tin kết nối của bạn
```

Các biến môi trường quan trọng:

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Hỗ trợ `?schema=<name>` để set search_path |
| `JWT_SECRET` | ✅ | Tối thiểu 32 ký tự ngẫu nhiên (`openssl rand -hex 32`) |
| `PORT` | ❌ | Mặc định: `3000` |
| `DENO_ENV` | ❌ | `development` \| `production` \| `test` |
| `REDIS_URL` | ❌ | Mặc định: memory fallback |
| `FRONTEND_URL` | ❌ | CORS origin (mặc định: `http://localhost:5173`) |
| `TRUST_PROXY` | ❌ | `true` nếu đứng sau Nginx/Cloudflare |
| `SMTP_HOST` | ❌ | SMTP server (optional, graceful degradation nếu không có) |
| `STORAGE_TYPE` | ❌ | `local` \| `supabase` \| `s3` (mặc định: `supabase`) |
| `SUPABASE_URL` | ❌ | Chỉ cần khi `STORAGE_TYPE=supabase` |
| `S3_ENDPOINT` | ❌ | Chỉ cần khi `STORAGE_TYPE=s3` |

### 2. Seed dữ liệu mẫu

```bash
deno task seed
```

Seed tạo ra:
- Roles: `owner`, `admin`, `user`
- Users mặc định:

| Email | Password | Role |
|---|---|---|
| `owner@denolith.dev` | `Owner@123456` | `owner` |
| `admin@denolith.dev` | `Admin@123456` | `admin` |
| `user1@denolith.dev` | `User1@123456` | `user` |
| `user2@denolith.dev` | `User2@123456` | `user` |

- Permission codes: `users.read`, `users.create`, `users.update`, `users.delete`, `reports.view`, `reports.export`, `permissions.manage`, ...

### 3. Chạy server

```bash
# Development (hot-reload)
deno task dev

# Production
deno task start
```

Migrations sẽ **tự động chạy khi startup** — không cần chạy lệnh riêng trong dev thông thường.

Các endpoint sau khi khởi động:
- **Server**: `http://localhost:<PORT>`
- **Health check**: `http://localhost:<PORT>/health`

---

## 📜 Danh sách lệnh (deno task)

### Application

| Command | Mô tả |
|---|---|
| `dev` | Chạy development mode với `--watch` (hot-reload) |
| `start` | Chạy production mode |
| `format` | `deno fmt` + `deno lint --fix` |
| `test` | Chạy test suite (`src/` + `scratch/`) |
| `test:watch` | Chạy test với hot-reload |
| `compile` | Compile thành binary macOS (`./dist/denolith`) |
| `compile:linux` | Cross-compile cho Linux x86_64 (`./dist/denolith-linux`) |

### Migration

| Command | Mô tả |
|---|---|
| `migrate` | Apply tất cả pending migrations (up) |
| `migrate:down` | Rollback migration gần nhất (down, 1 step) |
| `migrate:reset` | Rollback toàn bộ về DB trống |
| `migrate:status` | Xem danh sách migration đã/chưa apply |
| `migrate:generate` | Scaffold file migration TypeScript mới |
| `seed` | Seed dữ liệu mẫu vào DB |

> **Lưu ý**: Khi `deno task dev` hay `deno task start`, migration **tự động apply** khi khởi động.

---

## 🌐 API Endpoints

### Auth — `/api/auth`

| Method | Path | Mô tả | Guard |
|---|---|---|---|
| `POST` | `/api/auth/register` | Đăng ký tài khoản | Rate limit 5/15min |
| `POST` | `/api/auth/login` | Đăng nhập → access token + refresh cookie | Rate limit 5/15min |
| `POST` | `/api/auth/refresh` | Làm mới access token từ refresh cookie | — |
| `POST` | `/api/auth/logout` | Đăng xuất, blacklist token | — |

### Admin Users — `/api/users` *(requires: admin tier)*

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/users` | Danh sách users (paginated, cached 60s) |
| `GET` | `/api/users/:id` | Chi tiết 1 user |
| `POST` | `/api/users` | Tạo user mới |
| `PATCH` | `/api/users/:id` | Cập nhật thông tin user |
| `PATCH` | `/api/users/:id/role` | Cập nhật role *(requires: permissions.manage)* |
| `DELETE` | `/api/users/:id` | Soft delete |
| `DELETE` | `/api/users/:id?force=true` | Hard delete (204 No Content) |
| `POST` | `/api/users/:id/restore` | Khôi phục user đã soft delete |

### Permissions — `/api/permissions` *(requires: permissions.manage)*

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/permissions/codes` | Xem tất cả permission codes |
| `GET` | `/api/permissions/profiles` | Danh sách profiles (filter: `?tier=admin\|user`) |
| `POST` | `/api/permissions/profiles` | Tạo profile mới |
| `GET` | `/api/permissions/profiles/:id` | Chi tiết profile + permissions bên trong |
| `PATCH` | `/api/permissions/profiles/:id` | Cập nhật profile |
| `DELETE` | `/api/permissions/profiles/:id` | Xóa profile (cascade xóa assignments) |
| `PUT` | `/api/permissions/profiles/:id/codes/:code` | Set permission code vào profile |
| `DELETE` | `/api/permissions/profiles/:id/codes/:code` | Xóa permission code khỏi profile |
| `GET` | `/api/permissions/users/:userId/profiles` | Xem profiles của user |
| `POST` | `/api/permissions/users/:userId/profiles` | Assign profile cho user |
| `DELETE` | `/api/permissions/users/:userId/profiles/:profileId` | Thu hồi profile |
| `GET` | `/api/permissions/users/:userId/overrides` | Xem individual overrides của user |
| `PUT` | `/api/permissions/users/:userId/overrides/:code` | Set individual override |
| `DELETE` | `/api/permissions/users/:userId/overrides/:code` | Xóa override |

### Roles — `/api/roles` *(requires: permissions.manage)*

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/roles` | Danh sách roles |
| `GET` | `/api/roles/:code` | Chi tiết 1 role |
| `POST` | `/api/roles` | Tạo role mới |
| `PATCH` | `/api/roles/:code` | Cập nhật role |
| `DELETE` | `/api/roles/:code` | Xóa role (không xóa được system role) |

### System

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Health check: ping DB + Redis |
| `GET` | `/` | `"Backend is running."` |

---

## ⚙️ Kiến trúc nội bộ

### AppContainer (Dependency Injection)

`src/core/container.ts` export một singleton `container`. Khi `container.init()` được gọi ở startup:
1. Kết nối Redis
2. Kết nối PostgreSQL
3. Khởi tạo tất cả Repositories (inject `db`)
4. Khởi tạo tất cả Services (inject Repositories)

```typescript
// main.ts
await container.init();
// → container.userService, container.authService... đã sẵn sàng
```

### Repository Pattern

Mọi Repository đều extends `BaseRepository`, cung cấp sẵn:
- `queryOne<T>(sql, params)` — lấy 1 dòng
- `queryMany<T>(sql, params)` — lấy nhiều dòng
- `execute(sql, params)` — INSERT/UPDATE/DELETE
- `paginate<T>(baseSql, params, pagination)` — auto count + LIMIT/OFFSET
- `collection<T>(sql, params)` — toàn bộ danh sách không phân trang
- `transaction(fn)` — wrap trong DB transaction, auto rollback khi lỗi

### Background Queue System

- **Redis mode**: `LPUSH` để enqueue, `BRPOP` (5s timeout) trên connection riêng
- **Memory fallback**: in-memory queue khi Redis không khả dụng
- **Graceful shutdown**: chờ tối đa 5s để drain active jobs

Workers đã đăng ký (`src/workers/index.ts`):
- `send_welcome_email` — Gửi email chào mừng qua SMTP
- `audit_log` — Ghi AuditLog vào bảng `audit_logs`

### Rate Limiting

- **Redis mode**: Lua script `INCR + PEXPIRE` — atomic, chống race condition
- **Memory fallback**: in-memory Map với TTL cleanup mỗi 60s
- Global: 100 req/phút
- Auth endpoints: 5 req/15 phút (chống brute force)
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Response Caching

Cache key: `cache:<userId>:<url>` — scope theo user + URL.
- **Redis**: `SETEX` với TTL cấu hình per-route
- **Memory**: LRU-lite với giới hạn 1000 keys
- Header `X-Cache: HIT-REDIS | HIT-MEMORY | MISS`

### Storage Service

Strategy Pattern — chọn provider qua `STORAGE_TYPE` trong `.env`:

| Provider | Cơ chế |
|---|---|
| `local` | Lưu file vào `./uploads/<bucket>/` trên server |
| `supabase` | HTTP POST đến Supabase Storage REST API |
| `s3` | `MiniS3Client` tự implement bằng Web Crypto API (AWS Signature V4) |

---

## 🐳 Docker

### Chạy với Docker Compose

```bash
cp compose.yml.example compose.yml
# Chỉnh sửa biến môi trường
docker compose up -d
```

`compose.yml.example` bao gồm:
- `denolith_api` — App container (build từ `Dockerfile`)
- `redis` — Redis 7.4-alpine với healthcheck

### Dockerfile

- Base: `denoland/deno:alpine`
- Layer cache dependencies trước khi copy source
- Type-check `main.ts` trong build step
- Chạy với non-root user `deno` (Principle of Least Privilege)

---

## 💡 Thêm Module mới

1. **Migration**: Thêm bảng mới — `deno task migrate:generate`, viết SQL vào `up`/`down`
2. **Entity**: Tạo `src/modules/<name>/<name>.entity.ts` định nghĩa TypeScript interface
3. **Repository**: Tạo `<name>.repository.ts` extends `BaseRepository`, viết raw SQL
4. **Service**: Tạo `<name>.service.ts`, inject Repository qua constructor
5. **Validation**: Tạo `<name>.validation.ts` dùng Valibot
6. **Routes**: Tạo `<name>.routes.ts`, áp dụng middlewares phù hợp
7. **Container**: Thêm repo + service vào `src/core/container.ts`
8. **Router**: Mount route trong `main.ts`

---

## 🛡️ License

Proprietary / Closed Source.
