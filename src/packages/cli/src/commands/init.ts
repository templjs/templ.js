/**
 * @templjs/cli - init command
 * Generates starter templates for a requested output format.
 */

import { writeFileSync } from 'fs';

const STARTERS: Record<string, string> = {
  markdown: `# Report\n\n{% for user in users %}\n- {{ user.name }}\n{% endfor %}\n`,
  html: `<ul>\n{% for user in users %}\n  <li>{{ user.name }}</li>\n{% endfor %}\n</ul>\n`,
  json: `{\n  "users": [\n    {% for user in users %}\n    { "name": "{{ user.name }}" }{% if not loop.last %},{% endif %}\n    {% endfor %}\n  ]\n}\n`,
  yaml: `users:\n{% for user in users %}\n  - name: {{ user.name }}\n{% endfor %}\n`,
};

export interface InitCommandOptions {
  format: string;
  output?: string;
}

export async function initCommand(options: InitCommandOptions): Promise<string> {
  const normalizedFormat = options.format.toLowerCase();
  const template = STARTERS[normalizedFormat];

  if (!template) {
    throw new Error(
      `Unsupported format: ${options.format}. Supported formats: ${Object.keys(STARTERS).join(', ')}`
    );
  }

  if (options.output) {
    writeFileSync(options.output, template, 'utf-8');
  }

  return template;
}
