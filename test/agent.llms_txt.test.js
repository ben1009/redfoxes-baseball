const fs = require('fs');
const path = require('path');

describe('llms.txt', () => {
    const filePath = path.resolve(__dirname, '..', 'llms.txt');
    let content;

    beforeAll(() => {
        content = fs.readFileSync(filePath, 'utf8');
    });

    test('should exist at repo root', () => {
        expect(fs.existsSync(filePath)).toBe(true);
    });

    test('should contain site name in Chinese', () => {
        expect(content).toContain('烈光少棒赤狐队');
    });

    test('should contain site name in English', () => {
        expect(content).toContain('Red Foxes Youth Baseball Team');
    });

    test('should list all 7 pages', () => {
        const pages = [
            'index.html',
            'match_review.html',
            'u10_rules.html',
            'pony_u10_rules.html',
            'tigercup_groupstage.html',
            'tigercup_finalstage.html',
            'sponsor_me.html'
        ];
        pages.forEach(page => {
            expect(content).toContain(page);
        });
    });

    test('should have an Actions Available section', () => {
        expect(content).toContain('Actions Available');
    });

    test('should mention search shortcut', () => {
        expect(content).toMatch(/Cmd|Ctrl/);
    });

    test('should be under 2KB to avoid wasting agent context', () => {
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeLessThan(2048);
    });
});
