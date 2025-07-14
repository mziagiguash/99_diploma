require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});

console.log('TELEGRAM_BOT_USERNAME:', process.env.TELEGRAM_BOT_USERNAME);
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '***' : 'NOT SET');

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const nunjucks = require("nunjucks");
const passport = require("passport");
const crypto = require("crypto");
const db = require("./db/database");
const pgSession = require('connect-pg-simple')(session);

const app = express();
app.set("trust proxy", 1); // Для Render и прокси

// ===== Сессии =====
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: "session",
  }),
  secret: process.env.JWT_SECRET || "super_secure_jwt_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
}));

// ===== Middleware =====
app.use(express.static("public"));
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ===== Passport =====
require('./routes/auth/passport'); 
app.use(passport.initialize());
app.use(passport.session());

// ===== Nunjucks =====
const env = nunjucks.configure("views", {
  autoescape: true,
  express: app,
});
env.addFilter("md5", (str) => crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex"));
app.set("view engine", "njk");

// ===== Роуты =====
const { ensureAuth, redirectIfAuth } = require("./middlewares/auth");
const notesRoutes = require("./routes/notes");
const passportRoutes = require('./routes/auth/passport'); // Google + GitHub
const telegramRoutes = require('./routes/auth'); // Telegram (POST /auth/telegram)

app.use('/auth', passportRoutes); // /auth/google, /auth/github и их callbacks
app.use(notesRoutes);
app.use(telegramRoutes); // POST /auth/telegram

// ===== Главная =====
app.get("/", redirectIfAuth, (req, res) => {
  res.render("index", { authError: null });
});

// ===== Дашборд =====
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

// ===== 404 =====
app.use((req, res) => {
  if (!req.session.userId) return res.redirect("/");
  res.status(404).render("404");
});

// ===== Запуск =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
