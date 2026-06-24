import sql from "mssql";

const config = {
  server: process.env.DB_SERVER ?? 'localhost',
  database: "LichessTournaments",
  ...(process.env.DB_USER ? { user: process.env.DB_USER, password: process.env.DB_PASSWORD } : {}),
  options: {
    instanceName: process.env.DB_INSTANCE ?? 'SQLEXPRESS',
    trustedConnection: !process.env.DB_USER,
    trustServerCertificate: true,
    encrypt: false
  }
};

// Create one shared pool on first use, then reuse it for every request
let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
}

async function getOpeningStats() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT ISNULL(opening, 'Unbekannte Eröffnung') AS opening, COUNT(*) AS count
    FROM game
    GROUP BY opening
    ORDER BY count DESC;
  `);
  return result.recordset;
}

async function getWinnerStats() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT winner, COUNT(*) AS count
    FROM game
    GROUP BY winner
    ORDER BY count DESC;
  `);
  return result.recordset;
}

async function getTopPlayers() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT player_id, COUNT(*) AS count FROM (
      SELECT white_id AS player_id FROM game
      UNION ALL
      SELECT black_id AS player_id FROM game
    ) AS both
    GROUP BY player_id
    ORDER BY count DESC;
  `);
  return result.recordset;
}

// Which tournaments are already in the database (to mark them in the UI)
async function getImportedTournamentIds() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT tournament_id FROM tournament;`);
  return result.recordset.map(row => row.tournament_id);
}

export { getOpeningStats, getWinnerStats, getTopPlayers, getImportedTournamentIds };