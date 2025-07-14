const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/database');
const passport = require('passport');
const router = express.Router();

const { createDemoNoteIfNone } = require("../utils/demoNote");

// === Google OAuth ===
router.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    await createDemoNoteIfNone(req.user.id);
    res.redirect('/dashboard');
  }
);

// === GitHub OAuth ===
router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  async (req, res) => {
    await createDemoNoteIfNone(req.user.id);
    res.redirect('/dashboard');
  }
);

// === Signup ===
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

// === Login ===
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

// === Logout ===
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
