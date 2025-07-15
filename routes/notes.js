const express = require('express');
const db = require('../db/database');
const { ensureAuth } = require('../middlewares/auth');
const markdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

const router = express.Router();
const md = new markdownIt();

// 📥 Получение заметок с фильтрацией, поиском и пагинацией
router.get("/notes", ensureAuth, async (req, res) => {
  const userId = req.session.userId;
  const { filter = "1month", search = "", page = "1" } = req.query;

  const limit = 10;
  const pageNum = parseInt(page, 10) || 1;
  const offset = (pageNum - 1) * limit;

  try {
    const values = [userId];
    let query = `SELECT *, created_at AS created FROM notes WHERE user_id = $1`;
    let countQuery = `SELECT COUNT(*) FROM notes WHERE user_id = $1`;

    if (filter === "archive") {
      query += ` AND archived = TRUE`;
      countQuery += ` AND archived = TRUE`;
    } else {
      let createdAfter = "1970-01-01";
      if (filter === "1month") {
        createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (filter === "3months") {
        createdAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      }
      values.push(createdAfter);
      query += ` AND created_at >= $${values.length} AND archived = FALSE`;
      countQuery += ` AND created_at >= $${values.length} AND archived = FALSE`;
    }

    if (search.trim()) {
      values.push(`%${search.toLowerCase()}%`);
      query += ` AND title_search ILIKE $${values.length}`;
      countQuery += ` AND title_search ILIKE $${values.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const paginatedValues = [...values, limit, offset];

    const notesResult = await db.query(query, paginatedValues);
    const countResult = await db.query(countQuery, values);

    const total = parseInt(countResult.rows[0].count, 10);
    const hasMore = offset + limit < total;

    const data = notesResult.rows.map(row => ({
      ...row,
      _id: row.id,
      created: row.created_at,
      matches: search.trim() && row.title.toLowerCase().includes(search.toLowerCase()) ? [search.toLowerCase()] : undefined
    }));

    console.log({ pageNum, offset, limit, total, hasMore });

    res.json({ data, hasMore });
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

// 📄 Скачать PDF через puppeteer (Markdown -> HTML -> PDF)
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
    const markdown = `# ${note.title}\n\n${note.text}`;
    const html = md.render(markdown);

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(`
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { text-align: center; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"note-${id}.pdf\"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Ошибка при генерации PDF:", err);
    res.status(500).send("Ошибка при генерации PDF");
  }
});

module.exports = router;
