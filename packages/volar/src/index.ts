/**
 * @templjs/volar - Volar language server plugin for templjs
 *
 * This package provides Volar integration for IDE support including:
 * - Syntax highlighting
 * - Diagnostics and error reporting
 * - IntelliSense and autocompletion
 * - Virtual code mapping for base format delegation
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import type { LanguagePlugin } from '@volar/language-core';

export const version = '0.1.0';

/**
 * Create the templjs language plugin for Volar
 */
export function createTempljsLanguagePlugin(): LanguagePlugin {
  return {
    createVirtualCode(uri: any, languageId: any, _snapshot: any) {
      // TODO: Implement virtual code generation
      // This will strip template syntax and provide base format for delegation

      return {
        id: 'root',

        languageId,

        snapshot: _snapshot,
        mappings: [],
        embeddedCodes: [],
      };
    },

    updateVirtualCode(uri, virtualCode, snapshot) {
      // TODO: Implement virtual code updates
      return virtualCode;
    },
  };
}

export default {
  version,
  createTempljsLanguagePlugin,
};
