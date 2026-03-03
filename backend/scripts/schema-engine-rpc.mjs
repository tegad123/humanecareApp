#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(backendDir, '..');
const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
const command = process.argv[2];
const datasourceUrl = process.env.DATABASE_URL;

async function resolveSchemaEnginePath() {
  const enginesDir = path.join(rootDir, 'node_modules', '@prisma', 'engines');
  const entries = await fs.readdir(enginesDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith('schema-engine'))
    .map((entry) => path.join(enginesDir, entry.name));

  if (candidates.length === 0) {
    throw new Error(`No schema-engine binary found in ${enginesDir}`);
  }

  return candidates[0];
}

async function readFileOrNull(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function buildMigrationsList() {
  const lockfilePath = path.join(migrationsDir, 'migration_lock.toml');
  const lockfileContent = await readFileOrNull(lockfilePath);
  let migrationDirectories = [];

  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    migrationDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    migrationDirectories = [];
  }

  const dirs = [];
  for (const dir of migrationDirectories) {
    const migrationPath = path.join(migrationsDir, dir, 'migration.sql');
    try {
      const content = await fs.readFile(migrationPath, 'utf8');
      dirs.push({
        path: dir,
        migrationFile: {
          path: 'migration.sql',
          content: { tag: 'ok', value: content },
        },
      });
    } catch (error) {
      dirs.push({
        path: dir,
        migrationFile: {
          path: 'migration.sql',
          content: { tag: 'error', value: error instanceof Error ? error.message : String(error) },
        },
      });
    }
  }

  return {
    baseDir: migrationsDir,
    lockfile: {
      path: 'migration_lock.toml',
      content: lockfileContent,
    },
    migrationDirectories: dirs,
    shadowDbInitScript: '',
  };
}

async function runSchemaEngineRpc({ method, params }) {
  const enginePath = await resolveSchemaEnginePath();
  const datasource = JSON.stringify({ url: datasourceUrl });
  const args = ['--datasource', datasource, '--datamodels', schemaPath];

  return new Promise((resolve, reject) => {
    const child = spawn(enginePath, args, {
      cwd: backendDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderr = '';
    let stdoutBuffer = '';
    const requestId = 1;
    const request = {
      id: requestId,
      jsonrpc: '2.0',
      method,
      params,
    };
    let settled = false;

    const fail = (message) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
      child.kill();
    };

    const succeed = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      child.kill();
    };

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        let payload;
        try {
          payload = JSON.parse(line);
        } catch {
          continue;
        }

        if (payload.id === requestId && payload.error) {
          fail(
            `Schema engine RPC ${method} failed: ${JSON.stringify(payload.error)}\n${stderr}`,
          );
          return;
        }

        if (payload.id === requestId && payload.result !== undefined) {
          succeed(payload.result);
          return;
        }
      }
    });

    child.on('error', (error) => {
      fail(`Failed to start schema engine: ${error.message}`);
    });

    child.on('exit', (code) => {
      if (!settled) {
        fail(
          `Schema engine exited before responding (code ${code ?? 'null'}).\n${stderr}`,
        );
      }
    });

    child.stdin.write(`${JSON.stringify(request)}\n`);
    child.stdin.end();
  });
}

async function runCanConnectCli() {
  const enginePath = await resolveSchemaEnginePath();
  const datasource = JSON.stringify({ url: datasourceUrl });
  const args = ['--datasource', datasource, 'cli', 'can-connect-to-database'];

  await new Promise((resolve, reject) => {
    const child = spawn(enginePath, args, {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        process.stdout.write(stdout);
        resolve();
      } else {
        reject(new Error(`can-connect-to-database failed (${code}): ${stderr || stdout}`));
      }
    });
  });
}

async function main() {
  if (!command || !['can-connect', 'apply-migrations'].includes(command)) {
    throw new Error(
      'Usage: node scripts/schema-engine-rpc.mjs <can-connect|apply-migrations>',
    );
  }

  if (!datasourceUrl) {
    throw new Error(
      'DATABASE_URL is not set. Export it or add it to backend/.env before running this script.',
    );
  }

  if (command === 'can-connect') {
    await runCanConnectCli();
    console.log('Database connectivity check succeeded.');
    return;
  }

  if (command === 'apply-migrations') {
    const migrationsList = await buildMigrationsList();
    const result = await runSchemaEngineRpc({
      method: 'applyMigrations',
      params: {
        migrationsList,
        filters: {
          externalTables: [],
          externalEnums: [],
        },
      },
    });
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
