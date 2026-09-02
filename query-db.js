const Database = require('better-sqlite3');
const db = new Database('server/azza.sqlite');
console.log('Tables:');
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
console.log(tables);
console.log('\nPRAGMA table_info(users):');
console.log(db.prepare("PRAGMA table_info(users)").all());
db.close();
