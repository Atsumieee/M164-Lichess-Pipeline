import express from "express";
import { getOpeningStats, getWinnerStats, getTopPlayers, getImportedTournamentIds } from "./queries.js";
import { fetchTournamentList } from "./lichess.js";
import { runImport } from "./pipeline.js";
import { setupDatabase } from "./database.js";

const app = express();
const PORT = 3000;

app.use(express.static("public"));
app.use(express.json());

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

app.get("/api/tournaments", async (request, response) => {
  try {
    const data = await fetchTournamentList();
    const finished = (data.finished ?? []).map(t => ({
      id: t.id,
      name: t.fullName,
      players: t.nbPlayers
    }));
    response.json(finished);
  } catch (error) {
    console.error("Lichess API error:", error.message, error.cause ?? "");
    response.status(500).json({ error: error.message });
  }
});

app.get("/api/imported", async (request, response) => {
  try {
    response.json(await getImportedTournamentIds());
  } catch (error) {
    console.error(error.message);
    response.json([]);
  }
});

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

app.post("/api/reset", async (request, response) => {
  try {
    await setupDatabase();
    response.json({ ok: true });
  } catch (error) {
    console.error(error.message);
    response.status(500).json({ error: "Reset failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
