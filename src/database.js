import sql from "mssql";
import { exportToXlsx } from "./export.js";

const DATA_DIR = "C:\\Users\\Public\\Projects\\M164-Lichess-Pipeline\\data"


const config = {
  server: process.env.DB_SERVER,
  database: "master",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    instanceName: process.env.DB_INSTANCE,
    trustServerCertificate: true,
    encrypt: false
  }
};

// Function to test connection to the SQL-Server
async function testConnection() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT SUSER_SNAME() AS who");
    console.log("Connected as:", result.recordset[0].who);
    await pool.close();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}



const DB_NAME = "LichessTournaments";

// Shared connection settings for every connection we open
const baseConfig = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    instanceName: process.env.DB_INSTANCE,
    trustServerCertificate: true,
    encrypt: false
  }
};

// "master" always exists -> used to create or drop our own database
const masterConfig = { ...baseConfig, database: "master" };
// Our project database -> used to build the tables inside it
const appConfig = { ...baseConfig, database: DB_NAME };

// Drop children first (reverse FK order), then create parents first
const schemaSql = `
DROP TABLE IF EXISTS standing;
DROP TABLE IF EXISTS game;
DROP TABLE IF EXISTS player;
DROP TABLE IF EXISTS tournament;

CREATE TABLE tournament (
  tournament_id NVARCHAR(20) PRIMARY KEY,
  name NVARCHAR(255),
  system NVARCHAR(20),
  start_time DATETIME2,
  player_count INT
);

CREATE TABLE player (
  player_id NVARCHAR(50) PRIMARY KEY,
  username NVARCHAR(50),
  title NVARCHAR(10) NULL
);

CREATE TABLE game (
  game_id NVARCHAR(20) PRIMARY KEY,
  tournament_id NVARCHAR(20) NOT NULL,
  white_id NVARCHAR(50) NOT NULL,
  black_id NVARCHAR(50) NOT NULL,
  winner NVARCHAR(10) NULL,
  opening NVARCHAR(255) NULL,
  move_count INT NULL,
  CONSTRAINT fk_game_tournament FOREIGN KEY (tournament_id) REFERENCES tournament(tournament_id),
  CONSTRAINT fk_game_white FOREIGN KEY (white_id) REFERENCES player(player_id),
  CONSTRAINT fk_game_black FOREIGN KEY (black_id) REFERENCES player(player_id)
);

CREATE TABLE standing (
  tournament_id NVARCHAR(20) NOT NULL,
  player_id NVARCHAR(50) NOT NULL,
  [rank] INT,
  points INT,
  CONSTRAINT pk_standing PRIMARY KEY (tournament_id, player_id),
  CONSTRAINT fk_standing_tournament FOREIGN KEY (tournament_id) REFERENCES tournament(tournament_id),
  CONSTRAINT fk_standing_player FOREIGN KEY (player_id) REFERENCES player(player_id)
);
`;

// Create the database (if missing) and build a fresh set of tables
async function setupDatabase() {
  // Step 1: ensure the database exists -> talk to master for this
  const masterPool = new sql.ConnectionPool(masterConfig);
  await masterPool.connect();
  await masterPool.request().batch(
    `IF DB_ID('${DB_NAME}') IS NULL CREATE DATABASE ${DB_NAME}`
  );
  await masterPool.close();

  // Step 2: build the tables inside our own database
  const appPool = new sql.ConnectionPool(appConfig);
  await appPool.connect();
  await appPool.request().batch(schemaSql);
  await appPool.close();

  console.log(`Database '${DB_NAME}' is ready with a fresh schema.`);
}

// Create the database and tables only if they are missing (NO drop).
// Used by the merge import path so previously imported data is preserved.
const ensureSchemaSql = `
IF OBJECT_ID('tournament', 'U') IS NULL
CREATE TABLE tournament (
  tournament_id NVARCHAR(20) PRIMARY KEY,
  name NVARCHAR(255),
  system NVARCHAR(20),
  start_time DATETIME2,
  player_count INT
);

IF OBJECT_ID('player', 'U') IS NULL
CREATE TABLE player (
  player_id NVARCHAR(50) PRIMARY KEY,
  username NVARCHAR(50),
  title NVARCHAR(10) NULL
);

IF OBJECT_ID('game', 'U') IS NULL
CREATE TABLE game (
  game_id NVARCHAR(20) PRIMARY KEY,
  tournament_id NVARCHAR(20) NOT NULL,
  white_id NVARCHAR(50) NOT NULL,
  black_id NVARCHAR(50) NOT NULL,
  winner NVARCHAR(10) NULL,
  opening NVARCHAR(255) NULL,
  move_count INT NULL,
  CONSTRAINT fk_game_tournament FOREIGN KEY (tournament_id) REFERENCES tournament(tournament_id),
  CONSTRAINT fk_game_white FOREIGN KEY (white_id) REFERENCES player(player_id),
  CONSTRAINT fk_game_black FOREIGN KEY (black_id) REFERENCES player(player_id)
);

IF OBJECT_ID('standing', 'U') IS NULL
CREATE TABLE standing (
  tournament_id NVARCHAR(20) NOT NULL,
  player_id NVARCHAR(50) NOT NULL,
  [rank] INT,
  points INT,
  CONSTRAINT pk_standing PRIMARY KEY (tournament_id, player_id),
  CONSTRAINT fk_standing_tournament FOREIGN KEY (tournament_id) REFERENCES tournament(tournament_id),
  CONSTRAINT fk_standing_player FOREIGN KEY (player_id) REFERENCES player(player_id)
);
`;

async function ensureSchema() {
  // Step 1: create the database if it does not exist yet
  const masterPool = new sql.ConnectionPool(masterConfig);
  await masterPool.connect();
  await masterPool.request().batch(
    `IF DB_ID('${DB_NAME}') IS NULL CREATE DATABASE ${DB_NAME}`
  );
  await masterPool.close();

  // Step 2: create the tables only if they are missing (keeps existing rows)
  const appPool = new sql.ConnectionPool(appConfig);
  await appPool.connect();
  await appPool.request().batch(ensureSchemaSql);
  await appPool.close();

  console.log(`Database '${DB_NAME}' schema ensured (existing data kept).`);
}

// Drop the whole database -> leaves no trace behind
async function teardownDatabase() {
  const masterPool = new sql.ConnectionPool(masterConfig);
  await masterPool.connect();
  await masterPool.request().batch(`
    IF DB_ID('${DB_NAME}') IS NOT NULL
    BEGIN
      ALTER DATABASE ${DB_NAME} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE ${DB_NAME};
    END
  `);
  await masterPool.close();

  console.log(`Database '${DB_NAME}' removed.`);
}


// Bulk load one CSV file into one table (server-side read)
async function bulkLoad(pool, table, fileName) {
  const command = `
    BULK INSERT ${table}
    FROM '${DATA_DIR}\\${fileName}'
    WITH (
      FORMAT = 'CSV',
      FIRSTROW = 2,
      FIELDQUOTE = '"',
      FIELDTERMINATOR = ',',
      ROWTERMINATOR = '0x0a',
      CODEPAGE = '65001'
    );
  `;
  await pool.request().batch(command);
  console.log(`Loaded ${table}`);
}

// Load all four CSV files in dependency order (parents before children)
async function bulkLoadCsvs() {
  const pool = new sql.ConnectionPool(appConfig);
  await pool.connect();
  try {
    await bulkLoad(pool, "tournament", "tournament.csv");
    await bulkLoad(pool, "player", "player.csv");
    await bulkLoad(pool, "game", "game.csv");
    await bulkLoad(pool, "standing", "standing.csv");
  } finally {
    await pool.close();
  }
  console.log("Import complete.");
}

// Staging tables mirror the CSV columns but carry no keys/constraints,
// so BULK INSERT never conflicts with existing data.
const stageDdl = `
DROP TABLE IF EXISTS stage_standing;
DROP TABLE IF EXISTS stage_game;
DROP TABLE IF EXISTS stage_player;
DROP TABLE IF EXISTS stage_tournament;

CREATE TABLE stage_tournament (tournament_id NVARCHAR(20), name NVARCHAR(255), system NVARCHAR(20), start_time DATETIME2, player_count INT);
CREATE TABLE stage_player (player_id NVARCHAR(50), username NVARCHAR(50), title NVARCHAR(10) NULL);
CREATE TABLE stage_game (game_id NVARCHAR(20), tournament_id NVARCHAR(20), white_id NVARCHAR(50), black_id NVARCHAR(50), winner NVARCHAR(10) NULL, opening NVARCHAR(255) NULL, move_count INT NULL);
CREATE TABLE stage_standing (tournament_id NVARCHAR(20), player_id NVARCHAR(50), [rank] INT, points INT);
`;

// Insert only rows that are not already present, parents before children,
// then drop the staging tables again. Re-importing a tournament is a no-op.
const mergeSql = `
SET XACT_ABORT ON;
BEGIN TRANSACTION;

INSERT INTO tournament (tournament_id, name, system, start_time, player_count)
SELECT s.tournament_id, s.name, s.system, s.start_time, s.player_count
FROM stage_tournament s
WHERE NOT EXISTS (SELECT 1 FROM tournament t WHERE t.tournament_id = s.tournament_id);

-- Players with full info from the player CSV
INSERT INTO player (player_id, username, title)
SELECT s.player_id, s.username, s.title
FROM stage_player s
WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.player_id = s.player_id);

-- Safety net: guarantee every player_id referenced by games or standings
-- exists, even if its row was missing from the player CSV. Falls back to the
-- id as username. This keeps the FK constraints satisfied no matter what.
INSERT INTO player (player_id, username, title)
SELECT ref.id, ref.id, NULL
FROM (
  SELECT white_id AS id FROM stage_game
  UNION SELECT black_id FROM stage_game
  UNION SELECT player_id FROM stage_standing
) ref
WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.player_id = ref.id);

INSERT INTO game (game_id, tournament_id, white_id, black_id, winner, opening, move_count)
SELECT s.game_id, s.tournament_id, s.white_id, s.black_id, s.winner, s.opening, s.move_count
FROM stage_game s
WHERE NOT EXISTS (SELECT 1 FROM game g WHERE g.game_id = s.game_id);

INSERT INTO standing (tournament_id, player_id, [rank], points)
SELECT s.tournament_id, s.player_id, s.[rank], s.points
FROM stage_standing s
WHERE NOT EXISTS (SELECT 1 FROM standing x WHERE x.tournament_id = s.tournament_id AND x.player_id = s.player_id);

COMMIT TRANSACTION;

DROP TABLE stage_standing;
DROP TABLE stage_game;
DROP TABLE stage_player;
DROP TABLE stage_tournament;
`;

// Bulk load the four CSVs into staging, then merge into the real tables.
async function mergeLoadCsvs() {
  const pool = new sql.ConnectionPool(appConfig);
  await pool.connect();
  try {
    await pool.request().batch(stageDdl);
    await bulkLoad(pool, "stage_tournament", "tournament.csv");
    await bulkLoad(pool, "stage_player", "player.csv");
    await bulkLoad(pool, "stage_game", "game.csv");
    await bulkLoad(pool, "stage_standing", "standing.csv");
    await pool.request().batch(mergeSql);
  } finally {
    await pool.close();
  }
  console.log("Merge import complete.");
}




async function verifyData() {

  const pool = new sql.ConnectionPool(appConfig);
  await pool.connect()

  try{

    const result = await pool.request().query(`
        SELECT TOP 5
          t.name AS tournament,
          w.username AS white_player,
          b.username AS black_player,
          g.winner,
          g.opening
        FROM game AS g
        JOIN tournament AS t ON g.tournament_id = t.tournament_id
        JOIN player w ON g.white_id = w.player_id
        JOIN player b ON g.black_id = b.player_id;
      `);
    console.table(result.recordset);

    const orphans = await pool.request().query(`
        SELECT COUNT(*) AS orphan_games
        FROM game AS g
        LEFT JOIN player AS p ON g.white_id = p.player_id
        WHERE p.player_id IS NULL;
      `);

      console.log("Games with a missing white player:", orphans.recordset[0].orphan_games);


  } finally {
    await pool.close;
  }

};



async function exportData() {

  const pool = new sql.ConnectionPool(appConfig);
  await pool.connect();

  try {
    await exportToXlsx(pool, `${DATA_DIR}\\export.xlsx`);
  } finally {
    await pool.close();
  }

}


export { setupDatabase, ensureSchema, teardownDatabase, bulkLoadCsvs, mergeLoadCsvs, verifyData, exportData };



