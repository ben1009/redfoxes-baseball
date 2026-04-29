const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.ponyRules);

describe('PONY U10 Rules Page (pony_u10_rules.html)', () => {
    beforeAll(harness.setup, TEST_CONFIG.timeout);
    afterAll(harness.teardown);

    beforeEach(async () => {
        if (!harness.browserLaunchError) {
            await harness.loadPage();
        }
    });

    test('should have correct page title', async () => harness.withBrowser(async () => {
        const title = await harness.page.title();
        expect(title).toContain('PONY小马棒球联赛');
        expect(title).toContain('U10');
        expect(title).toContain('Bronco-10');
    }));

    test('should have sticky navigation', async () => harness.withBrowser(async () => {
        const nav = await harness.page.$('.page-nav');
        expect(nav).not.toBeNull();

        const navLinks = await harness.page.$$('.nav-link');
        expect(navLinks.length).toBeGreaterThan(5);
    }));

    test('should have schedule section with tournament image', async () => harness.withBrowser(async () => {
        const scheduleSection = await harness.page.$('#schedule');
        expect(scheduleSection).not.toBeNull();

        const scheduleImage = await harness.page.$('img[src*="pony_u10_tianjin_schedule"]');
        expect(scheduleImage).not.toBeNull();

        const imageCaption = await scheduleSection.$('.image-caption');
        expect(imageCaption).not.toBeNull();
        const captionText = await imageCaption.evaluate(el => el.textContent);
        expect(captionText).toContain('5月2-3日');
        expect(captionText).toContain('5月4日');

        const infoBox = await scheduleSection.$('.info-box');
        expect(infoBox).not.toBeNull();
    }));

    test('should have schedule nav link', async () => harness.withBrowser(async () => {
        const scheduleLink = await harness.page.$('a.nav-link[href="#schedule"]');
        expect(scheduleLink).not.toBeNull();
    }));

    test('should have image containers with lightbox functionality', async () => harness.withBrowser(async () => {
        const imageContainers = await harness.page.$$('.image-container');
        expect(imageContainers.length).toBeGreaterThan(0);

        const modal = await harness.page.$('#imageModal');
        expect(modal).not.toBeNull();
    }));

    test('should link to external rules_style.css', async () => harness.withBrowser(async () => {
        const hasStylesheet = await harness.page.evaluate(() => {
            return document.querySelector('link[rel="stylesheet"][href="rules_style.css"]') !== null;
        });
        expect(hasStylesheet).toBe(true);
    }));

    test('should have field specifications section', async () => harness.withBrowser(async () => {
        const fieldSection = await harness.page.$('#field-specs');
        expect(fieldSection).not.toBeNull();

        const fieldMetrics = await fieldSection.$$('.metric-card');
        expect(fieldMetrics.length).toBeGreaterThan(0);
    }));

    test('should have game format section with tables', async () => harness.withBrowser(async () => {
        const gameSection = await harness.page.$('#game-format');
        expect(gameSection).not.toBeNull();

        const tables = await gameSection.$$('table');
        expect(tables.length).toBeGreaterThan(0);
    }));

    test('should have pitcher limits section', async () => harness.withBrowser(async () => {
        const pitcherSection = await harness.page.$('#pitcher-limits');
        expect(pitcherSection).not.toBeNull();

        const sectionText = await pitcherSection.evaluate(el => el.textContent);
        expect(sectionText).toContain('2局');
        expect(sectionText).toContain('10局');
    }));

    test('should have coach rules section', async () => harness.withBrowser(async () => {
        const coachSection = await harness.page.$('#coach-rules');
        expect(coachSection).not.toBeNull();

        const metricCards = await coachSection.$$('.metric-card');
        expect(metricCards.length).toBeGreaterThan(0);
    }));

    test('should have base running rules section', async () => harness.withBrowser(async () => {
        const runningSection = await harness.page.$('#base-running');
        expect(runningSection).not.toBeNull();

        const sectionText = await runningSection.evaluate(el => el.textContent);
        expect(sectionText).toContain('盗垒');
    }));

    test('should have scoring section', async () => harness.withBrowser(async () => {
        const scoringSection = await harness.page.$('#scoring');
        expect(scoringSection).not.toBeNull();

        const tables = await scoringSection.$$('table');
        expect(tables.length).toBeGreaterThan(0);
    }));

    test('should have highlight and warning boxes', async () => harness.withBrowser(async () => {
        const highlightBoxes = await harness.page.$$('.highlight-box');
        expect(highlightBoxes.length).toBeGreaterThan(0);

        const warningBoxes = await harness.page.$$('.warning-box');
        expect(warningBoxes.length).toBeGreaterThan(0);
    }));

    test('should have contact footer', async () => harness.withBrowser(async () => {
        const footer = await harness.page.$('.contact-footer');
        expect(footer).not.toBeNull();

        const footerText = await footer.evaluate(el => el.textContent);
        expect(footerText).toContain('天津君奥体育文化发展有限公司');
    }));

    test('should have Google Analytics', async () => harness.withBrowser(async () => {
        const hasGA = await harness.page.evaluate(() => {
            return typeof gtag === 'function' ||
                document.querySelector('script[src*="googletagmanager"]') !== null;
        });
        expect(hasGA).toBe(true);
    }));

    test('should use correct baseball terminology', async () => harness.withBrowser(async () => {
        const pageContent = await harness.page.evaluate(() => document.body.textContent);
        expect(pageContent).toContain('触身球');
        expect(pageContent).not.toContain('中身');
    }));
});
