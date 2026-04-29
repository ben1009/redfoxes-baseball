const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.groupstage);

describe('Groupstage Analysis Page (tigercup_groupstage.html)', () => {
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
        expect(title).toContain('数据分析');
    }));

    test('should have data image', async () => harness.withBrowser(async () => {
        const dataImage = await harness.page.$('img[src*="groupstage_data"]');
        expect(dataImage).not.toBeNull();
    }));

    test('should have navigation to all AI analysis sections', async () => harness.withBrowser(async () => {
        const navLinks = await harness.page.$$eval('.nav-link', links =>
            links.map(link => link.getAttribute('href'))
        );

        expect(navLinks).toContain('#kimi');
        expect(navLinks).toContain('#gemini');
        expect(navLinks).toContain('#chatgpt');
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
        expect(footerText).toContain('猛虎杯小组赛');
    }));

    test('should have link back to index and finalstage', async () => harness.withBrowser(async () => {
        const navLinks = await harness.page.$$eval('.nav-link', links =>
            links.map(link => link.getAttribute('href'))
        );

        expect(navLinks).toContain('index.html');
        expect(navLinks).toContain('tigercup_finalstage.html');
    }));
});
