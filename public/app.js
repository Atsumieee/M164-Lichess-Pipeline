// Browser logic for the analysis-board dashboard:
// loads the three stats, renders the eval-bar + ranked bars, drives import.

const TOP_N = 8;
const nf = new Intl.NumberFormat("de-DE");
const fmt = n => nf.format(n);

// German labels for the three winner buckets coming from the API
const WINNER_LABELS = { white: "Weiss", draw: "Remis", black: "Schwarz" };
const WINNER_ORDER = ["white", "draw", "black"];

// Fetch JSON from one of our own API routes
async function loadData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

// Reveal animated widths on the next frame so the CSS transition runs
// (under prefers-reduced-motion the transition is disabled, so this is instant).
function revealWidths(setters) {
  requestAnimationFrame(() => {
    for (const set of setters) set();
  });
}

// ---- Skeletons --------------------------------------------------------------
function skeletonBar(container) {
  container.innerHTML = `<div class="skeleton" style="height:2.75rem"></div>`;
}
function skeletonRanks(container) {
  container.innerHTML = `<div class="ranks">${
    Array.from({ length: 5 }, () => `<div class="skeleton" style="height:1.6rem"></div>`).join("")
  }</div>`;
}

// ---- Eval-bar (winner distribution, the signature element) ------------------
function renderEvalBar(container, rows) {
  const counts = Object.fromEntries(WINNER_ORDER.map(k => [k, 0]));
  for (const row of rows) {
    if (row.winner in counts) counts[row.winner] = row.count;
  }
  const total = WINNER_ORDER.reduce((sum, k) => sum + counts[k], 0);

  if (total === 0) {
    container.innerHTML = `<p class="empty">Noch keine Partien importiert. Wähle oben Turniere aus.</p>`;
    return;
  }

  const pct = k => (counts[k] / total) * 100;

  container.innerHTML = `
    <div class="evalbar" role="img"
         aria-label="Sieg-Verteilung: Weiss ${fmt(counts.white)}, Remis ${fmt(counts.draw)}, Schwarz ${fmt(counts.black)}">
      <div class="evalbar__seg evalbar__seg--white" data-w="${pct("white")}"></div>
      <div class="evalbar__seg evalbar__seg--draw"  data-w="${pct("draw")}"></div>
      <div class="evalbar__seg evalbar__seg--black" data-w="${pct("black")}"></div>
    </div>
    <div class="legend">
      ${WINNER_ORDER.map(k => `
        <span class="legend__item">
          <span class="legend__swatch legend__swatch--${k}"></span>
          <span class="legend__label">${WINNER_LABELS[k]}</span>
          <span class="legend__val num">${fmt(counts[k])}</span>
          <span class="legend__pct">${Math.round(pct(k))}%</span>
        </span>`).join("")}
    </div>`;

  const segs = container.querySelectorAll(".evalbar__seg");
  revealWidths([...segs].map(seg => () => { seg.style.width = `${seg.dataset.w}%`; }));
}

// ---- Ranked horizontal bars -------------------------------------------------
function renderRanks(container, rows, labelKey) {
  const top = rows.slice(0, TOP_N);
  if (top.length === 0) {
    container.innerHTML = `<p class="empty">Noch keine Daten.</p>`;
    return;
  }
  const max = Math.max(...top.map(r => r.count));

  container.innerHTML = `<div class="ranks">${
    top.map(r => `
      <div class="rank">
        <span class="rank__label">${r[labelKey]}</span>
        <span class="rank__val num">${fmt(r.count)}</span>
        <span class="rank__track"><span class="rank__fill" data-w="${(r.count / max) * 100}"></span></span>
      </div>`).join("")
  }</div>`;

  const fills = container.querySelectorAll(".rank__fill");
  revealWidths([...fills].map((fill, i) => () => {
    fill.style.transitionDelay = `${i * 40}ms`;   // staggered cascade
    fill.style.width = `${fill.dataset.w}%`;
  }));
}

// ---- Stats orchestration ----------------------------------------------------
function updateCounts(winners, players) {
  const games = winners.reduce((sum, r) => sum + r.count, 0);
  const el = document.getElementById("counts");
  el.innerHTML = games === 0
    ? ""
    : `<b>${fmt(games)}</b> Partien · <b>${fmt(players.length)}</b> Spieler`;
}

async function loadStats() {
  const winnersEl = document.getElementById("winners");
  const openingsEl = document.getElementById("openings");
  const playersEl = document.getElementById("top-players");
  skeletonBar(winnersEl);
  skeletonRanks(openingsEl);
  skeletonRanks(playersEl);

  try {
    const [winners, openings, topPlayers] = await Promise.all([
      loadData("/api/stats/winners"),
      loadData("/api/stats/openings"),
      loadData("/api/stats/top-players")
    ]);
    renderEvalBar(winnersEl, winners);
    renderRanks(openingsEl, openings, "opening");
    renderRanks(playersEl, topPlayers, "player_id");
    updateCounts(winners, topPlayers);
  } catch (error) {
    console.error("Could not load stats:", error.message);
    winnersEl.innerHTML = `<p class="empty">Statistiken konnten nicht geladen werden.</p>`;
  }
}

// ---- Tournament discovery + import -----------------------------------------
const importBtn = document.getElementById("import-selected");
const tournamentList = document.getElementById("tournament-list");
const IMPORT_LABEL = "Ausgewählte importieren";

function syncImportButton() {
  // Only newly selectable rows count; already-imported rows are locked
  const count = document.querySelectorAll("#tournament-list input:checked:not(:disabled)").length;
  importBtn.disabled = count === 0;
  importBtn.textContent = count === 0 ? IMPORT_LABEL : `${IMPORT_LABEL} (${count})`;
}

// One delegated listener for the whole list (rows are re-rendered on each load)
tournamentList.addEventListener("change", syncImportButton);

async function loadTournaments() {
  const container = document.getElementById("tournament-list");
  container.innerHTML = `<ul class="tlist">${
    Array.from({ length: 4 }, () => `<li class="skeleton" style="height:2.6rem"></li>`).join("")
  }</ul>`;
  try {
    const [tournaments, imported] = await Promise.all([
      loadData("/api/tournaments"),
      loadData("/api/imported")
    ]);
    if (tournaments.length === 0) {
      container.innerHTML = `<p class="empty">Keine beendeten Turniere gefunden.</p>`;
      return;
    }
    const importedSet = new Set(imported);
    container.innerHTML = `<ul class="tlist">${
      tournaments.map(t => {
        const isImported = importedSet.has(t.id);
        return `
        <li>
          <label class="tlist__row${isImported ? " tlist__row--imported" : ""}">
            <input type="checkbox" value="${t.id}"${isImported ? " checked disabled" : ""}>
            <span class="tlist__name">${t.name}</span>
            ${isImported ? `<span class="tlist__badge">importiert</span>` : ""}
            <span class="tlist__meta num">${fmt(t.players)} Spieler</span>
          </label>
        </li>`;
      }).join("")
    }</ul>`;
    syncImportButton();
  } catch (error) {
    container.innerHTML = `<p class="empty">Fehler: ${error.message}</p>`;
  }
}

async function importSelected() {
  const checked = document.querySelectorAll("#tournament-list input:checked:not(:disabled)");
  const ids = [...checked].map(box => box.value);
  const status = document.getElementById("import-status");

  if (ids.length === 0) {
    status.dataset.state = "error";
    status.textContent = "Bitte mindestens ein Turnier auswählen.";
    return;
  }

  // Collapse the selector and show live activity the moment import starts
  tournamentList.innerHTML =
    `<div class="progress" role="progressbar" aria-label="Import läuft"><div class="progress__bar"></div></div>`;
  status.dataset.state = "";
  status.textContent = `Importiere ${ids.length} Turnier(e)… das kann dauern.`;
  importBtn.disabled = true;
  importBtn.textContent = "Importiere…";

  try {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const summary = await response.json();
    status.dataset.state = "done";
    status.textContent =
      `Fertig: ${summary.tournaments} Turniere, ${summary.players} Spieler, ${summary.games} Partien hinzugefügt. ` +
      `„Turniere laden“ für weitere.`;
    tournamentList.innerHTML = "";   // stays collapsed until reloaded
    await loadStats();               // refresh the dashboard with the new data
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = `Fehler: ${error.message}`;
    tournamentList.innerHTML = "";
  } finally {
    syncImportButton();
  }
}

document.getElementById("load-tournaments").addEventListener("click", loadTournaments);
importBtn.addEventListener("click", importSelected);

// ---- Reset (wipe all imported data) ----------------------------------------
const resetBtn = document.getElementById("reset-db");
const resetConfirm = document.getElementById("reset-confirm");

resetBtn.addEventListener("click", () => {
  resetConfirm.hidden = false;
  resetBtn.disabled = true;
});
document.getElementById("reset-no").addEventListener("click", () => {
  resetConfirm.hidden = true;
  resetBtn.disabled = false;
});
document.getElementById("reset-yes").addEventListener("click", async () => {
  const status = document.getElementById("import-status");
  resetConfirm.hidden = true;
  tournamentList.innerHTML =
    `<div class="progress" role="progressbar" aria-label="Zurücksetzen läuft"><div class="progress__bar"></div></div>`;
  status.dataset.state = "";
  status.textContent = "Datenbank wird zurückgesetzt…";

  try {
    const response = await fetch("/api/reset", { method: "POST" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    status.dataset.state = "done";
    status.textContent = "Datenbank zurückgesetzt. Alle Daten wurden gelöscht.";
    tournamentList.innerHTML = "";
    await loadStats();
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = `Fehler beim Zurücksetzen: ${error.message}`;
    tournamentList.innerHTML = "";
  } finally {
    resetBtn.disabled = false;
  }
});

loadStats();
