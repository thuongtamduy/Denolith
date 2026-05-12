# 🏛️ Denolith

**Denolith** (**Deno** + **Monolith**) là một backend framework monolithic hiệu năng cao, type-safe, sẵn sàng cho môi trường production. Được xây dựng trên nền tảng Deno 2.x, Hono, và Prisma 7, Denolith cung cấp đầy đủ các tính năng enterprise trong một kiến trúc duy nhất, gọn gàng, dễ bảo trì.

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|---|---|
| 🚀 **Ultra-Fast Routing** | Powered by `Hono` — một trong những HTTP framework nhanh nhất trên Deno |
| 🛡️ **100% Type-Safe** | End-to-end type safety từ Database (Prisma) đến API layer (Valibot) |
| 🏰 **Enterprise Architecture** | Modular structure (`src/modules`) với Lazy DI Container (`src/core/container.ts`) |
| 🔐 **RBAC + Granular Permissions** | 3-tier Role System (`owner > admin > user`) kết hợp Permission Profiles và Individual Overrides |
| ☁️ **Background Workers & Cron** | Hệ thống queue (Redis + memory fallback) và cronjob chạy song song với HTTP server |
| ⚡ **Caching & Rate Limiting** | Redis-backed response cache + atomic rate limiting với Lua script (memory fallback) |
| 🚦 **API Versioning** | `/api/v1` (protected) vs `/api/v0` (public read-only) |
| 📦 **File Storage Strategy** | Hỗ trợ `local`, `supabase`, và `s3`/MinIO qua Strategy Pattern |
| 📧 **SMTP Email Service** | Gửi email native qua Deno TCP + STARTTLS (không cần thư viện ngoài) |
| 🗃️ **Soft Delete & Audit Logs** | Khôi phục bản ghi đã xóa và theo dõi mọi hành động qua `AuditService` (async queue) |
| 🛑 **Graceful Shutdown** | Xử lý tín hiệu `SIGINT`/`SIGTERM` để drain connections sạch sẽ |
| 📖 **OpenAPI / Swagger UI** | Tự động sinh tài liệu API tại `/api/swagger` |

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Runtime** | [Deno 2.x](https://deno.land/) |
| **API Framework** | [Hono 4.x](https://hono.dev/) |
| **ORM** | [Prisma 7.x](https://www.prisma.io/) + `@prisma/adapter-pg` |
| **Database** | PostgreSQL (qua `pg` driver) |
| **Cache & Queue** | Redis (`@db/redis`) với memory fallback |
| **Validation** | [Valibot 1.x](https://valibot.dev/) |
| **API Docs** | `hono-openapi` + `@hono/swagger-ui` |
| **Storage** | Local / Supabase Storage / S3-MinIO (tự implement `MiniS3Client`) |
| **Email** | Deno native TCP + STARTTLS (không cần thư viện ngoài) |

---

## 📂 Cấu trúc thư mục

```text
Denolith/
├── prisma/
│   ├── schema/
│   │   ├── schema.prisma        # Generator & Datasource entry
│   │   ├── user.prisma          # Models: Role, User, RefreshToken
│   │   ├── permission.prisma    # Models: Permission, PermissionProfile, ProfilePermission, UserProfile, UserPermission
│   │   ├── audit.prisma         # Model: AuditLog
│   │   └── migrations/          # Migration history (auto-generated)
│   └── seeds/
│       ├── index.ts             # Seed entrypoint
│       ├── role.seed.ts         # System roles (owner, admin, user)
│       ├── user.seed.ts         # Default users
│       ├── permission.seed.ts   # Permission definitions
│       └── profile.seed.ts      # Permission profiles & assignments
│
├── src/
│   ├── core/                    # Hạ tầng cốt lõi
│   │   ├── config.ts            # Env validation & typed config (Valibot)
│   │   ├── logger.ts            # Logger
│   │   ├── database.ts          # Prisma Client singleton
│   │   ├── redis.ts             # Redis client (primary + queue connection)
│   │   ├── queue.ts             # Background Job Queue (Redis BRPOP + memory fallback)
│   │   ├── cron.ts              # Cronjob scheduler (token cleanup, daily tasks)
│   │   ├── audit.ts             # AuditService — ghi log bất đồng bộ qua Queue
│   │   ├── email.ts             # SMTP Email Service + Email Templates
│   │   ├── storage.ts           # StorageService (Strategy: local | supabase | s3)
│   │   ├── mini-s3.ts           # MiniS3Client — S3-compatible client thuần Web Crypto
│   │   ├── context.ts           # Hono AppEnv type definition
│   │   ├── schema.ts            # Shared Valibot schemas
│   │   └── container.ts         # Lazy Singleton DI Container
│   │
│   ├── modules/                 # Domain-driven modules
│   │   ├── auth/
│   │   │   ├── auth.routes.ts   # POST /register, /login, /refresh, /logout
│   │   │   ├── auth.service.ts  # Business logic: JWT, refresh token, blacklist
│   │   │   └── auth.validation.ts
│   │   ├── user/
│   │   │   ├── user.routes.ts   # Admin CRUD + Public read-only routes
│   │   │   ├── user.service.ts  # Soft delete, restore, role update
│   │   │   └── user.validation.ts
│   │   ├── permission/
│   │   │   ├── permission.routes.ts  # Permission profiles & user overrides API
│   │   │   ├── permission.service.ts # resolvePermissions, hasPermission
│   │   │   └── permission.validation.ts
│   │   └── role/
│   │       ├── role.routes.ts   # CRUD roles
│   │       ├── role.service.ts
│   │       └── role.validation.ts
│   │
│   ├── shared/
│   │   ├── errors/              # AppError definitions & global error handler
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts         # JWT verify + Redis blacklist + user status cache
│   │   │   ├── rbac.middleware.ts         # requireRole() — tier-based access control
│   │   │   ├── permission.middleware.ts   # requirePermission() / requireAnyPermission()
│   │   │   ├── cache.middleware.ts        # cacheResponse() — Redis + memory LRU cache
│   │   │   ├── rate-limit.middleware.ts   # rateLimiter() — atomic Lua script + memory fallback
│   │   │   └── validate-uuid.middleware.ts
│   │   ├── types/               # Shared TypeScript types
│   │   └── utils/
│   │       ├── hash.ts          # Password hashing
│   │       ├── pagination.ts    # extractPagination, paginationQuerySchema
│   │       ├── sanitize.ts      # sanitizeUser (strip sensitive fields)
│   │       ├── validator.ts     # validateJson, validateQuery wrappers
│   │       └── openapi.ts       # describeRoute wrapper for hono-openapi
│   │
│   ├── workers/
│   │   └── index.ts             # Workers: send_welcome_email, audit_log
│   │
│   └── app.router.ts            # Central router — lazy DI injection vào routes
│
├── main.ts                      # Entrypoint: bootstrap, middleware, server, graceful shutdown
├── prisma.config.ts             # Prisma config (env, adapter)
├── deno.json                    # Deno tasks, import map, version
├── Dockerfile                   # Multi-stage Docker image (denoland/deno:alpine)
└── compose.yml.example          # Docker Compose example (API + Redis)
```

---

## 🔐 Hệ thống phân quyền

Denolith sử dụng mô hình phân quyền **3 tầng (3-tier)**:

```
OWNER (tier: owner)
  → Bypass hoàn toàn mọi kiểm tra quyền

ADMIN (tier: admin)
  → Được gán Permission Profiles
  → Có thể có Individual Permission Overrides

USER (tier: user)
  → Được gán Permission Profiles
  → Có thể có Individual Permission Overrides
```

### Luồng xác thực quyền (Permission Resolution)

```
Request → authMiddleware
  → JWT Verify
  → Redis Blacklist Check
  → User Status Cache (Redis 30s TTL)
  → payload.tier injected

Router middleware → requirePermission("code")
  → tier === "owner" → BYPASS (no DB query)
  → others → resolvePermissions(userId, tier)
      → Load từ UserProfile (PermissionProfiles assigned)
      → Merge UserPermission (Individual Overrides, override profile)
      → Cache vào context (tránh query trùng trong 1 request)
  → hasPermission(resolved, code) → AND check
```

---

## 🚀 Bắt đầu sử dụng

### 1. Yêu cầu hệ thống

- [Deno 2.x](https://deno.com/)
- PostgreSQL
- Redis *(optional — sẽ tự fallback sang memory nếu không có)*

### 2. Cài đặt môi trường

```bash
cp .env.example .env
# Chỉnh sửa .env với thông tin kết nối của bạn
```

Các biến môi trường quan trọng:

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (qua Supavisor hoặc trực tiếp) |
| `DIRECT_URL` | ✅ (migrate) | Kết nối trực tiếp dùng để chạy migration |
| `JWT_SECRET` | ✅ | Tối thiểu 32 ký tự ngẫu nhiên |
| `PORT` | ❌ | Mặc định: `3000` |
| `DENO_ENV` | ❌ | `development` \| `production` \| `test` |
| `REDIS_URL` | ❌ | Mặc định: memory fallback |
| `FRONTEND_URL` | ❌ | CORS origin (mặc định: `http://localhost:5173`) |
| `TRUST_PROXY` | ❌ | `true` nếu đứng sau Nginx/Cloudflare |
| `SMTP_HOST` | ❌ | SMTP server (optional, graceful degradation) |
| `STORAGE_TYPE` | ❌ | `local` \| `supabase` \| `s3` (mặc định: `supabase`) |
| `SUPABASE_URL` | ❌ | Chỉ cần khi `STORAGE_TYPE=supabase` |
| `S3_ENDPOINT` | ❌ | Chỉ cần khi `STORAGE_TYPE=s3` |

### 3. Migration & Seed

```bash
# Generate Prisma Client
deno task prisma:generate

# Tạo và apply migration (dev)
deno task migrate:dev

# Seed dữ liệu mẫu (roles, users, permissions)
deno task seed
```

### 4. Chạy server

```bash
# Development (hot-reload)
deno task dev

# Production
deno task start
```

Server khởi động tại: `http://localhost:<PORT>`
Swagger UI: `http://localhost:<PORT>/api/swagger`
OpenAPI JSON: `http://localhost:<PORT>/api/swagger/openapi.json`
Health check: `http://localhost:<PORT>/health`

---

## 📜 Danh sách lệnh (deno task)

### Application

| Command | Mô tả |
|---|---|
| `dev` | Chạy development mode với `--watch` (hot-reload) |
| `start` | Chạy production mode |
| `format` | `deno fmt` + `deno lint --fix` + `prisma format` |
| `compile` | Compile thành binary macOS (`./dist/denolith`) |
| `compile:linux` | Cross-compile cho Linux x86_64 (`./dist/denolith-linux`) |
| `deps:check` | Kiểm tra dependencies lỗi thời |
| `deps:update` | Cập nhật dependencies lên bản mới nhất |

### Prisma & Database

| Command | Mô tả |
|---|---|
| `prisma:generate` | Generate Prisma Client types. **Chạy sau mọi thay đổi schema.** |
| `prisma:format` | Format tất cả file `.prisma` |
| `prisma:push` | Push schema trực tiếp vào DB (không tạo migration file — chỉ dùng để prototype) |
| `migrate:dev` | **[DEV]** Tạo migration mới + apply + auto generate client |
| `migrate` | **[PROD]** Chỉ apply các migration đã có sẵn, không tạo mới |
| `migrate:reset` | ⚠️ **Xóa toàn bộ DB** + chạy lại tất cả migration từ đầu |
| `migrate:status` | Kiểm tra migration nào đã/chưa apply |
| `seed` | Seed dữ liệu mẫu (roles, users, permissions, profiles) |

---

## 🗄️ Prisma & Database

### Schema Overview

Schema được chia thành nhiều file trong `prisma/schema/`:

| File | Models |
|---|---|
| `user.prisma` | `Role`, `User`, `RefreshToken` |
| `permission.prisma` | `Permission`, `PermissionProfile`, `ProfilePermission`, `UserProfile`, `UserPermission` |
| `audit.prisma` | `AuditLog` |

### `migrate:dev` vs `migrate` — Khi nào dùng gì?

| | `migrate:dev` | `migrate` (deploy) |
|---|---|---|
| **Dùng khi** | Đang phát triển (local) | Deploy lên server (prod/staging) |
| **Tạo file migration?** | ✅ Có | ❌ Không |
| **Interactive?** | ✅ Hỏi tên migration | ❌ Chạy tự động |
| **Có thể reset data?** | ⚠️ Có (nếu drift) | ❌ Không bao giờ |
| **Auto generate client?** | ✅ Có | ❌ Không |
| **An toàn cho prod?** | ❌ Không | ✅ Rất an toàn |

### Workflow phát triển chuẩn

```bash
# 1. Sửa file .prisma (vd: thêm field vào user.prisma)
# 2. Format schema
deno task prisma:format

# 3. Tạo migration + apply vào DB + generate client
deno task migrate:dev
# → Prisma hỏi tên migration, tạo file SQL, và apply luôn

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

---

## 🐳 Docker

### Chạy với Docker Compose

```bash
# Copy compose file
cp compose.yml.example compose.yml

# Chỉnh sửa biến môi trường trong compose.yml
# Sau đó chạy:
docker compose up -d
```

`compose.yml.example` bao gồm:
- `denolith_api` — Deno app container (build từ `Dockerfile`)
- `redis` — Redis 7.4-alpine với healthcheck

### Dockerfile

- Base image: `denoland/deno:alpine` (siêu nhẹ)
- Cache dependencies trước khi copy source (layer caching)
- Type-check `main.ts` trong build step
- Chạy với non-root user `deno` (Principle of Least Privilege)

---

## 🌐 API Endpoints

### Auth — `/api/auth`

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | ❌ (rate limited: 5/15min) |
| `POST` | `/api/auth/login` | Đăng nhập, nhận access token + refresh token cookie | ❌ (rate limited: 5/15min) |
| `POST` | `/api/auth/refresh` | Làm mới access token từ refresh token cookie | ❌ |
| `POST` | `/api/auth/logout` | Đăng xuất, blacklist token | ❌ |

### Admin Users — `/api/users` *(requires: admin+)*

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/users` | Danh sách users (paginated, cached 60s) |
| `GET` | `/api/users/:id` | Chi tiết 1 user |
| `POST` | `/api/users` | Tạo user mới |
| `PATCH` | `/api/users/:id` | Cập nhật thông tin user |
| `PATCH` | `/api/users/:id/role` | Cập nhật role user *(requires: permissions.manage)* |
| `DELETE` | `/api/users/:id` | Soft delete user |
| `DELETE` | `/api/users/:id?force=true` | Hard delete user (204 No Content) |
| `POST` | `/api/users/:id/restore` | Khôi phục user đã bị soft delete |

### Public Users — `/api/v0/users` *(no auth)*

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/v0/users` | Danh sách users (paginated, cached 60s) |
| `GET` | `/api/v0/users/:id` | Chi tiết 1 user |

### Permissions — `/api/permissions` *(requires: permissions.manage)*

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/permissions` | Xem tất cả permission codes |
| `GET` | `/api/permissions/profiles` | Danh sách permission profiles |
| `POST` | `/api/permissions/profiles` | Tạo permission profile mới |
| `GET` | `/api/permissions/profiles/:id` | Chi tiết profile + danh sách permissions |
| `PATCH` | `/api/permissions/profiles/:id` | Cập nhật profile |
| `DELETE` | `/api/permissions/profiles/:id` | Xóa profile |
| `PUT` | `/api/permissions/profiles/:id/codes/:code` | Set permission code vào profile |
| `DELETE` | `/api/permissions/profiles/:id/codes/:code` | Xóa permission code khỏi profile |
| `GET` | `/api/permissions/users/:userId/profiles` | Xem profiles của user |
| `POST` | `/api/permissions/users/:userId/profiles` | Assign profile cho user |
| `DELETE` | `/api/permissions/users/:userId/profiles/:profileId` | Thu hồi profile khỏi user |
| `GET` | `/api/permissions/users/:userId/overrides` | Xem individual overrides của user |
| `PUT` | `/api/permissions/users/:userId/overrides/:code` | Set individual override cho user |
| `DELETE` | `/api/permissions/users/:userId/overrides/:code` | Xóa override |

### Roles — `/api/roles` *(requires: permissions.manage)*

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/roles` | Danh sách roles |
| `GET` | `/api/roles/:code` | Chi tiết 1 role |
| `POST` | `/api/roles` | Tạo role mới |
| `PATCH` | `/api/roles/:code` | Cập nhật role |
| `DELETE` | `/api/roles/:code` | Xóa role (không được xóa system role) |

### System

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Health check: ping DB + Redis |
| `GET` | `/api/swagger` | Swagger UI |
| `GET` | `/api/swagger/openapi.json` | OpenAPI JSON spec |

---

## ⚙️ Kiến trúc nội bộ

### Dependency Injection (Lazy Singleton Container)

`src/core/container.ts` implement pattern DI Container gọn nhẹ. Service chỉ được khởi tạo khi được gọi lần đầu tiên — tiết kiệm bộ nhớ và tránh circular dependency:

```typescript
// Service chỉ được new() khi lần đầu được access
get userService() {
  if (!this._userService) this._userService = new UserService(prisma);
  return this._userService;
}
```

### Background Queue System

- **Redis mode**: Dùng `LPUSH` để enqueue, `BRPOP` (blocking pop, 5s timeout) trên connection riêng để không block các lệnh Redis khác
- **Memory fallback**: Khi Redis không khả dụng, job được đưa vào in-memory queue và xử lý ngay
- **Graceful shutdown**: Chờ tối đa 5s để drain active jobs trước khi tắt

Workers đã đăng ký:
- `send_welcome_email` — Gửi email chào mừng qua SMTP
- `audit_log` — Ghi AuditLog vào database

### Rate Limiting

- **Redis mode**: Dùng Lua script `INCR + PEXPIRE` để đảm bảo atomic (chống race condition)
- **Memory fallback**: In-memory Map với TTL cleanup mỗi 60s
- Global: 100 requests/phút
- Auth endpoints: 5 requests/15 phút (chống brute force)
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Response Caching

Cache key: `cache:<userId>:<url>` — phân biệt theo user và URL.
- **Redis**: `SETEX` với TTL cấu hình
- **Memory**: LRU-lite với giới hạn 1000 keys
- Header `X-Cache: HIT-REDIS | HIT-MEMORY | MISS`

### Storage Service

Strategy Pattern — chọn provider qua `STORAGE_TYPE`:

| Provider | Cơ chế |
|---|---|
| `local` | Lưu file vào `./uploads/<bucket>/` trên server |
| `supabase` | Gửi HTTP POST đến Supabase Storage REST API |
| `s3` | Dùng `MiniS3Client` tự implement bằng Web Crypto API (AWS Signature V4) |

---

## 💡 Thêm Module mới

Denolith tuân theo kiến trúc module nghiêm ngặt. Để thêm feature mới (ví dụ: `Product`):

1. **Schema**: Định nghĩa model `Product` trong `prisma/schema/`. Chạy `deno task migrate:dev`.
2. **Directory**: Tạo `src/modules/product/`.
3. **Validation**: Tạo `product.validation.ts` dùng Valibot.
4. **Service**: Tạo `product.service.ts` đóng gói Prisma queries, nhận `prisma` qua constructor.
5. **Routes**: Tạo `product.routes.ts` định nghĩa endpoints, áp dụng middlewares phù hợp.
6. **Container**: Thêm `productService` vào `src/core/container.ts`.
7. **Router**: Mount router trong `src/app.router.ts`.

---

## 🛡️ License

Proprietary / Closed Source.
