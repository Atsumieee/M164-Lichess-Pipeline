// Fetch JSON from one of our own API routes
async function loadData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

// Render an array of {label, count} rows as a simple list
function renderList(elementId, rows, labelKey) {
  const container = document.getElementById(elementId);
  const items = rows
    .map(row => `<li>${row[labelKey]}: ${row.count}</li>`)
    .join("");
  container.innerHTML = `<ul>${items}</ul>`;
}

async function init() {
  try {
    const winners = await loadData("/api/stats/winners");
    renderList("winners", winners, "winner");

    const openings = await loadData("/api/stats/openings");
    renderList("openings", openings, "opening");

    const topPlayers = await loadData("/api/stats/top-players");
    renderList("top-players", topPlayers, "player_id");
  } catch (error) {
    console.error("Could not load stats:", error.message);
  }
}

init();



// Load the finished-tournament list and show it with checkboxes
async function loadTournaments() {
  const container = document.getElementById("tournament-list");
  container.innerHTML = "Lade...";
  try {
    const tournaments = await loadData("/api/tournaments");
    if (tournaments.length === 0) {
      container.innerHTML = "<p>Keine beendeten Turniere gefunden.</p>";
      return;
    }
    const items = tournaments
      .map(t => `<li>
        <label>
          <input type="checkbox" value="${t.id}">
          ${t.name} (${t.players} Spieler)
        </label>
      </li>`)
      .join("");
    container.innerHTML = `<ul>${items}</ul>`;
  } catch (error) {
    container.innerHTML = `<p>Fehler: ${error.message}</p>`;
  }
}

document.getElementById("load-tournaments").addEventListener("click", loadTournaments);