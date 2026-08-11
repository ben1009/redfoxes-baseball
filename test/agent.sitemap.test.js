const fs = require('fs');
const path = require('path');

describe('sitemap.xml', () => {
    const filePath = path.resolve(__dirname, '..', 'sitemap.xml');
    let content;

    beforeAll(() => {
        content = fs.readFileSync(filePath, 'utf8');
    });

    test('should exist at repo root', () => {
        expect(fs.existsSync(filePath)).toBe(true);
    });

    test('should be valid XML with urlset root', () => {
        expect(content).toMatch(/^<\?xml/);
        expect(content).toContain('<urlset');
        expect(content).toContain('</urlset>');
    });

    test('should contain all 10 page URLs', () => {
        const pages = [
            'index.html',
            'match_review.html',
            'u10_rules.html',
            'pony_u10_rules.html',
            'cba_u10_rules.html',
            'tigercup_groupstage.html',
            'tigercup_finalstage.html',
            'pony_u10_tianjin.html',
            'cba_u10_player_analysis.html',
            'sponsor_me.html'
        ];
        pages.forEach(page => {
            expect(content).toContain(`redfoxes-baseball/${page}`);
        });
    });

    test('each url entry should have loc, lastmod, changefreq, and priority', () => {
        const urlBlocks = content.match(/<url>[\s\S]*?<\/url>/g) || [];
        expect(urlBlocks.length).toBe(10);
        urlBlocks.forEach(block => {
            expect(block).toContain('<loc>');
            expect(block).toContain('<lastmod>');
            expect(block).toContain('<changefreq>');
            expect(block).toContain('<priority>');
        });
    });

    test('index.html should have priority 1.0', () => {
        expect(content).toMatch(/index\.html[\s\S]*?<priority>1\.0<\/priority>/);
    });

    test('sponsor_me.html should have weekly changefreq', () => {
        expect(content).toMatch(/sponsor_me\.html[\s\S]*?<changefreq>weekly<\/changefreq>/);
    });
});
