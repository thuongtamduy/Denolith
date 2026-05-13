import type { Migration } from "../core/migrator.ts";

export const migration: Migration = {
  version: "001",
  name: "init",
  up: [
    `CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`,

    `CREATE TABLE IF NOT EXISTS roles (
      code        VARCHAR     PRIMARY KEY,
      tier        VARCHAR     NOT NULL CHECK (tier IN ('owner', 'admin', 'user')),
      name        VARCHAR     NOT NULL,
      description TEXT        DEFAULT NULL,
      color       VARCHAR     DEFAULT NULL,
      icon        VARCHAR     DEFAULT NULL,
      sort_order  INT         NOT NULL DEFAULT 0,
      system      BOOLEAN     NOT NULL DEFAULT false,
      active      BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_roles_tier   ON roles(tier);`,
    `CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(active);`,
    `CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON roles(sort_order);`,

    `CREATE TABLE IF NOT EXISTS users (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      username    VARCHAR     NOT NULL UNIQUE,
      email       VARCHAR     NOT NULL UNIQUE,
      password    VARCHAR     NOT NULL,
      
      -- Thông tin cá nhân
      first_name    VARCHAR DEFAULT NULL,
      last_name     VARCHAR DEFAULT NULL,
      display_name  VARCHAR DEFAULT NULL,
      avatar        VARCHAR DEFAULT NULL,
      date_of_birth DATE DEFAULT NULL,
      gender        VARCHAR DEFAULT NULL CHECK (gender IN ('male', 'female', 'other')),
      bio           TEXT DEFAULT NULL,
      
      -- Liên hệ
      phone           VARCHAR DEFAULT NULL,
      phone_verified  BOOLEAN NOT NULL DEFAULT false,
      email_verified  BOOLEAN NOT NULL DEFAULT false,
      
      -- Địa chỉ
      address VARCHAR DEFAULT NULL,
      city    VARCHAR DEFAULT NULL,
      country VARCHAR DEFAULT NULL,
      
      -- Tracking
      last_login_at TIMESTAMPTZ DEFAULT NULL,
      last_login_ip VARCHAR DEFAULT NULL,
      
      role        VARCHAR     NOT NULL DEFAULT 'user' REFERENCES roles(code) ON UPDATE CASCADE,
      active      BOOLEAN     NOT NULL DEFAULT true,
      
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted     BOOLEAN     NOT NULL DEFAULT false,
      deleted_at  TIMESTAMPTZ DEFAULT NULL
    );`,

    `CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();`,

    `CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email)    WHERE deleted = false;`,
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted = false;`,
    `CREATE INDEX IF NOT EXISTS idx_users_active   ON users(id)       WHERE deleted = false;`,
    `CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role)     WHERE deleted = false;`,

    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL,
      token       VARCHAR     NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,

    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id    UUID        DEFAULT NULL,
      action      VARCHAR     NOT NULL,
      target_type VARCHAR     DEFAULT NULL,
      target_id   VARCHAR     DEFAULT NULL,
      device      VARCHAR     DEFAULT NULL,
      os          VARCHAR     DEFAULT NULL,
      metadata    JSONB       DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_audit_logs_actor    ON audit_logs(actor_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_target   ON audit_logs(target_type, target_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON audit_logs(action);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);`,

    `CREATE TABLE IF NOT EXISTS permissions (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      code        VARCHAR     NOT NULL UNIQUE,
      description TEXT        DEFAULT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);`,

    `CREATE TABLE IF NOT EXISTS permission_profiles (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR     NOT NULL,
      tier        VARCHAR     NOT NULL CHECK (tier IN ('admin', 'user')),
      description TEXT        DEFAULT NULL,
      active      BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TRIGGER trg_permission_profiles_updated_at
      BEFORE UPDATE ON permission_profiles
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();`,

    `CREATE INDEX IF NOT EXISTS idx_pprofiles_tier   ON permission_profiles(tier);`,
    `CREATE INDEX IF NOT EXISTS idx_pprofiles_active ON permission_profiles(active);`,

    `CREATE TABLE IF NOT EXISTS profile_permissions (
      profile_id      UUID        NOT NULL REFERENCES permission_profiles(id) ON DELETE CASCADE,
      permission_code VARCHAR     NOT NULL REFERENCES permissions(code)       ON DELETE CASCADE,
      granted         BOOLEAN     NOT NULL DEFAULT true,
      PRIMARY KEY (profile_id, permission_code)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_pperms_profile ON profile_permissions(profile_id);`,

    `CREATE TABLE IF NOT EXISTS user_profiles (
      user_id     UUID        NOT NULL REFERENCES users(id)               ON DELETE CASCADE,
      profile_id  UUID        NOT NULL REFERENCES permission_profiles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_by UUID        DEFAULT NULL REFERENCES users(id)           ON DELETE SET NULL,
      PRIMARY KEY (user_id, profile_id)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_user_profiles_user    ON user_profiles(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_profiles_profile ON user_profiles(profile_id);`,

    `CREATE TABLE IF NOT EXISTS user_permissions (
      user_id         UUID        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
      permission_code VARCHAR     NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
      granted         BOOLEAN     NOT NULL,
      assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_by     UUID        DEFAULT NULL REFERENCES users(id)     ON DELETE SET NULL,
      PRIMARY KEY (user_id, permission_code)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);`,
  ],
  down: [
    `DROP TABLE IF EXISTS user_permissions CASCADE;`,
    `DROP TABLE IF EXISTS user_profiles CASCADE;`,
    `DROP TABLE IF EXISTS profile_permissions CASCADE;`,
    `DROP TABLE IF EXISTS permission_profiles CASCADE;`,
    `DROP TABLE IF EXISTS permissions CASCADE;`,
    `DROP TABLE IF EXISTS audit_logs CASCADE;`,
    `DROP TABLE IF EXISTS refresh_tokens CASCADE;`,
    `DROP TABLE IF EXISTS users CASCADE;`,
    `DROP TABLE IF EXISTS roles CASCADE;`,
    `DROP FUNCTION IF EXISTS trigger_set_updated_at();`,
  ],
};
