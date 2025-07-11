-- Расширение для удаления диакритических знаков
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- Таблица заметок с колонкой для ускоренного поиска
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived BOOLEAN DEFAULT FALSE,
  title_search TEXT
);

-- Таблица для сессий с первичным ключом сразу в объявлении
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

-- Индекс для сессий по времени истечения
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Обновляем существующие записи для title_search
UPDATE notes SET title_search = unaccent(lower(title));

-- Функция обновления title_search при вставке/обновлении
CREATE OR REPLACE FUNCTION update_title_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.title_search := unaccent(lower(NEW.title));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Удаляем старый триггер, если есть
DROP TRIGGER IF EXISTS trg_update_title_search ON notes;

-- Создаём триггер
CREATE TRIGGER trg_update_title_search
BEFORE INSERT OR UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION update_title_search();

-- Индекс для ускорения поиска по title_search
CREATE INDEX IF NOT EXISTS idx_notes_title_search ON notes(title_search);
