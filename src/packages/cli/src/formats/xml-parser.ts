import type { FormatParser } from './types.js';

export class XmlParser implements FormatParser {
  parse(content: string): Record<string, unknown> {
    const trimmed = content.trim();
    if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
      throw new Error('Invalid XML: expected XML document');
    }

    return { xml: trimmed };
  }

  async parseAsync(content: string): Promise<Record<string, unknown>> {
    return this.parse(content);
  }
}
