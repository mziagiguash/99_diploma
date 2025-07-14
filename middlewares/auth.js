const db = require('../db/database');
const { createDemoNoteIfNone } = require('../utils/demoNote');
const crypto = require('crypto');

function md5(str) {
  return crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex");
}

// Проверка сессии, загрузка юзера и демо-заметки
async function ensureAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/");

  try {
    const result = await db.query("SELECT username FROM users WHERE id = $1", [req.session.userId]);
    const user = result.rows[0];
    if (!user) return res.redirect("/");

    await createDemoNoteIfNone(req.session.userId);

    res.locals.user = {
      username: user.username,
      hash: md5(user.username || "default"),
    };

    next();
  } catch (err) {
    console.error("❌ Ошибка в ensureAuth:", err);
    res.redirect("/");
  }
}

function redirectIfAuth(req, res, next) {
  if (req.session.userId) return res.redirect("/dashboard");
  next();
}

module.exports = {
  ensureAuth,
  redirectIfAuth,
};
