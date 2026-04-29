export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: string;
  phone: string | null;
  active: boolean;
  // --- Audit Fields (bắt buộc có ở mọi bảng) ---
  created_at: Date;       // Auto-set bởi DB khi INSERT
  updated_at: Date;       // Auto-set bởi PostgreSQL Trigger khi UPDATE
  deleted: boolean;       // Flag: false = đang hoạt động, true = đã bị xóa mềm
  deleted_at: Date | null; // Timestamp xóa mềm: null nếu chưa xóa
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  phone?: string;
}
