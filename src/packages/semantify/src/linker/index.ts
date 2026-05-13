import type { SymbolRef } from '../model/public-types.js';

export interface LinkReferencesInput {
  symbols: SymbolRef[];
}

export interface LinkReferencesResult {
  symbols: SymbolRef[];
}

export function linkReferences(input: LinkReferencesInput): LinkReferencesResult {
  return {
    symbols: input.symbols,
  };
}
