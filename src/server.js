import express from "express";
import { getOpeningStats, getWinnerStats, getTopPlayers } from "./queries.js";
import { fetchTournamentList } from "./lichess.js";
import { runImport } from "./pipeline.js";

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.get("/api/stats/openings", async (request, response) => {
  try {
    response.json(await getOpeningStats());
  } catch (error) {
    console.error(error.message);
    response.status(500).json({ error: "Query failed" });
  }
});

app.get("/api/stats/winners", async (request, response) => {
  try {
    response.json(await getWinnerStats());
  } catch (error) {
    console.error(error.message);
    response.status(500).json({ error: "Query failed" });
  }
});

app.get("/api/stats/top-players", async (request, response) => {
  try {
    response.json(await getTopPlayers());
  } catch (error) {
    console.error(error.message);
    response.status(500).json({ error: "Query failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});



app.get("/api/tournaments", async (request, response) => {
  try {
    const data = await fetchTournamentList();
    // Only finished tournaments are stable enough to import
    const finished = (data.finished ?? []).map(t => ({
      id: t.id,
      name: t.fullName,
      players: t.nbPlayers
    }));
    response.json(finished);
  } catch (error) {
    console.error(error.message);
    response.status(500).json({ error: "Could not load tournaments" });
  }
});



// Allow the server to read JSON bodies from POST requests
app.use(express.json());

app.post("/api/import", async (request, response) => {
  const ids = request.body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return response.status(400).json({ error: "No tournament IDs provided" });
  }
  try {
    const summary = await runImport(ids);
    response.json(summary);
  } catch (error) {
    console.error(error.message);
    response.status(500).json({ error: "Import failed" });
  }
});