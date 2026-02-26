/**
 * Tests for semantic token provider
 */

import { describe, it, expect } from 'vitest';
import {
  extractSemanticTokens,
  SEMANTIC_TOKEN_LEGEND,
  SemanticTokenModifiers,
  SemanticTokenTypes,
  DEFAULT_DELIMITERS,
} from './semantic-token-provider';

describe('Semantic Token Provider', () => {
  describe('Basic Token Types', () => {
    it('should export semantic token types', () => {
      expect(SemanticTokenTypes).toHaveProperty('Keyword');
      expect(SemanticTokenTypes).toHaveProperty('Variable');
      expect(SemanticTokenTypes).toHaveProperty('Function');
      expect(SemanticTokenTypes).toHaveProperty('Comment');
    });

    it('should export semantic token modifiers', () => {
      expect(SemanticTokenModifiers).toHaveProperty('Readonly');
      expect(SemanticTokenModifiers).toHaveProperty('Deprecated');
    });

    it('should export semantic token legend for VS Code', () => {
      expect(SEMANTIC_TOKEN_LEGEND).toHaveProperty('tokenTypes');
      expect(SEMANTIC_TOKEN_LEGEND).toHaveProperty('tokenModifiers');
      expect(Array.isArray(SEMANTIC_TOKEN_LEGEND.tokenTypes)).toBe(true);
      expect(Array.isArray(SEMANTIC_TOKEN_LEGEND.tokenModifiers)).toBe(true);
    });

    it('should have token legend with all token types', () => {
      const { tokenTypes } = SEMANTIC_TOKEN_LEGEND;
      expect(tokenTypes).toContain('keyword');
      expect(tokenTypes).toContain('variable');
      expect(tokenTypes).toContain('function');
      expect(tokenTypes).toContain('comment');
    });
  });

  describe('Comment Highlighting', () => {
    it('should identify single-line comments', () => {
      const text = 'Start {# this is a comment #} end';
      const tokens = extractSemanticTokens(text);

      expect(tokens.length).toBeGreaterThan(0);
      const commentToken = tokens.find((t) => t.type === SemanticTokenTypes.Comment);
      expect(commentToken).toBeDefined();
      expect(commentToken?.offset).toBe(6);
      expect(commentToken?.length).toBe(23);
    });

    it('should identify multiline comments', () => {
      const text = '{# line 1\nline 2\nline 3 #}';
      const tokens = extractSemanticTokens(text);

      const commentToken = tokens.find((t) => t.type === SemanticTokenTypes.Comment);
      expect(commentToken).toBeDefined();
      expect(commentToken?.offset).toBe(0);
      expect(commentToken?.length).toBe(text.length);
    });

    it('should handle multiple comments', () => {
      const text = '{# first #} text {# second #}';
      const tokens = extractSemanticTokens(text);

      const commentTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Comment);
      expect(commentTokens.length).toBe(2);
      expect(commentTokens[0].offset).toBe(0);
      expect(commentTokens[1].offset).toBe(17);
    });

    it('should handle nested-looking comments', () => {
      const text = '{# outer {# inner #} #}';
      const tokens = extractSemanticTokens(text);

      const commentTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Comment);
      expect(commentTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Statement Highlighting', () => {
    it('should identify if statements', () => {
      const text = '{% if condition %}content{% endif %}';
      const tokens = extractSemanticTokens(text);

      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      expect(keywordTokens.length).toBeGreaterThan(0);
      expect(keywordTokens.some((t) => t.offset === 0)).toBe(true);
    });

    it('should identify for statements', () => {
      const text = '{% for item in items %}{{ item }}{% endfor %}';
      const tokens = extractSemanticTokens(text);

      const stmtToken = tokens.find((t) => t.offset === 0 && t.type === SemanticTokenTypes.Keyword);
      expect(stmtToken).toBeDefined();
    });

    it('should identify elif statements', () => {
      const text = '{% if x %}A{% elif y %}B{% endif %}';
      const tokens = extractSemanticTokens(text);

      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      expect(keywordTokens.length).toBeGreaterThan(0);
    });

    it('should identify else statements', () => {
      const text = '{% if x %}yes{% else %}no{% endif %}';
      const tokens = extractSemanticTokens(text);

      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      expect(keywordTokens.length).toBeGreaterThan(0);
    });

    it('should identify block statements', () => {
      const text = '{% block content %}...{% endblock %}';
      const tokens = extractSemanticTokens(text);

      const blockToken = tokens.find(
        (t) => t.offset === 0 && t.type === SemanticTokenTypes.Keyword
      );
      expect(blockToken).toBeDefined();
    });

    it('should handle multiline statements', () => {
      const text = '{% if\n  condition\n%}\ncontent\n{% endif %}';
      const tokens = extractSemanticTokens(text);

      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      expect(keywordTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Expression Highlighting', () => {
    it('should identify simple variable expressions', () => {
      const text = 'Hello {{ name }}!';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(varToken).toBeDefined();
      expect(varToken?.offset).toBe(6);
      expect(varToken?.length).toBe(10);
    });

    it('should identify nested property access', () => {
      const text = '{{ user.profile.name }}';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(varToken).toBeDefined();
    });

    it('should identify multiple expressions', () => {
      const text = '{{ first }} and {{ second }}';
      const tokens = extractSemanticTokens(text);

      const varTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Variable);
      expect(varTokens.length).toBe(2);
    });

    it('should identify expressions with filters', () => {
      const text = '{{ name | upper }}';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(varToken).toBeDefined();

      const funcToken = tokens.find((t) => t.type === SemanticTokenTypes.Function);
      expect(funcToken).toBeDefined();
      expect(funcToken?.modifiers).toContain(SemanticTokenModifiers.Readonly);
    });

    it('should handle multiline expressions', () => {
      const text = '{{\n  user.name\n  | upper\n}}';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(varToken).toBeDefined();
    });

    it('should handle expressions with whitespace', () => {
      const text = '{{  name  }}';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(varToken).toBeDefined();
      expect(varToken?.offset).toBe(0);
      expect(varToken?.length).toBe(12);
    });
  });

  describe('Filter Highlighting', () => {
    it('should identify single filter', () => {
      const text = '{{ value | upper }}';
      const tokens = extractSemanticTokens(text);

      const funcTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Function);
      expect(funcTokens.length).toBeGreaterThan(0);
      expect(funcTokens[0].length).toBe(5); // length of "upper"
    });

    it('should identify multiple chained filters', () => {
      const text = '{{ name | lower | capitalize }}';
      const tokens = extractSemanticTokens(text);

      const funcTokens = tokens.filter(
        (t) =>
          t.type === SemanticTokenTypes.Function &&
          t.modifiers?.includes(SemanticTokenModifiers.Readonly)
      );
      expect(funcTokens.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle filters with arguments', () => {
      const text = '{{ items | join: "," }}';
      const tokens = extractSemanticTokens(text);

      const funcTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Function);
      expect(funcTokens.length).toBeGreaterThan(0);
    });

    it('should identify built-in filters correctly', () => {
      const builtInFilters = [
        '{{ x | upper }}',
        '{{ x | lower }}',
        '{{ x | trim }}',
        '{{ x | default: "N/A" }}',
        '{{ x | escape }}',
      ];

      for (const text of builtInFilters) {
        const tokens = extractSemanticTokens(text);
        const funcToken = tokens.find((t) => t.type === SemanticTokenTypes.Function);
        expect(funcToken).toBeDefined();
      }
    });

    it('should not identify unknown filters', () => {
      const text = '{{ x | unknownfilter }}';
      const tokens = extractSemanticTokens(text);

      const funcTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Function);
      expect(funcTokens.length).toBe(0);
    });
  });

  describe('Complex Templates', () => {
    it('should handle mixed template and base syntax', () => {
      const text = `# Header
{# Comment #}
## Subheader
{% if show %}
Content: {{ name | upper }}
{% endif %}`;

      const tokens = extractSemanticTokens(text);

      const commentTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Comment);
      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      const varTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Variable);

      expect(commentTokens.length).toBeGreaterThan(0);
      expect(keywordTokens.length).toBeGreaterThan(0);
      expect(varTokens.length).toBeGreaterThan(0);
    });

    it('should handle nested template structures', () => {
      const text = `{% for item in items %}
  {% if item.active %}
    {{ item.name | upper }}
  {% endif %}
{% endfor %}`;

      const tokens = extractSemanticTokens(text);

      expect(tokens.length).toBeGreaterThan(0);
      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      expect(keywordTokens.length).toBeGreaterThan(2); // for, if, endif, endfor
    });

    it('should maintain correct offset in complex documents', () => {
      const text = 'prefix {% if x %} middle {{ name }} suffix {% endif %}';
      const tokens = extractSemanticTokens(text);

      // Verify tokens have valid offsets and lengths
      for (const token of tokens) {
        expect(token.offset).toBeGreaterThanOrEqual(0);
        expect(token.length).toBeGreaterThan(0);
        expect(token.offset + token.length).toBeLessThanOrEqual(text.length);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const tokens = extractSemanticTokens('');
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBe(0);
    });

    it('should handle input with no template syntax', () => {
      const text = 'Just plain text with no templates';
      const tokens = extractSemanticTokens(text);
      expect(tokens.length).toBe(0);
    });

    it('should handle unclosed delimiters gracefully', () => {
      const text = 'text {% unclosed statement';
      const tokens = extractSemanticTokens(text);
      // Should not throw, might not match unclosed delimiters
      expect(Array.isArray(tokens)).toBe(true);
    });

    it('should handle special characters in content', () => {
      const text = '{{ special_var-name.property[0] }}';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(varToken).toBeDefined();
    });

    it('should handle escaped sequences in strings', () => {
      const text = '{{ "string with \\" escaped quotes" }}';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(varToken).toBeDefined();
    });

    it('should return tokens sorted by offset', () => {
      const text = 'z {{ a }} y {# c #} x {% if d %}';
      const tokens = extractSemanticTokens(text);

      // Verify sorted order
      for (let i = 0; i < tokens.length - 1; i++) {
        expect(tokens[i].offset).toBeLessThanOrEqual(tokens[i + 1].offset);
      }
    });

    it('should remove duplicate tokens', () => {
      const text = '{{ var }}';
      const tokens = extractSemanticTokens(text);

      // Should not have duplicate tokens at same offset
      const offsetSet = new Set<string>();
      for (const token of tokens) {
        const key = `${token.offset}-${token.length}`;
        expect(!offsetSet.has(key)) // This should never be true (duplicate check)
          .toBe(true);
        offsetSet.add(key);
      }
    });
  });

  describe('Custom Delimiters', () => {
    it('should support custom comment delimiters', () => {
      const text = '{% first %} middle << comment >> end';
      const tokens = extractSemanticTokens(text, {
        commentStart: '<<',
        commentEnd: '>>',
      });

      const commentToken = tokens.find((t) => t.type === SemanticTokenTypes.Comment);
      expect(commentToken).toBeDefined();
      expect(commentToken?.offset).toBe(19);
    });

    it('should support custom statement delimiters', () => {
      const text = '<< if condition >> content << endif >>';
      const tokens = extractSemanticTokens(text, {
        statementStart: '<<',
        statementEnd: '>>',
      });

      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      expect(keywordTokens.length).toBeGreaterThan(0);
    });

    it('should support custom expression delimiters', () => {
      const text = '<: user.name :> other <: email :>';
      const tokens = extractSemanticTokens(text, {
        expressionStart: '<:',
        expressionEnd: ':>',
      });

      const varTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Variable);
      expect(varTokens.length).toBe(2);
    });

    it('should support all custom delimiters at once', () => {
      const text = '<<comment>> <<if x>> <:name:> <<endif>>';
      const tokens = extractSemanticTokens(text, {
        commentStart: '<<',
        commentEnd: '>>',
        statementStart: '<<',
        statementEnd: '>>',
        expressionStart: '<:',
        expressionEnd: ':>',
      });

      const commentTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Comment);
      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      const varTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Variable);

      expect(commentTokens.length).toBeGreaterThan(0);
      expect(keywordTokens.length).toBeGreaterThan(0);
      expect(varTokens.length).toBeGreaterThan(0);
    });

    it('should handle overlapping custom delimiters', () => {
      // Test that we can define delimiters that look similar
      const text = '[[ if x ]] << name >>';
      const tokens = extractSemanticTokens(text, {
        statementStart: '[[',
        statementEnd: ']]',
        expressionStart: '<<',
        expressionEnd: '>>',
      });

      const keywordTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Keyword);
      const varTokens = tokens.filter((t) => t.type === SemanticTokenTypes.Variable);

      expect(keywordTokens.length).toBeGreaterThan(0);
      expect(varTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Token Properties', () => {
    it('should set correct offset and length for tokens', () => {
      const text = 'prefix {{ name }} suffix';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(varToken?.offset).toBe(7);
      expect(varToken?.length).toBe(10); // {{ name }}
    });

    it('should include modifiers for filter functions', () => {
      const text = '{{ x | upper }}';
      const tokens = extractSemanticTokens(text);

      const funcToken = tokens.find((t) => t.type === SemanticTokenTypes.Function);
      expect(funcToken?.modifiers).toBeDefined();
      expect(funcToken?.modifiers?.length).toBeGreaterThan(0);
      expect(funcToken?.modifiers).toContain(SemanticTokenModifiers.Readonly);
    });

    it('should not add modifiers to non-function tokens', () => {
      const text = 'text {{ var }} text';
      const tokens = extractSemanticTokens(text);

      const varToken = tokens.find((t) => t.type === SemanticTokenTypes.Variable);
      expect(!varToken?.modifiers || varToken.modifiers.length === 0).toBe(true);
    });
  });

  describe('Default Delimiters Export', () => {
    it('should export default delimiters', () => {
      expect(DEFAULT_DELIMITERS).toBeDefined();
      expect(DEFAULT_DELIMITERS.commentStart).toBe('{#');
      expect(DEFAULT_DELIMITERS.commentEnd).toBe('#}');
      expect(DEFAULT_DELIMITERS.statementStart).toBe('{%');
      expect(DEFAULT_DELIMITERS.statementEnd).toBe('%}');
      expect(DEFAULT_DELIMITERS.expressionStart).toBe('{{');
      expect(DEFAULT_DELIMITERS.expressionEnd).toBe('}}');
    });

    it('should use default delimiters when none specified', () => {
      const text1 = '{% if %} {{ var }} {# comment #}';
      const text2 = text1;

      const tokensDefault = extractSemanticTokens(text1);
      const tokensExplicit = extractSemanticTokens(text2, DEFAULT_DELIMITERS);

      expect(tokensDefault.length).toBe(tokensExplicit.length);
    });
  });

  describe('Theme Compatibility', () => {
    it('should have theme-compatible token types', () => {
      const { tokenTypes } = SEMANTIC_TOKEN_LEGEND;

      // All token types should be valid VS Code semantic token types
      const validTypes = [
        'comment',
        'string',
        'number',
        'regexp',
        'operator',
        'keyword',
        'variable',
        'function',
        'parameter',
        'type',
        'class',
        'interface',
        'enum',
        'decorator',
        'label',
      ];

      for (const type of tokenTypes) {
        expect(validTypes).toContain(type);
      }
    });

    it('should have theme-compatible modifiers', () => {
      const { tokenModifiers } = SEMANTIC_TOKEN_LEGEND;

      // All modifiers should be valid VS Code semantic token modifiers
      const validModifiers = [
        'declaration',
        'definition',
        'readonly',
        'static',
        'deprecated',
        'abstract',
        'async',
        'modification',
        'documentation',
        'defaultLibrary',
      ];

      for (const modifier of tokenModifiers) {
        expect(validModifiers).toContain(modifier);
      }
    });

    it('should support both light and dark theme coloring', () => {
      const text = '{% if show %} {{ name | upper }} {% endif %}';
      const tokens = extractSemanticTokens(text);

      // All token types should be theme-aware
      const uniqueTypes = new Set(tokens.map((t) => t.type));
      for (const type of uniqueTypes) {
        expect(['keyword', 'variable', 'function', 'comment']).toContain(type);
      }
    });
  });
});
