async function holeSpieler(username) {
  try {
    const antwort = await fetch(`https://lichess.org/api/user/${username}`);

    if (!antwort.ok) {
      throw new Error(`Lichess antwortete mit Status ${antwort.status}`);
    }

    const daten = await antwort.json();

    console.log("Name:", daten.username);
    console.log("Bullet-Rating:", daten.perfs.bullet.rating);
  } catch (err) {
    console.error("Konnte Spieler nicht holen:", err.message);
  }
}

holeSpieler("DrNykterstein");   // klappt
holeSpieler("dieseruserexistiertsichernicht12345");   // 404, sauber abgefangen