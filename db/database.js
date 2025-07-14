const { Pool } = require("pg");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config(); // локально
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false } // Render требует SSL
    : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
