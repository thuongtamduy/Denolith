# ARCHITECTURE.md — Denolith Backend

> **Mục đích:** Tài liệu kiến trúc bắt buộc đọc trước khi đóng góp code.\
> Mọi AI agent hay developer phải bám sát tài liệu này. Vi phạm = PR bị reject.

---

## 1. Tech Stack

| Thành phần    | Công nghệ                     | Ghi chú                                                |
| ------------- | ----------------------------- | ------------------------------------------------------ |
| Runtime       | **Deno 2**                    | Không dùng Node.js, không dùng npm packages            |
| Framework     | **Hono**                      | `@hono/core`, không dùng Express/Fastify               |
| Database      | **PostgreSQL**                | `@db/postgres`, raw SQL — không dùng ORM               |
| Cache / Queue | **Redis** (optional)          | Tự động fallback sang Memory nếu Redis tắt             |
| Validation    | **Valibot**                   | `valibot` + `@hono/valibot-validator`                  |
| Auth          | **JWT** + **HttpOnly Cookie** | `@hono/jwt` cho access token, cookie cho refresh token |

### ❌ Tuyệt đối không dùng

- Prisma, Drizzle, TypeORM hay bất kỳ ORM nào
- `npm:*` packages (chỉ dùng `jsr:` và `deno.land/x/`)
- `bcryptjs` hoặc bất kỳ hash lib bên ngoài nào — dùng `crypto.subtle` (native
  Deno)

---

## 2. Cấu trúc thư mục

```
Denolith/
├── main.ts                    # Entry point: boot, middleware, route registration
├── src/
│   ├── core/                  # Infrastructure layer — dùng chung toàn app
│   │   ├── audit.ts           # AuditService — ghi log qua Queue (non-blocking)
│   │   ├── base.repository.ts # BaseRepository — queryOne/queryMany/paginate/transaction
│   │   ├── config.ts          # Env validation (Valibot), fail-fast khi thiếu biến
│   │   ├── container.ts       # Dependency Injection container (Singleton)
│   │   ├── context.ts         # AppEnv: JwtPayload type cho Hono context
│   │   ├── cron.ts            # Background cronjobs (daily cleanup, etc.)
│   │   ├── database.ts        # PostgreSQL connection
│   │   ├── logger.ts          # Structured logger (info/warn/error/debug)
│   │   ├── migrator.ts        # Auto-migration engine khi startup
│   │   ├── queue.ts           # Job Queue (Redis BRPOP + Memory fallback)
│   │   └── redis.ts           # Redis connection (optional, fail-safe)
│   │
│   ├── migrations/            # Database migrations (tăng dần theo version)
│   │   ├── 001_init.ts
│   │   └── index.ts           # Export allMigrations[]
│   │
│   ├── modules/               # Feature modules — MỖI module là 1 thư mục
│   │   ├── auth/
│   │   │   ├── auth.entity.ts           # (nếu có) Domain types
│   │   │   ├── auth.repository.ts       # DB queries cho auth
│   │   │   ├── auth.routes.ts           # Hono router — thin controller
│   │   │   ├── auth.service.ts          # Business logic
│   │   │   └── auth.validation.ts       # Valibot schemas + inferred types
│   │   ├── permission/
│   │   │   ├── permission.entity.ts     # Permission, PermissionProfile, ResolvedPermissions
│   │   │   ├── permission.repository.ts # SQL: resolve, CRUD profiles, assign/revoke
│   │   │   ├── permission.routes.ts     # 14 endpoints quản lý phân quyền
│   │   │   ├── permission.service.ts    # Resolve + Redis cache + audit log
│   │   │   └── permission.validation.ts # Valibot schemas cho permission endpoints
│   │   └── user/
│   │       ├── user.entity.ts           # Interface User, UserRole, CreateUserData
│   │       ├── user.repository.ts       # DB queries cho user
│   │       ├── user.routes.ts           # Hono router — thin controller
│   │       ├── user.schema.ts           # DB table schema (cho auto-migration)
│   │       ├── user.service.ts          # Business logic
│   │       └── user.validation.ts       # Valibot schemas + inferred types
│   │
│   ├── shared/                # Utilities dùng chung — không phụ thuộc module cụ thể
│   │   ├── errors/
│   │   │   ├── AppError.ts          # Custom error class với statusCode + code
│   │   │   └── error.handler.ts     # Global Hono error handler
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts        # JWT verify + Redis blacklist + DB alive check
│   │   │   ├── cache.middleware.ts       # Response cache (Redis + Memory fallback)
│   │   │   ├── permission.middleware.ts  # requirePermission() + requireAnyPermission()
│   │   │   ├── rate-limit.middleware.ts  # Rate limiting (Redis Lua + Memory fallback)
│   │   │   ├── rbac.middleware.ts        # requireRole() — legacy tier check
│   │   │   └── validate-uuid.middleware.ts  # UUID v4 param validation
│   │   ├── types/
│   │   │   └── index.ts             # ApiResponse<T>, ApiErrorResponse
│   │   └── utils/
│   │       ├── hash.ts              # hashPassword / verifyPassword (PBKDF2 native)
│   │       ├── pagination.ts        # PaginationParams, PaginatedResult, extractPagination
│   │       ├── sanitize.ts          # sanitizeUser — loại bỏ password khỏi response
│   │       └── validator.ts         # validateJson() — wrap vValidator với AppError
│   │
│   └── workers/
│       └── index.ts           # Worker handlers: send_welcome_email, audit_log
```

---

## 3. Luồng xử lý Request (Request Lifecycle)

```
HTTP Request
    │
    ▼
[Global Middlewares] (main.ts)
  secureHeaders() → cors() → rateLimiter(100/min)
    │
    ▼
[Route Middleware] (per-router)
  authMiddleware → requireRole() | requirePermission()
    │
    ▼
[Validation Middleware]
  validateUUID() → validateJson(schema)
    │
    ▼
[Route Handler] (*.routes.ts)
  c.req.valid("json") as XxxInput
    │
    ▼
[Service] (*.service.ts)
  Business logic, throw AppError nếu lỗi
    │
    ▼
[Repository] (*.repository.ts)
  Raw SQL qua BaseRepository
    │
    ▼
[Response] c.json({ success: true, data: ... })
    │
    ▼
  (nếu có lỗi) globalErrorHandler → { success: false, error: { code, message } }
```

---

## 4. Quy tắc bắt buộc theo layer

### 4.1 Routes (`*.routes.ts`) — Thin Controller

```typescript
// ✅ ĐÚNG: Routes chỉ làm 3 việc: validate → call service → trả về response
router.patch(
  "/:id",
  validateUUID(),
  validateJson(updateUserSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const body = c.req.valid("json") as UpdateUserInput; // cast từ InferOutput
    const user = await service.update(id, body);
    return c.json({ success: true, data: sanitizeUser(user) });
  },
);

// ❌ SAI: Không được có business logic trong routes
// ❌ SAI: Không được dùng try/catch trong routes (dùng throw)
// ❌ SAI: Không được khai báo schema inline trong routes — phải dùng *.validation.ts
// ❌ SAI: Không được cast bằng "as Parameters<ServiceMethod>[0]" — unsafe
```

### 4.2 Validation (`*.validation.ts`)

```typescript
// ✅ ĐÚNG: Tất cả Valibot schemas đặt trong file riêng, export kèm type
export const updateUserSchema = v.partial(v.object({
  username: v.pipe(v.string(), v.minLength(3), v.maxLength(50)),
  phone: phoneSchema,
  active: v.boolean(),
}));

export type UpdateUserInput = v.InferOutput<typeof updateUserSchema>;

// ❌ SAI: Không được khai báo schema trong routes hoặc service
// ❌ SAI: Không được cho phép update email/role/password qua updateUserSchema (Mass Assignment)
```

### 4.3 Service (`*.service.ts`)

```typescript
// ✅ ĐÚNG: Service nhận DTO cụ thể, không nhận Partial<Entity>
async update(id: string, data: UpdateUserData): Promise<User> {
  const user = await this.repo.update(id, data);
  if (!user) throw AppError.notFound(`User with id ${id} not found`);
  return user;
}

// ✅ ĐÚNG: Hash password tại Service trước khi xuống Repository
async create(data: CreateUserData): Promise<User> {
  return await this.repo.transaction(async (tx) => {
    const existing = await this.repo.findByEmail(data.email, tx);
    if (existing) throw AppError.conflict("Email already exists");
    const hashedPassword = await hashPassword(data.password);
    return await this.repo.create({ ...data, password: hashedPassword }, tx);
  });
}

// ❌ SAI: Không được nhận Partial<User> — dùng DTO cụ thể (UpdateUserData)
// ❌ SAI: Không được lưu raw password xuống DB
// ❌ SAI: Không được có try/catch — throw AppError trực tiếp
```

### 4.4 Repository (`*.repository.ts`)

```typescript
// ✅ ĐÚNG: Khai báo SAFE_COLUMNS — không bao giờ SELECT * trong query thông thường
const SAFE_COLUMNS = `id, username, email, role, phone, active, created_at, updated_at, deleted, deleted_at`;

// ✅ ĐÚNG: Tách hàm riêng khi cần password (Least Privilege)
async findByEmail(email: string): Promise<Omit<User, "password"> | undefined>
async findByEmailWithPassword(email: string): Promise<User | undefined> // Chỉ dùng cho Auth

// ✅ ĐÚNG: Nhận DTO chặt chẽ, không nhận Partial<Entity>
async update(id: string, data: UpdateUserData, tx?: Transaction): Promise<User | undefined>

// ❌ SAI: Không được RETURNING * trừ trường hợp cần password ngay sau INSERT
// ❌ SAI: Không được nhận Partial<User> — phải dùng UpdateUserData
```

---

## 5. Error Handling — Throw-to-Handler Pattern

**Quy tắc tuyệt đối:** Không có `try/catch` trong route handlers và service
methods. Mọi lỗi đều `throw AppError.*` và để `globalErrorHandler` bắt.

```typescript
// ✅ ĐÚNG: Throw AppError — globalErrorHandler tự format response
throw AppError.notFound("User not found");
throw AppError.conflict("Email already exists");
throw AppError.badRequest("Invalid input");
throw AppError.unauthorized("Token expired");
throw AppError.forbidden("Access denied");

// AppError methods: badRequest(400), unauthorized(401), forbidden(403),
//                   notFound(404), conflict(409), tooManyRequests(429), internal(500)
```

### Response envelope chuẩn

```typescript
// ✅ Success
{ success: true, data: T }                    // single resource
{ success: true, ...PaginatedResult<T> }      // paginated list
{ success: true, message: "..." }             // action without data
// HTTP 204 No Content cho hard delete

// ✅ Error (tự động từ globalErrorHandler)
{ success: false, error: { code: "NOT_FOUND", message: "..." } }
```

### Empty `catch {}` có chủ đích (Intentional Fail-Open)

Các `catch {}` sau đây là **intentional** — không được thêm code vào:

| File                       | Vị trí                 | Lý do                              |
| -------------------------- | ---------------------- | ---------------------------------- |
| `auth.middleware.ts`       | Redis blacklist check  | Redis down → không block request   |
| `auth.routes.ts`           | logout JWT decode      | Token hết hạn khi logout là OK     |
| `cache.middleware.ts`      | Redis cache read/write | Cache down → fallback memory       |
| `rate-limit.middleware.ts` | Redis rate limit       | Down → fallback memory             |
| `queue.ts`                 | Redis queue fallback   | Down → memory fallback / reconnect |

---

## 6. Security Rules

### 6.1 Authentication & Authorization

- **authMiddleware** chạy 3 lớp: JWT verify → Redis blacklist → DB alive check
- **requireRole(...roles)** — legacy check theo tier: `requireRole("admin")`
- **requirePermission(...codes)** — ABAC check theo permission code:
  `requirePermission("users.read")`
- Role được lấy từ **JWT payload** (đã verify DB khi login). OWNER bypass mọi
  check.

### 6.6 RBAC + ABAC Permission Model

Hệ thống phân quyền 3 tầng:

```
Tầng 1: TIER (cố định, trong users.role)
  ├── owner  → Bypass HOÀN TOÀN mọi permission check, toàn quyền
  ├── admin  → Phải được cấp PermissionProfile, KHÔNG tự do hành động
  └── user   → Bị giới hạn theo PermissionProfile được assign

Tầng 2: PERMISSION PROFILE (Admin quản lý tại runtime)
  PermissionProfile = tập hợp permission codes được đặt tên
  Ví dụ: "Sales Manager" = { users.read ✅, reports.view ✅, users.delete ❌ }

Tầng 3: INDIVIDUAL OVERRIDE (OWNER/Admin cấp cho từng user)
  Ghi đè profile — ưu tiên cao nhất
  Ví dụ: user A được cấp thêm reports.export dù profile không có
```

**Priority chain khi check quyền:**

```
1. OWNER?          → ✅ PASS ngay, 0 overhead
2. denied set?     → ❌ DENY  (user_permissions.granted = false)
3. granted set?    → ✅ PASS  (profile hoặc individual override)
4. Không có gì     → ❌ DENY  (deny-by-default)
```

**Cách dùng trong routes:**

```typescript
// AND logic — phải có TẤT CẢ codes
router.get("/users", requirePermission("users.read"), handler);
router.delete("/users/:id", requirePermission("users.delete"), handler);

// OR logic — có ÍT NHẤT 1 code
router.get(
  "/reports",
  requireAnyPermission("reports.view", "reports.export"),
  handler,
);
```

**Database tables hỗ trợ:**

```
permissions           — Quyền nguyên tử (developer định nghĩa, thêm qua migration)
                        code: "users.read", "reports.export", "permissions.manage"...

permission_profiles   — Bộ quyền được đặt tên (Admin tạo/sửa tại runtime)
                        "Sales Manager", "Report Viewer", "Super Admin"...

profile_permissions   — Profile chứa những quyền gì
                        profile_id × permission_code × granted (true/false)

user_profiles         — User được assign profile nào (nhiều-nhiều)
                        user_id × profile_id

user_permissions      — Override cá nhân (ưu tiên cao hơn profile)
                        user_id × permission_code × granted (true/false)
```

**Nguyên tắc "Cổng Bất Biến" — tách biệt CODE và CONFIGURATION:**

```
Dev viết 1 lần (code):              Admin cấu hình runtime (DB):
                                       Profile "Report Viewer"
  router.get("/reports",     ←───       └── reports.view ✅
    requirePermission(
      "reports.view"                   Assign cho user bất kỳ:
    ), handler)                          → ADMIN_A có profile → vào được ✅
                                         → USER_B có profile → vào được ✅
  "Cổng" này KHÔNG BAO GIỜ đổi          → ADMIN_C không có profile → 403 ❌
  dù cấp/thu hồi bao nhiêu lần
```

> Muốn cấp quyền cho ADMIN_C? → Assign profile, không cần sửa code, không cần
> deploy lại.

**Permission codes hiện có** (developer-defined, thêm qua migration + seed):

| Code                 | Mô tả                                          |
| -------------------- | ---------------------------------------------- |
| `users.read`         | Xem danh sách và thông tin user                |
| `users.write`        | Tạo mới và cập nhật user                       |
| `users.delete`       | Xóa user (soft delete)                         |
| `users.restore`      | Phục hồi user đã bị xóa                        |
| `users.hard_delete`  | Xóa vĩnh viễn user                             |
| `reports.view`       | Xem báo cáo                                    |
| `reports.export`     | Xuất báo cáo ra file                           |
| `permissions.manage` | Quản lý permission profiles và phân quyền user |

**API quản lý permissions** (`/api/permissions/*`, yêu cầu
`permissions.manage`):

```
GET    /api/permissions/codes                              — Xem tất cả permission codes
GET    /api/permissions/profiles                           — Danh sách profiles
POST   /api/permissions/profiles                           — Tạo profile mới
GET    /api/permissions/profiles/:id                       — Chi tiết profile
PATCH  /api/permissions/profiles/:id                       — Cập nhật profile
DELETE /api/permissions/profiles/:id                       — Xóa profile (cascade)
PUT    /api/permissions/profiles/:id/codes/:code           — Thêm/cập nhật permission vào profile
DELETE /api/permissions/profiles/:id/codes/:code           — Xóa permission khỏi profile
GET    /api/permissions/users/:userId/profiles             — Profiles của user
POST   /api/permissions/users/:userId/profiles             — Assign profile → user
DELETE /api/permissions/users/:userId/profiles/:profileId  — Thu hồi profile
GET    /api/permissions/users/:userId/overrides            — Overrides cá nhân
PUT    /api/permissions/users/:userId/overrides/:code      — Set override
DELETE /api/permissions/users/:userId/overrides/:code      — Xóa override
```

**Caching:** `ResolvedPermissions` được cache vào Redis với key
`perm:v1:{userId}`, TTL 5 phút. Tự động invalidate khi assign/revoke profile
hoặc set override.

### 6.2 Password Security

- Hash bằng **PBKDF2 native** (`crypto.subtle`) — 100,000 iterations, SHA-256
- Format lưu DB: `<uuid-salt>:<hex64-hash>`
- **Chỉ** `UserService.create()` và `AuthService.register()` được hash password
- **Chỉ** `findByEmailWithPassword()` được SELECT password — không dùng
  `SAFE_COLUMNS`

### 6.3 Timing Attack

- `AuthService.login()` luôn chạy `verifyPassword()` dù user không tồn tại
  (`DUMMY_HASH`)
- Không được `return` sớm trước khi hash hoàn thành

### 6.4 Audit Logging

- Mọi action quan trọng phải gọi `AuditService.log()` — **trước khi throw** nếu
  cần
- AuditService đẩy vào Queue (non-blocking) — không ảnh hưởng response time
- Actions đã định nghĩa trong `AuditAction` type — phải thêm type trước khi dùng

```typescript
// Thứ tự đúng: log TRƯỚC khi throw
await AuditService.log({ action: "auth.login_failed", metadata: { email } });
throw AppError.unauthorized("Invalid email or password");
```

### 6.5 Input Validation

- `validateUUID()` middleware chặn UUID sai định dạng trước khi xuống DB
- `validateJson(schema)` wrap `vValidator` — trả về AppError.badRequest với
  message đầu tiên
- `extractPagination()` có NaN guard — `?page=abc` → fallback page=1

---

## 7. Pagination

```typescript
// Request: GET /api/users?page=2&limit=20
// Tự động xử lý bởi extractPagination() + BaseRepository.paginate()

// Response chuẩn:
{
  success: true,
  data: User[],
  total: 150,      // tổng số records
  page: 2,
  limit: 20,
  totalPages: 8
}

// Giới hạn: limit tối đa 100, tối thiểu 1 — chống DDOS
```

---

## 8. Background Jobs (Queue + Worker)

```typescript
// Enqueue (trong Service/Routes)
await Queue.enqueue("job_type", { ...payload });

// Register Worker (trong workers/index.ts)
Queue.registerWorker("job_type", async (payload: unknown) => {
  // PHẢI có runtime guard trước khi cast
  const data = payload as { field?: string };
  if (!data?.field) {
    logger.error("❌ [Worker] Invalid payload", payload);
    return; // Không throw — worker không crash
  }
  // ... xử lý job
});
```

**Lưu ý:** Worker không được throw — lỗi phải được log và return.

---

## 9. Thêm Module Mới — Checklist

Khi thêm module `foo`, tạo các file sau:

```
src/modules/foo/
├── foo.entity.ts        # 1. Interface: FooEntity, CreateFooData, UpdateFooData
├── foo.schema.ts        # 2. DB table schema (cho auto-migration)
├── foo.repository.ts    # 3. extends BaseRepository, dùng SAFE_COLUMNS
├── foo.service.ts       # 4. Business logic, inject FooRepository
├── foo.validation.ts    # 5. Valibot schemas + InferOutput types
└── foo.routes.ts        # 6. Hono router, inject FooService
```

Sau đó đăng ký trong:

- `src/core/container.ts` — khởi tạo repo + service
- `src/migrations/` — thêm migration tạo table
- `src/migrations/index.ts` — export migration mới
- `main.ts` — mount route

---

## 10. REST API Conventions

| Hành động          | Method   | Path                            | Response                     |
| ------------------ | -------- | ------------------------------- | ---------------------------- |
| Lấy danh sách      | `GET`    | `/api/resources`                | 200 + PaginatedResult        |
| Lấy 1 resource     | `GET`    | `/api/resources/:id`            | 200 + data                   |
| Tạo mới            | `POST`   | `/api/resources`                | 201 + data + Location header |
| Cập nhật (partial) | `PATCH`  | `/api/resources/:id`            | 200 + data                   |
| Soft delete        | `DELETE` | `/api/resources/:id`            | 200 + message                |
| Hard delete        | `DELETE` | `/api/resources/:id?force=true` | **204 No Content**           |
| Action/Hành động   | `POST`   | `/api/resources/:id/action`     | 200 + data/message           |

**Lưu ý:**

- Dùng `PATCH` (không phải `PUT`) cho update vì đây là partial update
- Action endpoints (restore, approve...) dùng `POST`, không dùng `PATCH`
- Hard delete trả về `204` — không có body
- Luôn có `Location` header khi tạo resource mới

---

## 11. Dependency Injection (Container)

```typescript
// src/core/container.ts — Singleton pattern

class AppContainer {
  db: Client;
  userService: UserService;
  authService: AuthService;
  permissionService: PermissionService;

  async init() {
    const userRepo = new UserRepository(this.db);
    const authRepo = new AuthRepository(this.db);
    const permissionRepo = new PermissionRepository(this.db);
    this.userService = new UserService(userRepo);
    this.authService = new AuthService(userRepo, authRepo);
    this.permissionService = new PermissionService(permissionRepo);
  }
}

export const container = new AppContainer();
```

**Quy tắc:**

- Không `new Service()` hay `new Repository()` trong route files
- Mọi dependency được inject qua constructor (testable)
- Container được import 1 lần duy nhất tại `main.ts`
- Permission middleware dùng **dynamic import**
  (`await import("../../core/container.ts")`) để tránh circular dependency

---

## 12. Graceful Shutdown

Hệ thống hỗ trợ `SIGINT` và `SIGTERM` (Docker):

```
Signal → shutdown()
  │
  ├── stopCrons()         # Hủy các cronjob
  ├── abortController.abort()  # Dừng HTTP server
  ├── Queue.shutdown()    # Chờ tối đa 5s cho jobs đang chạy
  ├── closeRedis()        # Đóng Redis connections
  └── closeDb()           # Đóng DB connection
```

**Không gọi `Deno.exit()`** trong shutdown — để event loop tự kết thúc (cho Deno
watcher hot-reload).

---

## 13. Logging

```typescript
logger.info("..."); // Thông tin thông thường
logger.warn("..."); // Cảnh báo — business errors (AppError)
logger.error("..."); // Lỗi nghiêm trọng — unhandled exceptions
logger.debug("..."); // Chỉ hiện ở development mode

// globalErrorHandler tự động log:
// AppError → logger.warn("[CODE] message")
// Unhandled → logger.error("[UNHANDLED] message", stack)
```

---

## 14. Quy Ước Dành Cho AI Agent và Developer

> **⚠️ Đây là phần BẮT BUỘC đọc trước khi viết bất kỳ dòng code nào.** Vi phạm
> các quy tắc dưới đây sẽ bị reject trong quá trình review.

---

### 14.1 Quy tắc Ngôn ngữ (Language Rules)

**Comments được viết bằng tiếng Việt. Runtime strings phải là tiếng Anh.**

| Loại                                 | Ngôn ngữ      | Ví dụ                                            |
| ------------------------------------ | ------------- | ------------------------------------------------ |
| `// Comments` trong code             | ✅ Tiếng Việt | `// Kiểm tra tier compatibility trước khi gán`   |
| `/** JSDoc */`                       | ✅ Tiếng Việt | `/** Lấy danh sách roles theo tier */`           |
| `-- SQL comments` trong migration    | ✅ Tiếng Việt | `-- Trigger: tự động cập nhật updated_at`        |
| `throw AppError.*()` messages        | ✅ Tiếng Anh  | `throw AppError.notFound("Role not found.")`     |
| `c.json({ message: ... })` responses | ✅ Tiếng Anh  | `{ message: "Profile deleted successfully." }`   |
| `logger.info/warn/error()`           | ✅ Tiếng Anh  | `logger.error("Failed to write audit log", err)` |
| Validation error messages (Valibot)  | ✅ Tiếng Anh  | `v.string("Name must not be empty.")`            |
| Email subject/body                   | ✅ Tiếng Anh  | `subject: "Welcome to Denolith! 🚀"`             |

---

### 14.2 Cấu trúc Module

Mỗi feature module phải tuân theo cấu trúc sau (không thêm, không bớt file trừ
khi có lý do rõ ràng):

```
src/modules/<tên_module>/
├── <tên>.entity.ts       # TypeScript interfaces/types — KHÔNG có logic
├── <tên>.repository.ts   # Tất cả SQL queries — extends BaseRepository
├── <tên>.service.ts      # Business logic — inject Repository
├── <tên>.routes.ts       # Hono router — thin controller, chỉ parse input/output
└── <tên>.validation.ts   # Valibot schemas + inferred types
```

**Cấm** để SQL raw trong `routes.ts` hoặc `service.ts`. SQL chỉ được phép ở
`repository.ts`.

---

### 14.3 Error Handling

**Luôn dùng `AppError` cho business errors, không bao giờ throw `new Error()`.**

```typescript
// ✅ Đúng
throw AppError.notFound("User not found.");
throw AppError.badRequest("Role tier mismatch.");
throw AppError.forbidden("You do not have permission.");
throw AppError.conflict("Email already exists.");

// ❌ Sai — không bao giờ dùng
throw new Error("User not found");
```

Bảng mã lỗi chuẩn:

| Method                       | HTTP Status | Dùng khi                          |
| ---------------------------- | ----------- | --------------------------------- |
| `AppError.badRequest()`      | 400         | Input không hợp lệ, tier mismatch |
| `AppError.unauthorized()`    | 401         | Chưa đăng nhập, token hết hạn     |
| `AppError.forbidden()`       | 403         | Đã đăng nhập nhưng không có quyền |
| `AppError.notFound()`        | 404         | Resource không tồn tại            |
| `AppError.conflict()`        | 409         | Duplicate key, FK đang được dùng  |
| `AppError.tooManyRequests()` | 429         | Vượt rate limit                   |

---

### 14.4 Permission & Security

**Bất kỳ route nào liên quan đến dữ liệu nhạy cảm phải có middleware bảo vệ.**

```typescript
// ✅ Đúng — guard rõ ràng
router.use("*", requirePermission("permissions.manage"));
router.patch("/:id/role", requirePermission("permissions.manage"), ...);

// ❌ Sai — không có guard
router.delete("/roles/:code", async (c) => { ... });
```

Các quy tắc bất biến:

- **OWNER** (`tier = "owner"`) bypass tất cả mọi permission check. Không được
  thêm logic kiểm tra cho OWNER.
- **System roles** (`system = true`) không bao giờ được xóa hoặc thay đổi
  `tier`. Phải kiểm tra ở Service layer trước khi gọi Repository.
- **Không bao giờ** expose `password` hash trong response — luôn dùng
  `sanitizeUser()`.
- **Mọi hành động ghi** (create, update, delete, assign) phải gọi
  `AuditService.log()` sau khi thao tác thành công.

---

### 14.5 Database & Migration

**Không sửa migration đã chạy (`001_init.ts`) nếu database đang ở production.**
Tạo migration mới (`002_xxx.ts`) cho mọi thay đổi schema.

Quy ước đặt tên:

- Bảng: `snake_case`, số nhiều → `users`, `refresh_tokens`,
  `permission_profiles`
- FK: luôn khai báo `ON DELETE CASCADE` hoặc `ON DELETE SET NULL` — không được
  để trống
- Index: `idx_<tên_bảng>_<cột>` → `idx_users_email`, `idx_roles_tier`
- Mọi bảng có thao tác update phải có `updated_at` + trigger
  `trigger_set_updated_at()`

**Cấm dùng ORM.** Mọi query đều là raw SQL qua `BaseRepository`.

---

### 14.6 Redis Cache Invalidation

Khi nào phải gọi `permissionService.invalidateCache(userId)`:

| Hành động                     | Bắt buộc invalidate?                                    |
| ----------------------------- | ------------------------------------------------------- |
| Gán/Thu hồi Profile cho User  | ✅ Có                                                   |
| Set/Xóa Override cá nhân      | ✅ Có                                                   |
| Cập nhật `active` của Profile | ✅ Có (với tất cả user đang dùng profile đó)            |
| Đổi Role của User             | ❌ Không cần (role nằm trong JWT, cần logout/login lại) |
| Tạo/Xóa Role                  | ❌ Không cần                                            |

**Cache TTL = 5 phút.** Nếu sửa DB trực tiếp (không qua API), cache sẽ không tự
invalidate — phải xóa tay bằng `redis-cli DEL perm:v1:<userId>` hoặc đợi hết
TTL.

---

### 14.7 Những điều AI Agent TUYỆT ĐỐI không được làm

```
❌ Tự ý thêm npm package (chỉ dùng jsr: và deno.land/x/)
❌ Dùng ORM (Prisma, Drizzle, TypeORM, v.v.)
❌ Viết SQL trong routes.ts hoặc service.ts
❌ Throw new Error() cho business errors (dùng AppError)
❌ Viết runtime message bằng tiếng Việt (comments được, strings không được)
❌ Expose password field trong response (luôn sanitizeUser())
❌ Thêm logic vào entity.ts (chỉ được chứa interfaces/types)
❌ Sửa system roles (system = true) ở DB hoặc code
❌ Gọi Deno.exit() trong bất kỳ flow nào (kể cả shutdown)
❌ Hardcode secrets hoặc credentials trong code (dùng .env)
```
