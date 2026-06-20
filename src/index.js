import { fetchStandings, fetchGames } from "./lichess.js";

const TEST_ID = "ZucVODJj";

const standings = await fetchStandings(TEST_ID);
console.log("Number of players:", standings.length);
console.log("First standing:", standings[0]);

const games = await fetchGames(TEST_ID);
console.log("Number of games:", games.length);
console.log("First game (white):", games[0].players.white.user.name);
console.log("First game (winner):", games[0].winner);
console.log("First game (opening):", games[0].opening?.name);