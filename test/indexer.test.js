/**
 * @fileoverview Tests for the search indexer chunk extraction logic
 * Ensures section_ids map to real DOM anchors and synthetic fallbacks are rejected.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const { extractChunks, PAGES } = require('../scripts/index-content.js');

describe('Indexer Chunk Extraction', () => {
    function getValidIds(html) {
        const $ = cheerio.load(html);
        const ids = new Set();
        $('[id]').each((_, el) => ids.add($(el).attr('id')));
        return ids;
    }

    describe('u10_rules.html', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '../u10_rules.html'), 'utf-8');
        const chunks = extractChunks(html, 'u10_rules.html');
        const validIds = getValidIds(html);

        it('should produce at least one chunk', () => {
            expect(chunks.length).toBeGreaterThan(0);
        });

        it('should use real section IDs for all chunks that have one', () => {
            const chunksWithId = chunks.filter(c => c.section_id);
            expect(chunksWithId.length).toBeGreaterThan(0);

            for (const chunk of chunksWithId) {
                expect(validIds.has(chunk.section_id)).toBe(true);
            }
        });

        it('should not produce synthetic section-N fallback IDs', () => {
            for (const chunk of chunks) {
                expect(chunk.section_id).not.toMatch(/^section-\d+$/);
            }
        });

        it('should map the 场地 section to the venue anchor', () => {
            const venueChunks = chunks.filter(c => c.section_id === 'venue');
            expect(venueChunks.length).toBeGreaterThan(0);
            expect(venueChunks[0].heading).toContain('芦城体校');
        });
    });

    describe('pony_u10_rules.html', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '../pony_u10_rules.html'), 'utf-8');
        const chunks = extractChunks(html, 'pony_u10_rules.html');
        const validIds = getValidIds(html);

        it('should use real section IDs and no synthetic fallbacks', () => {
            const chunksWithId = chunks.filter(c => c.section_id);
            expect(chunksWithId.length).toBeGreaterThan(0);

            for (const chunk of chunks) {
                if (chunk.section_id) {
                    expect(validIds.has(chunk.section_id)).toBe(true);
                }
                expect(chunk.section_id).not.toMatch(/^section-\d+$/);
            }
        });
    });

    describe('tigercup_groupstage.html', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '../tigercup_groupstage.html'), 'utf-8');
        const chunks = extractChunks(html, 'tigercup_groupstage.html');
        const validIds = getValidIds(html);

        it('should use real section IDs and no synthetic fallbacks', () => {
            const chunksWithId = chunks.filter(c => c.section_id);
            expect(chunksWithId.length).toBeGreaterThan(0);

            for (const chunk of chunks) {
                if (chunk.section_id) {
                    expect(validIds.has(chunk.section_id)).toBe(true);
                }
                expect(chunk.section_id).not.toMatch(/^section-\d+$/);
            }
        });
    });

    describe('tigercup_finalstage.html', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '../tigercup_finalstage.html'), 'utf-8');
        const chunks = extractChunks(html, 'tigercup_finalstage.html');
        const validIds = getValidIds(html);

        it('should use real section IDs and no synthetic fallbacks', () => {
            const chunksWithId = chunks.filter(c => c.section_id);
            expect(chunksWithId.length).toBeGreaterThan(0);

            for (const chunk of chunks) {
                if (chunk.section_id) {
                    expect(validIds.has(chunk.section_id)).toBe(true);
                }
                expect(chunk.section_id).not.toMatch(/^section-\d+$/);
            }
        });
    });

    describe('pages without section IDs', () => {
        it('index.html should produce empty section_ids, not fallbacks', () => {
            const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
            const chunks = extractChunks(html, 'index.html');

            for (const chunk of chunks) {
                expect(chunk.section_id).not.toMatch(/^section-\d+$/);
            }
        });

        it('sponsor_me.html should produce empty section_ids, not fallbacks', () => {
            const html = fs.readFileSync(path.resolve(__dirname, '../sponsor_me.html'), 'utf-8');
            const chunks = extractChunks(html, 'sponsor_me.html');

            for (const chunk of chunks) {
                expect(chunk.section_id).not.toMatch(/^section-\d+$/);
            }
        });
    });

    describe('heading text deduplication', () => {
        it('should not duplicate heading text in the body', () => {
            const html = fs.readFileSync(path.resolve(__dirname, '../u10_rules.html'), 'utf-8');
            const chunks = extractChunks(html, 'u10_rules.html');
            const venueChunk = chunks.find(c => c.section_id === 'venue');
            expect(venueChunk).toBeDefined();
            // The heading text should appear in heading, not duplicated in body
            expect(venueChunk.body).not.toContain(venueChunk.heading);
        });
    });

    describe('PAGES config', () => {
        it('should list exactly 7 pages', () => {
            expect(PAGES).toHaveLength(7);
        });

        it('should include all expected page paths', () => {
            const paths = PAGES.map(p => p.path);
            expect(paths).toEqual(expect.arrayContaining([
                'index.html',
                'match_review.html',
                'u10_rules.html',
                'pony_u10_rules.html',
                'tigercup_groupstage.html',
                'tigercup_finalstage.html',
                'sponsor_me.html',
            ]));
        });
    });

    describe('indexer script source', () => {
        it('should request outputDimensionality from Gemini batch API', () => {
            const src = fs.readFileSync(path.resolve(__dirname, '../scripts/index-content.js'), 'utf-8');
            expect(src).toContain('outputDimensionality: TARGET_DIM');
        });
    });
});
