const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.ponyU10Tianjin);

describe('PONY U10 Tianjin Analysis Page (pony_u10_tianjin.html)', () => {
    beforeAll(harness.setup, TEST_CONFIG.timeout);
    afterAll(harness.teardown);

    beforeEach(async () => {
        if (!harness.browserLaunchError) {
            await harness.loadPage();
        }
    });

    test('should have correct page title', async () => harness.withBrowser(async () => {
        const title = await harness.page.title();
        expect(title).toContain('天津PONY U10');
        expect(title).toContain('数据分析');
    }));

    test('should have sticky navigation', async () => harness.withBrowser(async () => {
        const nav = await harness.page.$('.page-nav');
        expect(nav).not.toBeNull();

        const navLinks = await harness.page.$$('.nav-link');
        expect(navLinks.length).toBeGreaterThan(5);
    }));

    test('should have schedule section with match records', async () => harness.withBrowser(async () => {
        const scheduleSection = await harness.page.$('#schedule');
        expect(scheduleSection).not.toBeNull();

        const pageContent = await harness.page.evaluate(() => document.body.textContent);
        expect(pageContent).toContain('北理附小');
        expect(pageContent).toContain('北京小熊投手');
        expect(pageContent).toContain('香河星宇强棒');
        expect(pageContent).toContain('重庆拓普棒球UP');
        expect(pageContent).toContain('北京平野');
        expect(pageContent).toContain('奥美德威熊');
    }));

    test('should have bilibili video link', async () => harness.withBrowser(async () => {
        const videoLink = await harness.page.$('a[href*="bilibili.com"]');
        expect(videoLink).not.toBeNull();
    }));

    test('should have player statistics tables', async () => harness.withBrowser(async () => {
        const dataSection = await harness.page.$('#data');
        expect(dataSection).not.toBeNull();

        const tables = await harness.page.$$('table');
        expect(tables.length).toBeGreaterThan(2);
    }));

    test('should have defense notes section with good/bad classification', async () => harness.withBrowser(async () => {
        const notesSection = await harness.page.$('#notes');
        expect(notesSection).not.toBeNull();

        const goodNotes = await notesSection.$$('.note-good');
        const badNotes = await notesSection.$$('.note-bad');
        expect(goodNotes.length).toBeGreaterThan(0);
        expect(badNotes.length).toBeGreaterThan(0);
    }));

    test('should have navigation to all AI analysis sections', async () => harness.withBrowser(async () => {
        const navLinks = await harness.page.$$eval('.nav-link', links =>
            links.map(link => link.getAttribute('href'))
        );

        expect(navLinks).toContain('#kimi');
        expect(navLinks).toContain('#gemini');
        expect(navLinks).toContain('#chatgpt');
    }));

    test('should have Kimi analysis first', async () => harness.withBrowser(async () => {
        const sections = await harness.page.$$('section[data-ai-source]');
        expect(sections.length).toBe(3);

        const firstSource = await sections[0].evaluate(el => el.getAttribute('data-ai-source'));
        expect(firstSource).toBe('Kimi');
    }));

    test('should have AI analysis cards', async () => harness.withBrowser(async () => {
        const aiCards = await harness.page.$$('.ai-card');
        expect(aiCards.length).toBe(3);
    }));

    test('should have summary section with key metrics', async () => harness.withBrowser(async () => {
        const summarySection = await harness.page.$('.summary-section');
        expect(summarySection).not.toBeNull();

        const metricCards = await summarySection.$$('.metric-card');
        expect(metricCards.length).toBe(3);
    }));

    test('should have data source footer', async () => harness.withBrowser(async () => {
        const footer = await harness.page.$('.contact-footer');
        expect(footer).not.toBeNull();

        const footerText = await footer.evaluate(el => el.textContent);
        expect(footerText).toContain('天津PONY U10');
    }));

    test('should not link to Tiger Cup rules page', async () => harness.withBrowser(async () => {
        const navLinks = await harness.page.$$eval('.nav-link', links =>
            links.map(link => link.getAttribute('href'))
        );

        expect(navLinks).not.toContain('u10_rules.html');
    }));

    test('should have link back to index and PONY rules', async () => harness.withBrowser(async () => {
        const navLinks = await harness.page.$$eval('.nav-link', links =>
            links.map(link => link.getAttribute('href'))
        );

        expect(navLinks).toContain('index.html');
        expect(navLinks).toContain('pony_u10_rules.html');
    }));
});
