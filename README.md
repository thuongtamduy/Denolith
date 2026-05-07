# 🚀 Denolith Enterprise

**Denolith** là một Backend Boilerplate đạt chuẩn **Enterprise &
Production-Ready**, được xây dựng độc quyền trên nền tảng **Deno 2.x** kết hợp
với **Hono**. Dự án hướng tới một kiến trúc siêu tối ưu, loại bỏ hoàn toàn
`node_modules`, 100% sử dụng thư viện JSR và tuân thủ nghiêm ngặt mô hình
**Clean Architecture**.

![Deno](https://img.shields.io/badge/Deno-2.x-black?logo=deno)
![Hono](https://img.shields.io/badge/Hono-v4-blue?logo=hono)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Native-blue)
![Redis](https://img.shields.io/badge/Redis-Caching-red)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)

---

## ✨ Điểm Nổi Bật (Features)

Denolith không chỉ là một bộ khung cơ bản, mà đã được trang bị 9 lớp "vũ khí"
tối tân nhất cho các dự án quy mô lớn:

1. **Clean Architecture & Container DI:** Phân tách hoàn toàn các lớp (Routes →
   Service → Repository), kết hợp Dependency Injection giúp code dễ bảo trì và
   dễ dàng scale.
2. **Hệ Thống Migration Tự Động:** Quản lý lịch sử thay đổi cấu trúc Database
   bằng script SQL nguyên thuỷ siêu tốc, không cần các ORM nặng nề.
3. **Bảo Mật Băm Mật Khẩu (Web Crypto):** Băm mật khẩu bằng chuẩn PBKDF2 native
   của Deno với Salt ngẫu nhiên, miễn nhiễm với hình thức tấn công dò mật khẩu.
4. **Rate Limiting & Graceful Fallback:** Chống Spam/DDoS mạnh mẽ qua Redis. Tự
   động chuyển lùi về sử dụng Memory Cache cục bộ nếu máy chủ Redis gặp sự cố
   (Đảm bảo Zero Downtime).
5. **Advanced Authentication:** Cơ chế Refresh Token Rotation. Quản lý Access
   Token (15 phút) và Refresh Token thông qua `HttpOnly`, `Secure` Cookie để
   chống hoàn toàn XSS.
6. **Dynamic RBAC + ABAC:** Hệ thống phân quyền 3 tầng linh hoạt:
   - **OWNER** — Bypass toàn bộ, không cần check bất kỳ quyền nào.
   - **ADMIN** — Được cấp `PermissionProfile` động, không hard-code role.
   - **USER** — Bị giới hạn theo profile được assign và individual overrides.
   - Router chỉ khai báo **permission code cần thiết** — ai được quyền là do Admin cấu hình runtime, không cần deploy lại.
7. **API Caching Siêu Tốc:** Bộ đệm Redis Caching cho các API đọc dữ liệu
   (`GET`), tăng tốc độ phản hồi xuống dưới 1ms.
8. **Background Job Queue:** Kiến trúc Message Queue tích hợp ngay trên Redis,
   đưa các tác vụ nặng (như gửi Email) xuống chạy ngầm ở Background Worker không
   làm block luồng xử lý chính.
9. **CI/CD & Dockerization:** Đã cấu hình sẵn `Dockerfile`, `docker-compose.yml`
   và Github Actions tự động kiểm duyệt code (`fmt`, `lint`, `type check`,
   `test`).

---

## 🛠 Tech Stack

- **Runtime:** Deno 2.x
- **Web Framework:** Hono (`jsr:@hono/hono`)
- **Database:** PostgreSQL (`jsr:@db/postgres`)
- **Caching & Queue:** Redis (`jsr:@db/redis`)
- **Validation:** Valibot (`jsr:@valibot/valibot`)
- **Security:** Deno Web Crypto API

---

## 🚀 Hướng Dẫn Khởi Chạy (Quick Start)

### Yêu cầu hệ thống:

- Cài đặt **Deno 2.x**
- Cài đặt **Docker & Docker Compose** (để chạy Database và Redis)

### Bước 1: Cấu hình Môi trường

Sao chép file cấu hình mẫu và đổi tên thành `.env`:

```bash
cp .env.example .env
```

Tạo mã bí mật siêu mạnh (CSPRNG) cho biến `JWT_SECRET` bằng script có sẵn:

```bash
deno run scripts/generate-secret.ts 64
```

Sau đó copy đoạn mã vừa tạo dán vào file `.env` (hoặc `compose.yml`).

### Bước 2: Khởi chạy dự án

**Cách 1: Chạy bằng Docker (Khuyên dùng cho Production & Môi trường đồng nhất)**
Lệnh này sẽ tự build image, khởi chạy Database, Redis và cả API Server:

```bash
docker compose up -d
```

Server sẽ sẵn sàng tại: `http://localhost:9999`

**Cách 2: Chạy môi trường phát triển (Hot-reload)** Nếu bạn muốn code và tự động
nhận thay đổi, chỉ cần khởi động các service nền:

```bash
docker compose up -d db redis
```

Sau đó chạy server qua Deno:

```bash
# Lệnh này sẽ tự động chạy Migration tạo Table và khởi động Server với tính năng Hot-reload
deno task dev
```

### Bước 3: Khởi tạo dữ liệu mẫu

```bash
deno task seed
```

Seed sẽ tạo 4 users mặc định:

| Email | Password | Role |
|---|---|---|
| `owner@denolith.dev` | `Owner@123456` | `owner` |
| `admin@denolith.dev` | `Admin@123456` | `admin` |
| `user1@denolith.dev` | `User1@123456` | `user` |
| `user2@denolith.dev` | `User2@123456` | `user` |

Và 8 permission codes cơ bản: `users.*`, `reports.*`, `permissions.manage`.

Server sẽ sẵn sàng phục vụ tại: `http://localhost:9999`

---

## 📜 Danh Sách Lệnh Tiện Ích (Deno Tasks)

| Lệnh                      | Chức năng                                                      |
| ------------------------- | -------------------------------------------------------------- |
| `deno task dev`           | Chạy môi trường phát triển (Tự động Restart khi sửa code)      |
| `deno task start`         | Chạy Server ở chế độ thông thường (Dùng cho Production)        |
| `deno task migrate`       | Cập nhật các thay đổi Schema mới nhất vào DB                   |
| `deno task migrate:down`  | Rollback (hoàn tác) file Migration được tạo gần nhất           |
| `deno task migrate:reset` | Rollback TOÀN BỘ Database về trạng thái trống trơn             |
| `deno task seed`          | Chạy dữ liệu mẫu (Seeding) vào Database                        |
| `deno test -A`            | Chạy bộ Unit Tests bảo mật tự động                             |
| `deno task compile`       | Đóng gói toàn bộ Backend thành 1 file nhị phân duy nhất (.exe) |
| `deno task compile:linux` | Đóng gói toàn bộ Backend thành 1 file nhị phân cho Linux       |
| `deno task format`        | Tự động format lại code theo chuẩn Denolith                    |

---

## 🔐 Biến Môi Trường (.env)

Dưới đây là các biến môi trường quan trọng cần cấu hình để ứng dụng vận hành:

- `PORT`: Cổng ứng dụng (Mặc định: 9999)
- `DATABASE_URL`: Chuỗi kết nối tới máy chủ PostgreSQL
- `REDIS_URL`: Chuỗi kết nối Redis (Nếu hệ thống không có Redis, Denolith sẽ tự
  động chuyển sang dùng RAM cục bộ)
- `JWT_SECRET`: Chuỗi khóa bí mật siêu dài dùng để ký Token xác thực

---

## 🔑 Hệ Thống Phân Quyền (RBAC + ABAC)

Denolith sử dụng mô hình phân quyền **3 tầng** kết hợp RBAC và ABAC:

```
OWNER  →  Bypass tất cả, không check gì
ADMIN  →  Phải được cấp PermissionProfile
USER   →  Bị giới hạn theo PermissionProfile được assign
```

**Luồng cấu hình quyền (không cần deploy lại):**

1. Developer định nghĩa permission code trong migration: `"users.read"`, `"reports.export"`...
2. OWNER tạo PermissionProfile: `"Sales Manager"` = `{ users.read ✅, reports.view ✅ }`
3. OWNER assign profile cho ADMIN/USER → có quyền ngay lập tức (Redis cache 5 phút)
4. OWNER set individual override cho user cụ thể nếu cần
5. Router chỉ khai báo: `requirePermission("users.read")` — không cần sửa khi muốn cấp/thu hồi quyền

**Xem chi tiết:** [ARCHITECTURE.md — Section 6.6](./ARCHITECTURE.md)

---

**Được thiết kế cho Tốc độ, Bảo mật và Trải nghiệm Developer tối thượng.**
