import { SchemaValidator, type SchemaMetadata } from '@templjs/core';

const schemaMetadataCache = new WeakMap<object, SchemaMetadata>();

export function getSharedSchemaMetadata(schema: object): SchemaMetadata {
  const cached = schemaMetadataCache.get(schema);
  if (cached) {
    return cached;
  }

  const metadata = new SchemaValidator(schema).getMetadata();
  schemaMetadataCache.set(schema, metadata);
  return metadata;
}
