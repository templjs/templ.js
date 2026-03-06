/**
 * XML format parser
 */

import { FormatParserAsync } from './types';
import { parseStringPromise } from 'xml2js';

export class XmlParser implements FormatParserAsync {
  formatName = 'XML';

  async parseAsync(content: string): Promise<Record<string, unknown>> {
    try {
      const result = await parseStringPromise(content);

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
  parse(_content: string): Record<string, unknown> {
    throw new Error(
      'XML parsing requires async method. Use parseAsync() instead or use a different format.'
    );
  }
}
