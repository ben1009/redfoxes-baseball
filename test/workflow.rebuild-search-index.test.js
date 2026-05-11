/**
 * @fileoverview Guards the rebuild-search-index GitHub Actions workflow
 * against drift from the indexer's PAGES array. If a new HTML page is added
 * to scripts/index-content.js PAGES, this test forces the workflow's path
 * filter to be updated to match, preventing the "added a page but search
 * forgot about it" bug.
 */

const fs = require('fs');
const path = require('path');

const { PAGES } = require('../scripts/index-content.js');

describe('rebuild-search-index GitHub Actions workflow', () => {
    const workflowPath = path.resolve(
        __dirname,
        '..',
        '.github',
        'workflows',
        'rebuild-search-index.yml'
    );
    let workflowContent;

    beforeAll(() => {
        workflowContent = fs.readFileSync(workflowPath, 'utf8');
    });

    test('workflow file should exist', () => {
        expect(fs.existsSync(workflowPath)).toBe(true);
    });

    test('every indexed page must appear in the workflow path filter', () => {
        PAGES.forEach(({ path: pagePath }) => {
            // Each page should appear as a path filter entry, e.g. `- 'index.html'`
            const expectedLine = new RegExp(`-\\s+['"]${pagePath.replace(/[/.]/g, '\\$&')}['"]`);
            expect(workflowContent).toMatch(expectedLine);
        });
    });

    test('workflow must also watch the indexer script itself', () => {
        expect(workflowContent).toMatch(/-\s+['"]scripts\/index-content\.js['"]/);
    });

    test('workflow must support manual re-indexing via workflow_dispatch', () => {
        expect(workflowContent).toMatch(/workflow_dispatch/);
    });

    test('workflow must run on main and master push', () => {
        expect(workflowContent).toMatch(/branches:\s*\[\s*main,\s*master\s*\]/);
    });

    test('workflow must pass all three required secrets to the indexer', () => {
        expect(workflowContent).toMatch(/SUPABASE_URL:\s*\$\{\{\s*secrets\.SUPABASE_URL\s*\}\}/);
        expect(workflowContent).toMatch(
            /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/
        );
        expect(workflowContent).toMatch(/GEMINI_API_KEY:\s*\$\{\{\s*secrets\.GEMINI_API_KEY\s*\}\}/);
    });

    test('workflow must use cancel-in-progress: false to avoid partial upserts', () => {
        expect(workflowContent).toMatch(/cancel-in-progress:\s*false/);
    });

    test('workflow must not require a committed package-lock.json', () => {
        // package-lock.json is gitignored in this repo, so these patterns
        // would break CI on a fresh runner. Use `npm install` and skip
        // the setup-node npm cache.
        expect(workflowContent).not.toMatch(/run:\s*npm ci\b/);
        expect(workflowContent).not.toMatch(/cache:\s*['"]npm['"]/);
        expect(workflowContent).not.toMatch(/-\s+['"]package-lock\.json['"]/);
    });
});
