const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'server', 'azza.sqlite');
const db = new Database(dbPath);
try {
  db.prepare("ALTER TABLE users ADD COLUMN password TEXT").run();
  console.log('ALTER TABLE executed');
} catch (err) {
  console.error('Migration error:', err.message);
} finally {
  db.close();
}
