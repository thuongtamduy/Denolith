# Hướng Dẫn Tạo API Module Mới (Workflow Chuẩn)

Quy trình chuẩn hóa từng bước (Step-by-Step) để phát triển một module API mới
trong dự án Denolith, đảm bảo tính nhất quán, bảo mật và dễ bảo trì. Quy trình
này được xây dựng dựa trên pattern của module `stores`.

---

## Bước 1: Định nghĩa Database Schema

Tạo file `.prisma` mới trong thư mục `prisma/schema/`.

1. Tạo file: `prisma/schema/<module_name>.prisma` (VD: `store.prisma`).
2. Định nghĩa Model với các chuẩn sau:
   - Sử dụng UUID mặc định:
     `id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`
   - Đặt tên bảng dạng số nhiều: `@@map("table_names")`
   - Bắt buộc có Timestamps: `createdAt` và `updatedAt`.
   - Bắt buộc có Soft Delete (nếu cần): `deleted Boolean @default(false)` và
     `deletedAt DateTime?`.
   - Đánh Index cho các cột hay được tìm kiếm hoặc filter.

## Bước 2: Format & Tạo Migration

Chạy các lệnh Prisma để đồng bộ database.

```bash
# 1. Format lại schema
deno task prisma:format

# 2. Tạo migration mới và áp dụng vào DB (Thay tên tương ứng)
deno task migrate:dev --name add_<module_name>_table

# 3. Generate lại Prisma Client
deno task prisma:generate
```

## Bước 3: Tạo Data Mẫu (Seeding - Tùy chọn)

Nếu module cần dữ liệu mẫu khi khởi tạo dự án:

1. Tạo file `prisma/seeds/<module_name>.seed.ts`.
2. Viết logic tạo dữ liệu (Dùng `findUnique` check trước khi `create` để tránh
   lỗi duplicate).
3. Đăng ký seed function vào `prisma/seeds/index.ts`.

## Bước 4: Tạo Thư Mục Module

Tạo thư mục mới tại `src/modules/<module_name>` để chứa toàn bộ logic.

```bash
mkdir -p src/modules/<module_name>
```

## Bước 5: Viết Validation Schema (`<module_name>.validation.ts`)

Sử dụng `valibot` để định nghĩa rõ ràng cấu trúc dữ liệu Input và tự động gen ra
OpenAPI/Swagger Schema đẹp.

1. Khai báo các object con cụ thể (VD: `metadataSchema`), **tránh dùng**
   `v.record(v.string(), v.unknown())` để Swagger UI không sinh ra rác
   (`additionalProp1`).
2. Phân chia rõ schema cho CREATE (`create...Schema`) và UPDATE
   (`update...Schema` kết hợp `v.partial()`).
3. Dùng `v.InferOutput<typeof ...>` để export ra Typecript Types.

## Bước 6: Viết Service Layer (`<module_name>.service.ts`)

Chịu trách nhiệm tương tác với Database (Prisma) và Xử lý Business Logic.

1. **Class Pattern**: Khởi tạo class nhận PrismaClient qua Constructor
   (`constructor(private prisma: PrismaClient) {}`).
2. **Tìm kiếm & Phân trang (`findMany`)**:
   - Tái sử dụng `PaginationParams`.
   - Dùng `$transaction` kết hợp `Promise.all` để lấy list data và `count` total
     cùng lúc.
   - Hỗ trợ `OR` condition cho param `search`.
3. **Audit Logging**: Mọi hành động Create/Update/Delete đều phải ghi log qua
   `AuditService.log()`.
4. **Soft/Hard Delete**: Tách biệt logic xóa tạm (`softDelete`) và xóa vĩnh viễn
   (`hardDelete`). Kèm chức năng `restore`.

## Bước 7: Viết Routes & Controller (`<module_name>.routes.ts`)

Khai báo API endpoints, tích hợp OpenAPI và Middleware.

1. Khởi tạo `new Hono<AppEnv>()`.
2. **Middleware Phân quyền**: Dùng `authMiddleware` và
   `requirePermission('module.action')`.
3. **OpenAPI `describeRoute`**: Định nghĩa rõ tags, summary, và các responses.
   (Lưu ý: Valibot sẽ tự lo phần `requestBody`, không cần viết thủ công
   `requestBody.example` nếu validation schema đã rõ ràng).
4. **Validation**: Dùng `validateJson(...)` và `validateQuery(...)`.
5. **Caching (Tùy chọn)**: Dùng `cacheResponse(giây)` cho các GET endpoints.

## Bước 8: Đăng ký Dependency Injection (DI Container)

Đăng ký Service vào Container trung tâm.

1. Mở file `src/core/container.ts`.
2. Khai báo private field: `private _<module_name>Service?: <Module>Service;`
3. Thêm getter khởi tạo lazy-load (truyền `prisma` vào).

## Bước 9: Gắn Router vào Application

Đăng ký các Endpoints để Hono nhận diện trong hệ thống router phân cấp.

1. Mở file `src/app.router.ts`.
2. Import hàm tạo routes (VD: `create<Module>Routes`).
3. Đăng ký vào đúng nhánh Router tương ứng:
   - **Đối với API bảo mật (Private/Authenticated)**: Thêm vào hàm
     `createApiRouter()` (tất cả API ở đây sẽ tự động có prefix `/v1`):
     `router.route("/<module_names>", create<Module>Routes(container.<module>Service));`
   - **Đối với API công khai (Public)**: Thêm vào hàm `createNormalRouter()`
     (không có prefix `v1`, nằm ở root `/`):
     `router.route("/<module_names>", createPublic<Module>Routes(container.<module>Service));`

## Bước 10: Format Code & Kiểm Tra

Chạy format code tổng thể và bật server test:

```bash
# Sửa tự động các lỗi cú pháp, lint, format
deno task format

# Chạy server
deno task dev
```

Kiểm tra kết quả trên giao diện Swagger UI (`http://localhost:9999/swagger`) để
đảm bảo API lên chuẩn, validate hoạt động tốt và test các luồng
Create/Read/Update/Delete.
