-- Добавляем колонку 'status' в таблицу 'users', если её ещё нет
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Удаляем ограничение CHECK, если оно существует (чтобы избежать конфликта при обновлении)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- Добавляем новое ограничение CHECK для колонки 'status' (только 'pending' или 'active')
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'active'));

-- Создаём таблицу 'вопросы_уроков', если её ещё нет
CREATE TABLE IF NOT EXISTS lesson_questions (
    id BIGSERIAL PRIMARY KEY,
    lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 1,         -- порядок сортировки вопросов в уроке
    question TEXT NOT NULL,                        -- текст вопроса
    options JSONB NOT NULL DEFAULT '[]'::jsonb,    -- варианты ответов (JSON-массив)
    correct_index INTEGER NOT NULL DEFAULT 0       -- индекс правильного ответа (начиная с 0)
);

-- Создаём индексы для ускорения запросов (если их ещё нет)
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson ON lesson_questions(lesson_id);