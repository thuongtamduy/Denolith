import type { Client, Transaction } from "@db/postgres";
import type { CreateUserData, User } from "./user.entity.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";
import { BaseRepository } from "../../core/base.repository.ts";

// Các cột an toàn (không bao gồm password) dùng cho hầu hết các query
const SAFE_COLUMNS = `id, username, email, role, phone, active,
   created_at, updated_at, deleted, deleted_at`;

export class UserRepository extends BaseRepository {
  constructor(db: Client) {
    super(db);
  }

  async findMany(
    params: PaginationParams,
    tx?: Transaction,
  ): Promise<PaginatedResult<User>> {
    return await this.paginate<User>(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE deleted = false ORDER BY created_at DESC`,
      [],
      params,
      tx,
    );
  }

  async findById(id: string, tx?: Transaction): Promise<User | undefined> {
    return await this.queryOne<User>(
      `SELECT ${SAFE_COLUMNS}
       FROM users
       WHERE id = $1 AND deleted = false`,
      [id],
      tx,
    );
  }

  // Dùng để kiểm tra tồn tại — KHÔNG chứa password (Least Privilege)
  async findByEmail(
    email: string,
    tx?: Transaction,
  ): Promise<Omit<User, "password"> | undefined> {
    return await this.queryOne<Omit<User, "password">>(
      `SELECT ${SAFE_COLUMNS}
       FROM users
       WHERE email = $1 AND deleted = false`,
      [email],
      tx,
    );
  }

  // Dùng riêng cho Auth login — cần password để verifyPassword()
  async findByEmailWithPassword(
    email: string,
    tx?: Transaction,
  ): Promise<User | undefined> {
    return await this.queryOne<User>(
      `SELECT id, username, email, password, role, phone, active,
              created_at, updated_at, deleted, deleted_at
       FROM users
       WHERE email = $1 AND deleted = false`,
      [email],
      tx,
    );
  }

  async create(data: CreateUserData, tx?: Transaction): Promise<User> {
    const user = await this.queryOne<User>(
      // RETURNING * để trả về đầy đủ User kể cả password
      // (authService dùng ngay để ký JWT sau khi register — password không bị leak ra ngoài vì sanitizeUser ở tầng Route)
      `INSERT INTO users (username, email, password, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.username, data.email, data.password, data.phone || null],
      tx,
    );
    return user!;
  }

  async update(
    id: string,
    data: Partial<User>,
    tx?: Transaction,
  ): Promise<User | undefined> {
    // Chỉ lấy các trường có giá trị (loại bỏ undefined)
    const updates = Object.entries(data).filter(([_, val]) =>
      val !== undefined
    );
    if (updates.length === 0) return await this.findById(id, tx);

    const setClauses = updates.map(([key, _], index) =>
      `${key} = $${index + 2}`
    ).join(", ");
    const values = updates.map(([_, val]) => val);

    const sql = `
      UPDATE users 
      SET ${setClauses} 
      WHERE id = $1 AND deleted = false 
      RETURNING ${SAFE_COLUMNS}
    `;

    return await this.queryOne<User>(sql, [id, ...values], tx);
  }

  /**
   * Soft Delete: Bật flag deleted=true và ghi timestamp deleted_at.
   * Trigger PostgreSQL sẽ tự động cập nhật updated_at.
   * Trả về undefined nếu user không tồn tại hoặc đã bị xóa trước đó.
   */
  async softDelete(id: string, tx?: Transaction): Promise<User | undefined> {
    return await this.queryOne<User>(
      `UPDATE users
       SET deleted = true, deleted_at = NOW()
       WHERE id = $1 AND deleted = false
       RETURNING ${SAFE_COLUMNS}`,
      [id],
      tx,
    );
  }

  /**
   * Restore: Tắt flag deleted=false và xóa timestamp deleted_at về NULL.
   * Trigger PostgreSQL sẽ tự động cập nhật updated_at.
   * Trả về undefined nếu user không tồn tại hoặc chưa bị xóa.
   */
  async restore(id: string, tx?: Transaction): Promise<User | undefined> {
    return await this.queryOne<User>(
      `UPDATE users
       SET deleted = false, deleted_at = NULL
       WHERE id = $1 AND deleted = true
       RETURNING ${SAFE_COLUMNS}`,
      [id],
      tx,
    );
  }

  /**
   * Hard Delete: Xóa vĩnh viễn khỏi Database.
   * Bắt buộc user phải ở trạng thái deleted=true trước (2-step safety).
   * Trả về false nếu user không tìm thấy hoặc chưa bị soft delete.
   */
  async hardDelete(id: string, tx?: Transaction): Promise<boolean> {
    const rowCount = await this.execute(
      `DELETE FROM users
       WHERE id = $1 AND deleted = true`,
      [id],
      tx,
    );
    return rowCount > 0;
  }
}
