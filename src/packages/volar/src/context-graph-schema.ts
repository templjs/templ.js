import { SchemaValidator, type SchemaMetadata } from '@templjs/core';

const schemaMetadataCache = new WeakMap<object, SchemaMetadata>();

function freezeMetadata(metadata: SchemaMetadata): SchemaMetadata {
  const frozenMetadata: SchemaMetadata = {};

  for (const [path, entry] of Object.entries(metadata)) {
    const frozenEntry = { ...entry };

    if (entry.properties) {
      frozenEntry.properties = Object.freeze([...entry.properties]) as unknown as string[];
    }

    frozenMetadata[path] = Object.freeze(frozenEntry);
  }

  return Object.freeze(frozenMetadata);
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
