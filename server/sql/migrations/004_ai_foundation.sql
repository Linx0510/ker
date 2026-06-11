CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lesson_questions
    ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'single',
    ADD COLUMN IF NOT EXISTS correct_indices JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS matching_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS explanation TEXT,
    ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE lesson_questions
    DROP CONSTRAINT IF EXISTS lesson_questions_question_type_check;

ALTER TABLE lesson_questions
    ADD CONSTRAINT lesson_questions_question_type_check
    CHECK (question_type IN ('single', 'multiple', 'matching'));

ALTER TABLE lesson_questions
    DROP CONSTRAINT IF EXISTS lesson_questions_points_check;

ALTER TABLE lesson_questions
    ADD CONSTRAINT lesson_questions_points_check
    CHECK (points > 0);

ALTER TABLE lesson_questions
    ALTER COLUMN correct_index DROP NOT NULL;

CREATE TABLE IF NOT EXISTS ai_generation_drafts (
    id BIGSERIAL PRIMARY KEY,
    generation_type TEXT NOT NULL CHECK (generation_type IN ('course', 'lesson', 'test', 'question', 'matching')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error', 'confirmed')),
    input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_payload JSONB,
    error_text TEXT,
    requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    model_used TEXT,
    fallback_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id BIGSERIAL PRIMARY KEY,
    draft_id BIGINT REFERENCES ai_generation_drafts(id) ON DELETE CASCADE,
    requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_text TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson_order
    ON lesson_questions(lesson_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_ai_generation_drafts_status
    ON ai_generation_drafts(status);

CREATE INDEX IF NOT EXISTS idx_ai_generation_drafts_created_at
    ON ai_generation_drafts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at
    ON ai_generation_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_courses_search_fts
    ON courses USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, '')));
