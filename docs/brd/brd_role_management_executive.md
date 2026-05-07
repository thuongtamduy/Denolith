# Tài Liệu Yêu Cầu Nghiệp Vụ (BRD)

## Hệ Thống Quản Lý Phân Quyền Nhân Sự Tập Trung

| Thông tin dự án |                                |
| --------------- | ------------------------------ |
| **Tên dự án**   | Denolith — Hệ thống Phân Quyền |
| **Phiên bản**   | 1.0                            |
| **Ngày tạo**    | 07/05/2026                     |
| **Trạng thái**  | ✅ Sẵn sàng triển khai         |
| **Phân loại**   | Tài liệu nội bộ — Mật          |

---

## 1. Mục Tiêu Dự Án

### 1.1 Bối Cảnh & Vấn Đề Cần Giải Quyết

Trong các tổ chức có quy mô phát triển, việc quản lý quyền truy cập hệ thống
theo cách thủ công (chỉnh sửa trực tiếp trong code hoặc cơ sở dữ liệu) gây ra
nhiều rủi ro nghiêm trọng:

- **Rủi ro bảo mật:** Nhân viên nghỉ việc hoặc chuyển bộ phận vẫn giữ quyền truy
  cập cũ, dẫn đến nguy cơ rò rỉ dữ liệu.
- **Thiếu linh hoạt:** Mỗi thay đổi quyền nhỏ đều yêu cầu can thiệp kỹ thuật,
  gây chậm trễ vận hành.
- **Không có truy vết:** Không thể xác định ai đã thay đổi quyền của ai, vào lúc
  nào — vi phạm các tiêu chuẩn kiểm toán nội bộ.
- **Thiếu nhất quán:** Quyền được gán rải rác, không theo chuẩn, khó kiểm soát
  khi tổ chức mở rộng.

### 1.2 Mục Tiêu Chiến Lược

Hệ thống phân quyền được xây dựng nhằm:

1. **Trao quyền tự quản cho Admin:** Quản trị viên có thể tạo, sửa, gán và thu
   hồi quyền trực tiếp trên giao diện — không cần sự hỗ trợ của đội ngũ kỹ
   thuật.
2. **Đảm bảo tuân thủ nguyên tắc Tối Thiểu Quyền Hạn (Least Privilege):** Mỗi
   nhân sự chỉ được cấp đúng những quyền cần thiết cho công việc của họ.
3. **Giảm rủi ro bảo mật:** Quyền có thể được thu hồi tức thời, áp dụng ngay lập
   tức mà không cần khởi động lại hệ thống.
4. **Đáp ứng yêu cầu kiểm toán:** Mọi thay đổi về quyền được ghi nhận tự động
   vào nhật ký kiểm toán (Audit Log) với đầy đủ thông tin: ai thực hiện, thay
   đổi gì, khi nào.

---

## 2. Đối Tượng Sử Dụng

| Nhóm người dùng               | Vai trò                | Quyền hạn chính                                                           |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| **System Owner**              | Chủ sở hữu hệ thống    | Toàn quyền tuyệt đối. Không bị giới hạn bởi bất kỳ cơ chế nào.            |
| **Administrator**             | Quản trị viên hệ thống | Tạo Roles, cấu hình Profiles, gán/thu hồi quyền cho nhân sự.              |
| **Nhân viên Back-Office**     | Nhân sự các phòng ban  | Sử dụng các chức năng được cấp phép. Không tự quản lý quyền của bản thân. |
| **Nhân viên Sale / Vận hành** | Người dùng cuối        | Truy cập hệ thống theo đúng phạm vi công việc được giao.                  |

---

## 3. Phạm Vi Chức Năng

Hệ thống cung cấp **3 nhóm chức năng** chính:

### 3.1 Quản Lý Vai Trò (Role Management)

> Trả lời câu hỏi: _"Người này là ai trong tổ chức?"_

| Chức năng       | Mô tả                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Xem danh sách   | Hiển thị toàn bộ vai trò đang tồn tại trong hệ thống, phân trang, sắp xếp.                        |
| Tạo vai trò mới | Admin tự định nghĩa vai trò mới phù hợp với cơ cấu tổ chức (VD: Trưởng Phòng, Kế Toán Trưởng...). |
| Sửa thông tin   | Cập nhật tên hiển thị, mô tả, hoặc vô hiệu hóa vai trò tạm thời.                                  |
| Xóa vai trò     | Xóa vai trò khi không còn phù hợp. Hệ thống từ chối nếu vai trò đang được gán cho nhân sự.        |
| Gán cho nhân sự | Admin chọn vai trò phù hợp cho từng nhân sự. Mỗi nhân sự có đúng 1 vai trò tại 1 thời điểm.       |

**Ràng buộc quan trọng:** Các vai trò hệ thống gốc (`System Owner`,
`Administrator`, `Standard User`) được bảo vệ — không thể xóa hoặc sửa cấu trúc.

### 3.2 Quản Lý Bộ Quyền (Permission Profile Management)

> Trả lời câu hỏi: _"Người này được làm gì?"_

Bộ Quyền (Profile) là một tập hợp các quyền nguyên tử được đặt tên và tái sử
dụng. Ví dụ: "Bộ quyền Nhân viên Sale Khu Vực Miền Nam" có thể bao gồm quyền
_Xem danh sách khách hàng_ và _Xem báo cáo doanh số_.

| Chức năng               | Mô tả                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Tạo Bộ Quyền            | Admin đặt tên và định nghĩa một tập hợp quyền mới, phù hợp với 1 nhóm chức năng cụ thể.           |
| Cấu hình quyền          | Bật/tắt từng quyền nguyên tử trong Profile (VD: bật `Xem báo cáo`, tắt `Xuất báo cáo`).           |
| Gán Profile cho nhân sự | Một nhân sự có thể được gán nhiều Profiles. Quyền sẽ được cộng gộp (Union) từ tất cả Profiles.    |
| Thu hồi Profile         | Xóa Profile khỏi nhân sự khi họ chuyển bộ phận hoặc thay đổi phạm vi công việc. Hiệu lực tức thì. |

### 3.3 Phân Quyền Ngoại Lệ (Override)

> Trả lời câu hỏi: _"Người này có trường hợp đặc biệt nào không?"_

Override cho phép Admin cấp thêm hoặc thu hồi 1 quyền cụ thể của đúng 1 nhân sự
— mà không ảnh hưởng đến bất kỳ ai khác, kể cả những người cùng Profile.

| Tình huống                 | Giải pháp                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Nhân viên bị kỷ luật       | Thu hồi quyền xuất báo cáo chỉ riêng nhân viên đó bằng Override `granted = false`.    |
| Nhân viên được đặc cách    | Cấp thêm 1 quyền ngoài Profile cho nhân viên xuất sắc bằng Override `granted = true`. |
| Hết kỷ luật / Hết đặc cách | Xóa Override — nhân sự tự động trở về quyền theo Profile.                             |

---

## 4. Sơ Đồ Luồng Nghiệp Vụ (User Flow)

### 4.1 Luồng Tổng Quát: Onboarding Nhân Sự Mới

Mô tả quy trình Admin cấp quyền đầy đủ cho một nhân viên mới gia nhập:

```
BƯỚC 1 — Xác nhận vai trò tổ chức
  └─► Admin xác định nhân sự mới thuộc bộ phận nào
      (VD: Nhân viên Sale, Khu vực Miền Nam)

BƯỚC 2 — Gán Vai Trò (Role)
  └─► Admin vào màn hình Chi tiết Nhân sự
      └─► Chọn Vai trò phù hợp từ danh sách (VD: "Sales Representative")
          └─► Lưu → Hệ thống cập nhật danh xưng cho nhân sự

BƯỚC 3 — Gán Bộ Quyền (Profile)
  └─► Admin mở tab "Phân Quyền" của nhân sự đó
      └─► Tìm và chọn Profile phù hợp (VD: "Sales Representative Profile")
          └─► Xác nhận → Hệ thống cấp ngay lập tức toàn bộ quyền trong Profile

BƯỚC 4 — Kiểm tra & Điều chỉnh (Tùy chọn)
  └─► Nếu nhân sự cần thêm 1 quyền đặc biệt ngoài Profile
      └─► Thêm Override cụ thể (VD: cho phép "Xem báo cáo nội bộ")
  └─► Nếu nhân sự có giới hạn đặc biệt
      └─► Thêm Override từ chối (VD: cấm "Xuất dữ liệu")

KẾT QUẢ
  └─► Nhân sự đăng nhập và sử dụng đúng các chức năng được phép
      Toàn bộ quá trình được ghi nhận trong Audit Log
```

### 4.2 Luồng Chi Tiết: Xử Lý Quyền Đặc Cách (Override)

```
Tình huống: Nhân viên A (thuộc Profile "Sale Miền Nam") bị kỷ luật.
Admin muốn tạm thời cấm A xuất báo cáo — không ảnh hưởng ai khác.

Admin mở trang Chi tiết Nhân viên A
  └─► Tab "Phân Quyền" → Sub-tab "Ngoại Lệ (Override)"
      └─► Thêm Override: Quyền "Xuất báo cáo" → Trạng thái: Từ chối ❌
          └─► Lưu → Hiệu lực ngay lập tức

Nhân viên A cố gắng xuất báo cáo
  └─► Hệ thống kiểm tra:
      ├─ Profile "Sale Miền Nam": Cho phép ✅
      └─ Override cá nhân A: Từ chối ❌ ← THẮNG (ưu tiên cao nhất)
          └─► Trả về lỗi 403 Forbidden

Sau khi kỷ luật kết thúc:
  Admin xóa Override → A tự động khôi phục quyền theo Profile
```

---

## 5. Quy Tắc Nghiệp Vụ (Business Rules)

### 5.1 Nguyên Tắc Đánh Giá Quyền (Priority Chain)

Khi nhân sự thực hiện một hành động bất kỳ, hệ thống đánh giá quyền theo thứ tự
ưu tiên sau:

```
┌────────────────────────────────────────────────────────────────┐
│              TRÌNH TỰ KIỂM TRA QUYỀN CỦA HỆ THỐNG             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. System Owner?  ──────────────────────────► ✅ LUÔN CHO QUA │
│                                                                │
│  2. Có Override cá nhân?                                       │
│     ├─ granted = false  ──────────────────────► ❌ TỪ CHỐI    │
│     └─ granted = true   ──────────────────────► ✅ CHO QUA    │
│                                                                │
│  3. Có Profile nào cấp quyền này không?  ─────► ✅ CHO QUA    │
│                                                                │
│  4. Không có gì  ─────────────────────────────► ❌ TỪ CHỐI   │
│                              (Deny-by-Default)                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Các Quy Tắc Bất Biến

| STT | Quy tắc                                                                                           |
| --- | ------------------------------------------------------------------------------------------------- |
| BR1 | Mỗi nhân sự **chỉ có đúng 1 Vai Trò** tại một thời điểm.                                          |
| BR2 | Một nhân sự **có thể được gán nhiều Bộ Quyền**. Quyền được cộng gộp (Union) từ tất cả.            |
| BR3 | Override cá nhân **luôn ưu tiên cao hơn** quyền từ Bộ Quyền, dù Bộ Quyền quy định thế nào.        |
| BR4 | Thay đổi Bộ Quyền hoặc Override **có hiệu lực ngay lập tức** — không cần đăng xuất/đăng nhập lại. |
| BR5 | Thay đổi **Vai Trò** (Role) chỉ có hiệu lực sau khi nhân sự **đăng nhập lại** lần tiếp theo.      |
| BR6 | Các vai trò hệ thống gốc **không thể xóa hoặc sửa** cấu trúc.                                     |
| BR7 | Không thể xóa Vai Trò đang **còn người dùng đang được gán**.                                      |
| BR8 | Bộ Quyền của Tầng `Admin` **chỉ gán được** cho nhân sự có Vai Trò thuộc Tầng `Admin`.             |
| BR9 | Mọi hành động thay đổi quyền **đều được ghi vào Nhật Ký Kiểm Toán** tự động, không thể tắt.       |

### 5.3 Mô Hình Tầng (Tier) — Không Thay Đổi Được

Hệ thống có 3 Tầng cố định được xác định ngay trong lõi hệ thống:

| Tầng    | Mô tả                                             | Ghi chú                    |
| ------- | ------------------------------------------------- | -------------------------- |
| `owner` | Chủ sở hữu — bypass tuyệt đối mọi kiểm tra        | Chỉ 1 tài khoản duy nhất   |
| `admin` | Quản trị — sử dụng Back-Office, quản lý hệ thống  | Có thể tạo nhiều tài khoản |
| `user`  | Người dùng cuối — phạm vi giới hạn theo nghiệp vụ | Đại đa số nhân sự          |

---

## 6. Yêu Cầu Về Kiểm Toán & Truy Vết (Audit Log)

### 6.1 Mục Đích

Hệ thống Nhật Ký Kiểm Toán đảm bảo tính **minh bạch và trách nhiệm giải trình**
trong quản trị quyền hạn — đặc biệt quan trọng khi xảy ra sự cố bảo mật hoặc
khiếu nại nội bộ.

### 6.2 Các Hành Động Được Ghi Nhận Tự Động

| Hành động               | Thông tin được ghi nhận                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Tạo Vai Trò mới         | Người tạo, tên vai trò, tier, thời điểm                                              |
| Sửa thông tin Vai Trò   | Người sửa, trước/sau khi thay đổi, thời điểm                                         |
| Xóa Vai Trò             | Người xóa, vai trò bị xóa, thời điểm                                                 |
| Gán Vai Trò cho nhân sự | Người thực hiện, nhân sự được gán, vai trò mới, thời điểm                            |
| Tạo Bộ Quyền            | Người tạo, tên bộ quyền, danh sách quyền ban đầu, thời điểm                          |
| Gán Bộ Quyền            | Người thực hiện, nhân sự nhận, bộ quyền được gán, thời điểm                          |
| Thu hồi Bộ Quyền        | Người thực hiện, nhân sự bị thu hồi, bộ quyền bị gỡ, thời điểm                       |
| Thêm Override           | Người thực hiện, nhân sự được/bị áp dụng, mã quyền, trạng thái (cấp/chặn), thời điểm |
| Xóa Override            | Người thực hiện, nhân sự, mã quyền được gỡ, thời điểm                                |

### 6.3 Đặc Điểm Kỹ Thuật

- **Ghi bất đồng bộ:** Nhật ký được ghi ngầm qua hàng đợi xử lý (Queue), không
  làm chậm thao tác của người dùng.
- **Không thể chỉnh sửa:** Audit Log chỉ được ghi thêm (append-only). Không có
  API nào cho phép xóa hoặc sửa log.
- **Lưu trữ đầy đủ:** Mỗi bản ghi bao gồm: ID người thực hiện, loại hành động,
  đối tượng bị tác động, dữ liệu chi tiết (JSON), thời điểm (UTC).

---

## 7. Kế Hoạch Triển Khai & Tích Hợp

### 7.1 Trạng Thái Hiện Tại

| Hạng mục                      | Trạng thái      |
| ----------------------------- | --------------- |
| Backend API                   | ✅ Hoàn thành   |
| Cơ sở dữ liệu & Migration     | ✅ Hoàn thành   |
| Bảo mật & Middleware          | ✅ Hoàn thành   |
| Kiểm thử API (Postman)        | ✅ Sẵn sàng     |
| Dữ liệu mẫu (Seed)            | ✅ Hoàn thành   |
| Giao diện quản trị (Frontend) | ⏳ Chờ tích hợp |

### 7.2 Tài Liệu Bàn Giao Kèm Theo

| Tài liệu                                           | Mô tả                                         |
| -------------------------------------------------- | --------------------------------------------- |
| `brd_role_management.md`                           | Đặc tả API chi tiết dành cho đội ngũ Frontend |
| `Denolith_Role_Management.postman_collection.json` | Bộ test API sẵn sàng import vào Postman       |
| `ARCHITECTURE.md`                                  | Tài liệu kiến trúc hệ thống toàn diện         |

---

## 8. Rủi Ro & Điều Kiện Tiên Quyết

| Rủi ro                                      | Mức độ     | Biện pháp giảm thiểu                                                                           |
| ------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Admin gán sai Bộ Quyền                      | Trung bình | Hệ thống tự động kiểm tra tính tương thích Tầng trước khi gán. Audit Log ghi nhận để rollback. |
| Thay đổi Role không hiệu lực ngay           | Thấp       | Đã ghi chú rõ trong BRD: cần đăng nhập lại. Admin được thông báo.                              |
| Sửa dữ liệu trực tiếp trong DB (bypass API) | Cao        | Quyền truy cập DB production bị giới hạn. Cache tự hết hạn sau 5 phút.                         |

---

_Tài liệu này được soạn thảo bởi đội ngũ kỹ thuật Denolith. Mọi thắc mắc hoặc
yêu cầu điều chỉnh vui lòng liên hệ trực tiếp với Lead Developer._
