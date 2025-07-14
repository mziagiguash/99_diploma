const express = require('express');
const router = express.Router();
const db = require('../../db/database');
const checkTelegramAuth = require('../../utils/checkTelegramAuth');
const { createDemoNoteIfNone } = require('../../utils/demoNote');

router.post('/auth/telegram', async (req, res) => {
  const data = req.body;

  if (!checkTelegramAuth(data)) {
    return res.status(403).send('Bad signature');
  }

  try {
    const username = data.username || `telegram_user_${data.id}`;

    let result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    let user = result.rows[0];

    if (!user) {
      result = await db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [username, 'oauth_placeholder']
      );
      user = result.rows[0];
    }

    req.session.userId = user.id;
    await createDemoNoteIfNone(user.id);

    res.sendStatus(200);
  } catch (err) {
    console.error('Telegram auth error:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
