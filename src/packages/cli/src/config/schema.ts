/**
 * JSON Schema for .templjs.json configuration files
 */

export const CLI_CONFIG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'templjs CLI Configuration',
  description: 'Configuration schema for .templjs.json files',
  type: 'object',
  properties: {
    inputFormat: {
      type: 'string',
      enum: ['json', 'yaml', 'toml', 'xml'],
      description: 'Default input format',
    },
    outputFormat: {
      type: 'string',
      enum: ['text', 'json', 'html', 'markdown'],
      description: 'Default output format',
    },
    defaultTemplate: {
      type: 'string',
      description: 'Default template file path',
    },
    defaultOutput: {
      type: 'string',
      description: 'Default output file path',
    },
    templateDelimiters: {
      type: 'object',
      properties: {
        statement_start: { type: 'string' },
        statement_end: { type: 'string' },
        expression_start: { type: 'string' },
        expression_end: { type: 'string' },
      },
      additionalProperties: false,
      description: 'Custom template delimiters',
    },
    validation: {
      type: 'object',
      properties: {
        validateInput: { type: 'boolean' },
        validateOutput: { type: 'boolean' },
        schemaPath: { type: 'string' },
      },
      additionalProperties: false,
      description: 'Validation settings',
    },
  },
  additionalProperties: false,
};
