import { SchemaValidator, type SchemaMetadata } from '@templjs/core';

const schemaMetadataCache = new WeakMap<object, SchemaMetadata>();
type FrozenSchemaMetadataEntry = Omit<SchemaMetadata[string], 'properties'> & {
  properties?: readonly string[];
};

function freezeMetadata(metadata: SchemaMetadata): SchemaMetadata {
  const frozenMetadata: Record<string, FrozenSchemaMetadataEntry> = {};

  for (const [path, entry] of Object.entries(metadata)) {
    frozenMetadata[path] = Object.freeze({
      ...entry,
      ...(entry.properties ? { properties: Object.freeze([...entry.properties]) } : {}),
    });
  }

  return Object.freeze(frozenMetadata) as SchemaMetadata;
}

export function getSharedSchemaMetadata(schema: object): SchemaMetadata {
  const cached = schemaMetadataCache.get(schema);
  if (cached) {
    return cached;
  }

  const metadata = freezeMetadata(new SchemaValidator(schema).getMetadata());
  schemaMetadataCache.set(schema, metadata);
  return metadata;
}
