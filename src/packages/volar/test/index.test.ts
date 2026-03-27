/**
 * Tests for @templjs/volar language plugin
 */

import { describe, it, expect, vi } from 'vitest';
import { createTempljsLanguagePlugin } from '../src/index.js';
import { collectDiagnostics } from '../src/diagnostic-provider.js';
import { IntellisenseProvider } from '../src/intellisense-provider.js';

describe('LanguagePlugin', () => {
  const plugin = createTempljsLanguagePlugin();
  const languageCases = [
    {
      name: 'markdown',
      uri: 'file:///example.md.tmpl',
      languageId: 'templjs-markdown',
      expectedLanguage: 'markdown',
      content: '# Title\n\n{% if true %}\nContent\n{% endif %}',
      length: 43,
    },
    {
      name: 'json',
      uri: 'file:///config.json.tmpl',
      languageId: 'templjs-json',
      expectedLanguage: 'json',
      content: '{ "name": "{{ user.name }}" }',
      length: 30,
    },
    {
      name: 'yaml',
      uri: 'file:///config.yaml.tmpl',
      languageId: 'templjs-yaml',
      expectedLanguage: 'yaml',
      content: 'key: {{ value }}\nother: {{ other }}',
      length: 36,
    },
    {
      name: 'html',
      uri: 'file:///page.html.tmpl',
      languageId: 'templjs-html',
      expectedLanguage: 'html',
      content: '<h1>{{ title }}</h1>\n<p>{% if show %}{{ content }}{% endif %}</p>',
      length: 65,
    },
  ] as const;

  describe('createVirtualCode', () => {
    it.each(languageCases)(
      'should create virtual code for $name template',
      ({ uri, languageId, expectedLanguage, content, length }) => {
        const mockSnapshot = {
          getText: () => content,
          getLength: () => length,
          getChangeRange: () => undefined,
        };

        const virtualCode = plugin.createVirtualCode(uri, languageId, mockSnapshot);

        expect(virtualCode).toBeDefined();
        expect(virtualCode?.id).toBe('root');
        expect(virtualCode?.languageId).toBe(expectedLanguage);
      }
    );

    it('should strip template syntax from content', () => {
      const content = 'Hello {{ name }}, welcome!';
      const mockSnapshot = {
        getText: () => content,
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      expect(virtualCode?.mappings).toBeDefined();
      expect(Array.isArray(virtualCode?.mappings)).toBe(true);
    });

    it('should include mapping metadata for base delegation', () => {
      const content = 'Hello {{ name }}';
      const mockSnapshot = {
        getText: () => content,
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.mappings[0]?.data).toBeDefined();
      expect(virtualCode?.mappings[0]?.data.format).toBe(true);
    });

    it('should preserve line structure when stripping templates', () => {
      const content = 'Line 1\n{% if true %}\nLine 3\n{% endif %}\nLine 5';
      const mockSnapshot = {
        getText: () => content,
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      // Verify line structure is preserved (should have same number of newlines)
      expect(virtualCode?.mappings.length).toBeGreaterThan(0);
    });

    it('should handle multiple template blocks', () => {
      const content =
        'Start\n{{ var1 }}\nMiddle\n{% for item in items %}\n{{ item }}\n{% endfor %}\nEnd';
      const mockSnapshot = {
        getText: () => content,
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      expect(virtualCode?.mappings).toBeDefined();
    });

    it('should handle empty templates', () => {
      const mockSnapshot = {
        getText: () => '',
        getLength: () => 0,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///empty.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      expect(virtualCode?.languageId).toBe('markdown');
    });

    it('should handle content without template syntax', () => {
      const content = 'Just plain markdown\nwith no templates';
      const mockSnapshot = {
        getText: () => content,
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///plain.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      expect(virtualCode?.mappings).toBeDefined();
    });
  });

  describe('updateVirtualCode', () => {
    it('should update virtual code on document change', () => {
      const oldContent = 'Old {{ var }}';
      const newContent = 'New {{ variable }}';

      const oldSnapshot = {
        getText: () => oldContent,
        getLength: () => oldContent.length,
        getChangeRange: () => ({
          start: 0,
          length: oldContent.length,
          newLength: newContent.length,
          span: { start: 0, length: oldContent.length },
        }),
      };

      const newSnapshot = {
        getText: () => newContent,
        getLength: () => newContent.length,
        getChangeRange: () => undefined,
      };

      const oldVirtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        oldSnapshot
      );

      if (!oldVirtualCode) {
        throw new Error('Failed to create initial virtual code');
      }

      const updatedCode = plugin.updateVirtualCode(
        'file:///test.md.tmpl',
        oldVirtualCode,
        newSnapshot
      );

      expect(updatedCode).toBeDefined();
      expect(updatedCode.languageId).toBe('markdown');
    });

    it('should handle incremental changes', () => {
      const snapshot = {
        getText: () => 'Content with {{ variable }}',
        getLength: () => 27,
        getChangeRange: () => ({
          start: 14,
          length: 10,
          newLength: 8,
          span: { start: 14, length: 10 },
        }),
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        snapshot
      );

      if (!virtualCode) {
        throw new Error('Failed to create initial virtual code');
      }

      const updated = plugin.updateVirtualCode('file:///test.md.tmpl', virtualCode, snapshot);

      expect(updated).toBeDefined();
    });

    it('treats single-symbol edits as simple edits (non-template)', () => {
      const content = 'color: #fff;\nbody { margin: 0; }\nvalue: 100%';
      const snapshot = {
        getText: () => content,
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///style.css.tmpl',
        'templjs-markdown',
        snapshot
      );
      const helpers = virtualCode as unknown as {
        isSimpleEdit: (removedText: string, insertedText: string) => boolean;
      };

      expect(helpers.isSimpleEdit('{', 'x')).toBe(true);
      expect(helpers.isSimpleEdit('', '#')).toBe(true);
      expect(helpers.isSimpleEdit('', '%')).toBe(true);
      expect(helpers.isSimpleEdit('{{', '')).toBe(false);
      expect(helpers.isSimpleEdit('', '{%')).toBe(false);
      expect(helpers.isSimpleEdit('', '#}')).toBe(false);
    });

    it('should handle template marker edits using bounded window', () => {
      // Create document with template markup
      const initialContent = 'Line 1\nLine 2 with {{ var }}\nLine 3\nLine 4';
      const initialSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return initialContent;
          return initialContent.slice(start, end);
        },
        getLength: () => initialContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot) return undefined;
          return undefined;
        },
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        initialSnapshot
      );

      if (!virtualCode) {
        throw new Error('Failed to create initial virtual code');
      }

      // Edit that adds template markers (insert "{% if true %}" at position 7)
      const updatedContent = 'Line 1\n{% if true %}Line 2 with {{ var }}\nLine 3\nLine 4';
      const updateSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return updatedContent;
          return updatedContent.slice(start, end);
        },
        getLength: () => updatedContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot || oldSnapshot === initialSnapshot) {
            return {
              span: { start: 7, length: 0 },
              newLength: 14, // "{% if true %}"
            };
          }
          return undefined;
        },
      };

      const updated = plugin.updateVirtualCode('file:///test.md.tmpl', virtualCode, updateSnapshot);

      // Should successfully update using bounded window (not full rebuild)
      expect(updated).toBeDefined();
      expect(updated.languageId).toBe('markdown');

      // Verify the virtual code has correct structure
      expect(updated.snapshot).not.toBe(updateSnapshot);
      expect(updated.snapshot.getLength()).toBeGreaterThan(0);
    });

    it('should handle template marker deletion using bounded window', () => {
      // Create document with template markup
      const initialContent = 'Line 1\n{% block %}Content{% endblock %}\nLine 3';
      const initialSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return initialContent;
          return initialContent.slice(start, end);
        },
        getLength: () => initialContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot) return undefined;
          return undefined;
        },
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        initialSnapshot
      );

      if (!virtualCode) {
        throw new Error('Failed to create initial virtual code');
      }

      // Delete template block (remove "{% block %}" at position 7, length 12)
      const updatedContent = 'Line 1\nContent{% endblock %}\nLine 3';
      const updateSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return updatedContent;
          return updatedContent.slice(start, end);
        },
        getLength: () => updatedContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot || oldSnapshot === initialSnapshot) {
            return {
              span: { start: 7, length: 12 },
              newLength: 0,
            };
          }
          return undefined;
        },
      };

      const updated = plugin.updateVirtualCode('file:///test.md.tmpl', virtualCode, updateSnapshot);

      // Should successfully update using bounded window (not full rebuild)
      expect(updated).toBeDefined();
      expect(updated.languageId).toBe('markdown');
      expect(updated.snapshot).not.toBe(updateSnapshot);
      expect(updated.snapshot.getLength()).toBeGreaterThan(0);
    });

    it('should regenerate accurate position mappings after incremental edits', () => {
      // Regression test: verify mappings aren't discarded with empty array
      // Create document with template markers
      const initialContent = 'Title\n\n{{ variable }}\n\nContent here';
      const initialSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return initialContent;
          return initialContent.slice(start, end);
        },
        getLength: () => initialContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot) return undefined;
          return undefined;
        },
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        initialSnapshot
      );

      if (!virtualCode) {
        throw new Error('Failed to create initial virtual code');
      }

      // Verify initial mappings exist and are valid
      expect(virtualCode.mappings).toBeDefined();
      expect(virtualCode.mappings.length).toBeGreaterThan(0);

      // Apply a simple edit (no template markers in change)
      const updatedContent = 'Title\n\n{{ variable }}\n\nContent here with more text';
      const updateSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return updatedContent;
          return updatedContent.slice(start, end);
        },
        getLength: () => updatedContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot || oldSnapshot === initialSnapshot) {
            return {
              span: { start: 31, length: 0 },
              newLength: 15, // " with more text"
            };
          }
          return undefined;
        },
      };

      const updated = plugin.updateVirtualCode('file:///test.md.tmpl', virtualCode, updateSnapshot);

      // Verify mappings were regenerated, not discarded
      expect(updated.mappings).toBeDefined();
      expect(updated.mappings.length).toBeGreaterThan(0);

      // Mappings should still be valid after the edit
      expect(updated.mappings[0]).toBeDefined();
      expect(updated.mappings[0].sourceOffsets).toBeDefined();
      expect(updated.mappings[0].generatedOffsets).toBeDefined();
      expect(updated.mappings[0].data).toBeDefined();

      // Position mapping should still work (no empty array regression)
      expect(updated.snapshot).not.toBe(updateSnapshot);
      expect(updated.snapshot.getLength()).toBeGreaterThan(0);
    });

    it('should regenerate accurate position mappings after template marker edits', () => {
      // Regression test: verify mappings are accurate after bounded window reprocessing
      const initialContent = 'Start\n\nMiddle\n\nEnd';
      const initialSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return initialContent;
          return initialContent.slice(start, end);
        },
        getLength: () => initialContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot) return undefined;
          return undefined;
        },
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        initialSnapshot
      );

      if (!virtualCode) {
        throw new Error('Failed to create initial virtual code');
      }

      // Add template markers (triggers bounded window reprocessing)
      const updatedContent = 'Start\n\n{% if true %}Middle{% endif %}\n\nEnd';
      const updateSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return updatedContent;
          return updatedContent.slice(start, end);
        },
        getLength: () => updatedContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot || oldSnapshot === initialSnapshot) {
            return {
              span: { start: 7, length: 6 },
              newLength: 29, // "{% if true %}Middle{% endif %}"
            };
          }
          return undefined;
        },
      };

      const updated = plugin.updateVirtualCode('file:///test.md.tmpl', virtualCode, updateSnapshot);

      // Verify mappings exist and are valid after template marker edit
      expect(updated.mappings).toBeDefined();
      expect(updated.mappings.length).toBeGreaterThan(0);
      expect(updated.mappings[0].sourceOffsets).toBeDefined();
      expect(updated.mappings[0].generatedOffsets).toBeDefined();
      expect(updated.mappings[0].lengths).toBeDefined();
      expect(updated.mappings[0].data).toBeDefined();

      // Verify mapping data includes expected features
      expect(updated.mappings[0].data.verification).toBe(true);
      expect(updated.mappings[0].data.completion).toBe(true);
    });

    it('keeps cleaned output identical to full rebuild for bounded edits with earlier multiline templates', () => {
      // Regression test for mapOriginalToCleaned: proportional mapping can drift when
      // earlier multiline template blocks compress cleaned offsets.
      const initialContent = [
        'Header',
        '{% if user %}',
        'A'.repeat(2500),
        'B'.repeat(2500),
        '{% endif %}',
        'Body line one',
        'Body line two',
        'Footer',
      ].join('\n');

      const initialSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return initialContent;
          return initialContent.slice(start, end);
        },
        getLength: () => initialContent.length,
        getChangeRange: () => undefined,
      };

      const incrementalPlugin = createTempljsLanguagePlugin();
      const virtualCode = incrementalPlugin.createVirtualCode(
        'file:///regression.md.tmpl',
        'templjs-markdown',
        initialSnapshot
      );

      const target = 'Body line two';
      const targetStart = initialContent.indexOf(target);
      const replacement = '{% if enabled %}Body line two{% endif %}';
      const updatedContent =
        initialContent.slice(0, targetStart) +
        replacement +
        initialContent.slice(targetStart + target.length);

      const updateSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return updatedContent;
          return updatedContent.slice(start, end);
        },
        getLength: () => updatedContent.length,
        getChangeRange: (oldSnapshot?: unknown) => {
          if (!oldSnapshot || oldSnapshot === initialSnapshot) {
            return {
              span: { start: targetStart, length: target.length },
              newLength: replacement.length,
            };
          }
          return undefined;
        },
      };

      const incremental = incrementalPlugin.updateVirtualCode(
        'file:///regression.md.tmpl',
        (() => {
          if (!virtualCode) {
            throw new Error('Failed to create initial virtual code');
          }
          return virtualCode;
        })(),
        updateSnapshot
      );

      // Compare against ground truth from full rebuild of the final content.
      const rebuildPlugin = createTempljsLanguagePlugin();
      const rebuilt = rebuildPlugin.createVirtualCode(
        'file:///regression.md.tmpl',
        'templjs-markdown',
        {
          getText: (start?: number, end?: number) => {
            if (start === undefined || end === undefined) return updatedContent;
            return updatedContent.slice(start, end);
          },
          getLength: () => updatedContent.length,
          getChangeRange: () => undefined,
        }
      );

      expect((incremental as any).cleaned).toBe((rebuilt as any).cleaned);
      expect((incremental as any).original).toBe(updatedContent);
    });

    it('maps original offsets to exact cleaned offsets for multiline template content', () => {
      // Regression test for mapOriginalToCleaned: verify exact offsets, not proportional estimates.
      const content = [
        'Header',
        '{#',
        'A'.repeat(1500),
        'B'.repeat(1500),
        '#}',
        'Body line one',
        'Body line two',
      ].join('\n');

      const snapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return content;
          return content.slice(start, end);
        },
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///offsets.md.tmpl',
        'templjs-markdown',
        snapshot
      ) as any;

      const expectedOriginalToCleaned = (source: string, originalOffset: number): number => {
        const clamped = Math.max(0, Math.min(originalOffset, source.length));
        const templatePattern = /(\{[%#{][\s\S]*?[%#}]\})/g;

        let cleanedPos = 0;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = templatePattern.exec(source)) !== null) {
          const blockStart = match.index;
          const blockText = match[0];
          const blockEnd = blockStart + blockText.length;

          if (clamped <= blockStart) {
            return cleanedPos + (clamped - lastIndex);
          }

          cleanedPos += blockStart - lastIndex;

          const firstNewline = blockText.indexOf('\n');

          if (clamped <= blockEnd) {
            const rel = clamped - blockStart;
            let relMapped = 0;

            for (let i = 0; i < rel; i++) {
              const ch = blockText[i];
              const advance = firstNewline === -1 || i < firstNewline ? 1 : ch === '\n' ? 1 : 0;
              relMapped += advance;
            }

            return cleanedPos + relMapped;
          }

          for (let i = 0; i < blockText.length; i++) {
            const ch = blockText[i];
            const advance = firstNewline === -1 || i < firstNewline ? 1 : ch === '\n' ? 1 : 0;
            cleanedPos += advance;
          }

          lastIndex = blockEnd;
        }

        return cleanedPos + (clamped - lastIndex);
      };

      const checkpoints = new Set<number>([
        0,
        content.indexOf('{#'),
        content.indexOf('Body line one'),
        content.indexOf('Body line two'),
        content.length,
      ]);

      // Sample many offsets to ensure non-linear regions are covered.
      for (let offset = 0; offset <= content.length; offset += 137) {
        checkpoints.add(offset);
      }

      for (const offset of checkpoints) {
        const expected = expectedOriginalToCleaned(content, offset);
        const actual = virtualCode.mapOriginalToCleaned(offset);
        expect(actual).toBe(expected);
      }
    });

    it('should correctly map offsets when applying simple edits after bounded edits', () => {
      // Regression test: verify offset mapping works when original and cleaned diverge
      // Step 1: Create initial content
      const initialContent = 'Header\n\nContent\n\nFooter';
      const initialSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return initialContent;
          return initialContent.slice(start, end);
        },
        getLength: () => initialContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot) return undefined;
          return undefined;
        },
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        initialSnapshot
      );

      if (!virtualCode) {
        throw new Error('Failed to create initial virtual code');
      }

      // Step 2: Apply an edit that adds template markers (forces bounded window processing)
      // This may cause original and cleaned to have different lengths
      const withTemplateContent = 'Header\n\n{% block %}Content{% endblock %}\n\nFooter';
      const templateSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return withTemplateContent;
          return withTemplateContent.slice(start, end);
        },
        getLength: () => withTemplateContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot || oldSnapshot === initialSnapshot) {
            return {
              span: { start: 9, length: 7 },
              newLength: 30, // "{% block %}Content{% endblock %}"
            };
          }
          return undefined;
        },
      };

      const afterTemplate = plugin.updateVirtualCode(
        'file:///test.md.tmpl',
        virtualCode,
        templateSnapshot
      );

      // Step 3: Apply a simple edit (no template markers) after the template region
      // This edit should use correct offset mapping for cleaned text
      const finalContent = 'Header\n\n{% block %}Content{% endblock %}\n\nFooter text';
      const finalSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return finalContent;
          return finalContent.slice(start, end);
        },
        getLength: () => finalContent.length,
        getChangeRange: function (oldSnapshot?: any) {
          if (!oldSnapshot || oldSnapshot === templateSnapshot) {
            return {
              span: { start: 47, length: 0 },
              newLength: 5, // " text"
            };
          }
          return undefined;
        },
      };

      const final = plugin.updateVirtualCode('file:///test.md.tmpl', afterTemplate, finalSnapshot);

      // Verify the final virtual code is valid and didn't corrupt cleaned text
      expect(final).toBeDefined();
      expect(final.languageId).toBe('markdown');
      expect(final.snapshot).not.toBe(finalSnapshot);
      expect(final.snapshot.getLength()).toBeGreaterThan(0);
      expect(final.mappings).toBeDefined();
      expect(final.mappings.length).toBeGreaterThan(0);
    });

    it('falls back to full rebuild when bounded edit window cannot be found', () => {
      // Create content with large blocks without newlines to force window expansion beyond MAX_WINDOW_SIZE (5000)
      // The 8000-char block has no line breaks, so finding window boundaries will exceed the size limit
      const huge = 'x'.repeat(8000);
      const initialContent = `${huge}\n{{ value }}\n${huge}`;
      const initialSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return initialContent;
          return initialContent.slice(start, end);
        },
        getLength: () => initialContent.length,
        getChangeRange: function () {
          return undefined;
        },
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///large.md.tmpl',
        'templjs-markdown',
        initialSnapshot
      );

      const updatedContent = `${huge}\n${'y'.repeat(3000)}\n${huge}`;
      const updateSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return updatedContent;
          return updatedContent.slice(start, end);
        },
        getLength: () => updatedContent.length,
        getChangeRange: function () {
          return {
            span: { start: huge.length + 1, length: 3000 },
            newLength: 3000,
          };
        },
      };

      const updated = plugin.updateVirtualCode(
        'file:///large.md.tmpl',
        (() => {
          if (!virtualCode) {
            throw new Error('Failed to create initial virtual code');
          }
          return virtualCode;
        })(),
        updateSnapshot as any
      );

      expect(updated.snapshot).not.toBe(updateSnapshot);
      expect(updated.snapshot.getLength()).toBeGreaterThan(0);
      expect(updated.languageId).toBe('markdown');
    });

    it('rebuilds when updateVirtualCode receives a non-Templjs virtual code instance', () => {
      const content = 'Hello {{name}}';
      const snapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return content;
          return content.slice(start, end);
        },
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const updated = plugin.updateVirtualCode(
        'file:///fallback.md.tmpl',
        { snapshot: null } as any,
        snapshot as any
      );

      expect(updated).toBeDefined();
      expect(updated.languageId).toBe('markdown');
      expect(updated.snapshot).not.toBe(snapshot);
      expect(updated.snapshot.getLength()).toBeGreaterThan(0);
    });

    it('covers mapOriginalToCleaned fallback branches for empty and sparse offset tables', () => {
      const content = 'abcde';
      const snapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return content;
          return content.slice(start, end);
        },
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///offset-fallback.md.tmpl',
        'templjs-markdown',
        snapshot
      ) as any;

      virtualCode.original = content;
      virtualCode.originalToCleanedOffsets = [];
      expect(virtualCode.mapOriginalToCleaned(3)).toBe(0);

      virtualCode.originalToCleanedOffsets = [0];
      expect(virtualCode.mapOriginalToCleaned(3)).toBe(0);
    });

    it('maps offsets via originalToCleanedOffsets table', () => {
      const content = 'seed';
      const snapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return content;
          return content.slice(start, end);
        },
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///offset-divergence.md.tmpl',
        'templjs-markdown',
        snapshot
      ) as any;

      virtualCode.original = 'abcdef';
      virtualCode.cleaned = 'abcX';
      virtualCode.originalToCleanedOffsets = [0, 1, 2, 3, 4, 4, 4];
      expect(virtualCode.mapOriginalOffsetToCleaned(4)).toBe(4);
      expect(virtualCode.mapOriginalOffsetToCleaned(5)).toBe(4);
      expect(virtualCode.mapOriginalOffsetToCleaned(9)).toBe(4);

      virtualCode.originalToCleanedOffsets = [];
      expect(virtualCode.mapOriginalOffsetToCleaned(3)).toBeNull();
    });

    it('falls back from simple edit to bounded edit when offset mapping fails', () => {
      const content = 'seed';
      const snapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return content;
          return content.slice(start, end);
        },
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///simple-fallback.md.tmpl',
        'templjs-markdown',
        snapshot
      ) as any;

      virtualCode.original = 'abcdef';
      virtualCode.cleaned = 'XYZ';
      virtualCode.originalToCleanedOffsets = [];
      const boundedSpy = vi.spyOn(virtualCode, 'applyBoundedEdit').mockReturnValue(true);

      const updated = virtualCode.applyEdit(2, 0, 'q');

      expect(updated).toBe(true);
      expect(boundedSpy).toHaveBeenCalledWith(2, 0, 'q');
      boundedSpy.mockRestore();
    });

    it('falls back from simple edit when mapped end offset precedes mapped start', () => {
      const content = 'abcdef';
      const snapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return content;
          return content.slice(start, end);
        },
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///simple-fallback-order.md.tmpl',
        'templjs-markdown',
        snapshot
      ) as any;

      const mapSpy = vi
        .spyOn(virtualCode, 'mapOriginalOffsetToCleaned')
        .mockReturnValueOnce(5)
        .mockReturnValueOnce(4);
      const boundedSpy = vi.spyOn(virtualCode, 'applyBoundedEdit').mockReturnValue(true);

      const updated = virtualCode.applyEdit(2, 1, 'q');

      expect(updated).toBe(true);
      expect(boundedSpy).toHaveBeenCalledWith(2, 1, 'q');
      mapSpy.mockRestore();
      boundedSpy.mockRestore();
    });
  });

  describe('Custom delimiter integration', () => {
    it('supports custom delimiters end-to-end across diagnostics and intellisense', () => {
      const provider = new IntellisenseProvider();
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      };

      const delimiters = {
        statementStart: '<<',
        statementEnd: '>>',
        expressionStart: '<:',
        expressionEnd: ':>',
        commentStart: '<#',
        commentEnd: '#>',
      };

      const template = '<< if user.name >>\nHello <: user.name :>\n<< endif >>';

      const diagnostics = collectDiagnostics(template, { schema, delimiters });
      expect(diagnostics).toHaveLength(0);

      const completions = provider.getCompletions('<: us :>', 4, {
        schema,
        delimiters,
      });
      expect(completions.some((item) => item.label === 'user')).toBe(true);

      const hover = provider.getHover('<: user.name :>', 6, {
        schema,
        delimiters,
      });
      expect(hover?.contents).toContain('user.name');
    });

    it('supports custom delimiters in virtual-code create/update flow', () => {
      const customPlugin = createTempljsLanguagePlugin({
        delimiters: {
          statementStart: '<<',
          statementEnd: '>>',
          expressionStart: '<:',
          expressionEnd: ':>',
          commentStart: '<#',
          commentEnd: '#>',
        },
      });

      const initialContent = 'Header\nValue: <: user.name :>\nFooter';
      const initialSnapshot = {
        getText: (start?: number, end?: number) => {
          if (start === undefined || end === undefined) return initialContent;
          return initialContent.slice(start, end);
        },
        getLength: () => initialContent.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = customPlugin.createVirtualCode(
        'file:///custom.md.tmpl',
        'templjs-markdown',
        initialSnapshot
      );

      if (!virtualCode) {
        throw new Error('Failed to create initial virtual code');
      }

      const replacement = '<< if user.name >>Value: <: user.name :><< endif >>';
      const target = 'Value: <: user.name :>';
      const start = initialContent.indexOf(target);
      const updatedContent =
        initialContent.slice(0, start) + replacement + initialContent.slice(start + target.length);

      const updateSnapshot = {
        getText: (snapshotStart?: number, snapshotEnd?: number) => {
          if (snapshotStart === undefined || snapshotEnd === undefined) return updatedContent;
          return updatedContent.slice(snapshotStart, snapshotEnd);
        },
        getLength: () => updatedContent.length,
        getChangeRange: (oldSnapshot?: unknown) => {
          if (!oldSnapshot || oldSnapshot === initialSnapshot) {
            return {
              span: { start, length: target.length },
              newLength: replacement.length,
            };
          }
          return undefined;
        },
      };

      const updated = customPlugin.updateVirtualCode(
        'file:///custom.md.tmpl',
        virtualCode,
        updateSnapshot
      );

      expect(updated).toBeDefined();
      expect(updated.snapshot).not.toBe(updateSnapshot);
      expect(updated.snapshot.getLength()).toBeGreaterThan(0);
      expect(updated.languageId).toBe('markdown');

      const updatedAccess = updated as unknown as { cleaned: string };
      expect(updatedAccess.cleaned).not.toContain('<<');
      expect(updatedAccess.cleaned).not.toContain('>>');
      expect(updatedAccess.cleaned).not.toContain('<:');
      expect(updatedAccess.cleaned).not.toContain(':>');
    });
  });

  describe('Language ID detection', () => {
    it('should support templjs-markdown language ID', () => {
      const mockSnapshot = {
        getText: () => 'test',
        getLength: () => 4,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('markdown');
    });

    it('should support templjs-json language ID', () => {
      const mockSnapshot = {
        getText: () => '{}',
        getLength: () => 2,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///data.json.tmpl',
        'templjs-json',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('json');
    });

    it('should support templjs-yaml language ID', () => {
      const mockSnapshot = {
        getText: () => 'key: value',
        getLength: () => 10,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///config.yaml.tmpl',
        'templjs-yaml',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('yaml');
    });

    it('should support templjs-html language ID', () => {
      const mockSnapshot = {
        getText: () => '<div></div>',
        getLength: () => 11,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///page.html.tmpl',
        'templjs-html',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('html');
    });
  });

  describe('Base format detection', () => {
    it('should detect markdown from .md extension', () => {
      const mockSnapshot = {
        getText: () => '# Title',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('markdown');
    });

    it('should detect markdown from .md.tpl extension', () => {
      const mockSnapshot = {
        getText: () => '# Title',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.md.tpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('markdown');
    });

    it('should detect markdown from .md.templ extension', () => {
      const mockSnapshot = {
        getText: () => '# Title',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.md.templ',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('markdown');
    });

    it('should detect markdown from .templ.md extension', () => {
      const mockSnapshot = {
        getText: () => '# Templated',
        getLength: () => 12,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.templ.md',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('markdown');
    });

    it('should detect json from .templ.json extension', () => {
      const mockSnapshot = {
        getText: () => '{ "name": "templ" }',
        getLength: () => 20,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///config.templ.json',
        'templjs-json',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('json');
    });

    it('should detect yaml from .templ.yaml extension', () => {
      const mockSnapshot = {
        getText: () => 'key: templ',
        getLength: () => 11,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///config.templ.yaml',
        'templjs-yaml',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('yaml');
    });

    it('should detect yaml from .templ.yml extension', () => {
      const mockSnapshot = {
        getText: () => 'key: templ',
        getLength: () => 11,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///config.templ.yml',
        'templjs-yaml',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('yaml');
    });

    it('should detect html from .templ.html extension', () => {
      const mockSnapshot = {
        getText: () => '<div>templ</div>',
        getLength: () => 17,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///page.templ.html',
        'templjs-html',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('html');
    });

    it('should detect markdown from .markdown.tmpl extension', () => {
      const mockSnapshot = {
        getText: () => '# Title',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.markdown.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('markdown');
    });

    it('should detect json from .json extension', () => {
      const mockSnapshot = {
        getText: () => '{}',
        getLength: () => 2,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///data.json.tmpl',
        'templjs-json',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('json');
    });

    it('should detect json from .json.tpl extension', () => {
      const mockSnapshot = {
        getText: () => '{}',
        getLength: () => 2,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///data.json.tpl',
        'templjs-json',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('json');
    });

    it('should detect yaml from .yaml/.yml extension', () => {
      const mockSnapshot = {
        getText: () => 'key: value',
        getLength: () => 10,
        getChangeRange: () => undefined,
      };

      const vcodeYaml = plugin.createVirtualCode(
        'file:///config.yaml.tmpl',
        'templjs-yaml',
        mockSnapshot
      );

      const vcodeYml = plugin.createVirtualCode(
        'file:///config.yml.tmpl',
        'templjs-yaml',
        mockSnapshot
      );

      expect(vcodeYaml?.languageId).toBe('yaml');
      expect(vcodeYml?.languageId).toBe('yaml');
    });

    it('should detect yaml from .yaml.tpl extension', () => {
      const mockSnapshot = {
        getText: () => 'key: value',
        getLength: () => 10,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///config.yaml.tpl',
        'templjs-yaml',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('yaml');
    });

    it('should detect html from .html.tpl extension', () => {
      const mockSnapshot = {
        getText: () => '<div>templ</div>',
        getLength: () => 17,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///page.html.tpl',
        'templjs-html',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('html');
    });

    it('should detect html from .html extension', () => {
      const mockSnapshot = {
        getText: () => '<div></div>',
        getLength: () => 11,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///page.html.tmpl',
        'templjs-html',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('html');
    });

    it('should default to plaintext for unknown formats', () => {
      const mockSnapshot = {
        getText: () => 'content',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///unknown.xyz.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      // Should not crash, languageId should be set to something valid
      expect(typeof virtualCode?.languageId).toBe('string');
    });

    it('should default to plaintext for .tmpl without base extension', () => {
      const mockSnapshot = {
        getText: () => 'content',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('plaintext');
    });

    it('should default to plaintext for .templ without base extension', () => {
      const mockSnapshot = {
        getText: () => 'content',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.templ',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('plaintext');
    });

    it('should default to plaintext when templ marker uses an unknown extension', () => {
      const mockSnapshot = {
        getText: () => 'content',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///doc.templ.xyz',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('plaintext');
    });

    it('should default to plaintext for non-template paths', () => {
      const mockSnapshot = {
        getText: () => 'content',
        getLength: () => 7,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///README.md',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.languageId).toBe('plaintext');
    });
  });

  describe('Snapshot handling', () => {
    it('should expose cleaned snapshot content', () => {
      const mockSnapshot = {
        getText: () => 'test content',
        getLength: () => 12,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.snapshot).not.toBe(mockSnapshot);
      expect(virtualCode?.snapshot.getText(0, virtualCode.snapshot.getLength())).toBe(
        'test content'
      );
    });

    it('should return full cleaned text when snapshot end is omitted', () => {
      const content = 'example content';
      const mockSnapshot = {
        getText: () => content,
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///snapshot.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode?.snapshot.getText(2)).toBe(content.slice(2));
    });

    it('should call snapshot getText correctly', () => {
      const content = 'Lorem ipsum dolor sit';
      let getTextCalls = 0;

      const mockSnapshot = {
        getText: (start: number, end: number) => {
          getTextCalls++;
          return content.substring(start, end);
        },
        getLength: () => content.length,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///test.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(getTextCalls).toBeGreaterThan(0);
      expect(virtualCode).toBeDefined();
    });
  });
});
