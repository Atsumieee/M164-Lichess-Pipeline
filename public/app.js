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

// Load all three dashboard statistics (reusable: on startup AND after import)
async function loadStats() {
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

function init() {
  loadStats();
}

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


// Collect checked tournament IDs and send them to the import route
async function importSelected() {
  const checked = document.querySelectorAll("#tournament-list input:checked");
  const ids = [...checked].map(box => box.value);

  const status = document.getElementById("import-status");
  if (ids.length === 0) {
    status.textContent = "Bitte mindestens ein Turnier auswählen.";
    return;
  }

  status.textContent = `Importiere ${ids.length} Turnier(e)... das kann dauern.`;
  try {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const summary = await response.json();
    status.textContent = `Fertig: ${summary.tournaments} Turniere, ${summary.players} Spieler, ${summary.games} Partien.`;
    await loadStats();   // refresh the dashboard with the new data
  } catch (error) {
    status.textContent = `Fehler: ${error.message}`;
  }
}

document.getElementById("import-selected").addEventListener("click", importSelected);