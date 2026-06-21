import sql from "mssql";

const config = {
  server: process.env.DB_SERVER,
  database: "LichessTournaments",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    instanceName: process.env.DB_INSTANCE,
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
    SELECT ISNULL(opening, 'Unknown') AS opening, COUNT(*) AS count
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

export { getOpeningStats, getWinnerStats, getTopPlayers };