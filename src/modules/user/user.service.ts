import type { UserRepository } from "./user.repository.ts";
import type { CreateUserData, UpdateUserData, User } from "./user.entity.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import { hashPassword } from "../../shared/utils/hash.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";

export class UserService {
  constructor(private repo: UserRepository) {}

  async findMany(params: PaginationParams): Promise<PaginatedResult<User>> {
    return await this.repo.findMany(params);
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw AppError.notFound(`User with id ${id} not found`);
    return user;
  }

  async create(data: CreateUserData): Promise<User> {
    // Sử dụng transaction để đảm bảo toàn vẹn dữ liệu:
    // Nếu trong lúc tìm email hoặc tạo user có lỗi xảy ra, transaction sẽ tự động rollback.
    return await this.repo.transaction(async (tx) => {
      const existing = await this.repo.findByEmail(data.email, tx);
      if (existing) throw AppError.conflict("Email already exists");

      // Hash password tại tầng Service — không để raw password xuống DB
      const hashedPassword = await hashPassword(data.password);
      return await this.repo.create({ ...data, password: hashedPassword }, tx);
    });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.repo.update(id, data);
    if (!user) throw AppError.notFound(`User with id ${id} not found`);
    return user;
  }

  async updateRole(id: string, roleCode: string, actorId?: string): Promise<User> {
    try {
      const user = await this.repo.updateRole(id, roleCode);
      if (!user) throw AppError.notFound(`User with id ${id} not found`);
      
      await AuditService.log({
        actorId,
        action: "user.update_role",
        targetType: "user",
        targetId: id,
        metadata: { roleCode },
      });
      
      return user;
    } catch (err: unknown) {
      if (err instanceof Error && err.message && err.message.includes("violates foreign key constraint")) {
        throw AppError.badRequest(`Role '${roleCode}' does not exist.`);
      }
      throw err;
    }
  }

  /**
   * Soft Delete một user theo ID.
   * Chỉ Admin mới được gọi service này (enforcement ở tầng Route/RBAC).
   * Không thể tự xóa chính mình (logic được kiểm tra ở tầng Route).
   */
  async softDelete(id: string): Promise<User> {
    const user = await this.repo.softDelete(id);
    if (!user) {
      // Trả về Not Found thống nhất — không tiết lộ user đã bị xóa hay chưa tồn tại
      throw AppError.notFound(`User with id ${id} not found`);
    }
    return user;
  }

  /**
   * Phục hồi một user đã bị soft delete.
   */
  async restore(id: string): Promise<User> {
    const user = await this.repo.restore(id);
    if (!user) {
      throw AppError.notFound(
        `User with id ${id} not found or is not deleted`,
      );
    }
    return user;
  }

  /**
   * Hard Delete — Xóa vĩnh viễn.
   * Chỉ hoạt động nếu user đã bị soft delete trước đó (2-step safety để tránh xóa nhầm).
   */
  async hardDelete(id: string): Promise<void> {
    const deleted = await this.repo.hardDelete(id);
    if (!deleted) {
      throw AppError.notFound(
        `User with id ${id} not found or must be soft-deleted first`,
      );
    }
  }
}
