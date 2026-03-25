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

function validateKpi(kpi, conversionRateFormat) {
  if (!kpi || typeof kpi !== 'object') {
    throw new Error('Invalid KPI payload: expected kpi to be an object');
  }

  if (typeof kpi.active_users_30d !== 'number' || Number.isNaN(kpi.active_users_30d)) {
    throw new Error(
      `Invalid KPI payload: active_users_30d must be a valid number (received ${String(kpi.active_users_30d)})`
    );
  }

  if (typeof kpi.total_users !== 'number' || Number.isNaN(kpi.total_users)) {
    throw new Error(
      `Invalid KPI payload: total_users must be a valid number (received ${String(kpi.total_users)})`
    );
  }

  if (typeof kpi.conversion_rate !== 'number' || Number.isNaN(kpi.conversion_rate)) {
    throw new Error(
      `Invalid KPI payload: conversion_rate must be a valid number (received ${String(kpi.conversion_rate)})`
    );
  }

  if (kpi.active_users_30d > kpi.total_users) {
    throw new Error(
      `Invalid KPI payload: active_users_30d (${kpi.active_users_30d}) must be less than or equal to total_users (${kpi.total_users})`
    );
  }

  const maxConversionRate = conversionRateFormat === 'percentage' ? 100 : 1;
  if (kpi.conversion_rate < 0 || kpi.conversion_rate > maxConversionRate) {
    throw new Error(
      `Invalid KPI payload: conversion_rate (${kpi.conversion_rate}) must be between 0 and ${maxConversionRate} when field_formats.kpi.conversion_rate is "${conversionRateFormat}"`
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
  for (const [index, region] of activeUsersByRegion.entries()) {
    const regionName = region?.name;
    if (typeof regionName !== 'string') {
      throw new Error(
        `Invalid active_users_by_region payload: region at index ${index} has non-string name (${String(regionName)})`
      );
    }

    const regionUsers = region?.users;
    if (typeof regionUsers !== 'number' || !Number.isFinite(regionUsers)) {
      throw new Error(
        `Invalid active_users_by_region payload: region at index ${index} has invalid users value (${String(regionUsers)}); expected a finite number`
      );
    }

    if (!Number.isInteger(regionUsers) || regionUsers < 0) {
      throw new Error(
        `Invalid active_users_by_region payload: region at index ${index} has invalid users value (${String(regionUsers)}); expected an integer >= 0`
      );
    }

    if (seenRegionNames.has(regionName)) {
      throw new Error(
        `Invalid active_users_by_region payload: duplicate region name "${regionName}"`
      );
    }

    seenRegionNames.add(regionName);
  }
}

function validateFieldFormats(data) {
  const { field_formats: fieldFormats } = data;

  if (Array.isArray(fieldFormats)) {
    throw new Error(
      'Invalid field_formats payload: expected field_formats to be an object, not an array'
    );
  }

  if (!fieldFormats || typeof fieldFormats !== 'object') {
    throw new Error('Invalid field_formats payload: expected field_formats to be an object');
  }

  const conversionRateFormat = fieldFormats.kpi?.conversion_rate;
  if (conversionRateFormat !== 'decimal' && conversionRateFormat !== 'percentage') {
    throw new Error(
      `Invalid field_formats payload: field_formats.kpi.conversion_rate (${String(conversionRateFormat)}) must be either "decimal" or "percentage"`
    );
  }

  return conversionRateFormat;
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
  validateActiveUsersByRegion(data.active_users_by_region);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `Invalid markdown-report regional data at examples/markdown-report/data.json: ${message}`
  );
  process.exit(1);
}

let conversionRateFormat;
try {
  conversionRateFormat = validateFieldFormats(data);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `Invalid markdown-report field format metadata at examples/markdown-report/data.json: ${message}`
  );
  process.exit(1);
}

try {
  validateKpi(data.kpi, conversionRateFormat);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `Invalid markdown-report KPI data at examples/markdown-report/data.json: ${message}`
  );
  process.exit(1);
}

console.log('examples/markdown-report/data.json schema validation passed');
