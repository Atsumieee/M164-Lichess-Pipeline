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
  const response = await fetch(`${API_BASE}/tournament/${tournamentId}/games?opening=true`,{
  headers: { Accept: "application/x-ndjson" }
  });

  if (!response.ok) {
    throw new Error(`Games request failed with status ${response.status}`);
  }
  const text = await response.text();
  return parseNdjson(text);
}

export { fetchStandings, fetchGames };