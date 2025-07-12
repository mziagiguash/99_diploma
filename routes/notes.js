const express = require('express');
const db = require('../db/database');
const { ensureAuth } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
const path = require('path');

const router = express.Router();
const fontDir = path.join(__dirname, '..', 'fonts');

// 📥 Получение заметок с фильтрацией, поиском и пагинацией
router.get("/notes", ensureAuth, async (req, res) => {
  const userId = req.session.userId;
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

    const paginatedQuery = `${query} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const paginatedValues = [...values, limit, offset];

    const notesResult = await db.query(paginatedQuery, paginatedValues);

    const countQuery = `SELECT COUNT(*) FROM notes WHERE user_id = $1 AND created_at >= $2` +
      (search.trim() ? ` AND title_search ILIKE $3` : '');
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const data = notesResult.rows.map(row => ({
      ...row,
      _id: row.id,
      created: row.created_at,
      matches: search.trim() && row.title.toLowerCase().includes(search.toLowerCase()) ? [search.toLowerCase()] : undefined
    }));

    res.json({ data, hasMore: offset + limit < total });
  } catch (err) {
    console.error("Ошибка при получении заметок:", err);
    res.status(500).send("Ошибка сервера");
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
    res.json({
      ...note,
      _id: note.id,
      created: note.created_at
    });
  } catch (err) {
    console.error("Ошибка при создании заметки:", err);
    res.status(500).json({ error: "Ошибка при создании заметки" });
  }
});

// 🔍 Получить одну заметку
router.get("/notes/:id", ensureAuth, async (req, res) => {
  const { id } = req.params;
  const result = await db.query(
    `SELECT * FROM notes WHERE id = $1 AND user_id = $2`,
    [id, req.session.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Заметка не найдена" });
  }

  const note = result.rows[0];
  res.json({
    ...note,
    _id: note.id,
    created: note.created_at
  });
});

// ✏️ Обновление заметки
router.put("/notes/:id", ensureAuth, async (req, res) => {
  const { id } = req.params;
  const { title, text } = req.body;

  try {
    const result = await db.query(
      `UPDATE notes
       SET title = $1, text = $2, title_search = unaccent(lower($1))
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [title, text, id, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Нет доступа к заметке" });
    }

    const note = result.rows[0];
    res.json({
      ...note,
      _id: note.id,
      created: note.created_at
    });
  } catch (err) {
    console.error("Ошибка при обновлении:", err);
    res.status(500).json({ error: "Ошибка при обновлении" });
  }
});

// 📦 Архивирование / Восстановление
router.post("/notes/:id/archive", ensureAuth, async (req, res) => {
  await db.query(
    `UPDATE notes SET archived = TRUE WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.session.userId]
  );
  res.json({ success: true });
});

router.post("/notes/:id/restore", ensureAuth, async (req, res) => {
  await db.query(
    `UPDATE notes SET archived = FALSE WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.session.userId]
  );
  res.json({ success: true });
});

// 🗑 Удаление одной или всех архивных заметок
router.delete("/notes/:id", ensureAuth, async (req, res) => {
  await db.query(
    `DELETE FROM notes WHERE id = $1 AND user_id = $2 AND archived = TRUE`,
    [req.params.id, req.session.userId]
  );
  res.json({ success: true });
});

router.delete("/notes", ensureAuth, async (req, res) => {
  await db.query(
    `DELETE FROM notes WHERE user_id = $1 AND archived = TRUE`,
    [req.session.userId]
  );
  res.json({ success: true });
});

// 📄 Скачать PDF
router.get("/notes/:id/pdf", ensureAuth, async (req, res) => {
  const id = req.params.id;

  try {
    const result = await db.query(
      `SELECT * FROM notes WHERE id = $1 AND user_id = $2`,
      [id, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Заметка не найдена");
    }

    const note = result.rows[0];

    const doc = new PDFDocument();
    doc.registerFont("DejaVuSans", path.join(fontDir, "DejaVuSans.ttf"));
    doc.registerFont("DejaVuSansBold", path.join(fontDir, "DejaVuSans-Bold.ttf"));
    doc.font('DejaVuSans');

    doc.font("DejaVuSansBold").fontSize(20).text(note.title, { align: "center" });
    doc.moveDown();
    doc.font("DejaVuSans").fontSize(12).text(note.text);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="note-${id}.pdf"`);

    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error("Ошибка при генерации PDF:", err);
    res.status(500).send("Ошибка при генерации PDF");
  }
});

module.exports = router;
