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
   - **Bắt buộc áp dụng 7 fields chuẩn hóa Record-level Provenance (Truy xuất
     nguồn gốc)**:
     ```prisma
     createdAt DateTime  @default(now()) @map("created_at")
     createdBy String?   @map("created_by") @db.Uuid
     updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")
     updatedBy String?   @map("updated_by") @db.Uuid
     deleted   Boolean   @default(false)
     deletedAt DateTime? @map("deleted_at")
     deletedBy String?   @map("deleted_by") @db.Uuid
     ```
     _(Lưu ý: Các field `createdBy`, `updatedBy`, `deletedBy` sẽ được tự động
     gán ngầm bởi Prisma Extension thông qua `requestContextStore`, không cần
     gán thủ công ở Service)._
   - Đánh Index cho các cột hay được tìm kiếm hoặc filter.
   - **Hỗ trợ Multi-Store**: Nếu bảng dữ liệu cần chia theo từng cửa hàng, bắt
     buộc thêm cột `storeId String? @map("store_id") @db.Uuid` và đánh index
     `@@index([storeId])`.

## Bước 2: Format & Tạo Migration

Chạy các lệnh Prisma để đồng bộ database.

```bash
# 1. Format lại schema
deno task prisma:format

# 2. Tạo migration mới và áp dụng vào DB (Tuân thủ Quy tắc Đặt tên)
# --- QUY TẮC ĐẶT TÊN MIGRATION CHUẨN MỰC ---
# Tạo bảng mới:          add_<table_name>_table            (VD: add_products_table)
# Thêm cột mới:          add_<field_name>_to_<table_name>  (VD: add_status_to_users)
# Sửa cấu trúc/kiểu cột: alter_<field_name>_in_<table_name> (VD: alter_phone_in_users)
# Xóa cột (Drop field):  drop_<field_name>_from_<table_name> (VD: drop_age_from_users)
# Xóa bảng (Drop table): drop_<table_name>_table           (VD: drop_old_logs_table)
# Thêm Index/Constraint: add_index_to_<table_name>_<field> (VD: add_index_to_users_email)
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
3. **Audit Logging & Provenance**:
   - Mọi hành động Create/Update/Delete đều phải ghi log qua
     `AuditService.log()`.
   - Các trường theo dõi `createdBy`, `updatedBy`, `updatedAt`, `deletedBy`,
     `deletedAt` được tự động xử lý ngầm ở tầng Prisma Extension, Service không
     cần gán thủ công.
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
6. **Bảo mật Multi-Store Context (x-api-key)**: Nếu module có chứa dữ liệu phân
   mảnh theo cửa hàng (`storeId`):
   - **GET List**: Ép buộc dùng `clientCtx.storeId` làm tham số filter nếu
     `payload.tier !== "owner"` (tuyệt đối không cho phép query tự do qua URL
     `?storeId=...`). Owner có quyền không truyền hoặc truyền tự do.
   - **POST/PUT/PATCH**: Bổ sung `storeId: body.storeId ?? clientCtx.storeId`
     vào `inputData` để dữ liệu tự động gắn chặt vào cửa hàng mà nhân viên đang
     thao tác.

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
     (không có prefix version, nằm ở root `/`):
     `router.route("/<module_names>", createPublic<Module>Routes(container.<module>Service));`

## Bước 10: Format Code, Fix Lint & Kiểm Tra (BẮT BUỘC)

Sau khi hoàn thành phát triển module, việc chạy định dạng và kiểm tra lỗi cú
pháp là **BẮT BUỘC** để đảm bảo code sạch, không chứa kiểu `any` lỏng lẻo và
vượt qua các tiêu chuẩn kiểm thử tự động của hệ thống.

```bash
# 1. Chạy định dạng, kiểm tra và sửa tự động các lỗi cú pháp, lint, format
deno task format

# 2. BẮT BUỘC: Nếu Deno báo lỗi linter hoặc type check, hãy sửa triệt để 
# (ví dụ: tránh dùng kiểu 'any', dùng đúng type cụ thể hoặc Record<string, unknown>).
# Chạy lại lệnh trên cho đến khi hoàn toàn thành công (Exit code: 0).

# 3. Chạy server thử nghiệm
deno task dev
```

Kiểm tra kết quả trên giao diện Swagger UI (`http://localhost:9999/swagger`) để
đảm bảo API lên chuẩn, validate hoạt động tốt và test các luồng
Create/Read/Update/Delete.
