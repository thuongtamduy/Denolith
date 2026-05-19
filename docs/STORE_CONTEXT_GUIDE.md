# Hướng Dẫn Tích Hợp Multi-Store Context (Dành Cho Frontend)

Tài liệu này mô tả chi tiết cơ chế bảo mật và luồng truy cập API trong kiến trúc
đa cửa hàng (Multi-Store) của hệ thống Denolith. Bắt buộc Frontend phải tuân thủ
để tránh các lỗi `403 Forbidden`.

## 1. Cơ chế phân loại User (Owner vs Non-Owner)

Hệ thống phân quyền dựa trên `tier` của Role. Hiện tại được chia làm 2 luồng
chính:

- **Owner (`tier: "owner"`)**: Người dùng toàn quyền hệ thống. Không bị giới hạn
  bởi một cửa hàng cụ thể.
- **Non-Owner (`tier: "admin", "user", ...`)**: Nhân viên hoặc quản lý chi
  nhánh. **BẮT BUỘC** phải được gán vào ít nhất 1 cửa hàng (Store) để có thể
  thao tác.

---

## 2. Luồng Đăng nhập & Chọn Cửa Hàng

### Bước 2.1: Đăng nhập & Lấy thông tin cá nhân

Sau khi gọi API Login thành công và có được `Bearer Token`, Frontend lập tức gọi
API lấy thông tin người dùng:

```http
GET /v1/users/me
Authorization: Bearer <token>
```

**Các trường hợp xảy ra:**

1. **Thành công**: Trả về thông tin user kèm theo mảng `userStores` (danh sách
   các cửa hàng mà user này đang làm việc).
2. **Thất bại (Lỗi 403)**: Nếu user là **Non-Owner** nhưng mảng `userStores` bị
   rỗng (tức là chưa được quản trị viên gán vào bất kỳ cửa hàng nào), hệ thống
   sẽ chủ động ném lỗi:
   > _"You have not been assigned to any store yet. Please contact your
   > administrator."_

   👉 **Hành động của FE**: Bắt lỗi này, hiển thị màn hình thông báo _"Bạn chưa
   được cấp quyền vào cửa hàng nào, vui lòng liên hệ admin"_ và có thể tự động
   Logout user.

### Bước 2.2: Chọn Cửa Hàng (Store Context)

Từ dữ liệu `userStores` lấy được ở Bước 2.1:

- Nếu user thuộc nhiều cửa hàng: Frontend cần hiển thị giao diện UI để user
  **chọn 1 cửa hàng** làm bối cảnh làm việc hiện tại (Current Store).
- Nếu user chỉ thuộc 1 cửa hàng: Frontend có thể tự động chọn luôn cửa hàng đó.
- Nếu là **Owner**: Có thể chọn một cửa hàng bất kỳ để xem dữ liệu, hoặc không
  chọn gì (quản lý tổng).

Sau khi có được ID của cửa hàng được chọn (chính là `storeId`), Frontend cần lưu
giá trị này vào Store/State (ví dụ: Redux, Zustand) hoặc LocalStorage.

---

## 3. Gọi các API Nghiệp Vụ (Yêu Cầu `x-api-key`)

Đối với tất cả các API nghiệp vụ khác trên hệ thống (ví dụ: Tạo đơn hàng, Lấy
danh sách sản phẩm, v.v.), hệ thống yêu cầu bối cảnh cửa hàng rõ ràng.

**Quy tắc:** Frontend **BẮT BUỘC** phải đính kèm header `x-api-key` (với giá trị
là `storeId` đang chọn) vào mọi HTTP Request.

```http
GET /v1/some-endpoint
Authorization: Bearer <token>
x-api-key: <storeId>
```

### Xử lý lỗi nếu thiếu `x-api-key`

Nếu một user **Non-Owner** gọi API mà Frontend quên đính kèm header `x-api-key`,
hệ thống sẽ chặn ngay lập tức tại Middleware và trả về lỗi:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Header 'x-api-key' (Store ID) is required to perform this action."
  }
}
```

### Các API Ngoại lệ (Không bắt buộc `x-api-key`)

Các API hệ thống sau đây được cấu hình bỏ qua bước kiểm tra Store Context (vì
lúc này user chưa có hoặc đang xóa context):

- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `POST /v1/auth/refresh`
- `GET /v1/users/me`

### Đặc quyền của Owner

Nếu tài khoản đang đăng nhập là **Owner**, middleware sẽ tự động bỏ qua luật ép
buộc header này. Owner có thể tùy ý truyền hoặc không truyền `x-api-key`. (Khi
không truyền, thao tác sẽ được hiểu là áp dụng cho cấu hình chung của toàn hệ
thống nếu API có hỗ trợ).

---

## 4. Tổng Kết Check-List Cho Frontend

- [ ] Bắt lỗi `403` ở api `/me` để xử lý case nhân viên chưa có cửa hàng.
- [ ] Thiết kế UI cho phép nhân viên chọn "Cửa hàng đang làm việc" sau khi đăng
      nhập.
- [ ] Cấu hình Axios / Fetch Interceptor để tự động nhúng header
      `x-api-key: <current_store_id>` vào mọi request.
- [ ] Khi nhân viên bấm "Đổi cửa hàng" trên UI, chỉ cần cập nhật lại biến
      `current_store_id` dùng cho Interceptor là xong.
