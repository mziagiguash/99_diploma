require("dotenv").config(); // В самом начале — .env

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const nunjucks = require("nunjucks");
const db = require("./db/database");
const pgSession = require('connect-pg-simple')(session);

const authRoutes = require("./routes/auth");
const notesRoutes = require("./routes/notes");
const { ensureAuth, redirectIfAuth } = require("./middlewares/auth");
const passport = require('passport');
require('./auth/passport');

const crypto = require("crypto");

const app = express();

// --- Сессии с PostgreSQL-хранилищем ---
app.use(
  session({
    store: new pgSession({
      pool: db.pool, // используй подключение к Postgres
      tableName: 'session',
    }),
    secret: process.env.JWT_SECRET || "super_secure_jwt_secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Парсеры и статика
app.use(express.static("public"));
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(passport.initialize());
app.use(passport.session());

// Роуты
app.use(authRoutes);
app.use(notesRoutes);

// Nunjucks конфигурация
const env = nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

// Добавляем фильтр md5
env.addFilter("md5", function (str) {
  return crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex");
});

app.set("view engine", "njk");


// Главная
app.get("/", redirectIfAuth, (req, res) => {
  res.render("index", { authError: null });
});

// Дашборд
app.get("/dashboard", ensureAuth, async (req, res) => {
  const filter = req.query.filter || "1month";
  let dateCondition = "";

  if (filter === "1month") {
    dateCondition = "AND created_at > CURRENT_DATE - INTERVAL '1 month'";
  } else if (filter === "3months") {
    dateCondition = "AND created_at > CURRENT_DATE - INTERVAL '3 month'";
  } else if (filter === "archive") {
    dateCondition = "AND archived = true";
  }

  const notes = await db.query(
    `SELECT id, title FROM notes WHERE user_id = $1 ${dateCondition} ORDER BY created_at DESC`,
    [req.session.userId]
  );

  let activeNote = null;
  if (notes.rows.length > 0) {
    const noteRes = await db.query(
      'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
      [notes.rows[0].id, req.session.userId]
    );
    activeNote = noteRes.rows[0];
  }

  res.render("dashboard", { notes: notes.rows, activeNote });
});

// 404
app.use((req, res) => {
  if (!req.session.userId) return res.redirect("/");
  res.status(404).render("404");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
