import { setupDatabase, teardownDatabase, verifyData, exportData } from "./database.js";
import { runImport } from "./pipeline.js";

const command = process.argv[2];
const ids = process.argv.slice(3);   // everything after the command = tournament IDs

try {
  if (command === "setup") {
    await setupDatabase();
  } else if (command === "teardown") {
    await teardownDatabase();
  } else if (command === "import") {
    if (ids.length === 0) {
      console.error("Usage: import <tournamentId> [<tournamentId> ...]");
    } else {
      const summary = await runImport(ids);
      console.log("Import done:", summary);
    }
  } else if (command === "verify") {
    await verifyData();
  } else if (command === "export") {
    await exportData();
  } else {
    console.log("Commands: setup | teardown | import <ids...> | verify | export");
  }
} catch (error) {
  console.error("Operation failed:", error.message);
}