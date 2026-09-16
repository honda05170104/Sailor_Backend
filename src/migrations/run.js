import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadMigrations() {
  const files = (await readdir(__dirname))
    .filter((file) => /^\d+_.*\.js$/.test(file))
    .sort();

  const migrations = [];

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(__dirname, file)).href);
    const migration = mod.default;

    if (!migration?.name || typeof migration.up !== 'function') {
      throw new Error(`Invalid migration file: ${file}`);
    }

    migrations.push(migration);
  }

  return migrations;
}

async function run() {
  await connectDB();

  const collection = mongoose.connection.db.collection('migrations');
  await collection.createIndex({ name: 1 }, { unique: true });

  const applied = new Set(
    (await collection.find({}, { projection: { name: 1 } }).toArray()).map(
      (doc) => doc.name
    )
  );

  const migrations = await loadMigrations();
  let ran = 0;

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      console.log(`skip  ${migration.name}`);
      continue;
    }

    console.log(`run   ${migration.name}`);
    await migration.up(mongoose.connection.db);
    await collection.insertOne({
      name: migration.name,
      appliedAt: new Date(),
    });
    ran += 1;
  }

  console.log(ran === 0 ? 'No pending migrations' : `Applied ${ran} migration(s)`);
}

try {
  await run();
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
