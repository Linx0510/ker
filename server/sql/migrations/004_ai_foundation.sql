-- Таблица для отслеживания миграций схемы базы данных (версионирование)
CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,               -- имя файла миграции
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- дата применения
);

-- Добавляем новые колонки в таблицу "вопросы_уроков" для поддержки разных типов вопросов
ALTER TABLE lesson_questions
    ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'single',        -- тип вопроса: одиночный/множественный/на соответствие
    ADD COLUMN IF NOT EXISTS correct_indices JSONB NOT NULL DEFAULT '[]'::jsonb, -- индексы правильных ответов (для multiple)
    ADD COLUMN IF NOT EXISTS matching_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,  -- пары для вопроса на соответствие
    ADD COLUMN IF NOT EXISTS explanation TEXT,                                   -- пояснение к ответу
    ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 1,                  -- количество баллов за вопрос
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();      -- дата последнего обновления

-- Удаляем старое ограничение на тип вопроса (если существует)
ALTER TABLE lesson_questions
    DROP CONSTRAINT IF EXISTS lesson_questions_question_type_check;

-- Добавляем новое ограничение: допустимые типы вопросов
ALTER TABLE lesson_questions
    ADD CONSTRAINT lesson_questions_question_type_check
    CHECK (question_type IN ('single', 'multiple', 'matching'));
-- single - один правильный ответ
-- multiple - несколько правильных ответов  
-- matching - вопрос на сопоставление

-- Удаляем старое ограничение на количество баллов (если существует)
ALTER TABLE lesson_questions
    DROP CONSTRAINT IF EXISTS lesson_questions_points_check;

-- Добавляем ограничение: баллы должны быть положительным числом
ALTER TABLE lesson_questions
    ADD CONSTRAINT lesson_questions_points_check
    CHECK (points > 0);

-- Делаем колонку correct_index необязательной (она больше не нужна для новых типов вопросов)
ALTER TABLE lesson_questions
    ALTER COLUMN correct_index DROP NOT NULL;

-- Таблица "черновики_генерации_ии" — хранит запросы к ИИ и результаты
CREATE TABLE IF NOT EXISTS ai_generation_drafts (
    id BIGSERIAL PRIMARY KEY,
    generation_type TEXT NOT NULL CHECK (generation_type IN ('course', 'lesson', 'test', 'question', 'matching')),
    -- тип генерации: курс, урок, тест, вопрос, сопоставление
    
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error', 'confirmed')),
    -- статус: ожидает, обрабатывается, выполнено, ошибка, подтверждён
    
    input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,     -- входные данные для ИИ
    output_payload JSONB,                                 -- результат от ИИ
    error_text TEXT,                                      -- текст ошибки, если была
    
    requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL, -- кто запросил
    model_used TEXT,                                      -- какая модель ИИ использовалась
    fallback_chain JSONB NOT NULL DEFAULT '[]'::jsonb,    -- цепочка запасных моделей
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),        -- дата создания
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),        -- дата обновления
    completed_at TIMESTAMPTZ                              -- дата завершения
);

-- Таблица "логи_генерации_ии" — детальные логи каждого вызова ИИ
CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id BIGSERIAL PRIMARY KEY,
    draft_id BIGINT REFERENCES ai_generation_drafts(id) ON DELETE CASCADE, -- связь с черновиком
    requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,           -- кто запросил
    model TEXT NOT NULL,                                                   -- какая модель вызывалась
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),          -- успех или ошибка
    error_text TEXT,                                                       -- текст ошибки
    prompt_tokens INTEGER,                                                 -- количество токенов в запросе
    completion_tokens INTEGER,                                             -- количество токенов в ответе
    duration_ms INTEGER NOT NULL DEFAULT 0,                                -- длительность в миллисекундах
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- что отправили
    response_payload JSONB,                                                -- что получили
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                          -- дата создания
);

-- Индекс для быстрой сортировки вопросов в уроке
CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson_order
    ON lesson_questions(lesson_id, sort_order, id);

-- Индекс для фильтрации черновиков по статусу
CREATE INDEX IF NOT EXISTS idx_ai_generation_drafts_status
    ON ai_generation_drafts(status);

-- Индекс для выборки по дате создания черновиков
CREATE INDEX IF NOT EXISTS idx_ai_generation_drafts_created_at
    ON ai_generation_drafts(created_at DESC);

-- Индекс для выборки по дате создания логов
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at
    ON ai_generation_logs(created_at DESC);

-- Индекс для полнотекстового поиска по курсам (название + описание)
CREATE INDEX IF NOT EXISTS idx_courses_search_fts
    ON courses USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, '')));