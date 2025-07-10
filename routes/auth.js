const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/database');
const passport = require('passport');
const router = express.Router();

// 🔧 Функция создания демо-заметки
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
    console.error("Ошибка при создании демо-заметки:", err);
  }
}

// ───── OAuth ─────

// Google auth
router.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    await createDemoNoteIfNone(req.user.id);
    res.redirect('/dashboard');
  }
);

// GitHub
router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  async (req, res) => {
    await createDemoNoteIfNone(req.user.id);
    res.redirect('/dashboard');
  }
);

// Facebook
router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/' }),
  async (req, res) => {
    await createDemoNoteIfNone(req.user.id);
    res.redirect('/dashboard');
  }
);

// ───── Стандартная регистрация ─────

router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('index', { authError: 'Пожалуйста, заполните все поля' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );
    const userId = result.rows[0].id;
    req.session.userId = userId;

    await createDemoNoteIfNone(userId);

    res.redirect('/dashboard');
  } catch (err) {
    res.render('index', { authError: 'Пользователь уже существует или ошибка' });
  }
});

// ───── Логин ─────

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('index', { authError: 'Пожалуйста, заполните все поля' });
  }
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user) {
    return res.render('index', { authError: 'Неверный логин или пароль' });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.render('index', { authError: 'Неверный логин или пароль' });
  }
  req.session.userId = user.id;

  await createDemoNoteIfNone(user.id);

  res.redirect('/dashboard');
});

// ───── Выход ─────

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
