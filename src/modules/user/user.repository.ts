import type { Client, Transaction } from "@db/postgres";
import type { CreateUserData, UpdateUserData, User } from "./user.entity.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";
import { BaseRepository } from "../../core/base.repository.ts";

// Các cột an toàn (không bao gồm password) dùng cho hầu hết các query
const SAFE_COLUMNS = `id, username, email, role, phone, active,
   first_name, last_name, display_name, avatar, date_of_birth, gender, bio,
   phone_verified, email_verified, address, city, country, last_login_at, last_login_ip,
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
      `SELECT u.id, u.username, u.email, u.role, u.phone, u.active,
              u.first_name, u.last_name, u.display_name, u.avatar, u.date_of_birth, u.gender, u.bio,
              u.phone_verified, u.email_verified, u.address, u.city, u.country, u.last_login_at, u.last_login_ip,
              u.created_at, u.updated_at, u.deleted, u.deleted_at,
              r.tier
       FROM users u
       JOIN roles r ON u.role = r.code
       WHERE u.id = $1 AND u.deleted = false`,
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

  // Dùng riêng cho Auth login — cần password để verifyPassword() và tier cho JWT
  async findByEmailWithPassword(
    email: string,
    tx?: Transaction,
  ): Promise<User | undefined> {
    return await this.queryOne<User>(
      `SELECT u.id, u.username, u.email, u.password, u.role, u.phone, u.active,
              u.first_name, u.last_name, u.display_name, u.avatar, u.date_of_birth, u.gender, u.bio,
              u.phone_verified, u.email_verified, u.address, u.city, u.country, u.last_login_at, u.last_login_ip,
              u.created_at, u.updated_at, u.deleted, u.deleted_at,
              r.tier
       FROM users u
       JOIN roles r ON u.role = r.code
       WHERE u.email = $1 AND u.deleted = false`,
      [email],
      tx,
    );
  }

  async create(data: CreateUserData, tx?: Transaction): Promise<User> {
    const user = await this.queryOne<User>(
      // INSERT rồi JOIN roles để lấy tier cho JWT
      // (authService dùng ngay để ký JWT sau khi register)
      `WITH inserted AS (
         INSERT INTO users (username, email, password, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING *
       )
       SELECT i.*, r.tier
       FROM inserted i
       JOIN roles r ON i.role = r.code`,
      [data.username, data.email, data.password, data.phone || null],
      tx,
    );
    return user!;
  }

  async update(
    id: string,
    data: UpdateUserData,
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

  async updateRole(
    id: string,
    roleCode: string,
    tx?: Transaction,
  ): Promise<User | undefined> {
    return await this.queryOne<User>(
      `WITH updated AS (
         UPDATE users
         SET role = $2
         WHERE id = $1 AND deleted = false
         RETURNING *
       )
       SELECT u.id, u.username, u.email, u.role, u.phone, u.active,
              u.first_name, u.last_name, u.display_name, u.avatar, u.date_of_birth, u.gender, u.bio,
              u.phone_verified, u.email_verified, u.address, u.city, u.country, u.last_login_at, u.last_login_ip,
              u.created_at, u.updated_at, u.deleted, u.deleted_at,
              r.tier
       FROM updated u
       JOIN roles r ON u.role = r.code`,
      [id, roleCode],
      tx,
    );
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
