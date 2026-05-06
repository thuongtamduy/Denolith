import type { Client } from "@db/postgres";
import type { CreateUserData, User } from "./user.entity.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";

// Các cột an toàn (không bao gồm password) dùng cho hầu hết các query
const SAFE_COLUMNS = `id, username, email, role, phone, active,
   created_at, updated_at, deleted, deleted_at`;

export class UserRepository {
  constructor(private db: Client) {}

  async findMany(params: PaginationParams): Promise<PaginatedResult<User>> {
    const offset = (params.page - 1) * params.limit;

    // Đếm tổng số user chưa bị xóa mềm
    const countRes = await this.db.queryObject<{ count: bigint }>(
      "SELECT COUNT(*) FROM users WHERE deleted = false",
    );
    const total = Number(countRes.rows[0].count);

    // Lấy dữ liệu phân trang — chỉ user chưa bị soft delete
    const res = await this.db.queryObject<User>(
      `SELECT ${SAFE_COLUMNS}
       FROM users
       WHERE deleted = false
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [params.limit, offset],
    );

    return {
      data: res.rows,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findById(id: string): Promise<User | undefined> {
    const result = await this.db.queryObject<User>(
      `SELECT ${SAFE_COLUMNS}
       FROM users
       WHERE id = $1 AND deleted = false`,
      [id],
    );
    return result.rows[0];
  }

  // Dùng để kiểm tra tồn tại — KHÔNG chứa password (Least Privilege)
  async findByEmail(
    email: string,
  ): Promise<Omit<User, "password"> | undefined> {
    const result = await this.db.queryObject<Omit<User, "password">>(
      `SELECT ${SAFE_COLUMNS}
       FROM users
       WHERE email = $1 AND deleted = false`,
      [email],
    );
    return result.rows[0];
  }

  // Dùng riêng cho Auth login — cần password để verifyPassword()
  async findByEmailWithPassword(email: string): Promise<User | undefined> {
    const result = await this.db.queryObject<User>(
      `SELECT id, username, email, password, role, phone, active,
              created_at, updated_at, deleted, deleted_at
       FROM users
       WHERE email = $1 AND deleted = false`,
      [email],
    );
    return result.rows[0];
  }

  async create(data: CreateUserData): Promise<User> {
    const res = await this.db.queryObject<User>(
      // RETURNING * để trả về đầy đủ User kể cả password
      // (authService dùng ngay để ký JWT sau khi register — password không bị leak ra ngoài vì sanitizeUser ở tầng Route)
      `INSERT INTO users (username, email, password, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.username, data.email, data.password, data.phone || null],
    );
    return res.rows[0];
  }

  /**
   * Soft Delete: Bật flag deleted=true và ghi timestamp deleted_at.
   * Trigger PostgreSQL sẽ tự động cập nhật updated_at.
   * Trả về undefined nếu user không tồn tại hoặc đã bị xóa trước đó.
   */
  async softDelete(id: string): Promise<User | undefined> {
    const res = await this.db.queryObject<User>(
      `UPDATE users
       SET deleted = true, deleted_at = NOW()
       WHERE id = $1 AND deleted = false
       RETURNING ${SAFE_COLUMNS}`,
      [id],
    );
    return res.rows[0];
  }

  /**
   * Restore: Tắt flag deleted=false và xóa timestamp deleted_at về NULL.
   * Trigger PostgreSQL sẽ tự động cập nhật updated_at.
   * Trả về undefined nếu user không tồn tại hoặc chưa bị xóa.
   */
  async restore(id: string): Promise<User | undefined> {
    const res = await this.db.queryObject<User>(
      `UPDATE users
       SET deleted = false, deleted_at = NULL
       WHERE id = $1 AND deleted = true
       RETURNING ${SAFE_COLUMNS}`,
      [id],
    );
    return res.rows[0];
  }

  /**
   * Hard Delete: Xóa vĩnh viễn khỏi Database.
   * Bắt buộc user phải ở trạng thái deleted=true trước (2-step safety).
   * Trả về false nếu user không tìm thấy hoặc chưa bị soft delete.
   */
  async hardDelete(id: string): Promise<boolean> {
    const res = await this.db.queryObject(
      `DELETE FROM users
       WHERE id = $1 AND deleted = true
       RETURNING id`,
      [id],
    );
    return res.rows.length > 0;
  }
}
