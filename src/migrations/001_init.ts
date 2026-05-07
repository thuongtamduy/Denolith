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
    -- TABLE: roles
    -- Danh sách roles được đặt tên — thêm/sửa tại runtime không cần migration.
    -- tier: gôm nhóm hành vi hệ thống (owner | admin | user) — cố định.
    -- system=true: 3 roles gốc, không được xóa hoặc đổi tier.
    -- =========================================================
    CREATE TABLE IF NOT EXISTS roles (
      code        VARCHAR     PRIMARY KEY,
      tier        VARCHAR     NOT NULL CHECK (tier IN ('owner', 'admin', 'user')),
      name        VARCHAR     NOT NULL,
      description TEXT        DEFAULT NULL,
      system      BOOLEAN     NOT NULL DEFAULT false,
      active      BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_roles_tier   ON roles(tier);
    CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(active);


    -- =========================================================
    -- TABLE: users
    -- role: FK → roles.code
    --   Tier của role quyết định hành vi hệ thống:
    --   owner-tier = toàn quyền bypass | admin/user-tier = cần PermissionProfile
    -- =========================================================
    CREATE TABLE IF NOT EXISTS users (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      username    VARCHAR     NOT NULL UNIQUE,
      email       VARCHAR     NOT NULL UNIQUE,
      password    VARCHAR     NOT NULL,
      phone       VARCHAR     DEFAULT NULL,
      role        VARCHAR     NOT NULL DEFAULT 'user'
                              REFERENCES roles(code) ON UPDATE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role)     WHERE deleted = false;


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
      action      VARCHAR     NOT NULL,             -- VD: 'user.soft_delete', 'auth.login_failed'
      target_type VARCHAR     DEFAULT NULL,         -- VD: 'user', 'permission_profile'
      target_id   VARCHAR     DEFAULT NULL,         -- ID của đối tượng bị tác động (UUID hoặc string code như roles.code)
      metadata    JSONB       DEFAULT '{}',         -- Thông tin bổ sung (IP, user-agent, etc.)
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes để query audit log hiệu quả
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor    ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target   ON audit_logs(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);


    -- =========================================================
    -- TABLE: permissions
    -- Danh sách quyền nguyên tử — developer định nghĩa qua migration.
    -- Format code: "<resource>.<action>" — vd: "users.read", "reports.export"
    -- Không ai tự thêm được tại runtime — thêm code phải qua migration mới.
    -- Seed data nằm trong scripts/seed.ts
    -- =========================================================
    CREATE TABLE IF NOT EXISTS permissions (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      code        VARCHAR     NOT NULL UNIQUE,
      description TEXT        DEFAULT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);


    -- =========================================================
    -- TABLE: permission_profiles
    -- Bộ quyền được đặt tên, Admin tạo/sửa tại runtime.
    -- tier: 'admin' | 'user' — profile chỉ assign được cho đúng tier
    -- =========================================================
    CREATE TABLE IF NOT EXISTS permission_profiles (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR     NOT NULL,
      tier        VARCHAR     NOT NULL CHECK (tier IN ('admin', 'user')),
      description TEXT        DEFAULT NULL,
      active      BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TRIGGER trg_permission_profiles_updated_at
      BEFORE UPDATE ON permission_profiles
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

    CREATE INDEX IF NOT EXISTS idx_pprofiles_tier   ON permission_profiles(tier);
    CREATE INDEX IF NOT EXISTS idx_pprofiles_active ON permission_profiles(active);


    -- =========================================================
    -- TABLE: profile_permissions
    -- Junction: PermissionProfile → Permission
    -- granted=false = tường minh CẤM quyền đó trong profile
    -- =========================================================
    CREATE TABLE IF NOT EXISTS profile_permissions (
      profile_id      UUID        NOT NULL REFERENCES permission_profiles(id) ON DELETE CASCADE,
      permission_code VARCHAR     NOT NULL REFERENCES permissions(code)       ON DELETE CASCADE,
      granted         BOOLEAN     NOT NULL DEFAULT true,
      PRIMARY KEY (profile_id, permission_code)
    );

    CREATE INDEX IF NOT EXISTS idx_pperms_profile ON profile_permissions(profile_id);


    -- =========================================================
    -- TABLE: user_profiles
    -- Junction: User → PermissionProfile (nhiều-nhiều)
    -- Một user có thể có nhiều profiles — quyền là UNION của tất cả
    -- =========================================================
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id     UUID        NOT NULL REFERENCES users(id)               ON DELETE CASCADE,
      profile_id  UUID        NOT NULL REFERENCES permission_profiles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_by UUID        DEFAULT NULL REFERENCES users(id)           ON DELETE SET NULL,
      PRIMARY KEY (user_id, profile_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_profiles_user    ON user_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_profiles_profile ON user_profiles(profile_id);


    -- =========================================================
    -- TABLE: user_permissions
    -- Override quyền cá nhân — ưu tiên cao hơn profile
    -- granted=true: cấp thêm | granted=false: thu hồi tường minh
    -- =========================================================
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id         UUID        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
      permission_code VARCHAR     NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
      granted         BOOLEAN     NOT NULL,
      assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_by     UUID        DEFAULT NULL REFERENCES users(id)     ON DELETE SET NULL,
      PRIMARY KEY (user_id, permission_code)
    );

    CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
  `,
  down: `
    -- Xóa ngược theo thứ tự FK
    DROP TABLE IF EXISTS user_permissions      CASCADE;
    DROP TABLE IF EXISTS user_profiles         CASCADE;
    DROP TABLE IF EXISTS profile_permissions   CASCADE;
    DROP TABLE IF EXISTS permission_profiles   CASCADE;
    DROP TABLE IF EXISTS permissions           CASCADE;
    DROP TABLE IF EXISTS audit_logs            CASCADE;
    DROP TABLE IF EXISTS refresh_tokens        CASCADE;
    DROP TABLE IF EXISTS users                 CASCADE;
    DROP TABLE IF EXISTS roles                 CASCADE;
    DROP FUNCTION IF EXISTS trigger_set_updated_at();
  `,
};
