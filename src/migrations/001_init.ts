import type { Migration } from "../core/migrator.ts";

export const migration: Migration = {
  version: "001",
  name: "init",
  up: `
    -- =========================================================
    -- SHARED: Hàm trigger tái sử dụng cho MỌI bảng trong DB
    -- Chỉ tạo một lần, áp dụng cho bất kỳ bảng nào cần auto updated_at
    -- =========================================================
    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;


    -- =========================================================
    -- TABLE: users
    -- =========================================================
    CREATE TABLE IF NOT EXISTS users (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      username    VARCHAR     NOT NULL UNIQUE,
      email       VARCHAR     NOT NULL UNIQUE,
      password    VARCHAR     NOT NULL,
      phone       VARCHAR     DEFAULT NULL,
      role        VARCHAR     NOT NULL DEFAULT 'user',
      active      BOOLEAN     NOT NULL DEFAULT true,
      -- Audit fields (bắt buộc ở mọi bảng)
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted     BOOLEAN     NOT NULL DEFAULT false,
      deleted_at  TIMESTAMPTZ DEFAULT NULL
    );

    -- Trigger: tự động cập nhật updated_at khi có thay đổi
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email)    WHERE deleted = false;
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted = false;
    CREATE INDEX IF NOT EXISTS idx_users_active   ON users(id)       WHERE deleted = false;


    -- =========================================================
    -- TABLE: refresh_tokens
    -- =========================================================
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL,
      token       VARCHAR     NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      -- Audit fields
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Index
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);


    -- =========================================================
    -- TABLE: audit_logs
    -- Ghi lại mọi hành động nhạy cảm để truy vết sau này
    -- =========================================================
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id    UUID        DEFAULT NULL,         -- ID của user thực hiện (NULL nếu system)
      action      VARCHAR     NOT NULL,             -- VD: 'user.soft_delete', 'user.restore', 'auth.login_failed'
      target_type VARCHAR     DEFAULT NULL,         -- VD: 'user', 'post'
      target_id   UUID        DEFAULT NULL,         -- ID của đối tượng bị tác động
      metadata    JSONB       DEFAULT '{}',         -- Thông tin bổ sung (IP, user-agent, etc.)
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes để query audit log hiệu quả
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor    ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target   ON audit_logs(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);
  `,
  down: `
    -- Xóa ngược lại theo thứ tự phụ thuộc
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS refresh_tokens CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP FUNCTION IF EXISTS trigger_set_updated_at();
  `,
};
