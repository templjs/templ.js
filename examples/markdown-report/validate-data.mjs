import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import process from 'node:process';
import console from 'node:console';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(currentDir, 'data.schema.json');
const dataPath = path.join(currentDir, 'data.json');

function loadJsonFile(filePath) {
  const jsonKind = path.basename(filePath).includes('schema') ? 'schema JSON' : 'data JSON';

  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load or parse ${jsonKind} at ${filePath}: ${message}`, {
      cause: error,
    });
  }
}

const schema = loadJsonFile(schemaPath);
const data = loadJsonFile(dataPath);

function validateKpi(kpi) {
  if (!kpi || typeof kpi !== 'object') {
    throw new Error('Invalid KPI payload: expected kpi to be an object');
  }

  if (kpi.active_users_30d > kpi.total_users) {
    throw new Error(
      `Invalid KPI payload: active_users_30d (${kpi.active_users_30d}) must be less than or equal to total_users (${kpi.total_users})`
    );
  }

  if (kpi.conversion_rate < 0 || kpi.conversion_rate > 1) {
    throw new Error(
      `Invalid KPI payload: conversion_rate (${kpi.conversion_rate}) must be between 0 and 1`
    );
  }
}

function validateActiveUsersByRegion(activeUsersByRegion) {
  if (!Array.isArray(activeUsersByRegion)) {
    throw new Error(
      'Invalid active_users_by_region payload: expected active_users_by_region to be an array'
    );
  }

  const seenRegionNames = new Set();
  for (const region of activeUsersByRegion) {
    const regionName = region?.name;
    if (typeof regionName !== 'string') {
      continue;
    }

    if (seenRegionNames.has(regionName)) {
      throw new Error(
        `Invalid active_users_by_region payload: duplicate region name "${regionName}"`
      );
    }

    seenRegionNames.add(regionName);
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);

if (!validate(data)) {
  console.error('Invalid markdown-report example data at examples/markdown-report/data.json');
  for (const error of validate.errors ?? []) {
    const location = error.instancePath || '/';
    console.error(`- ${location}: ${error.message}`);
  }
  process.exit(1);
}

try {
  validateKpi(data.kpi);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Invalid markdown-report KPI data at examples/markdown-report/data.json: ${message}`);
  process.exit(1);
}

try {
  validateActiveUsersByRegion(data.active_users_by_region);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `Invalid markdown-report regional data at examples/markdown-report/data.json: ${message}`
  );
  process.exit(1);
}

console.log('examples/markdown-report/data.json schema validation passed');
