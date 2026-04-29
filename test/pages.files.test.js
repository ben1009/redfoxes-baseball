const fs = require('fs');
const path = require('path');

describe('File Existence Tests', () => {
    const files = [
        'index.html',
        'match_review.html',
        'u10_rules.html',
        'pony_u10_rules.html',
        'tigercup_groupstage.html',
        'tigercup_finalstage.html',
        'sponsor_me.html',
        'site_analytics.js',
        'image_modal.js',
        'baseball_floats.css',
        'baseball_floats.js',
        'rules_style.css',
        'img/groupstage_data.png',
        'img/finalstage_data.png',
        'img/tigercup_final_ranking.jpg',
        'img/pony_u10_tianjin_schedule.png',
        'workers/sponsor_likes.js',
        'workers/wrangler.toml',
        'workers/README.md',
        'site_search.js',
        'scripts/index-content.js',
        'supabase/functions/sponsor-likes/index.ts',
        'supabase/functions/site-search/index.ts',
        'supabase/migrations/20260421_sponsor_likes.sql',
        'supabase/migrations/20260423_hybrid_search.sql',
        'supabase/README.md',
        '.github/workflows/deploy-worker.yml'
    ];

    files.forEach(file => {
        test(`${file} should exist`, () => {
            const filePath = path.resolve(__dirname, '..', file);
            expect(fs.existsSync(filePath)).toBe(true);
        });
    });
});

describe('Supabase Edge Function Security', () => {
    test('should use explicit CORS origin whitelist instead of wildcard', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/sponsor-likes/index.ts'),
            'utf8'
        );
        expect(ts).toContain('ALLOWED_ORIGINS');
        expect(ts).not.toContain('"Access-Control-Allow-Origin": "*"');
        expect(ts).not.toContain('ALLOWED_ORIGINS[0]');
    });

    test('should prefer infrastructure IP headers to avoid spoofing', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/sponsor-likes/index.ts'),
            'utf8'
        );
        const cfIndex = ts.indexOf('cf-connecting-ip');
        const realIpIndex = ts.indexOf('x-real-ip');
        const forwardedForIndex = ts.indexOf('x-forwarded-for');
        expect(cfIndex).toBeGreaterThan(-1);
        expect(realIpIndex).toBeGreaterThan(-1);
        expect(forwardedForIndex).toBeGreaterThan(-1);
        expect(cfIndex).toBeLessThan(forwardedForIndex);
        expect(realIpIndex).toBeLessThan(forwardedForIndex);
        expect(ts).toContain('ips[ips.length - 1]');
        expect(ts).not.toContain('split(",")[0].trim()');
    });

    test('should return generic error messages instead of raw internals', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/sponsor-likes/index.ts'),
            'utf8'
        );
        expect(ts).toContain('"Internal server error"');
        expect(ts).toContain('console.error(');
        expect(ts).not.toContain('return jsonResponse({ error: message }, 500');
    });

    test('should include VS Code Live Server origin in development whitelist', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/sponsor-likes/index.ts'),
            'utf8'
        );
        expect(ts).toContain('"http://localhost:5501"');
        expect(ts).toContain('"http://127.0.0.1:5501"');
    });

    test('site-search function should also use explicit CORS whitelist', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/site-search/index.ts'),
            'utf8'
        );
        expect(ts).toContain('ALLOWED_ORIGINS');
        expect(ts).not.toContain('"Access-Control-Allow-Origin": "*"');
        expect(ts).toContain('"Internal server error"');
    });

    test('site-search function should use Gemini embedding with fallback to FTS', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/site-search/index.ts'),
            'utf8'
        );
        expect(ts).toContain('GEMINI_API_KEY');
        expect(ts).toContain('gemini-embedding-2');
        expect(ts).toContain('truncateEmbedding');
        expect(ts).toContain('falling back to FTS-only search');
    });

    test('site-search function should omit hash when section_id is empty', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/site-search/index.ts'),
            'utf8'
        );
        expect(ts).toContain('const hash = sectionId ? `#${sectionId}` : ""');
        expect(ts).toContain('`${row.page_path}${hash}`');
        expect(ts).not.toContain('`${row.page_path}#${row.section_id}`');
    });

    test('site-search function should use atomic SET NX EX for rate limiting', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/site-search/index.ts'),
            'utf8'
        );
        expect(ts).toContain('"set"');
        expect(ts).toContain('"nx"');
        expect(ts).toContain('"ex"');
        expect(ts).toContain('if (initialized === "OK")');
        expect(ts).not.toContain('if (current === 1)');
    });

    test('site-search function should use last IP in X-Forwarded-For to avoid spoofing', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/site-search/index.ts'),
            'utf8'
        );
        expect(ts).toContain('return ips[ips.length - 1]');
        expect(ts).not.toContain('return ips[0]');
    });

    test('site-search function should request outputDimensionality from Gemini', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/site-search/index.ts'),
            'utf8'
        );
        expect(ts).toContain('outputDimensionality: TARGET_DIM');
    });
});

describe('Shared Script Coverage', () => {
    test('site_analytics.js should define the shared analytics bootstrap', () => {
        const js = fs.readFileSync(path.resolve(__dirname, '..', 'site_analytics.js'), 'utf8');

        expect(js).toContain('window.dataLayer = window.dataLayer || [];');
        expect(js).toContain('function gtag()');
        expect(js).toContain("gtag('js', new Date());");
        expect(js).toContain("gtag('config', 'G-QJ6EXQH8SW');");
    });

    test('image_modal.js should support both standard and sponsor modal variants', () => {
        const js = fs.readFileSync(path.resolve(__dirname, '..', 'image_modal.js'), 'utf8');

        expect(js).toContain("const modal = document.getElementById('imageModal');");
        expect(js).toContain("const zoomableSelector = '[data-zoomable], .image-container img';");
        expect(js).toContain("modal.querySelector('#modalImage, #imageModalImg, img')");
        expect(js).toContain("modal.querySelector('.modal-close, #imageModalClose, .image-modal-close')");
        expect(js).toContain("const modalMode = modal.dataset.modalMode || 'standard';");
        expect(js).toContain("const usesOverlayModal = modalMode === 'overlay';");
        expect(js).toContain("modal.classList.add('open');");
        expect(js).toContain("modal.classList.add('active');");
        expect(js).toContain("img.setAttribute('tabindex', '0');");
        expect(js).toContain("img.setAttribute('role', 'button');");
        expect(js).toContain("if (event.key === 'Enter' || event.key === ' ')");
        expect(js).toContain("if (event.key !== 'Escape')");
    });

    test('all pages should use the shared analytics bootstrap', () => {
        const pages = [
            'index.html',
            'match_review.html',
            'u10_rules.html',
            'pony_u10_rules.html',
            'tigercup_groupstage.html',
            'tigercup_finalstage.html',
            'sponsor_me.html'
        ];

        pages.forEach((file) => {
            const html = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
            expect(html).toContain('src="site_analytics.js"');
            expect(html).not.toContain("function gtag(){dataLayer.push(arguments);}");
        });
    });

    test('all pages should include the shared search script', () => {
        const pages = [
            'index.html',
            'match_review.html',
            'u10_rules.html',
            'pony_u10_rules.html',
            'tigercup_groupstage.html',
            'tigercup_finalstage.html',
            'sponsor_me.html'
        ];

        pages.forEach((file) => {
            const html = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
            expect(html).toContain('src="site_search.js"');
        });
    });
});
