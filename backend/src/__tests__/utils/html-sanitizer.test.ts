import { describe, expect, it } from 'vitest';

import { sanitizeHtmlContent } from '../../utils/html-sanitizer';

describe('HTML sanitizer', () => {
    it('passes through plain text', () => {
        expect(sanitizeHtmlContent('Hello world')).toBe('Hello world');
    });

    it('strips disallowed tags', () => {
        const result = sanitizeHtmlContent('<script>alert("xss")</script>Hello');
        expect(result).not.toContain('<script>');
        expect(result).toContain('Hello');
    });

    it('allows basic formatting tags', () => {
        const result = sanitizeHtmlContent('<strong>bold</strong> <em>italic</em> <u>underline</u>');
        expect(result).toContain('<strong>bold</strong>');
        expect(result).toContain('<em>italic</em>');
        expect(result).toContain('<u>underline</u>');
    });

    it('removes event handlers', () => {
        const result = sanitizeHtmlContent('<a href="#" onclick="evil()">link</a>');
        expect(result).not.toContain('onclick');
    });

    it('strips non-allowable attributes', () => {
        const result = sanitizeHtmlContent('<div style="color:red" data-custom="x">text</div>');
        expect(result).not.toContain('style');
        expect(result).not.toContain('data-custom');
        expect(result).toContain('text');
    });

    it('returns empty string for null', () => {
        expect(sanitizeHtmlContent(null)).toBeNull();
    });

    it('returns empty string for undefined', () => {
        expect(sanitizeHtmlContent(undefined)).toBeNull();
    });
});
