import type { Client, Transaction } from "@db/postgres";
import { BaseRepository } from "../../core/base.repository.ts";
import type { CreateRoleData, Role, UpdateRoleData } from "./role.entity.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";

export class RoleRepository extends BaseRepository {
  constructor(db: Client) {
    super(db);
  }

  async findMany(
    params: PaginationParams,
    tx?: Transaction,
  ): Promise<PaginatedResult<Role>> {
    return await this.paginate<Role>(
      `SELECT code, tier, name, description, system, active, created_at
       FROM roles
       ORDER BY system DESC, tier ASC, name ASC`,
      [],
      params,
      tx,
    );
  }

  async findByCode(code: string, tx?: Transaction): Promise<Role | undefined> {
    return await this.queryOne<Role>(
      `SELECT code, tier, name, description, system, active, created_at
       FROM roles
       WHERE code = $1`,
      [code],
      tx,
    );
  }

  async create(data: CreateRoleData, tx?: Transaction): Promise<Role> {
    const role = await this.queryOne<Role>(
      `INSERT INTO roles (code, tier, name, description, system, active)
       VALUES ($1, $2, $3, $4, false, true)
       RETURNING *`,
      [data.code, data.tier, data.name, data.description || null],
      tx,
    );
    return role!;
  }

  async update(
    code: string,
    data: UpdateRoleData,
    tx?: Transaction,
  ): Promise<Role | undefined> {
    const updates = Object.entries(data).filter(([_, val]) =>
      val !== undefined
    );
    if (updates.length === 0) return await this.findByCode(code, tx);

    const setClauses = updates.map(([key, _], i) => `${key} = $${i + 2}`).join(
      ", ",
    );
    const values = updates.map(([_, val]) => val);

    return await this.queryOne<Role>(
      `UPDATE roles
       SET ${setClauses}
       WHERE code = $1 AND system = false
       RETURNING *`,
      [code, ...values],
      tx,
    );
  }

  async delete(code: string, tx?: Transaction): Promise<boolean> {
    const rowCount = await this.execute(
      `DELETE FROM roles WHERE code = $1 AND system = false`,
      [code],
      tx,
    );
    return rowCount > 0;
  }
}
