const { PAGE_PATHS, TEST_CONFIG, createPageHarness } = require('./pages.shared');

jest.setTimeout(TEST_CONFIG.timeout);

const harness = createPageHarness(PAGE_PATHS.index);

describe('Index Page (Navigation Hub)', () => {
    beforeAll(harness.setup, TEST_CONFIG.timeout);
    afterAll(harness.teardown);

    beforeEach(async () => {
        if (!harness.browserLaunchError) {
            await harness.loadPage();
        }
    });

    test('should have correct page title', async () => harness.withBrowser(async () => {
        const title = await harness.page.title();
        expect(title).toContain('烈光少棒赤狐队');
    }));

    test('should have team logo and header', async () => harness.withBrowser(async () => {
        const header = await harness.page.$('.header');
        expect(header).not.toBeNull();

        const teamLogo = await harness.page.$('.team-logo');
        expect(teamLogo).not.toBeNull();
    }));

    test('should have navigation grid with 6 cards', async () => harness.withBrowser(async () => {
        const navGrid = await harness.page.$('.nav-grid');
        expect(navGrid).not.toBeNull();

        const cards = await harness.page.$$('.nav-card');
        expect(cards.length).toBe(6);
    }));

    test('should have correct navigation links', async () => harness.withBrowser(async () => {
        const links = await harness.page.$$eval('.nav-card', cards =>
            cards.map(card => card.getAttribute('href'))
        );

        expect(links).toContain('match_review.html');
        expect(links).toContain('u10_rules.html');
        expect(links).toContain('pony_u10_rules.html');
        expect(links).toContain('tigercup_groupstage.html');
        expect(links).toContain('tigercup_finalstage.html');
        expect(links).toContain('sponsor_me.html');
    }));

    test('should have team motto', async () => harness.withBrowser(async () => {
        const motto = await harness.page.$('.motto');
        expect(motto).not.toBeNull();

        const mottoText = await motto.evaluate(el => el.textContent);
        expect(mottoText).toContain('友谊第一');
    }));

    test('should have footer with copyright', async () => harness.withBrowser(async () => {
        const footer = await harness.page.$('.footer');
        expect(footer).not.toBeNull();

        const footerText = await footer.evaluate(el => el.textContent);
        expect(footerText).toContain('© 2026');
        expect(footerText).toContain('烈光少棒赤狐队');
    }));

    test('should navigate from index to match_review page', async () => harness.withBrowser(async () => {
        const matchReviewLink = await harness.page.$('a[href="match_review.html"]');
        expect(matchReviewLink).not.toBeNull();
    }));

    test('should navigate from index to u10_rules page', async () => harness.withBrowser(async () => {
        const rulesLink = await harness.page.$('a[href="u10_rules.html"]');
        expect(rulesLink).not.toBeNull();
    }));

    test('should navigate from index to pony_u10_rules page', async () => harness.withBrowser(async () => {
        const ponyRulesLink = await harness.page.$('a[href="pony_u10_rules.html"]');
        expect(ponyRulesLink).not.toBeNull();
    }));

    test('should navigate from index to groupstage page', async () => harness.withBrowser(async () => {
        const groupstageLink = await harness.page.$('a[href="tigercup_groupstage.html"]');
        expect(groupstageLink).not.toBeNull();
    }));

    test('should navigate from index to finalstage page', async () => harness.withBrowser(async () => {
        const finalstageLink = await harness.page.$('a[href="tigercup_finalstage.html"]');
        expect(finalstageLink).not.toBeNull();
    }));

    test('should navigate from index to sponsor page', async () => harness.withBrowser(async () => {
        const sponsorLink = await harness.page.$('a[href="sponsor_me.html"]');
        expect(sponsorLink).not.toBeNull();
    }));
});
