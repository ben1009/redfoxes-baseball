const fs = require('fs');
const path = require('path');

describe('agent-manifest.json', () => {
    const manifestPath = path.resolve(__dirname, '..', 'agent-manifest.json');
    const schemaPath = path.resolve(__dirname, '..', 'agent-manifest.schema.json');
    let manifest;

    beforeAll(() => {
        const raw = fs.readFileSync(manifestPath, 'utf8');
        manifest = JSON.parse(raw);
    });

    test('agent-manifest.json should exist', () => {
        expect(fs.existsSync(manifestPath)).toBe(true);
    });

    test('agent-manifest.schema.json should exist', () => {
        expect(fs.existsSync(schemaPath)).toBe(true);
    });

    test('should be valid JSON', () => {
        expect(manifest).toBeDefined();
        expect(typeof manifest).toBe('object');
    });

    test('should reference the schema file', () => {
        expect(manifest.$schema).toBe('./agent-manifest.schema.json');
    });

    test('site.name should be the team name', () => {
        expect(manifest.site.name).toBe('烈光少棒赤狐队');
    });

    test('site.url should point to GitHub Pages', () => {
        expect(manifest.site.url).toContain('ben1009.github.io');
    });

    test('should have exactly 8 pages', () => {
        expect(manifest.pages).toHaveLength(8);
    });

    test('each page should have required fields', () => {
        manifest.pages.forEach(page => {
            expect(page).toHaveProperty('path');
            expect(page).toHaveProperty('title');
            expect(page).toHaveProperty('type');
            expect(page).toHaveProperty('description');
            expect(page).toHaveProperty('actions');
            expect(page).toHaveProperty('requires_auth');
            expect(Array.isArray(page.actions)).toBe(true);
        });
    });

    test('match_review page should require auth and have hint', () => {
        const review = manifest.pages.find(p => p.path === 'match_review.html');
        expect(review).toBeDefined();
        expect(review.requires_auth).toBe(true);
        expect(review.auth_hint).toBeTruthy();
    });

    test('all page paths should correspond to actual HTML files', () => {
        manifest.pages.forEach(page => {
            const filePath = path.resolve(__dirname, '..', page.path);
            expect(fs.existsSync(filePath)).toBe(true);
        });
    });

    test('should have at least 2 global actions', () => {
        expect(manifest.global_actions.length).toBeGreaterThanOrEqual(2);
    });

    test('should have at least 3 API endpoints', () => {
        expect(manifest.api_endpoints.length).toBeGreaterThanOrEqual(3);
    });
});
