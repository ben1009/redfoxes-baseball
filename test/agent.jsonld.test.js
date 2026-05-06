const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const PAGES = [
    { file: 'index.html', expectedType: 'SportsTeam' },
    { file: 'match_review.html', expectedType: 'SportsEvent' },
    { file: 'u10_rules.html', expectedType: 'SportsEvent' },
    { file: 'pony_u10_rules.html', expectedType: 'SportsEvent' },
    { file: 'tigercup_groupstage.html', expectedType: 'Article' },
    { file: 'tigercup_finalstage.html', expectedType: 'Article' },
    { file: 'sponsor_me.html', expectedType: 'DonateAction' }
];

describe('JSON-LD Structured Data', () => {
    PAGES.forEach(({ file, expectedType }) => {
        describe(file, () => {
            let $;
            let jsonLdBlocks;

            beforeAll(() => {
                const html = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
                $ = cheerio.load(html);
                jsonLdBlocks = [];
                $('script[type="application/ld+json"]').each((_, el) => {
                    const text = $(el).html();
                    try {
                        jsonLdBlocks.push(JSON.parse(text));
                    } catch (e) {
                        // invalid JSON-LD
                    }
                });
            });

            test('should have at least one JSON-LD block', () => {
                expect(jsonLdBlocks.length).toBeGreaterThanOrEqual(1);
            });

            test('JSON-LD should have @context set to schema.org', () => {
                const block = jsonLdBlocks[0];
                expect(block['@context']).toBe('https://schema.org');
            });

            test(`should have @type "${expectedType}"`, () => {
                const types = jsonLdBlocks.map(b => b['@type']);
                expect(types).toContain(expectedType);
            });
        });
    });
});
