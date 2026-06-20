import { fetchStandings, fetchGames, transformTournament } from "./lichess.js";
import { writeCsv } from "./csv.js";

const TEST_ID = "ZucVODJj";
const OUTPUT_DIR = "C:\\Users\\Public\\Projects\\Lichess-Pipeline\\data";

const standings = await fetchStandings(TEST_ID);
const games = await fetchGames(TEST_ID);


const result = transformTournament({tournament_id: TEST_ID}, standings, games);

await writeCsv(OUTPUT_DIR, "player", result.players, ["player_id", "username", "title"]);
await writeCsv(OUTPUT_DIR, "tournament", [{ tournament_id: TEST_ID, name: "Test", system: "arena", start_time: null, player_count: result.players.length}], ["tournament_id", "name", "system", "start_time", "player_count"]);
await writeCsv(OUTPUT_DIR, "standing", result.standings, ["tournament_id", "player_id", "rank", "points"]);
await writeCsv(OUTPUT_DIR, "game", result.games, ["game_id", "tournament_id", "white_id", "black_id", "winner", "opening", "move_count"]);