import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import type { RoleRepository } from "./role.repository.ts";
import type {
  CreateRoleData,
  Role,
  UpdateRoleData,
} from "./role.entity.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";

export class RoleService {
  constructor(private repo: RoleRepository) {}

  async findMany(params: PaginationParams): Promise<PaginatedResult<Role>> {
    return await this.repo.findMany(params);
  }

  async findByCode(code: string): Promise<Role> {
    const role = await this.repo.findByCode(code);
    if (!role) {
      throw AppError.notFound(`Role '${code}' not found.`);
    }
    return role;
  }

  async create(data: CreateRoleData, actorId?: string): Promise<Role> {
    // 1. Kiểm tra tồn tại
    const existing = await this.repo.findByCode(data.code);
    if (existing) {
      throw AppError.conflict(`Role code '${data.code}' already exists.`);
    }

    // 2. Không cho phép tạo tier owner (validation đã block, nhưng check thêm để an toàn)
    if ((data.tier as string) === "owner") {
      throw AppError.badRequest("Cannot create a role with 'owner' tier.");
    }

    // 3. Tạo
    const role = await this.repo.create(data);

    // 4. Audit
    await AuditService.log({
      actorId,
      action: "role.create",
      targetType: "role",
      targetId: role.code,
      metadata: { newRole: role },
    });

    return role;
  }

  async update(
    code: string,
    data: UpdateRoleData,
    actorId?: string,
  ): Promise<Role> {
    const existing = await this.repo.findByCode(code);
    if (!existing) {
      throw AppError.notFound(`Role '${code}' not found.`);
    }

    if (existing.system) {
      throw AppError.forbidden(`Cannot update system role '${code}'.`);
    }

    const updated = await this.repo.update(code, data);
    if (!updated) {
      throw AppError.notFound(`Role '${code}' not found.`);
    }

    await AuditService.log({
      actorId,
      action: "role.update",
      targetType: "role",
      targetId: code,
      metadata: { old: existing, new: updated },
    });

    return updated;
  }

  async delete(code: string, actorId?: string): Promise<void> {
    const existing = await this.repo.findByCode(code);
    if (!existing) {
      throw AppError.notFound(`Role '${code}' not found.`);
    }

    if (existing.system) {
      throw AppError.forbidden(`Cannot delete system role '${code}'.`);
    }

    // Bắt lỗi Foregin Key ở DB (nếu role đang được gán cho user) thì PostgreSQL sẽ ném lỗi 
    // "violates foreign key constraint", ta có thể handle ở đây hoặc để errorHandler lo.
    try {
      const deleted = await this.repo.delete(code);
      if (!deleted) {
        throw AppError.notFound(`Role '${code}' not found.`);
      }
    } catch (err: unknown) {
      // Postgres error code for foreign key violation
      if (err instanceof Error && err.message && err.message.includes("violates foreign key constraint")) {
        throw AppError.conflict(`Cannot delete role '${code}' because it is still assigned to users.`);
      }
      throw err;
    }

    await AuditService.log({
      actorId,
      action: "role.delete",
      targetType: "role",
      targetId: code,
      metadata: { role: existing },
    });
  }
}
