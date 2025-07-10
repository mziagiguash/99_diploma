const db = require('../db/database');
const crypto = require('crypto');

// Вычисление md5-хеша для gravatar
function md5(str) {
  return crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex");
}

// Создание демо-заметки, если у пользователя ещё нет
async function createDemoNoteIfNone(userId) {
  try {
    const existing = await db.query(
      'SELECT id FROM notes WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO notes (user_id, title, text)
         VALUES ($1, $2, $3)`,
        [
          userId,
          'Demo',
          `
# 👋 Добро пожаловать!

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

Приятной работы! ✨
          `.trim(),
        ]
      );
    }
  } catch (err) {
    console.error("❌ Ошибка при создании демо-заметки:", err);
  }
}

// Middleware: проверка авторизации + user + gravatar + демо-заметка
async function ensureAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/");

  try {
    // Получаем пользователя
    const result = await db.query(
      "SELECT username FROM users WHERE id = $1",
      [req.session.userId]
    );
    const user = result.rows[0];
    if (!user) return res.redirect("/");

    // Создаём демо-заметку при первом входе
    await createDemoNoteIfNone(req.session.userId);

    // Сохраняем данные в шаблон
res.locals.user = {
  username: user.username,
  hash: md5( user.username || "default"),
};

    next();
  } catch (err) {
    console.error("❌ Ошибка в ensureAuth:", err);
    res.redirect("/");
  }
}

// Middleware: редирект если уже авторизован
function redirectIfAuth(req, res, next) {
  if (req.session.userId) return res.redirect("/dashboard");
  next();
}

module.exports = {
  ensureAuth,
  redirectIfAuth,
  createDemoNoteIfNone, // если тебе нужно отдельно
};
