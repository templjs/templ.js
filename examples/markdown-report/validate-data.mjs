import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import process from 'node:process';
import console from 'node:console';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(currentDir, 'data.schema.json');
const dataPath = path.join(currentDir, 'data.json');

let schema;
let data;

try {
  schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`Failed to load or parse schema JSON at ${schemaPath}: ${message}`, {
    cause: error,
  });
}

try {
  data = JSON.parse(readFileSync(dataPath, 'utf-8'));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`Failed to load or parse data JSON at ${dataPath}: ${message}`, { cause: error });
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

console.log('examples/markdown-report/data.json schema validation passed');
