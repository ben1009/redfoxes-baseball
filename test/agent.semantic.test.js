const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const PAGES = [
    'index.html',
    'match_review.html',
    'u10_rules.html',
    'pony_u10_rules.html',
    'tigercup_groupstage.html',
    'tigercup_finalstage.html',
    'sponsor_me.html'
];

describe('Semantic HTML', () => {
    PAGES.forEach(file => {
        describe(file, () => {
            let $;

            beforeAll(() => {
                const html = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
                $ = cheerio.load(html);
            });

            test('should have a <main> element', () => {
                expect($('main').length).toBeGreaterThanOrEqual(1);
            });

            test('should have a <footer> element', () => {
                expect($('footer').length).toBeGreaterThanOrEqual(1);
            });
        });
    });

    test('index.html should have <nav> with aria-label', () => {
        const $ = cheerio.load(fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8'));
        expect($('nav[aria-label]').length).toBeGreaterThanOrEqual(1);
    });

    test('u10_rules.html should have <nav> with aria-label', () => {
        const $ = cheerio.load(fs.readFileSync(path.resolve(__dirname, '..', 'u10_rules.html'), 'utf8'));
        expect($('nav[aria-label]').length).toBeGreaterThanOrEqual(1);
    });

    test('pony_u10_rules.html should have <nav> with aria-label', () => {
        const $ = cheerio.load(fs.readFileSync(path.resolve(__dirname, '..', 'pony_u10_rules.html'), 'utf8'));
        expect($('nav[aria-label]').length).toBeGreaterThanOrEqual(1);
    });

    test('tigercup_groupstage.html should have <nav> with aria-label', () => {
        const $ = cheerio.load(fs.readFileSync(path.resolve(__dirname, '..', 'tigercup_groupstage.html'), 'utf8'));
        expect($('nav[aria-label]').length).toBeGreaterThanOrEqual(1);
    });

    test('tigercup_finalstage.html should have <nav> with aria-label', () => {
        const $ = cheerio.load(fs.readFileSync(path.resolve(__dirname, '..', 'tigercup_finalstage.html'), 'utf8'));
        expect($('nav[aria-label]').length).toBeGreaterThanOrEqual(1);
    });

    test('sponsor_me.html should have <header> element (not just div.topbar)', () => {
        const $ = cheerio.load(fs.readFileSync(path.resolve(__dirname, '..', 'sponsor_me.html'), 'utf8'));
        expect($('header').length).toBeGreaterThanOrEqual(1);
        expect($('header.topbar').length).toBe(1);
    });

    test('tigercup_groupstage.html should use <article> for ai-cards', () => {
        const $ = cheerio.load(fs.readFileSync(path.resolve(__dirname, '..', 'tigercup_groupstage.html'), 'utf8'));
        expect($('article.ai-card').length).toBe(3);
        expect($('div.ai-card').length).toBe(0);
    });

    test('tigercup_finalstage.html should use <article> for ai-cards', () => {
        const $ = cheerio.load(fs.readFileSync(path.resolve(__dirname, '..', 'tigercup_finalstage.html'), 'utf8'));
        expect($('article.ai-card').length).toBe(3);
        expect($('div.ai-card').length).toBe(0);
    });
});
