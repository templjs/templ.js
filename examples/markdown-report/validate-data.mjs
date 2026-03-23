import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(currentDir, 'data.schema.json');
const dataPath = path.join(currentDir, 'data.json');

const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

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
