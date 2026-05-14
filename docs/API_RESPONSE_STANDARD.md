# Tiêu Chuẩn Giao Tiếp API Dành Cho Frontend (FE)

Tài liệu này định nghĩa cấu trúc chuẩn duy nhất cho mọi HTTP Response trả về từ
hệ thống API Denolith. Frontend (FE) chỉ cần căn cứ vào các interface dưới đây
để bóc tách dữ liệu và xử lý lỗi một cách đồng nhất.

---

## 1. Cấu Trúc Trả Về Chung (The Generic Response Wrapper)

Tất cả các API (trừ những API trả về `204 No Content` hoặc file tĩnh) đều trả về
một đối tượng JSON với cấu trúc TypeScript như sau:

```typescript
export interface ApiResponse<T = any> {
  // Flag xác định trạng thái API (Luôn có)
  // - true: Thành công (HTTP Status 2xx)
  // - false: Thất bại (HTTP Status 4xx, 5xx)
  success: boolean;

  // Dữ liệu payload chính. Kiểu dữ liệu phụ thuộc vào từng API.
  // Có thể là Object (nếu get detail), Array (nếu get list), hoặc rỗng.
  data?: T;

  // Dữ liệu phân trang. Chỉ xuất hiện ở các API dạng List (Danh sách).
  meta?: PaginationMeta;

  // Thông báo trả về từ server (Có thể show Toast/Snackbar cho user)
  message?: string;

  // Chi tiết lỗi (Chỉ xuất hiện khi success = false)
  // Dùng để map lỗi vào các UI Field tương ứng (ví dụ: lỗi form validation)
  errors?: any;
}

export interface PaginationMeta {
  total: number; // Tổng số lượng bản ghi thỏa điều kiện
  page: number; // Trang hiện tại
  limit: number; // Số lượng bản ghi tối đa trên mỗi trang
  totalPages: number; // Tổng số trang
}
```

---

## 2. Các Trường Hợp Thực Tế (Use Cases)

### 2.1. Lấy chi tiết, Cập nhật, hoặc Tạo mới thành công (HTTP 200 / 201)

Thường áp dụng cho: `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` (Soft
Delete).

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Cửa hàng Quận 1",
    "status": "active"
  },
  "message": "Resource created successfully" // (Có thể không có)
}
```

### 2.2. Lấy Danh Sách Có Phân Trang (HTTP 200)

Thường áp dụng cho: `GET /` (có query `?page=1&limit=20&search=...`).

**Response:**

```json
{
  "success": true,
  "data": [
    { "id": "uuid-1", "name": "Item 1" },
    { "id": "uuid-2", "name": "Item 2" }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### 2.3. Xóa Vĩnh Viễn (Hard Delete) (HTTP 204 No Content)

Thường áp dụng cho: `DELETE /:id?force=true`.

**Response:** _Không có Body. HTTP Status Code là 204._ FE chỉ cần check HTTP
Status `204` để biết là xóa cứng thành công.

---

### 2.4. Trả Về Lỗi (HTTP 400, 401, 403, 404, 500)

Mọi lỗi xuất phát từ hệ thống đều có `success: false` kèm theo mã HTTP tương
ứng.

**Ví dụ Lỗi Logic (400 Bad Request, 404 Not Found):**

```json
{
  "success": false,
  "message": "Store with id xxx not found"
}
```

**Ví dụ Lỗi Validation (400 Bad Request từ Valibot):** Hệ thống sẽ bóc tách lỗi
đầu tiên và đưa vào `message`.

```json
{
  "success": false,
  "message": "Invalid email format."
}
```

_(Trong các trường hợp phức tạp, backend có thể trả thêm trường `errors` chứa
chi tiết từng field để FE map vào Form)._

---

## 3. Gợi ý cho Frontend (Axios Interceptor Example)

FE nên cài đặt một Interceptor (nếu dùng Axios) hoặc wrapper (nếu dùng Fetch) để
xử lý gọn nhẹ cấu trúc này:

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:9999/v1",
});

// Xử lý chung Response
api.interceptors.response.use(
  (response) => {
    // Nếu là 204 No Content
    if (response.status === 204) return true;

    // Bóc tách thẳng data từ vỏ bọc ApiResponse
    const resData = response.data;

    // Nếu API thành công, có thể hiển thị Toast success nếu có message
    if (resData.message) {
      toast.success(resData.message);
    }

    // Trả về thẳng ruột bên trong để component đỡ phải gọi res.data.data
    return {
      data: resData.data,
      meta: resData.meta,
    };
  },
  (error) => {
    // Server có trả về chuẩn ApiResponse dạng lỗi
    if (error.response && error.response.data) {
      const errData = error.response.data;
      toast.error(errData.message || "Có lỗi xảy ra!");
      return Promise.reject(errData);
    }

    // Lỗi mạng hoặc server sập
    toast.error("Không thể kết nối đến máy chủ");
    return Promise.reject(error);
  },
);

// Cách dùng ở Component:
// const { data, meta } = await api.get('/stores?page=1');
// setStores(data);
// setTotalPages(meta.totalPages);
```

### Kết luận

- **Luôn kiểm tra HTTP Status** (Axios tự ném lỗi nếu >= 400).
- **Khi Status 2xx**: Data bạn cần luôn nằm ở `response.data.data`.
- **Phân trang**: Luôn nằm ở `response.data.meta`.
- **Báo lỗi UI**: Luôn lấy từ `error.response.data.message`.
