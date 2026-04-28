import type { Client } from "@db/postgres";
import type { CreateUserData, User } from "./user.entity.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";

export class UserRepository {
  constructor(private db: Client) {}

  async findMany(params: PaginationParams): Promise<PaginatedResult<User>> {
    const offset = (params.page - 1) * params.limit;

    // Đếm tổng số lượng dòng
    const countRes = await this.db.queryObject<{ count: bigint }>(
      "SELECT COUNT(*) FROM users",
    );
    const total = Number(countRes.rows[0].count);

    // Lấy dữ liệu phân trang
    const res = await this.db.queryObject<User>(
      "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
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
      "SELECT * FROM users WHERE id = $1",
      [id],
    );
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.queryObject<User>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    return result.rows[0];
  }

  async create(data: CreateUserData): Promise<User> {
    const res = await this.db.queryObject<User>(
      "INSERT INTO users (username, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING *",
      [data.username, data.email, data.password, data.phone || null],
    );
    return res.rows[0];
  }
}
