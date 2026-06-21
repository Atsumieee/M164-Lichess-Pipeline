/* ============================================================================
   db-setup.sql  —  one-time SQL Server setup for the Lichess Tournament Pipeline

   Run this ONCE, as an administrator (e.g. the "sa" login or a Windows admin),
   in SQL Server Management Studio (SSMS) or Azure Data Studio, connected to
   your SQLEXPRESS instance.

   It creates the login the app uses and grants exactly the permissions it needs:
     - dbcreator : the app creates its own database ("LichessTournaments")
     - bulkadmin : required for BULK INSERT (the import will fail without it)

   IMPORTANT: change the password below, and use the SAME value in your .env file.
   ============================================================================ */

-- 1. Create the application login (SQL Server authentication, not Windows).
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'lichess_app')
BEGIN
    CREATE LOGIN lichess_app
        WITH PASSWORD = 'ChangeMe_StrongPassword1',
             CHECK_POLICY = OFF;   -- relaxed policy for a school/local setup
END;

-- 2. Allow the login to create its own database (it becomes the owner).
ALTER SERVER ROLE dbcreator ADD MEMBER lichess_app;

-- 3. Allow the login to run BULK INSERT (server-side CSV import).
ALTER SERVER ROLE bulkadmin ADD MEMBER lichess_app;
