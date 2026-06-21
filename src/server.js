import express from "express";
import { getOpeningStats, getWinnerStats, getTopPlayers } from "./queries.js";

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