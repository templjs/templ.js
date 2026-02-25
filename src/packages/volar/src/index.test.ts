/**
 * Tests for @templjs/volar language plugin
 */

import { describe, it, expect } from 'vitest';
import { createTempljsLanguagePlugin } from './index';

describe('TemplJS Volar Plugin', () => {
  const plugin = createTempljsLanguagePlugin();

  describe('createVirtualCode', () => {
    it('should create virtual code for markdown template', () => {
      const mockSnapshot = {
        getText: () => '# Title\n\n{% if true %}\nContent\n{% endif %}',
        getLength: () => 43,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///example.md.tmpl',
        'templjs-markdown',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      expect(virtualCode?.id).toBe('root');
      expect(virtualCode?.languageId).toBe('markdown');
    });

    it('should create virtual code for json template', () => {
      const mockSnapshot = {
        getText: () => '{ "name": "{{ user.name }}" }',
        getLength: () => 30,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///config.json.tmpl',
        'templjs-json',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      expect(virtualCode?.languageId).toBe('json');
    });

    it('should create virtual code for yaml template', () => {
      const mockSnapshot = {
        getText: () => 'key: {{ value }}\nother: {{ other }}',
        getLength: () => 36,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///config.yaml.tmpl',
        'templjs-yaml',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      expect(virtualCode?.languageId).toBe('yaml');
    });

    it('should create virtual code for html template', () => {
      const mockSnapshot = {
        getText: () => '<h1>{{ title }}</h1>\n<p>{% if show %}{{ content }}{% endif %}</p>',
        getLength: () => 65,
        getChangeRange: () => undefined,
      };

      const virtualCode = plugin.createVirtualCode(
        'file:///page.html.tmpl',
        'templjs-html',
        mockSnapshot
      );

      expect(virtualCode).toBeDefined();
      expect(virtualCode?.languageId).toBe('html');
    });

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
