# API Specification: Quản Lý Phân Quyền (RBAC + ABAC)

Tài liệu này cung cấp đặc tả chi tiết về các API liên quan đến Hệ thống Phân
Quyền mới (Role Management, Profiles, và Overrides) để đội ngũ Frontend (FE)
tích hợp giao diện Admin.

> [!IMPORTANT]
> **Yêu cầu phân quyền:** Tất cả các endpoint dưới đây đều yêu cầu token của
> User có chứa quyền `permissions.manage` (hoặc User thuộc tier `owner`).

---

> [!TIP]
> **Tóm tắt cốt lõi (Cheat Sheet):**
>
> - **1 User** có **1 Role** cụ thể.
> - **1 Role** thuộc **1 Tier** cố định.
> - Để gán 1 Permission (quyền) cho User, có 2 cách:
>   - **Cách 1:** Gán trực tiếp ngoại lệ (vào bảng `user_permissions`).
>   - **Cách 2:** Thông qua Profile (Gộp nhóm quyền):
>     - 2.1 Tạo gôm nhóm quyền (bảng `permission_profiles`).
>     - 2.2 Gán permissions cho profiles (bảng `profile_permissions`).
>     - 2.3 Gán users vào profiles (bảng `user_profiles`: quan hệ nhiều-nhiều, 1
>       user có thể có nhiều profiles).

## 0. Tổng Quan Kiến Trúc Phân Quyền (RBAC + ABAC)

Hệ thống sử dụng mô hình kết hợp giữa **RBAC (Role-Based Access Control)** và
**ABAC (Attribute-Based Access Control)** để đảm bảo tính linh hoạt và dễ mở
rộng. Frontend (FE) cần hiểu rõ các khái niệm này để thiết kế UI phù hợp.

### Các Khái Niệm Cốt Lõi

1. **Tiers (Nhóm Hành Vi Gốc - Hardcoded)**
   - Không thể quản lý qua giao diện. Được gắn cố định vào source code và JWT
     Payload để kiểm tra nhanh.
   - Gồm 3 Tiers:
     - `owner`: Bypass mọi quyền (luôn trả về true). Không ai có thể tạo mới
       tier này.
     - `admin`: Tier quản lý, thường dùng cho giao diện Back-Office / Admin.
     - `user`: Tier khách hàng / người dùng cuối.

2. **Roles (Danh Xưng - RBAC)**
   - Được tạo động tại runtime qua API bảng `roles` (VD: "sales_manager",
     "accountant").
   - Mỗi Role phải thuộc về 1 Tier (admin hoặc user).
   - _Mục đích:_ Dùng để gán danh xưng cho người dùng. 1 người dùng chỉ có **1
     Role duy nhất** tại 1 thời điểm.

3. **Permission Profiles (Bộ Quyền - ABAC)**
   - Được tạo động tại runtime (VD: "Bộ quyền Xem Báo Cáo", "Bộ quyền Quản lý
     Khách Hàng").
   - Mỗi Profile chứa nhiều **Quyền Nguyên Tử (Atomic Permissions)** (VD:
     `reports.view`, `users.write`).
   - 1 người dùng có thể được gán **Nhiều Profiles**. Hệ thống sẽ cộng gộp tất
     cả quyền từ các profile lại.

4. **Overrides (Quyền Ngoại Lệ - ABAC)**
   - Ghi đè trực tiếp 1 quyền nguyên tử cho 1 người dùng cụ thể.
   - Mức độ ưu tiên cao nhất: Bất chấp các Profiles quy định ra sao, Override sẽ
     quyết định kết quả cuối cùng (`granted = true` hoặc `false`).

### Trình Tự Đánh Giá Quyền (Permission Evaluation Logic)

Khi user thực hiện 1 hành động yêu cầu quyền `users.delete`, Backend sẽ kiểm tra
theo thứ tự:

1. User có thuộc tier `owner`? → **Cho qua (Bypass).**
2. Có Override cá nhân cho `users.delete` không? → Nếu có, trả về kết quả của
   Override.
3. Trong tất cả Profiles của User, có Profile nào được cấp `users.delete` không?
   → Nếu có, **Cho qua**.
4. Mặc định → **Từ chối (403 Forbidden).**

---

## 1. Quản Lý Roles (Danh xưng / Vai trò)

Role đại diện cho danh xưng của user (VD: Quản trị viên, Nhân viên Sale, Kế
toán). Mỗi role được gán vào 1 **Tier** cố định (`admin` hoặc `user`) để xác
định hành vi gốc.

### 1.1 Lấy danh sách Roles

- **Endpoint:** `GET /api/roles`
- **Query:** `?page=1&limit=20` (Phân trang)
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "code": "admin",
        "tier": "admin",
        "name": "Quản Trị Viên",
        "description": "Quản trị toàn quyền",
        "system": true,
        "active": true,
        "created_at": "2026-05-07T00:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
  ```

### 1.2 Xem chi tiết 1 Role

- **Endpoint:** `GET /api/roles/:code`
- **Response:** Trả về Object Role chi tiết ở field `data`.

### 1.3 Tạo mới Role

- **Endpoint:** `POST /api/roles`
- **Body:**
  ```json
  {
    "code": "sales_manager",
    "tier": "admin", // Chỉ cho phép "admin" hoặc "user"
    "name": "Trưởng Phòng Sale",
    "description": "Quản lý phòng kinh doanh" // Optional
  }
  ```
  _(Lưu ý: `code` là duy nhất, độ dài 3-50 ký tự, chỉ chứa chữ thường, số và dấu
  gạch dưới)._

### 1.4 Cập nhật Role

- **Endpoint:** `PATCH /api/roles/:code`
- **Body:** (Partial update - truyền field nào sửa field đó)
  ```json
  {
    "name": "Tên mới",
    "description": "Mô tả mới",
    "active": false
  }
  ```
  _(Lưu ý: Các system role - `system: true` - không được phép cập nhật. Không
  cho phép sửa `code` hay `tier`)._

### 1.5 Xóa Role

- **Endpoint:** `DELETE /api/roles/:code`
- **Lưu ý:** Không thể xóa system roles hoặc roles đang được gán cho user. FE
  nên báo lỗi "Role đang được sử dụng" nếu nhận về mã lỗi `409 Conflict`.

---

## 2. Gán Role Cho Người Dùng (Thăng/Hạ Cấp)

Sử dụng endpoint chuyên biệt để đổi Role, tránh gộp chung vào API cập nhật user
thông thường.

### 2.1 Đổi Role của User

- **Endpoint:** `PATCH /api/users/:id/role`
- **Body:**
  ```json
  {
    "role": "sales_manager" // Phải là 1 role code tồn tại trong bảng roles
  }
  ```
- **Response:** Trả về Object User mới đã cập nhật. (Token của user sẽ tự động
  nhận tier mới trong lần đăng nhập sau).

---

## 3. Permission Profiles (Nhóm Quyền Tùy Chỉnh)

Profile là tập hợp nhiều quyền nhỏ. Dùng để gán hàng loạt quyền cho user.

### 3.1 CRUD Profiles

- **Danh sách:** `GET /api/permissions/profiles?page=1&limit=20&tier=admin` (Hỗ
  trợ lọc theo `tier`).
- **Tạo mới:** `POST /api/permissions/profiles`
  - Body: `{ "name": "Tên Profile", "tier": "admin", "description": "Mô tả" }`
- **Chi tiết:** `GET /api/permissions/profiles/:id` (Sẽ trả về thêm mảng
  `permissions` chứa các mã quyền hiện có của profile này).
- **Cập nhật:** `PATCH /api/permissions/profiles/:id`
  - Body: `{ "name": "Mới", "description": "Mới", "active": true }`
- **Xóa:** `DELETE /api/permissions/profiles/:id`

### 3.2 Lấy Danh sách Toàn Bộ Mã Quyền (Atomic Codes)

Hiển thị để Admin biết có những quyền nguyên tử nào có thể check/uncheck.

- **Endpoint:** `GET /api/permissions/codes`
- **Response:** Trả về danh sách object chứa `code` (VD: `users.read`) và
  `description`.

### 3.3 Cấu Hình Quyền Cho Profile (Check/Uncheck Quyền)

- **Cấp / Chặn quyền:** `PUT /api/permissions/profiles/:id/codes/:code`
  - Body: `{ "granted": true }` (truyền false nếu muốn explicit deny).
- **Xóa quyền khỏi Profile:** `DELETE /api/permissions/profiles/:id/codes/:code`
  (Profile sẽ trở về trạng thái không quan tâm đến quyền này).

---

## 4. Phân Quyền Cá Nhân (User Assignment & Override)

### 4.1 Gán/Thu hồi Profile Cho User

- **Xem danh sách Profile của User:**
  `GET /api/permissions/users/:userId/profiles`
- **Gán Profile mới:** `POST /api/permissions/users/:userId/profiles`
  - Body: `{ "profileId": "uuid-cua-profile" }`
- **Thu hồi Profile:**
  `DELETE /api/permissions/users/:userId/profiles/:profileId`

### 4.2 Gán Override Cho User (Quyền Ngoại Lệ)

Nếu User thuộc Profile A (bị cấm `reports.export`), nhưng Admin muốn đặc cách
riêng cho User này được export:

- **Xem danh sách Override của User:**
  `GET /api/permissions/users/:userId/overrides`
- **Cấp/Chặn quyền riêng lẻ:**
  `PUT /api/permissions/users/:userId/overrides/:code`
  - Body: `{ "granted": true }` (Ưu tiên cao nhất, đè lên mọi Profile).
- **Xóa Override (Trở về theo Profile):**
  `DELETE /api/permissions/users/:userId/overrides/:code`

---

## 5. Các Quy Trình Nghiệp Vụ Điển Hình (Workflows)

### 5.1 Quy trình Tạo và Gán Role cho User

1. **Xem danh sách Role hiện tại:**
   - Admin vào màn hình Quản lý Roles.
   - FE gọi `GET /api/roles` để hiển thị danh sách Role.
2. **Tạo Role mới (Nếu role cần thiết chưa tồn tại):**
   - Admin bấm "Tạo Role", nhập thông tin: Mã Role (`sales_intern`), Tên
     (`Thực tập sinh Sale`), Tier (`user`).
   - FE gọi `POST /api/roles`.
3. **Gán Role cho người dùng cụ thể:**
   - Admin vào màn hình Danh sách User, mở chi tiết user "Nguyễn Văn A".
   - (FE gọi `GET /api/roles` để lấy list roles đổ vào Dropdown chọn Role).
   - Admin chọn role `Thực tập sinh Sale` từ Dropdown và lưu lại.
   - FE gọi `PATCH /api/users/:id/role` với body `{ "role": "sales_intern" }`.
   - **Kết quả:** User "Nguyễn Văn A" chính thức mang danh xưng "Thực tập sinh
     Sale", và hành vi gốc bị giới hạn ở Tier `user` (Tier thấp nhất).

### 5.2 Quy trình Tạo Bộ Quyền (Profile) và Phân Quyền Chi Tiết

1. **Tạo Profile:**
   - Admin vào màn hình Quản lý Profiles.
   - FE gọi `POST /api/permissions/profiles` để tạo profile "Sale Khu Vực Miền
     Nam".
2. **Cấu hình Quyền cho Profile đó:**
   - FE gọi `GET /api/permissions/codes` để lấy danh sách tất cả các quyền hệ
     thống có sẵn (VD: `users.read`, `reports.export`).
   - Màn hình chi tiết Profile hiển thị danh sách các quyền dạng
     Checkbox/Toggle.
   - Admin gạt bật quyền `users.read` (Xem danh sách khách hàng).
   - FE gọi `PUT /api/permissions/profiles/:id/codes/users.read` với
     `{ "granted": true }`.
3. **Áp dụng Profile cho User:**
   - Admin mở lại chi tiết user "Nguyễn Văn A", chuyển sang tab "Cấu hình Phân
     Quyền".
   - Trực tiếp gán profile này cho user. FE gọi
     `POST /api/permissions/users/:userId/profiles` với `profileId` tương ứng.
   - **Kết quả:** Mặc dù user "Nguyễn Văn A" thuộc Tier `user` (mặc định bị cấm
     mọi thứ), nhưng nhờ được gán Profile "Sale Khu Vực Miền Nam", user này được
     phép thực hiện các hành động yêu cầu quyền `users.read`.

### 5.3 Quy trình Phân Quyền Ngoại Lệ (Override Cá Nhân)

Hệ thống xử lý quyền theo **2 luồng song song**: Luồng đại trà (thông qua
Profile) và Luồng cá nhân (thông qua Override). **Luồng cá nhân luôn có độ ưu
tiên cao nhất.**

1. **Ví dụ thực tế:** "Nguyễn Văn A" đang có Profile "Sale Khu Vực Miền Nam"
   (được phép `reports.export`). Nhưng vì A đang bị kỷ luật, Admin muốn tạm thời
   cấm A xuất báo cáo mà không làm ảnh hưởng đến các nhân viên Sale khác.
2. **Cấp Override (Ngoại lệ):**
   - Admin vào chi tiết user "Nguyễn Văn A", sang tab Phân Quyền -> sub-tab
     Overrides.
   - FE gọi `GET /api/permissions/codes` để lấy danh sách mã quyền.
   - Admin chọn quyền `reports.export` và thiết lập trạng thái là `Chặn` (Cấm).
   - FE gọi `PUT /api/permissions/users/:userId/overrides/reports.export` với
     `{ "granted": false }`.
3. **Kết quả đánh giá quyền của Backend (Sự va chạm 2 luồng):**
   - Luồng Profile nói: _"Cho phép xuất báo cáo"_.
   - Luồng Override nói: _"Cấm xuất báo cáo"_.
   - **Trọng tài (Backend) xử:** Luồng Override thắng. A sẽ bị lỗi 403 Forbidden
     khi cố gọi API xuất báo cáo.

---

> [!TIP]
> **Tóm tắt về giao diện Admin UI nên thiết kế:**
>
> 1. Màn hình **Quản lý Roles:** Liệt kê và tạo/sửa/xóa danh xưng.
> 2. Màn hình **Quản lý Profiles:** Liệt kê và tạo/sửa/xóa bộ quyền (Cấu hình
>    check/uncheck quyền nằm trong màn chi tiết profile).
> 3. Màn hình **Chi tiết User:**
>    - Có Dropdown để **Đổi Role**.
>    - Có tab **Phân quyền** chứa 2 sub-tab:
>      - _Profiles:_ Hiển thị danh sách Profiles đang gán cho user (cho phép
>        thêm/bớt).
>      - _Overrides:_ Hiển thị danh sách quyền ngoại lệ cấp thẳng cho user (cho
>        phép thêm/bớt).
