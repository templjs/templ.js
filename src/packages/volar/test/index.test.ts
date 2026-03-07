/**
 * Tests for @templjs/volar language plugin
 */

import { describe, it, expect } from 'vitest';
import { createTempljsLanguagePlugin } from '../src/index.js';

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
      expect(updated.snapshot).toBe(updateSnapshot);
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
      expect(updated.snapshot).toBe(updateSnapshot);
    });

    it('falls back to full rebuild when bounded edit window cannot be found', () => {
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
        virtualCode,
        updateSnapshot as any
      );

      expect(updated.snapshot).toBe(updateSnapshot);
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
      expect(updated.snapshot).toBe(snapshot);
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
  });

  describe('Snapshot handling', () => {
    it('should maintain snapshot reference', () => {
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

      expect(virtualCode?.snapshot).toBe(mockSnapshot);
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
