const fs = require("fs");
const path = require("path");
const db = require("./db/database"); // Подключение к PostgreSQL

const schemaPath = path.join(__dirname, "schema.sql");
const sql = fs.readFileSync(schemaPath, "utf8");

db.query(sql)
  .then(() => {
    console.log("✅ Схема успешно применена");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Ошибка при выполнении схемы:", err);
    process.exit(1);
  });
