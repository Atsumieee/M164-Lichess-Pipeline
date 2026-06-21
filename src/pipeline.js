import { fetchTournamentInfo, fetchStandings, fetchGames, transformTournament } from "./lichess.js";
import { writeCsv } from "./csv.js";
import { ensureSchema, mergeLoadCsvs } from "./database.js";

const OUTPUT_DIR = "C:\\Users\\Public\\Projects\\M164-Lichess-Pipeline\\data";

// Normalize a date value into a format SQL Server reliably accepts
function toSqlDate(value) {
    if (!value) return null;
    return new Date(value).toISOString().slice(0, 19); // "2024-01-01T12:00:00"
}

// Fetch and import the given tournaments end to end
async function runImport(tournamentIds) {
    const tournaments = [];
    const players = new Map();   // deduplicated across ALL selected tournaments
    const games = [];
    const standings = [];

    for (const id of tournamentIds) {
        const info = await fetchTournamentInfo(id);
        console.log(info)
        const rawStandings = await fetchStandings(id);
        const rawGames = await fetchGames(id);

        const result = transformTournament({ tournament_id: id }, rawStandings, rawGames);

        tournaments.push({
            tournament_id: id,
            name: info.fullName,
            system: "arena",
            start_time: toSqlDate(info.startsAt),
            player_count: info.nbPlayers ?? null
        });

        // Prefer a record that carries a title over one without
        for (const p of result.players) {
            const existing = players.get(p.player_id);
            if (!existing || (p.title && !existing.title)) {
                players.set(p.player_id, p);
            }
        }
        for (const g of result.games) games.push(g);
        for (const s of result.standings) standings.push(s);
    }

    await writeCsv(OUTPUT_DIR, "tournament", tournaments, ["tournament_id", "name", "system", "start_time", "player_count"]);
    await writeCsv(OUTPUT_DIR, "player", [...players.values()], ["player_id", "username", "title"]);
    await writeCsv(OUTPUT_DIR, "game", games, ["game_id", "tournament_id", "white_id", "black_id", "winner", "opening", "move_count"]);
    await writeCsv(OUTPUT_DIR, "standing", standings, ["tournament_id", "player_id", "rank", "points"]);

    await ensureSchema();    // create DB/tables if missing, keep existing data
    await mergeLoadCsvs();   // BULK INSERT into staging, then merge (no duplicates)

    return { tournaments: tournaments.length, players: players.size, games: games.length };
}

export { runImport };