-- ==============================================================================
-- CodeCity / Impact Mapper — Flyway Migration V2
-- Multi-User Architecture: app_users, repository ownership, user credentials
-- ==============================================================================

-- 1. Application Users Table (Maps Supabase Auth identities to local workspaces)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id UUID NOT NULL UNIQUE,
    email VARCHAR(255),
    display_name VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_app_users_supabase_id ON app_users(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- 2. Designated Seed / System User (Preserves legacy shared records under isolated system workspace)
INSERT INTO app_users (id, supabase_user_id, email, display_name, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'system-legacy@impactmapper.local',
    'System Legacy Workspace',
    NOW(),
    NOW()
)
ON CONFLICT (supabase_user_id) DO NOTHING;

-- 3. Add owner_id to repositories table
ALTER TABLE repositories
    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

-- Backfill any existing unowned repositories to the legacy system user
UPDATE repositories
SET owner_id = '00000000-0000-0000-0000-000000000001'
WHERE owner_id IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE repositories
    ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_repositories_owner_id ON repositories(owner_id);

-- 4. Scope repository name uniqueness per user instead of globally
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'repositories_repo_name_key'
    ) THEN
        ALTER TABLE repositories DROP CONSTRAINT repositories_repo_name_key;
    END IF;
END $$;

ALTER TABLE repositories
    ADD CONSTRAINT uq_user_repo_name UNIQUE (owner_id, repo_name);

-- 5. User-Specific GitHub Credentials (Optional secure user PAT storage)
CREATE TABLE IF NOT EXISTS user_github_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
    encrypted_token TEXT,
    token_preview VARCHAR(16),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_github_cred_user ON user_github_credentials(user_id);

