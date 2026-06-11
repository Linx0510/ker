-- Создаём таблицу "отделы", если её ещё нет
CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,                    -- название отдела (уникальное)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- дата создания
);

-- Создаём таблицу "должности", если её ещё нет
CREATE TABLE IF NOT EXISTS positions (
    id BIGSERIAL PRIMARY KEY,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE, -- связь с отделом
    name TEXT NOT NULL,                                                         -- название должности
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- дата создания
    UNIQUE (department_id, name) -- в одном отделе не может быть двух одинаковых должностей
);

-- Добавляем колонку "идентификатор_отдела" в таблицу пользователей (если её нет)
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL;

-- Добавляем колонку "идентификатор_должности" в таблицу пользователей (если её нет)
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_id BIGINT REFERENCES positions(id) ON DELETE SET NULL;

-- Добавляем колонку "ссылка_на_видео" в таблицу уроков (если её нет)
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Заполняем таблицу "отделы" уникальными значениями из поля "department" таблицы пользователей
INSERT INTO departments (name)
SELECT DISTINCT TRIM(department)                -- удаляем лишние пробелы
FROM users
WHERE department IS NOT NULL AND TRIM(department) <> '' -- только непустые значения
ON CONFLICT (name) DO NOTHING;                   -- если отдел уже есть — пропускаем

-- Заполняем таблицу "должности" уникальными парами (отдел, должность) из данных пользователей
INSERT INTO positions (department_id, name)
SELECT DISTINCT d.id, TRIM(u.position)          -- берём ID отдела и название должности
FROM users u
JOIN departments d ON d.name = TRIM(u.department) -- связываем по названию отдела
WHERE u.position IS NOT NULL AND TRIM(u.position) <> '' -- только непустые должности
ON CONFLICT (department_id, name) DO NOTHING;    -- если такая должность в отделе уже есть — пропускаем

-- Обновляем пользователей: проставляем ID отдела на основе текстового поля "department"
UPDATE users u
SET department_id = d.id
FROM departments d
WHERE u.department_id IS NULL                    -- только если ID отдела ещё не проставлен
  AND u.department IS NOT NULL
  AND TRIM(u.department) <> ''
  AND d.name = TRIM(u.department);

-- Обновляем пользователей: проставляем ID должности на основе текстового поля "position"
UPDATE users u
SET position_id = p.id
FROM positions p
JOIN departments d ON d.id = p.department_id     -- связываем должность с её отделом
WHERE u.position_id IS NULL                      -- только если ID должности ещё не проставлен
  AND u.position IS NOT NULL
  AND TRIM(u.position) <> ''
  AND p.name = TRIM(u.position)
  AND d.id = u.department_id;                    -- должность должна принадлежать тому же отделу, что и пользователь