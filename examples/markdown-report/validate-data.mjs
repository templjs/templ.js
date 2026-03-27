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

function validateBusinessRules(data) {
  const seenRegionNames = new Set();
  for (const region of data.active_users_by_region) {
    const regionName = region.name;
    if (seenRegionNames.has(regionName)) {
      throw new Error(`Duplicate region name in active_users_by_region: "${regionName}"`);
    }
    seenRegionNames.add(regionName);
  }

  if (data.kpi.active_users_30d > data.kpi.total_users) {
    throw new Error(
      `kpi.active_users_30d (${data.kpi.active_users_30d}) must be less than or equal to kpi.total_users (${data.kpi.total_users})`
    );
  }
}

let data;
let validate;

try {
  const schema = loadJsonFile(schemaPath);
  data = loadJsonFile(dataPath);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
  });
  addFormats(ajv);
  ajv.addVocabulary(['x-validation', 'x-uniqueBy']);
  validate = ajv.compile(schema);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to initialize markdown-report validation: ${message}`);
  process.exit(1);
}

if (!validate(data)) {
  console.error('Invalid markdown-report example data at examples/markdown-report/data.json');
  for (const error of validate.errors ?? []) {
    const location = error.instancePath || '/';
    console.error(`- ${location}: ${error.message}`);
  }
  process.exit(1);
}

try {
  validateBusinessRules(data);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `Invalid markdown-report business rule data at examples/markdown-report/data.json: ${message}`
  );
  process.exit(1);
}

console.log('examples/markdown-report/data.json validation passed');
