# 🚀 Denolith Enterprise

**Denolith** là một Backend Boilerplate đạt chuẩn **Enterprise & Production-Ready**, được xây dựng độc quyền trên nền tảng **Deno 2.x** kết hợp với **Hono**. Dự án hướng tới một kiến trúc siêu tối ưu, loại bỏ hoàn toàn `node_modules`, 100% sử dụng thư viện JSR và tuân thủ nghiêm ngặt mô hình **Clean Architecture**.

![Deno](https://img.shields.io/badge/Deno-2.x-black?logo=deno)
![Hono](https://img.shields.io/badge/Hono-v4-blue?logo=hono)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Native-blue)
![Redis](https://img.shields.io/badge/Redis-Caching-red)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)

---

## ✨ Điểm Nổi Bật (Features)

Denolith không chỉ là một bộ khung cơ bản, mà đã được trang bị 9 lớp "vũ khí" tối tân nhất cho các dự án quy mô lớn:

1. **Clean Architecture & Container DI:** Phân tách hoàn toàn các lớp (Routes → Service → Repository), kết hợp Dependency Injection giúp code dễ bảo trì và dễ dàng scale.
2. **Hệ Thống Migration Tự Động:** Quản lý lịch sử thay đổi cấu trúc Database bằng script SQL nguyên thuỷ siêu tốc, không cần các ORM nặng nề.
3. **Bảo Mật Băm Mật Khẩu (Web Crypto):** Băm mật khẩu bằng chuẩn PBKDF2 native của Deno với Salt ngẫu nhiên, miễn nhiễm với hình thức tấn công dò mật khẩu.
4. **Rate Limiting & Graceful Fallback:** Chống Spam/DDoS mạnh mẽ qua Redis. Tự động chuyển lùi về sử dụng Memory Cache cục bộ nếu máy chủ Redis gặp sự cố (Đảm bảo Zero Downtime).
5. **Advanced Authentication:** Cơ chế Refresh Token Rotation. Quản lý Access Token (15 phút) và Refresh Token thông qua `HttpOnly`, `Secure` Cookie để chống hoàn toàn XSS.
6. **Role-Based Access Control (RBAC):** Middleware gác cổng chặt chẽ, chỉ cho phép các Role chỉ định (VD: `ADMIN`) đi qua các API nhạy cảm.
7. **API Caching Siêu Tốc:** Bộ đệm Redis Caching cho các API đọc dữ liệu (`GET`), tăng tốc độ phản hồi xuống dưới 1ms.
8. **Background Job Queue:** Kiến trúc Message Queue tích hợp ngay trên Redis, đưa các tác vụ nặng (như gửi Email) xuống chạy ngầm ở Background Worker không làm block luồng xử lý chính.
9. **CI/CD & Dockerization:** Đã cấu hình sẵn `Dockerfile`, `docker-compose.yml` và Github Actions tự động kiểm duyệt code (`fmt`, `lint`, `type check`, `test`).

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

### Bước 1: Khởi động Database & Redis
Khởi chạy vùng chứa cơ sở dữ liệu ở background:
```bash
docker compose up -d
```

### Bước 2: Cấu hình Môi trường
Sao chép file cấu hình mẫu và đổi tên thành `.env`:
```bash
cp .env.example .env
```
*(Các thông số mặc định trong file `.env.example` đã khớp hoàn toàn với cấu hình Docker mặc định của dự án).*

### Bước 3: Khởi chạy dự án
```bash
# Lệnh này sẽ tự động chạy Migration tạo Table và khởi động Server
deno task dev
```

Server sẽ sẵn sàng phục vụ tại: `http://localhost:3000`

---

## 📜 Danh Sách Lệnh Tiện Ích (Deno Tasks)

| Lệnh | Chức năng |
|------|-----------|
| `deno task dev` | Chạy môi trường phát triển (Tự động Restart khi sửa code) |
| `deno task start` | Chạy Server ở chế độ thông thường (Dùng cho Production) |
| `deno task migrate` | Cập nhật các thay đổi Schema mới nhất vào DB |
| `deno task migrate:down` | Rollback (hoàn tác) file Migration được tạo gần nhất |
| `deno task migrate:reset` | Rollback TOÀN BỘ Database về trạng thái trống trơn |
| `deno task seed` | Chạy dữ liệu mẫu (Seeding) vào Database |
| `deno test -A` | Chạy bộ Unit Tests bảo mật tự động |
| `deno task compile` | Đóng gói toàn bộ Backend thành 1 file nhị phân duy nhất (.exe) |

---

## 🔐 Biến Môi Trường (.env)
Dưới đây là các biến môi trường quan trọng cần cấu hình để ứng dụng vận hành:
- `PORT`: Cổng ứng dụng (Mặc định: 3000)
- `DATABASE_URL`: Chuỗi kết nối tới máy chủ PostgreSQL
- `REDIS_URL`: Chuỗi kết nối Redis (Nếu hệ thống không có Redis, Denolith sẽ tự động chuyển sang dùng RAM cục bộ)
- `JWT_SECRET`: Chuỗi khóa bí mật siêu dài dùng để ký Token xác thực

---
**Được thiết kế cho Tốc độ, Bảo mật và Trải nghiệm Developer tối thượng.**
