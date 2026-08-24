declare module 'better-sqlite3' {
  type RunResult = { lastInsertRowid: number }
  type Statement = {
    run: (...values: unknown[]) => RunResult
    get: (...values: unknown[]) => unknown
  }
  type Database = {
    pragma: (value: string) => void
    exec: (value: string) => void
    prepare: (value: string) => Statement
  }
  const Database: new (filename: string) => Database
  export default Database
}
