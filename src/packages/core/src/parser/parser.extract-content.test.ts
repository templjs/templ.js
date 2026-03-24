import { describe, expect, it } from 'vitest';
import { TemplateParser } from './parser.js';
import type { ExtractTokenInput, DelimiterConfig } from './parser.js';

function createParser() {
  return new TemplateParser([]);
}

function extractStatementContent(
  input: string | ExtractTokenInput,
  delimiters: DelimiterConfig = { start: '{%', end: '%}' }
): string {
  const parser = createParser();
  return parser.extractStatementContent(input, delimiters);
}

function extractExpressionContent(
  input: string | ExtractTokenInput,
  delimiters: DelimiterConfig = { start: '{{', end: '}}' }
): string {
  const parser = createParser();
  return parser.extractExpressionContent(input, delimiters);
}

describe('TemplateParser extract content helpers', () => {
  describe('extractStatementContent', () => {
    it('extracts and trims content with default statement delimiters from string input', () => {
      expect(extractStatementContent('{%   if user.active   %}')).toBe('if user.active');
    });

    it('extracts and trims content with default statement delimiters from token input', () => {
      const token: ExtractTokenInput = {
        content: '{%   for item in items   %}',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };

      expect(extractStatementContent(token)).toBe('for item in items');
    });

    it('returns empty content for default statement delimiters from string input', () => {
      expect(extractStatementContent('{% %}')).toBe('');
    });

    it('returns empty content for default statement delimiters from token input', () => {
      const token: ExtractTokenInput = {
        content: '{% %}',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };

      expect(extractStatementContent(token)).toBe('');
    });

    it('extracts content with custom <% %> delimiters from token input', () => {
      const token: ExtractTokenInput = {
        content: '<%   set total = price * qty   %>',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };

      expect(extractStatementContent(token)).toBe('set total = price * qty');
    });

    it('extracts empty content with custom <% %> delimiters from token input', () => {
      const token: ExtractTokenInput = {
        content: '<%   %>',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };

      expect(extractStatementContent(token)).toBe('');
    });

    it('extracts content when both custom delimiters match', () => {
      const token: ExtractTokenInput = {
        content: '<% if user.active %>',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };

      expect(extractStatementContent(token)).toBe('if user.active');
    });

    it('supports asymmetric multi-character delimiters when both ends match', () => {
      const token: ExtractTokenInput = {
        content: '<!-- if user.active -->',
        delimiterStart: '<!--',
        delimiterEnd: '-->',
      };

      expect(extractStatementContent(token)).toBe('if user.active');
    });

    it('does not strip asymmetric multi-character delimiters when one end does not match', () => {
      const token: ExtractTokenInput = {
        content: '<!-- if user.active --',
        delimiterStart: '<!--',
        delimiterEnd: '-->',
      };

      expect(extractStatementContent(token)).toBe('<!-- if user.active --');
    });

    it('does not strip when delimiter metadata is omitted for custom-delimited content', () => {
      const token: ExtractTokenInput = {
        content: '<% if custom %>',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };

      expect(extractStatementContent(token)).toBe('<% if custom %>');
    });

    it('returns original content when delimiter metadata does not match token content', () => {
      const token: ExtractTokenInput = {
        content: '{{ if user.active }}',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };

      expect(extractStatementContent(token)).toBe('{{ if user.active }}');
    });

    it('falls back to trim when end delimiter is missing', () => {
      expect(extractStatementContent('   {% if user.active   ')).toBe('{% if user.active');
    });

    it('does not strip on partial delimiter match for string and token inputs', () => {
      expect(extractStatementContent('{% user.active }')).toBe('{% user.active }');

      const token: ExtractTokenInput = {
        content: '{% user.active }',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };

      expect(extractStatementContent(token)).toBe('{% user.active }');
    });

    it('trims plain statement content when delimiters are absent', () => {
      expect(extractStatementContent('   plain_statement   ')).toBe('plain_statement');

      const token: ExtractTokenInput = {
        content: '   plain_statement   ',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };

      expect(extractStatementContent(token)).toBe('plain_statement');
    });
  });

  describe('extractExpressionContent', () => {
    it('extracts and trims content with default expression delimiters from string input', () => {
      expect(extractExpressionContent('{{   user.name   }}')).toBe('user.name');
    });

    it('extracts and trims content with default expression delimiters from token input', () => {
      const token: ExtractTokenInput = {
        content: '{{   order.total | currency   }}',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };

      expect(extractExpressionContent(token)).toBe('order.total | currency');
    });

    it('returns empty content for default expression delimiters from string input', () => {
      expect(extractExpressionContent('{{ }}')).toBe('');
    });

    it('returns empty content for default expression delimiters from token input', () => {
      const token: ExtractTokenInput = {
        content: '{{ }}',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };

      expect(extractExpressionContent(token)).toBe('');
    });

    it('extracts content with custom [[ ]] delimiters from token input', () => {
      const token: ExtractTokenInput = {
        content: '[[   report.kpi.value   ]]',
        delimiterStart: '[[',
        delimiterEnd: ']]',
      };

      expect(extractExpressionContent(token)).toBe('report.kpi.value');
    });

    it('supports custom <% %> delimiters for expression extraction when provided', () => {
      const token: ExtractTokenInput = {
        content: '<%   user.email   %>',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };

      expect(extractExpressionContent(token)).toBe('user.email');
    });

    it('supports asymmetric multi-character delimiters when both ends match', () => {
      const token: ExtractTokenInput = {
        content: '<!-- user.email -->',
        delimiterStart: '<!--',
        delimiterEnd: '-->',
      };

      expect(extractExpressionContent(token)).toBe('user.email');
    });

    it('does not strip asymmetric multi-character delimiters when one end does not match', () => {
      const token: ExtractTokenInput = {
        content: '<!-- user.email --',
        delimiterStart: '<!--',
        delimiterEnd: '-->',
      };

      expect(extractExpressionContent(token)).toBe('<!-- user.email --');
    });

    it('does not strip when custom delimiter metadata is omitted', () => {
      const token: ExtractTokenInput = {
        content: '[[ user.name ]]',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };

      expect(extractExpressionContent(token)).toBe('[[ user.name ]]');
    });

    it('returns original content when delimiter metadata does not match token content', () => {
      const token: ExtractTokenInput = {
        content: '{% user.name %}',
        delimiterStart: '{{',
        delimiterEnd: '}}',
      };

      expect(extractExpressionContent(token)).toBe('{% user.name %}');
    });

    it('does not strip on partial delimiter match', () => {
      expect(extractExpressionContent('{{ user.name }')).toBe('{{ user.name }');
      expect(extractExpressionContent('{ user.name }}')).toBe('{ user.name }}');
    });

    it('falls back to trim when end delimiter is missing', () => {
      expect(extractExpressionContent('   {{ user.name   ')).toBe('{{ user.name');
    });

    it('trims plain content when no delimiters are present', () => {
      expect(extractExpressionContent('   plain_expression   ')).toBe('plain_expression');
    });
  });
});
