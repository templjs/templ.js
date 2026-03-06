/**
 * XML format parser
 */

import { FormatParserAsync } from './types';

// Dynamically import xml parser to handle optional dependency
let xmlParser: { parseStringPromise: (xml: string) => Promise<unknown> } | null = null;

function getXmlModule(): { parseStringPromise: (xml: string) => Promise<unknown> } {
  if (!xmlParser) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      xmlParser = require('xml2js');
    } catch {
      throw new Error(
        'XML support requires the "xml2js" package. Install it with: pnpm add xml2js'
      );
    }
  }
  return xmlParser as { parseStringPromise: (xml: string) => Promise<unknown> };
}

export class XmlParser implements FormatParserAsync {
  formatName = 'XML';

  async parseAsync(content: string): Promise<Record<string, unknown>> {
    try {
      const xml = getXmlModule();
      const result = await xml.parseStringPromise(content);

      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new Error('Input data must be valid XML element');
      }

      return result as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('xml2js')) {
        throw error; // Re-throw dependency error
      }
      throw new Error(`Invalid XML: ${message}`, { cause: error });
    }
  }

  /**
   * Synchronous parse method for compatibility with other parsers
   * Note: XML parsing is async, so we throw an error
   */
  parse(): Record<string, unknown> {
    throw new Error(
      'XML parsing requires async method. Use parseAsync() instead or use a different format.'
    );
  }
}
