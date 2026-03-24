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
      expect(parser.extractStatementContent(token)).toBe('if user.active');
    });

    // Case 2: raw string + explicit delimiters config
    it('extracts from a raw string when explicit delimiters are supplied as config', () => {
      const parser = makeParser();
      const delimiters: DelimiterConfig = { start: '{%', end: '%}' };
      expect(parser.extractStatementContent('{%   for item in items   %}', delimiters)).toBe(
        'for item in items'
      );
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
      expect(parser.extractStatementContent(token)).toBe('set total = price * qty');
    });

    it('extracts and trims with custom <% %> delimiters supplied as explicit config', () => {
      const parser = makeParser();
      const delimiters: DelimiterConfig = { start: '<%', end: '%>' };
      expect(parser.extractStatementContent('<%   set n = 0   %>', delimiters)).toBe('set n = 0');
    });

    it('token delimiterStart/delimiterEnd takes precedence over explicit delimiters config', () => {
      const parser = makeParser();
      const token: ExtractTokenInput = {
        content: '<%   set x = 1   %>',
        delimiterStart: '<%',
        delimiterEnd: '%>',
      };
      // explicit config uses {%/%}, but token metadata <%/%> should win
      expect(parser.extractStatementContent(token, { start: '{%', end: '%}' })).toBe('set x = 1');
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
      expect(parser.extractExpressionContent(token)).toBe('user.name');
    });

    // Case 2: raw string + explicit delimiters config
    it('extracts from a raw string when explicit delimiters are supplied as config', () => {
      const parser = makeParser();
      const delimiters: DelimiterConfig = { start: '{{', end: '}}' };
      expect(parser.extractExpressionContent('{{   order.total | currency   }}', delimiters)).toBe(
        'order.total | currency'
      );
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
      expect(parser.extractExpressionContent(token)).toBe('user.email');
    });

    it('extracts and trims with custom <% %> delimiters supplied as explicit config', () => {
      const parser = makeParser();
      const delimiters: DelimiterConfig = { start: '<%', end: '%>' };
      expect(parser.extractExpressionContent('<%   report.kpi.value   %>', delimiters)).toBe(
        'report.kpi.value'
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
      expect(parser.extractExpressionContent(token, { start: '{{', end: '}}' })).toBe(
        'report.total'
      );
    });
  });
});
