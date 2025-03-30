const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { resolve } = require('path');

async function main() {
  console.log('Connecting to database...');
  const migrationClient = postgres(process.env.DATABASE_URL);
  const db = drizzle(migrationClient);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Migrations completed!');

  await migrationClient.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
