// utils/demoNote.js
const db = require('../db/database');

async function createDemoNoteIfNone(userId) {
  try {
    const existing = await db.query(
      'SELECT id FROM notes WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (existing.rows.length === 0) {
      const markdown = `# 👋 Добро пожаловать!

Это ваша **демо-заметка**, оформленная в **Markdown**. Вот примеры:

## 🔤 Форматирование

- **Жирный**
- _Курсив_
- ~~Зачёркнутый~~
- [Ссылка](https://example.com)

## ✅ Чекбоксы

- [x] Попробовать Markdown
- [ ] Создать свою первую заметку

## 📊 Таблица

| Задача       | Статус |
|--------------|--------|
| Регистрация  | ✅     |
| Демо-заметка | ✅     |

Приятной работы! ✨`;

      await db.query(
        `INSERT INTO notes (user_id, title, text, title_search)
         VALUES ($1, $2, $3, unaccent(lower($2)))`,
        [userId, 'Demo', markdown]
      );
    }
  } catch (err) {
    console.error("❌ Ошибка при создании демо-заметки:", err);
  }
}

module.exports = { createDemoNoteIfNone };
