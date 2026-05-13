import { createSemantifyServices } from './binder/framework.js';

export type {
  CandidateItem,
  DelimiterConfigInput,
  OffsetRange,
  QueryIntent,
  QueryIntentType,
  RegionKind,
  ScopeBinding,
  ScopeBindingKind,
  SemanticContext,
  SemanticContextResolverInput,
  SemantifyServices,
  SemanticRegion,
  SymbolRef,
  SymbolKind,
} from './model/public-types.js';

export { createSemantifyServices };
export { semantifyTesting } from './binder/framework.js';
export { linkReferences } from './linker/index.js';
export type { LinkReferencesInput, LinkReferencesResult } from './linker/index.js';
