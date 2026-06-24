import { createInterface } from 'readline';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sql from 'mssql';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));

const SERVER = 'localhost';
const INSTANCE = 'SQLEXPRESS';

console.log('\n=== Lichess Pipeline — First-time setup ===\n');
console.log('Prerequisites: SQL Server Express must be running, TCP/IP enabled,');
console.log('and SQL Server Browser started (see README Troubleshooting if unsure).\n');

const answer = (await ask('Use Windows Authentication? (recommended for local installs) [Y/n]: ')).trim().toLowerCase();
const windowsAuth = answer === '' || answer === 'y' || answer === 'yes';

let dbUser, dbPassword;

if (!windowsAuth) {
  dbUser = 'lichess_app';
  const pw = (await ask(`Password for new SQL login '${dbUser}' [press Enter for default]: `)).trim();
  dbPassword = pw || 'ChangeMe_StrongPassword1';

  console.log('\nTo create the SQL login, admin credentials are needed.');
  console.log('Use the "sa" account or any login with sysadmin rights.\n');

  const adminUser = (await ask('Admin username [sa]: ')).trim() || 'sa';
  const adminPassword = (await ask('Admin password: ')).trim();

  const adminPool = new sql.ConnectionPool({
    server: SERVER,
    database: 'master',
    user: adminUser,
    password: adminPassword,
    options: {
      instanceName: INSTANCE,
      trustServerCertificate: true,
      encrypt: false
    }
  });

  try {
    await adminPool.connect();
  } catch (err) {
    console.error('\nCould not connect as admin:', err.message);
    console.error('Check the username/password and make sure mixed-mode authentication is enabled.');
    rl.close();
    process.exit(1);
  }

  const safePw = dbPassword.replace(/'/g, "''");
  await adminPool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '${dbUser}')
      CREATE LOGIN [${dbUser}] WITH PASSWORD = '${safePw}', CHECK_POLICY = OFF;
    IF IS_SRVROLEMEMBER('dbcreator', '${dbUser}') = 0
      ALTER SERVER ROLE dbcreator ADD MEMBER [${dbUser}];
    IF IS_SRVROLEMEMBER('bulkadmin', '${dbUser}') = 0
      ALTER SERVER ROLE bulkadmin ADD MEMBER [${dbUser}];
  `);
  await adminPool.close();
  console.log(`\nSQL login '${dbUser}' is ready.`);
}

// Write .env
const lines = [`DB_SERVER=${SERVER}`, `DB_INSTANCE=${INSTANCE}`];
if (dbUser) {
  lines.push(`DB_USER=${dbUser}`);
  lines.push(`DB_PASSWORD=${dbPassword}`);
}
writeFileSync(join(root, '.env'), lines.join('\n') + '\n');
console.log('.env written.\n');

rl.close();

// Set process.env now so the dynamic import of database.js reads the right values
process.env.DB_SERVER = SERVER;
process.env.DB_INSTANCE = INSTANCE;
if (dbUser) {
  process.env.DB_USER = dbUser;
  process.env.DB_PASSWORD = dbPassword;
}

const { setupDatabase } = await import('./database.js');
await setupDatabase();

console.log('\nAll done! Run "npm start" to open the app at http://localhost:3000');
