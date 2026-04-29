const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.finalstage);

describe('Finalstage Analysis Page (tigercup_finalstage.html)', () => {
    beforeAll(harness.setup, TEST_CONFIG.timeout);
    afterAll(harness.teardown);

    beforeEach(async () => {
        if (!harness.browserLaunchError) {
            await harness.loadPage();
        }
    });

    test('should have correct page title', async () => harness.withBrowser(async () => {
        const title = await harness.page.title();
        expect(title).toContain('猛虎杯');
        expect(title).toContain('决赛');
        expect(title).toContain('数据分析');
    }));

    test('should have finalstage data image', async () => harness.withBrowser(async () => {
        const dataImage = await harness.page.$('img[src*="finalstage_data"]');
        expect(dataImage).not.toBeNull();
    }));

    test('should have final ranking image', async () => harness.withBrowser(async () => {
        const rankingImage = await harness.page.$('img[src*="tigercup_final_ranking"]');
        expect(rankingImage).not.toBeNull();
    }));

    test('should have match score records', async () => harness.withBrowser(async () => {
        const pageContent = await harness.page.evaluate(() => document.body.textContent);
        expect(pageContent).toContain('北京励豹棒球俱乐部');
        expect(pageContent).toContain('飞雪陨劫');
        expect(pageContent).toContain('北京同心棒垒球俱乐部');
    }));

    test('should have navigation to all AI analysis sections', async () => harness.withBrowser(async () => {
        const navLinks = await harness.page.$$eval('.nav-link', links =>
            links.map(link => link.getAttribute('href'))
        );

        expect(navLinks).toContain('#gemini');
        expect(navLinks).toContain('#chatgpt');
        expect(navLinks).toContain('#kimi');
    }));

    test('should have AI analysis cards', async () => harness.withBrowser(async () => {
        const aiCards = await harness.page.$$('.ai-card');
        expect(aiCards.length).toBe(3);
    }));

    test('should have player statistics tables', async () => harness.withBrowser(async () => {
        const tables = await harness.page.$$('table');
        expect(tables.length).toBeGreaterThan(2);
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
        expect(footerText).toContain('猛虎杯决赛');
    }));

    test('should have link back to index and groupstage', async () => harness.withBrowser(async () => {
        const navLinks = await harness.page.$$eval('.nav-link', links =>
            links.map(link => link.getAttribute('href'))
        );

        expect(navLinks).toContain('index.html');
        expect(navLinks).toContain('tigercup_groupstage.html');
    }));
});
