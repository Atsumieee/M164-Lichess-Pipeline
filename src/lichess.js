const API_BASE = "https://lichess.org/api";

// Turn an NDJSON response body into an array of objects
function parseNdjson(text) {
  return text
    .trim()
    .split("\n")
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line));
}

// Fetch the standings of one arena tournament
async function fetchStandings(tournamentId) {
  const response = await fetch(`${API_BASE}/tournament/${tournamentId}/results`);
  if (!response.ok) {
    throw new Error(`Results request failed with status ${response.status}`);
  }
  const text = await response.text();
  return parseNdjson(text);
}

// Fetch all games of one arena tournament
async function fetchGames(tournamentId) {
  // We need to explicitly state that we want the NDJSON-Format, otherwise we would get the PNG-Format
  const response = await fetch(`${API_BASE}/tournament/${tournamentId}/games?opening=true`, {
    headers: { Accept: "application/x-ndjson" }
  });

  if (!response.ok) {
    throw new Error(`Games request failed with status ${response.status}`);
  }
  const text = await response.text();
  return parseNdjson(text);
}



// Transform raw API data of one tournament into flat table rows
function transformTournament(tournamentMeta, standings, games) {
  // player are deduplicated by id across both sources
  const players = new Map();

  // Collect players from the standing
  for (const entry of standings) {
    const id = entry.username?.toLowerCase();
    players.set(id, {player_id: id, username: entry.username, title: entry.title ?? null});    
  }

  // Build standing rows (one per player in this tournament)
  const standingRows = standings.map(entry => ({
    tournament_id: tournamentMeta.tournament_id,
    player_id: entry.username.toLowerCase(),
    rank: entry.rank,
    points: entry.score
  }));

  const gameRows= [];
  for (const game of games) {
    const whiteName = game.players?.white?.user?.name;
    const blackName = game.players?.black?.user?.name;

    if (!whiteName || !blackName) continue;

    const whiteId = whiteName.toLowerCase();
    const blackId = blackName.toLowerCase();

    if (!players.has(whiteId)) players.set(whiteId, { player_id: whiteId, username: whiteName, title: null});
    if (!players.has(blackId)) players.set(blackId, { player_id: blackId, username: blackName, title: null});


    gameRows.push({
      game_id: game.id,
      tournament_id: tournamentMeta.tournament_id,
      white_id: whiteId,
      black_id: blackId,
      winner: game.winner ?? "draw",
      opening: game.opening?.name ?? null,
      move_count: game.moves ? game.moves.split(" ").length : 0
    });
  }

  return {
    players: [...players.values()],
    standings: standingRows,
    games: gameRows
  }

};



// Fetch the list of currently visible arena tournaments (finished/ongoing/upcoming)
async function fetchTournamentList() {
  const response = await fetch(`${API_BASE}/tournament`, {
    headers: { "User-Agent": "M164-Lichess-Pipeline/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Tournament list failed with status ${response.status}`);
  }
  return response.json();
}

// Fetch metadata about one arena tournament
async function fetchTournamentInfo(tournamentId) {
  const response = await fetch(`${API_BASE}/tournament/${tournamentId}`);
  if (!response.ok) {
    throw new Error(`Tournament info failed with status ${response.status}`);
  }
  return response.json();
}

export { fetchStandings, fetchGames, transformTournament, fetchTournamentList, fetchTournamentInfo };