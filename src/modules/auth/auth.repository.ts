import type { Client } from "@db/postgres";

export class AuthRepository {
  constructor(private db: Client) {}

  async saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.db.queryObject(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [userId, token, expiresAt.toISOString()],
    );
  }

  async findRefreshToken(token: string) {
    const res = await this.db.queryObject<
      { user_id: string; expires_at: Date }
    >(
      "SELECT user_id, expires_at FROM refresh_tokens WHERE token = $1",
      [token],
    );
    return res.rows[0];
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.db.queryObject("DELETE FROM refresh_tokens WHERE token = $1", [
      token,
    ]);
  }
}
