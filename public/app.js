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