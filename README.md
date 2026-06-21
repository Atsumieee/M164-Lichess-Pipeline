# Lichess Tournament Pipeline (M164)

A Node.js application for the **M164** module (databases). It fetches public
**Lichess arena tournament** data, transforms the nested JSON into flat relational
rows, writes CSV files, bulk-loads them into a **SQL Server 2022 Express** database,
and shows the result in a small web dashboard (the "analysis board").

The web UI lets you browse finished tournaments, import the ones you pick (data
**accumulates** across imports), view dashboard statistics, see the ER diagram, and
reset the database.

---

## What it does

- Fetches arena tournaments from the Lichess public API.
- Transforms them into four tables: `tournament`, `player`, `game`, `standing`.
- Imports via server-side `BULK INSERT` from generated CSVs.
- Dashboard: winner distribution as an engine **eval-bar**, most frequent openings and
  most active players as ranked bars, and the ER diagram.
- Exports the data to an Excel (`.xlsx`) workbook.

## Tech stack

- **Node.js 24** (ES Modules). Environment variables are loaded with Node's built-in
  `--env-file=.env` — no `dotenv` package needed.
- **SQL Server 2022 Express** (named instance `SQLEXPRESS`).
- Dependencies: `mssql`, `express`, `exceljs`.

---

## Setup (6 steps)

### Prerequisites

1. **Node.js 24** — check with `node --version`.
2. **SQL Server 2022 Express** + **SQL Server Management Studio (SSMS)** (or Azure Data
   Studio) to run the setup script.

### One-time SQL Server configuration

The app connects with a **SQL login** (not Windows auth) and resolves the instance by
name, so three things must be enabled:

1. **Mixed-mode authentication** — SSMS → right-click the server → *Properties* →
   *Security* → "SQL Server and Windows Authentication mode" → restart the SQL Server
   service.
2. **TCP/IP enabled** — *SQL Server Configuration Manager* → *SQL Server Network
   Configuration* → *Protocols for SQLEXPRESS* → enable **TCP/IP** → restart the
   service.
3. **SQL Server Browser running** — same tool → *SQL Server Services* → start
   **SQL Server Browser** (and set it to start automatically). This is needed to
   connect by instance name.

### The steps

```bash
# 1. Get the code
git clone <repo-url>
cd lichess-pipeline

# 2. Install dependencies
npm install

# 3. Create your .env from the template, then edit the 4 values
copy .env.example .env        # Windows  (use: cp .env.example .env  in Git Bash)

# 4. Create the SQL login (run db-setup.sql in SSMS as an admin).
#    Change the password in the script first, and use the SAME password in .env.

# 5. Create the database and empty tables
npm run setup

# 6. Start the web server
npm start
```

Then open **http://localhost:3000**.

> On first start the dashboard is empty — that's expected. Click **Turniere laden**,
> pick a tournament, and **Ausgewählte importieren**.

---

## Using it

- **Turniere laden** — loads the list of recently finished tournaments. Ones already in
  the database are shown checked, locked, and badged "importiert".
- **Ausgewählte importieren** — imports the tournaments you ticked. Importing **adds** to
  what's already there (re-importing the same tournament is a no-op).
- **Datenbank zurücksetzen** (bottom of the import panel) — wipes all imported data after
  an inline confirmation.

## Command reference

All commands read `.env` automatically.

| Command | What it does |
|---|---|
| `npm start` | Start the web server at http://localhost:3000 |
| `npm run setup` | Create the database + empty tables (also empties an existing DB) |
| `npm run reset` | Same as setup — empty the tables |
| `npm run import -- <id> [<id> ...]` | Import tournaments from the command line |
| `npm run verify` | Print sample joined rows and check for orphaned games |
| `npm run export` | Export the data to `…/data/export.xlsx` |
| `npm run teardown` | Drop the whole database |

Example: `npm run import -- abcd1234 efgh5678`

---

## Data model

Four tables with **natural keys** (the source IDs are stable, so no surrogate IDs are
needed and `BULK INSERT` is simpler). Players are deduplicated across all tournaments by
lowercased id.

```mermaid
erDiagram
    TOURNAMENT ||--o{ GAME : enthaelt
    TOURNAMENT ||--o{ STANDING : hat
    PLAYER ||--o{ STANDING : steht_in
    PLAYER ||--o{ GAME : spielt_weiss
    PLAYER ||--o{ GAME : spielt_schwarz
    TOURNAMENT {
        nvarchar tournament_id PK
        nvarchar name
        nvarchar system
        datetime2 start_time
        int player_count
    }
    PLAYER {
        nvarchar player_id PK
        nvarchar username
        nvarchar title
    }
    GAME {
        nvarchar game_id PK
        nvarchar tournament_id FK
        nvarchar white_id FK
        nvarchar black_id FK
        nvarchar winner
        nvarchar opening
        int move_count
    }
    STANDING {
        nvarchar tournament_id PK,FK
        nvarchar player_id PK,FK
        int rank
        int points
    }
```

## The three analysis queries

These power the dashboard (`src/queries.js`).

**Winner distribution**
```sql
SELECT winner, COUNT(*) AS count
FROM game
GROUP BY winner
ORDER BY count DESC;
```

**Most frequent openings**
```sql
SELECT ISNULL(opening, 'Unknown') AS opening, COUNT(*) AS count
FROM game
GROUP BY opening
ORDER BY count DESC;
```

**Most active players** (games as white + games as black)
```sql
SELECT player_id, COUNT(*) AS count FROM (
  SELECT white_id AS player_id FROM game
  UNION ALL
  SELECT black_id AS player_id FROM game
) AS both
GROUP BY player_id
ORDER BY count DESC;
```

---

## Project structure

```
src/
  index.js       CLI entry point (setup | teardown | import <ids> | verify | export)
  server.js      Express server: static files + /api routes
  pipeline.js    runImport(ids): fetch -> transform -> CSV -> ensure schema -> merge load
  lichess.js     Lichess API calls + transformTournament()
  database.js    DB library: schema, merge import, reset, verify, export
  queries.js     Read-only query layer (the three dashboard stats + imported IDs)
  csv.js         CSV writing
  export.js      XLSX export
public/
  index.html     Dashboard page
  app.js         Browser logic (stats, import, reset)
  styles.css     Design system / styling
db-setup.sql     One-time SQL login + permissions
.env.example     Template for your .env
```

---

## Troubleshooting

- **Login failed for user 'lichess_app'** — mixed-mode auth is off, the password in
  `.env` doesn't match `db-setup.sql`, or SQL Server Browser isn't running.
- **Cannot connect / instance not found** — TCP/IP not enabled, or SQL Server Browser
  not running (both required to reach a named instance).
- **`You do not have permission to use the bulk load statement`** — the login is missing
  the **`bulkadmin`** role. Re-run `db-setup.sql`.
- **`Cannot bulk load. Operating system error … Access is denied`** — SQL Server reads
  the CSVs server-side from `C:\Users\Public\Projects\M164-Lichess-Pipeline\data`. The
  app creates this folder automatically, but on a locked-down machine the SQL Server
  service account may need read access to it.
