import { cleanTemplateContent } from './src/packages/volar/dist/index.js';
import { createRangeMapperFromOriginal } from './src/packages/language-service/dist/position-remapping-utility.js';

// Test case: YAML line with template expression  
const sourceDoc = `title: yaml block
id: {% set id = 'yaml-block' %}"{{ id }}"
name: "{{ item.name }}"`;

// Clean it
const { cleaned } = cleanTemplateContent(sourceDoc, undefined, { mode: 'text-only' });

console.log('Source:\n', sourceDoc);
console.log('\nCleaned:\n', cleaned);

// Create mapper
const mapper = createRangeMapperFromOriginal(sourceDoc);

// Find the position of 'name' in both docs
const sourceNamePos = sourceDoc.indexOf('name: "');
const cleanedNamePos = cleaned.indexOf('name: "');

console.log('\nsource "name:" at:', sourceNamePos);
console.log('cleaned "name:" at:', cleanedNamePos);

// Convert to line:char
const toLineChar = (doc, offset) => {
  const lines = doc.substring(0, offset).split('\n');
  const line = lines.length - 1;
  const char = lines[lines.length - 1].length;
  return { line, char };
};

const sourceNameLineChar = toLineChar(sourceDoc, sourceNamePos);
const cleanedNameLineChar = toLineChar(cleaned, cleanedNamePos);

console.log('source name position:', sourceNameLineChar);
console.log('cleaned name position:', cleanedNameLineChar);

// The template expression {{ item.name }} would be cleaned to empty
// So when we hover at cleaned position (2, 8) in the string {{ item.name }}
// we need to remap it back to source

// In cleaned doc, after name: " there's nothing (template removed)
// In source doc, after name: " there's {{ item.name }}

const cleanedExprPos = cleanedNameLineChar.line * 100 + cleanedNameLineChar.char + 8; // position after "
console.log('\nTesting range remap at expression boundary:');

// Try remapping a position that's in the template expression in source
// but corresponds to the empty string in cleaned
const testSourcePos = sourceNameLineChar.line * 100 + sourceNameLineChar.char + 8; // after "
console.log('source position (in template):', testSourcePos);

// Remap from cleaned position (which points to the ") back to source
const remapped = mapper.cleanedRangeToOriginal(
  cleanedNameLineChar.line,
  cleanedNameLineChar.char + 8,
  cleanedNameLineChar.line,
  cleanedNameLineChar.char + 8
);
console.log('remapped position:', remapped);
