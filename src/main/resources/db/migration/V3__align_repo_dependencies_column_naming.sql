-- ==============================================================================
-- CodeCity / Impact Mapper — Flyway Migration V3
-- Align repo_dependencies column naming with canonical snake_case standard
-- ==============================================================================

-- 1. Safely rename column "repoId" to repo_id if it exists with mixed-case
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'repo_dependencies' 
          AND column_name = 'repoId'
    ) THEN
        ALTER TABLE repo_dependencies RENAME COLUMN "repoId" TO repo_id;
    END IF;
END $$;

-- 2. Realign index to canonical snake_case naming
DROP INDEX IF EXISTS idx_repo_dep_repoid;
CREATE INDEX IF NOT EXISTS idx_repo_dep_repo_id ON repo_dependencies(repo_id);
