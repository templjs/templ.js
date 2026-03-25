import { describe, expect, it } from 'vitest';
import { TemplateParser } from './parser.js';
import type { ExtractTokenInput, DelimiterConfig } from './parser.js';

function makeParser() {
  return new TemplateParser([]);
}

describe('TemplateParser - public extractStatementContent / extractExpressionContent', () => {
  describe('extractStatementContent', () => {
    // Case 1: ExtractTokenInput with delimiterStart/delimiterEnd metadata
    it('strips and trims content when token carries delimiterStart/delimiterEnd metadata', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '{%   if user.active   %}',
        delimiterStart: '{%',
        delimiterEnd: '%}',
      };
      expect(parser.extractStatementContent(token).content).toBe('if user.active');
    });

    // Case 2: raw string + explicit delimiters config
    it('extracts from a raw string when explicit delimiters are supplied as config', () => {
      const parser = makeParser();
      const delimiters: DelimiterConfig = { start: '{%', end: '%}' };
      expect(
        parser.extractStatementContent('{%   for item in items   %}', delimiters).content
      ).toBe('for item in items');
    });

    // Case 3: no metadata and no explicit delimiters → must throw
    it('throws when neither token metadata nor explicit delimiters are provided', () => {
      const parser = makeParser();
      expect(() => parser.extractStatementContent('if user.active')).toThrow(
        'extractStatementContent requires delimiterStart/delimiterEnd in token metadata or explicit delimiters config'
      );
    });

    it('throws for an ExtractTokenInput with undefined metadata and no explicit delimiters', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '{% if user.active %}',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };
      expect(() => parser.extractStatementContent(token)).toThrow(
        'extractStatementContent requires delimiterStart/delimiterEnd in token metadata or explicit delimiters config'
      );
    });

    // Case 4: custom delimiters <% %>
    it('extracts and trims with custom <% %> delimiters supplied as token metadata', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '<%   set total = price * qty   %>',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };
      expect(parser.extractStatementContent(token).content).toBe('set total = price * qty');
    });

    it('extracts and trims with custom <% %> delimiters supplied as explicit config', () => {
      const parser = makeParser();
      const delimiters: DelimiterConfig = { start: '<%', end: '%>' };
      expect(parser.extractStatementContent('<%   set n = 0   %>', delimiters).content).toBe(
        'set n = 0'
      );
    });

    it('returns an empty string when statement content is empty between delimiters', () => {
      const parser = makeParser();
      expect(parser.extractStatementContent('{%   %}', { start: '{%', end: '%}' }).content).toBe(
        ''
      );
    });

    it('returns contentStart/contentEnd offsets relative to token start for wrapped statements', () => {
      const parser = makeParser();
      const extracted = parser.extractStatementContent('{%   if user.active   %}', {
        start: '{%',
        end: '%}',
      });

      expect(extracted).toEqual({
        content: 'if user.active',
        contentStart: 5,
        contentEnd: 19,
      });
    });

    // Edge case: when input lacks the configured delimiters (e.g. pre-processed tokens or
    // malformed/partial input recovery), extractStatementContent falls back to trimming the
    // whole input and returns offsets (contentStart, contentEnd) spanning only the trimmed content.
    it('returns offsets that span the trimmed plain content when delimiters are absent in text', () => {
      const parser = makeParser();
      const extracted = parser.extractStatementContent('   plain_statement   ', {
        start: '{%',
        end: '%}',
      });

      expect(extracted).toEqual({
        content: 'plain_statement',
        contentStart: 3,
        contentEnd: 18,
      });
    });

    it('handles minimal whitespace in statements without over-trimming content', () => {
      const parser = makeParser();
      expect(parser.extractStatementContent('{% x %}', { start: '{%', end: '%}' }).content).toBe(
        'x'
      );
    });

    it('throws when token metadata provides only delimiterStart', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '{% x %}',
        delimiterStart: '{%',
        delimiterEnd: undefined,
      };
      expect(() => parser.extractStatementContent(token)).toThrow(
        'extractStatementContent requires delimiterStart/delimiterEnd in token metadata or explicit delimiters config'
      );
    });

    it('throws when token metadata provides only delimiterEnd', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '{% x %}',
        delimiterStart: undefined,
        delimiterEnd: '%}',
      };
      expect(() => parser.extractStatementContent(token)).toThrow(
        'extractStatementContent requires delimiterStart/delimiterEnd in token metadata or explicit delimiters config'
      );
    });

    it('token delimiterStart/delimiterEnd takes precedence over explicit delimiters config', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '<%   set x = 1   %>',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };
      // explicit config uses {%/%}, but token metadata <%/%> should win
      expect(parser.extractStatementContent(token, { start: '{%', end: '%}' }).content).toBe(
        'set x = 1'
      );
    });
  });

  describe('extractExpressionContent', () => {
    // Case 1: ExtractTokenInput with delimiterStart/delimiterEnd metadata
    it('strips and trims content when token carries delimiterStart/delimiterEnd metadata', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '{{   user.name   }}',
        delimiterStart: '{{',
        delimiterEnd: '}}',
      };
      expect(parser.extractExpressionContent(token).content).toBe('user.name');
    });

    // Case 2: raw string + explicit delimiters config
    it('extracts from a raw string when explicit delimiters are supplied as config', () => {
      const parser = makeParser();
      const delimiters: DelimiterConfig = { start: '{{', end: '}}' };
      expect(
        parser.extractExpressionContent('{{   order.total | currency   }}', delimiters).content
      ).toBe('order.total | currency');
    });

    // Case 3: no metadata and no explicit delimiters → must throw
    it('throws when neither token metadata nor explicit delimiters are provided', () => {
      const parser = makeParser();
      expect(() => parser.extractExpressionContent('user.name')).toThrow(
        'extractExpressionContent requires delimiterStart/delimiterEnd in token metadata or explicit delimiters config'
      );
    });

    it('throws for an ExtractTokenInput with undefined metadata and no explicit delimiters', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '{{ user.name }}',
        delimiterStart: undefined,
        delimiterEnd: undefined,
      };
      expect(() => parser.extractExpressionContent(token)).toThrow(
        'extractExpressionContent requires delimiterStart/delimiterEnd in token metadata or explicit delimiters config'
      );
    });

    // Case 4: custom delimiters <% %>
    it('extracts and trims with custom <% %> delimiters supplied as token metadata', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '<%   user.email   %>',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };
      expect(parser.extractExpressionContent(token).content).toBe('user.email');
    });

    it('extracts and trims with custom <% %> delimiters supplied as explicit config', () => {
      const parser = makeParser();
      const delimiters: DelimiterConfig = { start: '<%', end: '%>' };
      expect(
        parser.extractExpressionContent('<%   report.kpi.value   %>', delimiters).content
      ).toBe('report.kpi.value');
    });

    it('returns an empty string when expression content is empty between delimiters', () => {
      const parser = makeParser();
      expect(parser.extractExpressionContent('{{   }}', { start: '{{', end: '}}' }).content).toBe(
        ''
      );
    });

    it('handles minimal whitespace in expressions without over-trimming content', () => {
      const parser = makeParser();
      expect(parser.extractExpressionContent('{{x}}', { start: '{{', end: '}}' }).content).toBe(
        'x'
      );
    });

    it('throws when token metadata provides only delimiterStart', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '{{x}}',
        delimiterStart: '{{',
        delimiterEnd: undefined,
      };
      expect(() => parser.extractExpressionContent(token)).toThrow(
        'extractExpressionContent requires delimiterStart/delimiterEnd in token metadata or explicit delimiters config'
      );
    });

    it('throws when token metadata provides only delimiterEnd', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '{{x}}',
        delimiterStart: undefined,
        delimiterEnd: '}}',
      };
      expect(() => parser.extractExpressionContent(token)).toThrow(
        'extractExpressionContent requires delimiterStart/delimiterEnd in token metadata or explicit delimiters config'
      );
    });

    it('token delimiterStart/delimiterEnd takes precedence over explicit delimiters config', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '[[   report.total   ]]',
        delimiterStart: '[[',
        delimiterEnd: ']]',
      };
      // explicit config uses {{/}}, but token metadata [[/]] should win
      expect(parser.extractExpressionContent(token, { start: '{{', end: '}}' }).content).toBe(
        'report.total'
      );
    });

    it('returns content offsets relative to the original expression token content', () => {
      const parser = makeParser();
      const extracted = parser.extractExpressionContent('{{   user.name   }}', {
        start: '{{',
        end: '}}',
      });

      expect(extracted).toEqual({
        content: 'user.name',
        contentStart: 5,
        contentEnd: 14,
      });
    });

    it('returns trimmed-span offsets when expression delimiters are absent in input text', () => {
      const parser = makeParser();
      const extracted = parser.extractExpressionContent('   plain_expression   ', {
        start: '{{',
        end: '}}',
      });

      expect(extracted).toEqual({
        content: 'plain_expression',
        contentStart: 3,
        contentEnd: 19,
      });
    });
  });
});
