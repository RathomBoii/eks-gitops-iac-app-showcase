-- 1. Create "group" role (no LOGIN = can't connect directly)
CREATE ROLE analysts;
CREATE ROLE developers;
CREATE ROLE readonly;

-- 2. Create actual users (with LOGIN)
CREATE USER alice WITH PASSWORD 'pass';
CREATE USER bob   WITH PASSWORD 'pass';
CREATE USER charlie WITH PASSWORD 'pass';

-- 3. Assign users to "groups"
GRANT analysts   TO alice;
GRANT developers TO bob;
GRANT analysts   TO charlie;
GRANT developers TO charlie;   -- charlie is in 2 groups

-- 4. Grant permissions to the GROUP role (not individual users)
GRANT USAGE ON SCHEMA public TO analysts;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analysts;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO developers;