const express = require('express');
const db = require('../db/database');
const { ensureAuth } = require('../middlewares/auth');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');

const fontDir = path.join(__dirname, 'fonts'); // Папка со шрифтами



// 🔍 Получение заметок по фильтру и поиску
router.get("/notes", ensureAuth, async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).send("Неавторизован");
  }

  const { filter = "1month", search = "", page = 1 } = req.query;

  let createdAfter = "1970-01-01";

  if (filter === "1month") {
    createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (filter === "3months") {
    createdAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  }

  const limit = 10;
  const offset = (parseInt(page) - 1) * limit;

  try {
    const values = [userId, createdAfter];
    let query = `
      SELECT *, created_at AS created FROM notes
      WHERE user_id = $1 AND created_at >= $2
    `;

    if (search.trim()) {
      values.push(`%${search.toLowerCase()}%`);
      query += ` AND title_search ILIKE $${values.length}`;
    }

    query += `
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    values.push(limit, offset);

    const result = await db.query(query, values);

    const data = result.rows.map(row => {
      const match = [];

      if (search.trim()) {
        const s = search.toLowerCase();
        const title = (row.title || "").toLowerCase();
        if (title.includes(s)) match.push(s);
      }

      return {
        ...row,
        _id: row.id,
        created: row.created_at,
        matches: match.length ? match : undefined,
      };
    });

    res.json({
      data,
      hasMore: result.rows.length === limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка загрузки заметок");
  }
});


// ✅ Создание заметки
router.post("/notes", ensureAuth, async (req, res) => {
  const { title, text } = req.body;

  if (!title || !text) {
    return res.status(400).json({ error: "Title и Text обязательны" });
  }

  try {
    const result = await db.query(
      `INSERT INTO notes (user_id, title, text, title_search)
       VALUES ($1, $2, $3, unaccent(lower($2)))
       RETURNING *`,
      [req.session.userId, title, text]
    );

    const note = result.rows[0];
    note._id = note.id;
    note.created = note.created_at;

    res.json(note);
  } catch (err) {
    console.error("Ошибка при создании заметки:", err);
    res.status(500).json({ error: "Ошибка при создании заметки" });
  }
});

// 📄 Получить одну заметку
router.get("/notes/:id", ensureAuth, async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
    [id, req.session.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Заметка не найдена" });
  }

  const note = result.rows[0];
  note._id = note.id;
  note.created = note.created_at;

  res.json(note);
});

// ✏️ Обновление заметки
router.put("/notes/:id", ensureAuth, async (req, res) => {
  const { id } = req.params;
  const { title, text } = req.body;

  try {
    const result = await db.query(
      `UPDATE notes
       SET title = $1,
           text = $2,
           title_search = unaccent(lower($1))
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [title, text, id, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Нет доступа к заметке" });
    }

    const note = result.rows[0];
    note._id = note.id;
    note.created = note.created_at;

    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при обновлении" });
  }
});


// 📦 Архивировать
router.post('/notes/:id/archive', ensureAuth, async (req, res) => {
  const { id } = req.params;

  await db.query(
    'UPDATE notes SET archived = TRUE WHERE id = $1 AND user_id = $2',
    [id, req.session.userId]
  );

  res.json({ success: true });
});


// 🔄 Восстановить из архива
router.post('/notes/:id/restore', ensureAuth, async (req, res) => {
  const { id } = req.params;

  await db.query(
    'UPDATE notes SET archived = FALSE WHERE id = $1 AND user_id = $2',
    [id, req.session.userId]
  );

  res.json({ success: true });
});


// 🗑 Удалить заархивированную заметку
router.delete('/notes/:id', ensureAuth, async (req, res) => {
  const { id } = req.params;

  await db.query(
    'DELETE FROM notes WHERE id = $1 AND user_id = $2 AND archived = TRUE',
    [id, req.session.userId]
  );

  res.json({ success: true });
});


// 🗑 Удалить все архивные заметки
router.delete('/notes', ensureAuth, async (req, res) => {
  await db.query(
    'DELETE FROM notes WHERE user_id = $1 AND archived = TRUE',
    [req.session.userId]
  );

  res.json({ success: true });
});


router.get('/notes/:id/pdf', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await db.query('SELECT * FROM notes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Заметка не найдена');
    }

    const note = result.rows[0];
    const doc = new PDFDocument();
    const fontDir = path.join(__dirname, '..', 'fonts');
    // Регистрируем шрифты с понятными ключами
    doc.registerFont('DejaVuSans', path.join(fontDir, 'DejaVuSans.ttf'));
    doc.registerFont('DejaVuSansBold', path.join(fontDir, 'DejaVuSans-Bold.ttf'));
    doc.registerFont('StatusRegular', path.join(fontDir, 'StatusRegular.ttf'));
    doc.registerFont('LorenzoSans', path.join(fontDir, 'Lorenzo Sans.ttf'));

    // Используем основной шрифт с поддержкой кириллицы
    doc.font('DejaVuSans');

    // Заголовок крупным шрифтом, жирным
    doc.font('DejaVuSansBold').fontSize(20).text(note.title, { align: 'center' });
    doc.moveDown();

    // Основной текст заметки обычным шрифтом
    doc.font('DejaVuSans').fontSize(12).text(note.text);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="note-${id}.pdf"`);

    doc.pipe(res);
    doc.end();

  } catch (err) {
    console.error('Ошибка при генерации PDF:', err);
    res.status(500).send('Ошибка при генерации PDF');
  }
});

module.exports = router;
