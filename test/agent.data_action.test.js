const { createPageHarness, PAGE_PATHS } = require('./pages.shared');

describe('data-action Attributes', () => {
    describe('index.html', () => {
        const harness = createPageHarness(PAGE_PATHS.index);

        beforeAll(harness.setup);
        afterAll(harness.teardown);

        test('nav cards should have data-action="navigate"', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                const cards = await harness.page.$$('a.nav-card[data-action="navigate"]');
                expect(cards).toHaveLength(9);
            });
        });

        test('nav cards should have data-target matching href', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                const matches = await harness.page.$$eval('a.nav-card[data-action="navigate"]', els =>
                    els.map(el => ({
                        href: el.getAttribute('href'),
                        target: el.getAttribute('data-target')
                    }))
                );
                matches.forEach(({ href, target }) => {
                    expect(target).toBe(href);
                });
            });
        });
    });

    describe('match_review.html', () => {
        const harness = createPageHarness(PAGE_PATHS.matchReview);

        beforeAll(harness.setup);
        afterAll(harness.teardown);

        test('video cards should have data-action="watch_video"', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                // Unlock the page
                await harness.page.evaluate((pw) => {
                    document.getElementById('passwordOverlay').style.display = 'none';
                    document.getElementById('mainContent').classList.add('visible');
                }, process.env.TEST_PASSWORD || '1972');

                const cards = await harness.page.$$('article.video-card[data-action="watch_video"]');
                expect(cards).toHaveLength(7);
            });
        });

        test('video cards should have data-video-id attributes', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                await harness.page.evaluate(() => {
                    document.getElementById('passwordOverlay').style.display = 'none';
                    document.getElementById('mainContent').classList.add('visible');
                });

                const ids = await harness.page.$$eval('article.video-card[data-action="watch_video"]', els =>
                    els.map(el => el.getAttribute('data-video-id'))
                );
                ids.forEach(id => {
                    expect(id).toBeTruthy();
                    expect(id).toMatch(/^BV/);
                });
            });
        });
    });

    describe('u10_rules.html', () => {
        const harness = createPageHarness(PAGE_PATHS.rules);

        beforeAll(harness.setup);
        afterAll(harness.teardown);

        test('sections should have data-action="read_rules"', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                const sections = await harness.page.$$('section[data-action="read_rules"]');
                expect(sections.length).toBeGreaterThan(0);
            });
        });
    });

    describe('cba_u10_rules.html', () => {
        const harness = createPageHarness(PAGE_PATHS.cbaRules);

        beforeAll(harness.setup);
        afterAll(harness.teardown);

        test('analysis links should have data-action="navigate"', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                const links = await harness.page.$$('a[href="cba_u10_player_analysis.html"][data-action="navigate"]');
                expect(links).toHaveLength(2);
            });
        });
    });

    describe('cba_u10_player_analysis.html', () => {
        const harness = createPageHarness(PAGE_PATHS.cbaU10PlayerAnalysis);

        beforeAll(harness.setup);
        afterAll(harness.teardown);

        test('new interactive elements should have data-action attributes', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                const navLinks = await harness.page.$$('nav.page-nav a.nav-link[data-action="navigate"]');
                expect(navLinks).toHaveLength(7);

                const zoomImage = await harness.page.$('img[data-zoomable][data-action="zoom_image"]');
                expect(zoomImage).not.toBeNull();

                const closeButton = await harness.page.$('button.modal-close[data-action="close_image"]');
                expect(closeButton).not.toBeNull();
            });
        });
    });

    describe('tigercup_groupstage.html', () => {
        const harness = createPageHarness(PAGE_PATHS.groupstage);

        beforeAll(harness.setup);
        afterAll(harness.teardown);

        test('sections should have data-action attributes', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                const sections = await harness.page.$$('section[data-action]');
                expect(sections.length).toBeGreaterThan(0);
            });
        });

        test('AI analysis sections should have data-ai-source', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                const aiSources = await harness.page.$$eval('section[data-ai-source]', els =>
                    els.map(el => el.getAttribute('data-ai-source'))
                );
                expect(aiSources).toContain('Kimi');
                expect(aiSources).toContain('Gemini');
                expect(aiSources).toContain('ChatGPT');
            });
        });
    });

    describe('sponsor_me.html', () => {
        const harness = createPageHarness(PAGE_PATHS.sponsor);

        beforeAll(harness.setup);
        afterAll(harness.teardown);

        test('like button should have data-action="like"', async () => {
            await harness.withBrowser(async () => {
                await harness.loadPage();
                const btn = await harness.page.$('.like-btn[data-action="like"]');
                expect(btn).not.toBeNull();
            });
        });
    });
});
