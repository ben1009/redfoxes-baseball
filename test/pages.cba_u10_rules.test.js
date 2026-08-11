const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.cbaRules);

describe('CBA U10 Rules Page (cba_u10_rules.html)', () => {
    beforeAll(harness.setup, TEST_CONFIG.timeout);
    afterAll(harness.teardown);

    beforeEach(async () => {
        if (!harness.browserLaunchError) {
            await harness.loadPage();
        }
    });

    test('should link to CBA U10 player analysis page', async () => harness.withBrowser(async () => {
        const navLink = await harness.page.$('a.nav-link[href="cba_u10_player_analysis.html"]');
        expect(navLink).not.toBeNull();

        const scheduleLink = await harness.page.$('#schedule a[href="cba_u10_player_analysis.html"]');
        expect(scheduleLink).not.toBeNull();
    }));
});
