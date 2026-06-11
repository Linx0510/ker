CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
    id BIGSERIAL PRIMARY KEY,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (department_id, name)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_id BIGINT REFERENCES positions(id) ON DELETE SET NULL;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_url TEXT;

INSERT INTO departments (name)
SELECT DISTINCT TRIM(department)
FROM users
WHERE department IS NOT NULL AND TRIM(department) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO positions (department_id, name)
SELECT DISTINCT d.id, TRIM(u.position)
FROM users u
JOIN departments d ON d.name = TRIM(u.department)
WHERE u.position IS NOT NULL AND TRIM(u.position) <> ''
ON CONFLICT (department_id, name) DO NOTHING;

UPDATE users u
SET department_id = d.id
FROM departments d
WHERE u.department_id IS NULL
  AND u.department IS NOT NULL
  AND TRIM(u.department) <> ''
  AND d.name = TRIM(u.department);

UPDATE users u
SET position_id = p.id
FROM positions p
JOIN departments d ON d.id = p.department_id
WHERE u.position_id IS NULL
  AND u.position IS NOT NULL
  AND TRIM(u.position) <> ''
  AND p.name = TRIM(u.position)
  AND d.id = u.department_id;
