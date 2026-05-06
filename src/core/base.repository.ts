import type { Client, Transaction } from "@db/postgres";
import type {
  CollectionResult,
  PaginatedResult,
  PaginationParams,
} from "../shared/utils/pagination.ts";

/**
 * Lớp BaseRepository cung cấp các công cụ query dùng chung (queryOne, queryMany) và quản lý Transaction.
 * Mọi Repository khi extends lớp này sẽ code ngắn gọn hơn và có sẵn transaction().
 */
export abstract class BaseRepository {
  constructor(protected db: Client) {}

  /**
   * Helper method dùng chung để tạo một Database Transaction chuẩn.
   * Tất cả các thao tác gọi trong `fn` nếu có lỗi (throw Error) sẽ tự động rollback.
   * Nếu thành công toàn bộ, sẽ tự động commit.
   */
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const txName = `tx_${Date.now()}_${
      Math.random().toString(36).substring(7)
    }`;
    const tx = this.db.createTransaction(txName);
    await tx.begin();
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  /**
   * Trả về runner hiện tại: nếu đang trong transaction thì dùng tx, nếu không thì dùng db gốc.
   * Giúp code query ở các Repo con ngắn gọn hơn.
   */
  protected getRunner(tx?: Transaction): Client | Transaction {
    return tx || this.db;
  }

  /**
   * Lấy 1 dòng duy nhất (dành cho findById, findByEmail...)
   */
  protected async queryOne<T>(
    sql: string,
    params: unknown[] = [],
    tx?: Transaction,
  ): Promise<T | undefined> {
    const runner = this.getRunner(tx);
    const result = await runner.queryObject<T>(sql, params);
    return result.rows[0];
  }

  /**
   * Lấy danh sách nhiều dòng (dành cho findMany, findAll...)
   */
  protected async queryMany<T>(
    sql: string,
    params: unknown[] = [],
    tx?: Transaction,
  ): Promise<T[]> {
    const runner = this.getRunner(tx);
    const result = await runner.queryObject<T>(sql, params);
    return result.rows;
  }

  /**
   * Thực thi lệnh Insert/Update/Delete và trả về số dòng bị ảnh hưởng
   */
  protected async execute(
    sql: string,
    params: unknown[] = [],
    tx?: Transaction,
  ): Promise<number> {
    const runner = this.getRunner(tx);
    const result = await runner.queryObject(sql, params);
    return result.rowCount ?? 0;
  }

  /**
   * Helper tự động phân trang cho mọi truy vấn SQL.
   * Dùng sub-query để tự động tính tổng số dòng (count).
   */
  protected async paginate<T>(
    baseSql: string,
    params: unknown[] = [],
    pagination: PaginationParams,
    tx?: Transaction,
  ): Promise<PaginatedResult<T>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // 1. Tự động lấy tổng số dòng bằng sub-query
    const countSql = `SELECT COUNT(*) FROM (${baseSql}) AS count_subquery`;
    const countRes = await this.queryOne<{ count: bigint }>(
      countSql,
      params,
      tx,
    );
    const total = Number(countRes?.count ?? 0);

    // 2. Tự động nối LIMIT và OFFSET vào query gốc.
    // Dùng nội suy tham số theo vị trí dựa trên độ dài params mảng gốc
    const paramCount = params.length;
    const paginatedSql = `${baseSql} LIMIT $${paramCount + 1} OFFSET $${
      paramCount + 2
    }`;

    // Nối thêm limit và offset vào cuối mảng params
    const paginatedParams = [...params, limit, offset];

    const data = await this.queryMany<T>(paginatedSql, paginatedParams, tx);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Helper trả về một Collection chuẩn (Danh sách không phân trang, bọc trong { data, total }).
   * Phù hợp cho các route cần tải toàn bộ danh sách (vd: dropdown categories, roles...).
   */
  protected async collection<T>(
    sql: string,
    params: unknown[] = [],
    tx?: Transaction,
  ): Promise<CollectionResult<T>> {
    const data = await this.queryMany<T>(sql, params, tx);
    return {
      data,
      total: data.length,
    };
  }
}
