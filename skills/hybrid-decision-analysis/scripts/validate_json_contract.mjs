#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

function parseArgs(argv) {
  const args = { schema: "", data: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--schema") {
      args.schema = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--data") {
      args.data = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
  }
  if (!args.schema || !args.data) {
    throw new Error("Usage: validate_json_contract.mjs --schema <schema.json> --data <data.json>");
  }
  return args;
}

async function main() {
  const { schema, data } = parseArgs(process.argv);

  const [schemaRaw, dataRaw] = await Promise.all([
    fs.readFile(schema, "utf8"),
    fs.readFile(data, "utf8"),
  ]);
  const schemaJson = JSON.parse(schemaRaw);
  const dataJson = JSON.parse(dataRaw);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schemaJson);
  const ok = validate(dataJson);

  if (!ok) {
    const errors = validate.errors ?? [];
    for (const err of errors) {
      const path = err.instancePath || "/";
      console.error(`${path} ${err.message}`);
    }
    process.exit(1);
  }

  console.log("valid");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
