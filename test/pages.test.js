/**
 * @fileoverview Comprehensive tests for all HTML pages
 * Tests page structure, navigation, and content
 */

const { launchBrowser } = require('./browser');
const path = require('path');
const fs = require('fs');

const TEST_CONFIG = {
    password: process.env.TEST_PASSWORD || '1972',
    viewport: { width: 1280, height: 800 },
    timeout: 30000
};

const PAGE_PATHS = {
    index: 'file://' + path.resolve(__dirname, '../index.html'),
    matchReview: 'file://' + path.resolve(__dirname, '../match_review.html'),
    rules: 'file://' + path.resolve(__dirname, '../u10_rules.html'),
    ponyRules: 'file://' + path.resolve(__dirname, '../pony_u10_rules.html'),
    groupstage: 'file://' + path.resolve(__dirname, '../tigercup_groupstage.html'),
    finalstage: 'file://' + path.resolve(__dirname, '../tigercup_finalstage.html'),
    sponsor: 'file://' + path.resolve(__dirname, '../sponsor_me.html')
};

function getEffectiveContent(file) {
    const filePath = path.resolve(__dirname, '..', file);
    let content = fs.readFileSync(filePath, 'utf8');

    const linkMatches = content.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi) || [];
    linkMatches.forEach((match) => {
        const hrefMatch = match.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
            const cssPath = path.resolve(__dirname, '..', hrefMatch[1]);
            if (fs.existsSync(cssPath)) {
                content += fs.readFileSync(cssPath, 'utf8');
            }
        }
    });

    return content;
}

describe('Page Structure and Navigation Tests', () => {
    let browser;
    let page;
    let browserLaunchError;
    let browserLaunchWarningShown = false;

    const withBrowser = async (callback) => {
        if (browserLaunchError) {
            if (!browserLaunchWarningShown) {
                console.warn(`Skipping browser assertions: ${browserLaunchError.message}`);
                browserLaunchWarningShown = true;
            }
            return;
        }

        await callback();
    };

    beforeAll(async () => {
        try {
            browser = await launchBrowser();
            page = await browser.newPage();
            await page.setViewportSize(TEST_CONFIG.viewport);
            page.setDefaultTimeout(5000);
            page.setDefaultNavigationTimeout(5000);
            await page.route(/^https?:\/\//, route => route.abort());
        } catch (error) {
            browserLaunchError = error;
        }
    }, TEST_CONFIG.timeout);

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    describe('Index Page (Navigation Hub)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('烈光少棒赤狐队');
        }));

        test('should have team logo and header', async () => withBrowser(async () => {
            const header = await page.$('.header');
            expect(header).not.toBeNull();
            
            const teamLogo = await page.$('.team-logo');
            expect(teamLogo).not.toBeNull();
        }));

        test('should have navigation grid with 5 cards', async () => withBrowser(async () => {
            const navGrid = await page.$('.nav-grid');
            expect(navGrid).not.toBeNull();
            
            const cards = await page.$$('.nav-card');
            expect(cards.length).toBe(6);
        }));

        test('should have correct navigation links', async () => withBrowser(async () => {
            const links = await page.$$eval('.nav-card', cards => 
                cards.map(card => card.getAttribute('href'))
            );
            
            expect(links).toContain('match_review.html');
            expect(links).toContain('u10_rules.html');
            expect(links).toContain('pony_u10_rules.html');
            expect(links).toContain('tigercup_groupstage.html');
            expect(links).toContain('tigercup_finalstage.html');
            expect(links).toContain('sponsor_me.html');
        }));

        test('should have team motto', async () => withBrowser(async () => {
            const motto = await page.$('.motto');
            expect(motto).not.toBeNull();
            
            const mottoText = await motto.evaluate(el => el.textContent);
            expect(mottoText).toContain('友谊第一');
        }));

        test('should have footer with copyright', async () => withBrowser(async () => {
            const footer = await page.$('.footer');
            expect(footer).not.toBeNull();
            
            const footerText = await footer.evaluate(el => el.textContent);
            expect(footerText).toContain('© 2026');
            expect(footerText).toContain('烈光少棒赤狐队');
        }));
    });

    describe('Match Review Page (match_review.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.matchReview, { waitUntil: 'domcontentloaded' });
            }
        });

        test('should have password protection overlay', async () => withBrowser(async () => {
            const passwordOverlay = await page.$('#passwordOverlay');
            expect(passwordOverlay).not.toBeNull();
            
            const passwordInput = await page.$('#passwordInput');
            expect(passwordInput).not.toBeNull();
        }));

        test('should unlock content with correct password', async () => withBrowser(async () => {
            // Enter password
            await page.type('#passwordInput', TEST_CONFIG.password);
            
            // Click unlock button
            await page.evaluate(() => {
                const btn = document.querySelector('.password-btn');
                if (btn) btn.click();
            });
            
            // Wait for main content to be visible
            await page.waitForSelector('#mainContent.visible', { timeout: 5000 });
            
            const mainContent = await page.$('#mainContent');
            expect(mainContent).not.toBeNull();
        }));

        test('should have 7 video cards after unlock', async () => withBrowser(async () => {
            // Unlock first
            await page.type('#passwordInput', TEST_CONFIG.password);
            await page.evaluate(() => {
                const btn = document.querySelector('.password-btn');
                if (btn) btn.click();
            });
            await page.waitForSelector('#mainContent.visible', { timeout: 5000 });
            
            const videoCards = await page.$$('.video-card');
            expect(videoCards.length).toBe(7);
        }));

        test('should show centered home link in header below match info after unlock', async () => withBrowser(async () => {
            await page.type('#passwordInput', TEST_CONFIG.password);
            await page.evaluate(() => {
                const btn = document.querySelector('.password-btn');
                if (btn) btn.click();
            });
            await page.waitForSelector('#mainContent.visible', { timeout: 5000 });

            const headerLayout = await page.evaluate(() => {
                const header = document.querySelector('#mainContent header');
                const matchInfo = header?.querySelector('.match-info');
                const homeLink = header?.querySelector('.home-link');

                if (!header || !matchInfo || !homeLink) {
                    return null;
                }

                const headerStyle = window.getComputedStyle(header);
                const homeLinkStyle = window.getComputedStyle(homeLink);

                return {
                    href: homeLink.getAttribute('href'),
                    target: homeLink.getAttribute('target'),
                    text: homeLink.textContent.trim(),
                    isInHeader: homeLink.parentElement === header,
                    followsMatchInfo: matchInfo.nextElementSibling === homeLink,
                    headerAlign: headerStyle.textAlign,
                    homeLinkDisplay: homeLinkStyle.display
                };
            });

            expect(headerLayout).not.toBeNull();
            expect(headerLayout.href).toBe('index.html');
            expect(headerLayout.target).toBe('_self');
            expect(headerLayout.text).toContain('返回首页');
            expect(headerLayout.isInHeader).toBe(true);
            expect(headerLayout.followsMatchInfo).toBe(true);
            expect(headerLayout.headerAlign).toBe('center');
            expect(headerLayout.homeLinkDisplay).toBe('inline-flex');
        }));

        test('should have Google Analytics', async () => withBrowser(async () => {
            const hasGA = await page.evaluate(() => {
                return typeof gtag === 'function' || 
                       document.querySelector('script[src*="googletagmanager"]') !== null;
            });
            expect(hasGA).toBe(true);
        }));
    });

    describe('U10 Rules Page (u10_rules.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.rules, { waitUntil: 'domcontentloaded' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('猛虎杯');
            expect(title).toContain('U10');
        }));

        test('should have sticky navigation', async () => withBrowser(async () => {
            const nav = await page.$('.page-nav');
            expect(nav).not.toBeNull();
            
            const navLinks = await page.$$('.nav-link');
            expect(navLinks.length).toBeGreaterThan(5);
        }));

        test('should have tournament schedule section', async () => withBrowser(async () => {
            const scheduleSection = await page.$('#schedule');
            expect(scheduleSection).not.toBeNull();
        }));

        test('should have image containers with lightbox functionality', async () => withBrowser(async () => {
            const imageContainers = await page.$$('.image-container');
            expect(imageContainers.length).toBeGreaterThan(0);
            
            // Check for modal
            const modal = await page.$('#imageModal');
            expect(modal).not.toBeNull();
        }));

        test('should support keyboard access for shared lightbox images', async () => withBrowser(async () => {
            const imageState = await page.evaluate(() => {
                const image = document.querySelector('.image-container img');
                const modal = document.getElementById('imageModal');
                const modalImage = document.getElementById('modalImage');

                if (!image || !modal || !modalImage) {
                    return null;
                }

                image.focus();
                image.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true
                }));

                const opened = modal.classList.contains('active');
                const modalSrc = modalImage.getAttribute('src');

                document.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Escape',
                    bubbles: true
                }));

                return {
                    tabIndex: image.getAttribute('tabindex'),
                    role: image.getAttribute('role'),
                    opened,
                    modalSrc
                };
            });

            expect(imageState).not.toBeNull();
            expect(imageState.tabIndex).toBe('0');
            expect(imageState.role).toBe('button');
            expect(imageState.opened).toBe(true);
            expect(imageState.modalSrc).toContain('img/');
        }));

        test('should have key metrics cards', async () => withBrowser(async () => {
            const metricCards = await page.$$('.metric-card');
            expect(metricCards.length).toBeGreaterThan(0);
        }));
    });

    describe('PONY U10 Rules Page (pony_u10_rules.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.ponyRules, { waitUntil: 'domcontentloaded' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('PONY小马棒球联赛');
            expect(title).toContain('U10');
            expect(title).toContain('Bronco-10');
        }));

        test('should have sticky navigation', async () => withBrowser(async () => {
            const nav = await page.$('.page-nav');
            expect(nav).not.toBeNull();
            
            const navLinks = await page.$$('.nav-link');
            expect(navLinks.length).toBeGreaterThan(5);
        }));

        test('should have schedule section with tournament image', async () => withBrowser(async () => {
            const scheduleSection = await page.$('#schedule');
            expect(scheduleSection).not.toBeNull();

            const scheduleImage = await page.$('img[src*="pony_u10_tianjin_schedule"]');
            expect(scheduleImage).not.toBeNull();

            const imageCaption = await scheduleSection.$('.image-caption');
            expect(imageCaption).not.toBeNull();
            const captionText = await imageCaption.evaluate(el => el.textContent);
            expect(captionText).toContain('5月2-3日');
            expect(captionText).toContain('5月4日');

            const infoBox = await scheduleSection.$('.info-box');
            expect(infoBox).not.toBeNull();
        }));

        test('should have schedule nav link', async () => withBrowser(async () => {
            const scheduleLink = await page.$('a.nav-link[href="#schedule"]');
            expect(scheduleLink).not.toBeNull();
        }));

        test('should have image containers with lightbox functionality', async () => withBrowser(async () => {
            const imageContainers = await page.$$('.image-container');
            expect(imageContainers.length).toBeGreaterThan(0);
            
            const modal = await page.$('#imageModal');
            expect(modal).not.toBeNull();
        }));

        test('should link to external rules_style.css', async () => withBrowser(async () => {
            const hasStylesheet = await page.evaluate(() => {
                return document.querySelector('link[rel="stylesheet"][href="rules_style.css"]') !== null;
            });
            expect(hasStylesheet).toBe(true);
        }));

        test('should have field specifications section', async () => withBrowser(async () => {
            const fieldSection = await page.$('#field-specs');
            expect(fieldSection).not.toBeNull();
            
            const fieldMetrics = await fieldSection.$$('.metric-card');
            expect(fieldMetrics.length).toBeGreaterThan(0);
        }));

        test('should have game format section with tables', async () => withBrowser(async () => {
            const gameSection = await page.$('#game-format');
            expect(gameSection).not.toBeNull();
            
            const tables = await gameSection.$$('table');
            expect(tables.length).toBeGreaterThan(0);
        }));

        test('should have pitcher limits section', async () => withBrowser(async () => {
            const pitcherSection = await page.$('#pitcher-limits');
            expect(pitcherSection).not.toBeNull();
            
            const sectionText = await pitcherSection.evaluate(el => el.textContent);
            expect(sectionText).toContain('2局');
            expect(sectionText).toContain('10局');
        }));

        test('should have coach rules section', async () => withBrowser(async () => {
            const coachSection = await page.$('#coach-rules');
            expect(coachSection).not.toBeNull();
            
            const metricCards = await coachSection.$$('.metric-card');
            expect(metricCards.length).toBeGreaterThan(0);
        }));

        test('should have base running rules section', async () => withBrowser(async () => {
            const runningSection = await page.$('#base-running');
            expect(runningSection).not.toBeNull();
            
            const sectionText = await runningSection.evaluate(el => el.textContent);
            expect(sectionText).toContain('盗垒');
        }));

        test('should have scoring section', async () => withBrowser(async () => {
            const scoringSection = await page.$('#scoring');
            expect(scoringSection).not.toBeNull();
            
            const tables = await scoringSection.$$('table');
            expect(tables.length).toBeGreaterThan(0);
        }));

        test('should have highlight and warning boxes', async () => withBrowser(async () => {
            const highlightBoxes = await page.$$('.highlight-box');
            expect(highlightBoxes.length).toBeGreaterThan(0);
            
            const warningBoxes = await page.$$('.warning-box');
            expect(warningBoxes.length).toBeGreaterThan(0);
        }));

        test('should have contact footer', async () => withBrowser(async () => {
            const footer = await page.$('.contact-footer');
            expect(footer).not.toBeNull();
            
            const footerText = await footer.evaluate(el => el.textContent);
            expect(footerText).toContain('天津君奥体育文化发展有限公司');
        }));

        test('should have Google Analytics', async () => withBrowser(async () => {
            const hasGA = await page.evaluate(() => {
                return typeof gtag === 'function' || 
                       document.querySelector('script[src*="googletagmanager"]') !== null;
            });
            expect(hasGA).toBe(true);
        }));

        test('should use correct baseball terminology', async () => withBrowser(async () => {
            const pageContent = await page.evaluate(() => document.body.textContent);
            expect(pageContent).toContain('触身球');
            expect(pageContent).not.toContain('中身');
        }));
    });

    describe('Groupstage Analysis Page (tigercup_groupstage.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.groupstage, { waitUntil: 'domcontentloaded' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('猛虎杯');
            expect(title).toContain('数据分析');
        }));

        test('should have data image', async () => withBrowser(async () => {
            const dataImage = await page.$('img[src*="groupstage_data"]');
            expect(dataImage).not.toBeNull();
        }));

        test('should have navigation to all AI analysis sections', async () => withBrowser(async () => {
            const navLinks = await page.$$eval('.nav-link', links => 
                links.map(link => link.getAttribute('href'))
            );
            
            expect(navLinks).toContain('#kimi');
            expect(navLinks).toContain('#gemini');
            expect(navLinks).toContain('#chatgpt');
        }));

        test('should have AI analysis cards', async () => withBrowser(async () => {
            const aiCards = await page.$$('.ai-card');
            expect(aiCards.length).toBe(3);
        }));

        test('should have player statistics tables', async () => withBrowser(async () => {
            const tables = await page.$$('table');
            expect(tables.length).toBeGreaterThan(2);
        }));

        test('should have summary section with key metrics', async () => withBrowser(async () => {
            const summarySection = await page.$('.summary-section');
            expect(summarySection).not.toBeNull();
            
            const metricCards = await summarySection.$$('.metric-card');
            expect(metricCards.length).toBe(3);
        }));

        test('should have data source footer', async () => withBrowser(async () => {
            const footer = await page.$('.contact-footer');
            expect(footer).not.toBeNull();
            
            const footerText = await footer.evaluate(el => el.textContent);
            expect(footerText).toContain('猛虎杯小组赛');
        }));

        test('should have link back to index and finalstage', async () => withBrowser(async () => {
            const navLinks = await page.$$eval('.nav-link', links => 
                links.map(link => link.getAttribute('href'))
            );
            
            expect(navLinks).toContain('index.html');
            expect(navLinks).toContain('tigercup_finalstage.html');
        }));
    });

    describe('Finalstage Analysis Page (tigercup_finalstage.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.finalstage, { waitUntil: 'domcontentloaded' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('猛虎杯');
            expect(title).toContain('决赛');
            expect(title).toContain('数据分析');
        }));

        test('should have finalstage data image', async () => withBrowser(async () => {
            const dataImage = await page.$('img[src*="finalstage_data"]');
            expect(dataImage).not.toBeNull();
        }));

        test('should have final ranking image', async () => withBrowser(async () => {
            const rankingImage = await page.$('img[src*="tigercup_final_ranking"]');
            expect(rankingImage).not.toBeNull();
        }));

        test('should have match score records', async () => withBrowser(async () => {
            const pageContent = await page.evaluate(() => document.body.textContent);
            expect(pageContent).toContain('北京励豹棒球俱乐部');
            expect(pageContent).toContain('飞雪陨劫');
            expect(pageContent).toContain('北京同心棒垒球俱乐部');
        }));

        test('should have navigation to all AI analysis sections', async () => withBrowser(async () => {
            const navLinks = await page.$$eval('.nav-link', links => 
                links.map(link => link.getAttribute('href'))
            );
            
            expect(navLinks).toContain('#gemini');
            expect(navLinks).toContain('#chatgpt');
            expect(navLinks).toContain('#kimi');
        }));

        test('should have AI analysis cards', async () => withBrowser(async () => {
            const aiCards = await page.$$('.ai-card');
            expect(aiCards.length).toBe(3);
        }));

        test('should have player statistics tables', async () => withBrowser(async () => {
            const tables = await page.$$('table');
            expect(tables.length).toBeGreaterThan(2);
        }));

        test('should have summary section with key metrics', async () => withBrowser(async () => {
            const summarySection = await page.$('.summary-section');
            expect(summarySection).not.toBeNull();
            
            const metricCards = await summarySection.$$('.metric-card');
            expect(metricCards.length).toBe(3);
        }));

        test('should have data source footer', async () => withBrowser(async () => {
            const footer = await page.$('.contact-footer');
            expect(footer).not.toBeNull();
            
            const footerText = await footer.evaluate(el => el.textContent);
            expect(footerText).toContain('猛虎杯决赛');
        }));

        test('should have link back to index and groupstage', async () => withBrowser(async () => {
            const navLinks = await page.$$eval('.nav-link', links => 
                links.map(link => link.getAttribute('href'))
            );
            
            expect(navLinks).toContain('index.html');
            expect(navLinks).toContain('tigercup_groupstage.html');
        }));
    });

    describe('Sponsor Page (sponsor_me.html)', () => {
        beforeEach(async () => {
            if (!browserLaunchError) {
                await page.goto(PAGE_PATHS.sponsor, { waitUntil: 'domcontentloaded' });
            }
        });

        test('should have correct page title', async () => withBrowser(async () => {
            const title = await page.title();
            expect(title).toContain('赞助赤狐');
        }));

        test('should show sponsor qr code and CTA copy', async () => withBrowser(async () => {
            const qrImage = await page.$('img[src*="sponsor_me.png"]');
            expect(qrImage).not.toBeNull();

            const qrCaption = await page.$('.qr-caption');
            expect(qrCaption).not.toBeNull();

            const qrText = await qrCaption.evaluate(el => el.textContent);
            expect(qrText).toContain('扫码进入赤狐补给站');
        }));

        test('should render support offer cards', async () => withBrowser(async () => {
            const offerCards = await page.$$('.offer-card');
            expect(offerCards.length).toBe(3);

            const offerTitles = await page.$$eval('.offer-card h2', nodes =>
                nodes.map(node => node.textContent.trim())
            );
            expect(offerTitles).toEqual(
                expect.arrayContaining(['一颗球计划', '加餐暴击包', '记录后勤补给包'])
            );
        }));

        test('should provide a zoom modal for sponsor item images', async () => withBrowser(async () => {
            const zoomableImages = await page.$$('[data-zoomable]');
            expect(zoomableImages.length).toBe(3);

            const modal = await page.$('#imageModal');
            expect(modal).not.toBeNull();

            const zoomableAccessibility = await page.$$eval('[data-zoomable]', (images) =>
                images.map((img) => ({
                    tabindex: img.getAttribute('tabindex'),
                    role: img.getAttribute('role'),
                }))
            );
            zoomableAccessibility.forEach((img) => {
                expect(img.tabindex).toBe('0');
                expect(img.role).toBe('button');
            });
        }));

        test('should open and close the sponsor image zoom modal', async () => withBrowser(async () => {
            const firstZoomableImage = await page.$('[data-zoomable]');
            expect(firstZoomableImage).not.toBeNull();

            const expectedSrc = await firstZoomableImage.evaluate((img) => img.src);
            await firstZoomableImage.click();

            await page.waitForSelector('#imageModal.open');

            const modalImageSrc = await page.$eval('#imageModalImg', (img) => img.src);
            expect(modalImageSrc).toBe(expectedSrc);

            await page.click('#imageModalClose');

            const modalIsOpen = await page.$eval('#imageModal', (modal) =>
                modal.classList.contains('open')
            );
            expect(modalIsOpen).toBe(false);
        }));

        test('should support keyboard zoom access and restore focus after closing', async () => withBrowser(async () => {
            await page.focus('[data-zoomable]');
            await page.keyboard.press('Enter');

            await page.waitForSelector('#imageModal.open');

            const activeElementId = await page.evaluate(() => document.activeElement.id);
            expect(activeElementId).toBe('imageModalClose');

            const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
            expect(bodyOverflow).toBe('hidden');

            await page.keyboard.press('Escape');

            const modalIsOpen = await page.$eval('#imageModal', (modal) =>
                modal.classList.contains('open')
            );
            expect(modalIsOpen).toBe(false);

            const focusedZoomableSrc = await page.evaluate(() => document.activeElement.getAttribute('src'));
            expect(focusedZoomableSrc).toBe('./img/350.png');

            const restoredBodyOverflow = await page.evaluate(() => document.body.style.overflow);
            expect(restoredBodyOverflow).toBe('');
        }));

        test('should render all 16 floating background stickers', async () => withBrowser(async () => {
            const floatingStickers = await page.$$('.floating-sticker');
            expect(floatingStickers.length).toBe(16);

            const stickerSources = await page.$$eval('.floating-sticker img', nodes =>
                nodes.map(node => node.getAttribute('src'))
            );
            expect(stickerSources).toContain('./img/01_homerun.png');
            expect(stickerSources).toContain('./img/16_champion.png');
        }));

        test('should include sticker rally and timeline sections', async () => withBrowser(async () => {
            const rallyCards = await page.$$('.sticker-card');
            expect(rallyCards.length).toBe(3);

            const timelineItems = await page.$$('.timeline li');
            expect(timelineItems.length).toBe(4);
        }));

        test('should not include floating baseball assets', async () => withBrowser(async () => {
            const hasBaseballFloatCss = await page.evaluate(() => {
                return document.querySelector('link[rel="stylesheet"][href="baseball_floats.css"]') !== null;
            });
            const hasBaseballFloatJs = await page.evaluate(() => {
                return document.querySelector('script[src="baseball_floats.js"]') !== null;
            });

            expect(hasBaseballFloatCss).toBe(false);
            expect(hasBaseballFloatJs).toBe(false);
        }));

        test('should have a like widget with button and label', async () => withBrowser(async () => {
            const likeWidget = await page.$('.like-widget');
            expect(likeWidget).not.toBeNull();

            const likeBtn = await page.$('.like-btn');
            expect(likeBtn).not.toBeNull();

            const likeCount = await page.$('.like-count');
            expect(likeCount).not.toBeNull();

            const likeLabel = await page.$('.like-label');
            expect(likeLabel).not.toBeNull();
        }));

        test('should show initial like count and unliked state', async () => withBrowser(async () => {
            const likeBtn = await page.$('.like-btn');
            const likeCount = await page.$('.like-count');

            // Wait for async fetch/fallback to settle (count becomes a number, not '...')
            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const countText = await likeCount.evaluate(el => el.textContent);
            expect(countText).toMatch(/^\d+$/);

            const isLiked = await likeBtn.evaluate(el => el.classList.contains('liked'));
            expect(isLiked).toBe(false);

            const ariaPressed = await likeBtn.evaluate(el => el.getAttribute('aria-pressed'));
            expect(ariaPressed).toBe('false');
        }));

        test('should toggle liked state on click', async () => withBrowser(async () => {
            // Ensure clean state
            await page.evaluate(() => {
                localStorage.removeItem('sponsor_me_liked_v1');
                localStorage.removeItem('sponsor_me_count_fallback');
            });
            await page.reload({ waitUntil: 'domcontentloaded' });

            // Wait for widget to settle before clicking
            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const likeBtn = await page.$('.like-btn');
            expect(likeBtn).not.toBeNull();

            // Initial state: not liked
            let isLiked = await likeBtn.evaluate(el => el.classList.contains('liked'));
            expect(isLiked).toBe(false);

            // Click to like and wait for state change
            await likeBtn.click();
            await page.waitForFunction(() => {
                const btn = document.querySelector('.like-btn');
                return btn && btn.classList.contains('liked');
            }, undefined, { timeout: 5000 });

            isLiked = await likeBtn.evaluate(el => el.classList.contains('liked'));
            expect(isLiked).toBe(true);

            const ariaPressed = await likeBtn.evaluate(el => el.getAttribute('aria-pressed'));
            expect(ariaPressed).toBe('true');

            // Click again to unlike and wait for state change
            await likeBtn.click();
            await page.waitForFunction(() => {
                const btn = document.querySelector('.like-btn');
                return btn && !btn.classList.contains('liked');
            }, undefined, { timeout: 5000 });

            isLiked = await likeBtn.evaluate(el => el.classList.contains('liked'));
            expect(isLiked).toBe(false);
        }));

        test('should not double-count on rapid clicks', async () => withBrowser(async () => {
            // Mock fetch for deterministic counting
            await page.addInitScript(() => {
                window.__testLikeCount = 0;
                const origFetch = window.fetch;
                window.fetch = async (url, opts) => {
                    if (typeof url === 'string' && url.includes('sponsor-likes')) {
                        if (opts && opts.method === 'POST' && url.endsWith('/like')) {
                            window.__testLikeCount++;
                        } else if (opts && opts.method === 'POST' && url.endsWith('/unlike')) {
                            window.__testLikeCount = Math.max(0, window.__testLikeCount - 1);
                        }
                        return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                    }
                    return origFetch(url, opts);
                };
            });

            // Clear and reload
            await page.evaluate(() => {
                localStorage.removeItem('sponsor_me_liked_v1');
                localStorage.removeItem('sponsor_me_count_fallback');
            });
            await page.reload({ waitUntil: 'domcontentloaded' });

            // Wait for widget to settle
            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const likeBtn = await page.$('.like-btn');
            const initialCount = parseInt(await page.$eval('.like-count', el => el.textContent), 10);

            // Rapid-fire 5 clicks
            for (let i = 0; i < 5; i++) {
                await likeBtn.click();
            }

            // Wait for any pending async operations to finish
            await page.waitForTimeout(1000);

            const finalCount = parseInt(await page.$eval('.like-count', el => el.textContent), 10);
            // Count should only change by at most 1 from the initial value
            expect(Math.abs(finalCount - initialCount)).toBeLessThanOrEqual(1);
        }));

        test('should persist liked state in localStorage', async () => withBrowser(async () => {
            // Mock fetch to avoid network/rate-limit flakiness in tests
            await page.addInitScript(() => {
                window.__testLikeCount = 0;
                const origFetch = window.fetch;
                window.fetch = async (url, opts) => {
                    if (typeof url === 'string' && url.includes('sponsor-likes')) {
                        if (opts && opts.method === 'POST' && url.endsWith('/like')) {
                            window.__testLikeCount++;
                        } else if (opts && opts.method === 'POST' && url.endsWith('/unlike')) {
                            window.__testLikeCount = Math.max(0, window.__testLikeCount - 1);
                        }
                        return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                    }
                    return origFetch(url, opts);
                };
            });

            // Clear and reload
            await page.evaluate(() => {
                localStorage.removeItem('sponsor_me_liked_v1');
                localStorage.removeItem('sponsor_me_count_fallback');
            });
            await page.reload({ waitUntil: 'domcontentloaded' });

            // Wait for widget to settle
            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const likeBtn = await page.$('.like-btn');

            // Click to like and wait for state change
            await likeBtn.click();
            await page.waitForFunction(() => {
                const btn = document.querySelector('.like-btn');
                return btn && btn.classList.contains('liked');
            }, undefined, { timeout: 5000 });

            // Verify localStorage
            const stored = await page.evaluate(() => localStorage.getItem('sponsor_me_liked_v1'));
            expect(stored).toBe('true');

            // Reload and verify state persists
            await page.reload({ waitUntil: 'domcontentloaded' });

            // Wait for widget to settle after reload
            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const reloadedBtn = await page.$('.like-btn');
            const isLiked = await reloadedBtn.evaluate(el => el.classList.contains('liked'));
            expect(isLiked).toBe(true);
        }));

        test('should not toggle state on rate-limited response', async () => withBrowser(async () => {
            // Mock fetch: like succeeds, unlike is rate-limited
            await page.addInitScript(() => {
                window.__testLikeCount = 0;
                const origFetch = window.fetch;
                window.fetch = async (url, opts) => {
                    if (typeof url === 'string' && url.includes('sponsor-likes')) {
                        if (opts && opts.method === 'POST') {
                            if (url.endsWith('/like')) {
                                window.__testLikeCount++;
                                return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                            }
                            if (url.endsWith('/unlike')) {
                                return { ok: true, json: async () => ({ count: window.__testLikeCount, rateLimited: true }) };
                            }
                        }
                        return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                    }
                    return origFetch(url, opts);
                };
            });

            // Clear localStorage and reload for clean state
            await page.evaluate(() => {
                localStorage.removeItem('sponsor_me_liked_v1');
                localStorage.removeItem('sponsor_me_count_fallback');
            });
            await page.reload({ waitUntil: 'domcontentloaded' });

            // Wait for widget to settle
            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const likeBtn = await page.$('.like-btn');

            // Verify starts unliked
            expect(await likeBtn.evaluate(el => el.classList.contains('liked'))).toBe(false);

            // First click — like succeeds
            await likeBtn.click();
            await page.waitForFunction(() => {
                const btn = document.querySelector('.like-btn');
                return btn && btn.classList.contains('liked');
            }, undefined, { timeout: 5000 });
            expect(await likeBtn.evaluate(el => el.classList.contains('liked'))).toBe(true);

            // Second click — unlike is rate-limited, should NOT toggle state
            await likeBtn.click();
            await page.waitForTimeout(600);
            expect(await likeBtn.evaluate(el => el.classList.contains('liked'))).toBe(true);

            // Count should still be 1
            const countText = await page.$eval('.like-count', el => el.textContent);
            expect(parseInt(countText, 10)).toBe(1);
        }));

        test('should animate only on successful like', async () => withBrowser(async () => {
            // Mock fetch: first like succeeds, second unlike is rate-limited
            await page.addInitScript(() => {
                window.__testLikeCount = 0;
                window.__actionAttempts = 0;
                const origFetch = window.fetch;
                window.fetch = async (url, opts) => {
                    if (typeof url === 'string' && url.includes('sponsor-likes')) {
                        if (opts && opts.method === 'POST') {
                            window.__actionAttempts++;
                            if (window.__actionAttempts === 1) {
                                // First action (like) succeeds
                                window.__testLikeCount++;
                                return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                            }
                            // Second action (unlike) is rate-limited
                            return { ok: true, json: async () => ({ count: window.__testLikeCount, rateLimited: true }) };
                        }
                        return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                    }
                    return origFetch(url, opts);
                };
            });

            // Clear and reload
            await page.evaluate(() => {
                localStorage.removeItem('sponsor_me_liked_v1');
                localStorage.removeItem('sponsor_me_count_fallback');
            });
            await page.reload({ waitUntil: 'domcontentloaded' });

            // Wait for widget to settle
            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const likeBtn = await page.$('.like-btn');

            // First click — succeeds, animation should fire
            await likeBtn.click();
            await page.waitForFunction(() => {
                const btn = document.querySelector('.like-btn');
                return btn && btn.classList.contains('liked');
            }, undefined, { timeout: 5000 });

            const hadPopAfterSuccess = await page.evaluate(() => {
                const icon = document.querySelector('.like-icon');
                return icon && icon.classList.contains('pop');
            });
            expect(hadPopAfterSuccess).toBe(true);

            // Wait for animation class to settle
            await page.waitForTimeout(300);

            // Remove pop class manually to detect re-addition
            await page.evaluate(() => {
                const icon = document.querySelector('.like-icon');
                if (icon) icon.classList.remove('pop');
            });

            // Second click — rate-limited, animation should NOT re-fire
            await likeBtn.click();
            await page.waitForTimeout(300);

            const hasPopAfterRateLimit = await page.evaluate(() => {
                const icon = document.querySelector('.like-icon');
                return icon && icon.classList.contains('pop');
            });
            expect(hasPopAfterRateLimit).toBe(false);
        }));

        test('should not animate when post falls back after API failure', async () => withBrowser(async () => {
            await page.addInitScript(() => {
                window.__testLikeCount = 0;
                window.__actionAttempts = 0;
                const origFetch = window.fetch;
                window.fetch = async (url, opts) => {
                    if (typeof url === 'string' && url.includes('sponsor-likes')) {
                        if (opts && opts.method === 'POST') {
                            window.__actionAttempts++;
                            if (window.__actionAttempts === 1) {
                                throw new Error('network failed');
                            }
                            window.__testLikeCount = Math.max(0, window.__testLikeCount - 1);
                            return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                        }
                        return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                    }
                    return origFetch(url, opts);
                };
            });

            await page.evaluate(() => {
                localStorage.removeItem('sponsor_me_liked_v1');
                localStorage.removeItem('sponsor_me_count_fallback');
            });
            await page.reload({ waitUntil: 'domcontentloaded' });

            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const likeBtn = await page.$('.like-btn');

            await likeBtn.click();
            await page.waitForFunction(() => {
                const btn = document.querySelector('.like-btn');
                return btn && btn.classList.contains('liked');
            }, undefined, { timeout: 5000 });

            const hasPopAfterFallback = await page.evaluate(() => {
                const icon = document.querySelector('.like-icon');
                return icon && icon.classList.contains('pop');
            });
            expect(hasPopAfterFallback).toBe(false);

            const stored = await page.evaluate(() => ({
                liked: localStorage.getItem('sponsor_me_liked_v1'),
                count: localStorage.getItem('sponsor_me_count_fallback')
            }));
            expect(stored.liked).toBe('true');
            expect(stored.count).toBe('1');
        }));

        test('should not animate when apiFailed early fallback is used', async () => withBrowser(async () => {
            // Mock fetch so initial GET /count fails, forcing apiFailed = true.
            // POST would succeed, but the early-return path should skip it.
            await page.addInitScript(() => {
                window.__testLikeCount = 0;
                const origFetch = window.fetch;
                window.fetch = async (url, opts) => {
                    if (typeof url === 'string' && url.includes('sponsor-likes')) {
                        if (opts && opts.method === 'POST') {
                            window.__testLikeCount++;
                            return { ok: true, json: async () => ({ count: window.__testLikeCount }) };
                        }
                        // GET /count always fails
                        throw new Error('network failed');
                    }
                    return origFetch(url, opts);
                };
            });

            await page.evaluate(() => {
                localStorage.removeItem('sponsor_me_liked_v1');
                localStorage.removeItem('sponsor_me_count_fallback');
            });
            await page.reload({ waitUntil: 'domcontentloaded' });

            await page.waitForFunction(() => {
                const countEl = document.querySelector('.like-count');
                return countEl && /^\d+$/.test(countEl.textContent);
            }, undefined, { timeout: 5000 });

            const likeBtn = await page.$('.like-btn');

            // Click while apiFailed === true — hits early-return fallback
            await likeBtn.click();
            await page.waitForFunction(() => {
                const btn = document.querySelector('.like-btn');
                return btn && btn.classList.contains('liked');
            }, undefined, { timeout: 5000 });

            const hasPopAfterApiFailedFallback = await page.evaluate(() => {
                const icon = document.querySelector('.like-icon');
                return icon && icon.classList.contains('pop');
            });
            expect(hasPopAfterApiFailedFallback).toBe(false);

            const stored = await page.evaluate(() => ({
                liked: localStorage.getItem('sponsor_me_liked_v1'),
                count: localStorage.getItem('sponsor_me_count_fallback')
            }));
            expect(stored.liked).toBe('true');
            expect(stored.count).toBe('1');
        }));
    });

    describe('Cross-Page Navigation', () => {
        test('should navigate from index to match_review page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
            
            // Find and click the match review link
            const matchReviewLink = await page.$('a[href="match_review.html"]');
            expect(matchReviewLink).not.toBeNull();
        }));

        test('should navigate from index to u10_rules page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
            
            const rulesLink = await page.$('a[href="u10_rules.html"]');
            expect(rulesLink).not.toBeNull();
        }));

        test('should navigate from index to pony_u10_rules page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
            
            const ponyRulesLink = await page.$('a[href="pony_u10_rules.html"]');
            expect(ponyRulesLink).not.toBeNull();
        }));

        test('should navigate from index to groupstage page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });
            
            const groupstageLink = await page.$('a[href="tigercup_groupstage.html"]');
            expect(groupstageLink).not.toBeNull();
        }));

        test('should navigate from index to finalstage page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });

            const finalstageLink = await page.$('a[href="tigercup_finalstage.html"]');
            expect(finalstageLink).not.toBeNull();
        }));

        test('should navigate from index to sponsor page', async () => withBrowser(async () => {
            await page.goto(PAGE_PATHS.index, { waitUntil: 'domcontentloaded' });

            const sponsorLink = await page.$('a[href="sponsor_me.html"]');
            expect(sponsorLink).not.toBeNull();
        }));
    });
});

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
        // Unauthorized origins should not fall back to the first allowed origin
        expect(ts).not.toContain('ALLOWED_ORIGINS[0]');
    });

    test('should prefer infrastructure IP headers to avoid spoofing', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/sponsor-likes/index.ts'),
            'utf8'
        );
        // Infrastructure headers must be checked before x-forwarded-for
        const cfIndex = ts.indexOf('cf-connecting-ip');
        const realIpIndex = ts.indexOf('x-real-ip');
        const forwardedForIndex = ts.indexOf('x-forwarded-for');
        expect(cfIndex).toBeGreaterThan(-1);
        expect(realIpIndex).toBeGreaterThan(-1);
        expect(forwardedForIndex).toBeGreaterThan(-1);
        expect(cfIndex).toBeLessThan(forwardedForIndex);
        expect(realIpIndex).toBeLessThan(forwardedForIndex);
        // Must use the last (trusted) element of the chain, not the first
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
        // Should not leak raw error messages to the client
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
        // Must fall back to FTS-only when embedding API fails
        expect(ts).toContain('falling back to FTS-only search');
    });

    test('site-search function should omit hash when section_id is empty', () => {
        const ts = fs.readFileSync(
            path.resolve(__dirname, '..', 'supabase/functions/site-search/index.ts'),
            'utf8'
        );
        // URL construction must guard against empty section_ids
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
        // First elements in X-Forwarded-For can be client-spoofed.
        // Use the last element (most recent proxy) as the safest fallback
        // after checking trusted infrastructure headers (cf-connecting-ip, x-real-ip).
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

    test('image-modal consumers should use the shared lightbox script', () => {
        const modalPages = [
            'u10_rules.html',
            'pony_u10_rules.html',
            'tigercup_groupstage.html',
            'tigercup_finalstage.html',
            'sponsor_me.html'
        ];

        modalPages.forEach((file) => {
            const html = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
            expect(html).toContain('src="image_modal.js"');
        });
    });

    test('image modal pages should declare their modal mode explicitly', () => {
        const standardPages = [
            'u10_rules.html',
            'pony_u10_rules.html',
            'tigercup_groupstage.html',
            'tigercup_finalstage.html'
        ];

        standardPages.forEach((file) => {
            const html = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
            expect(html).toContain('data-modal-mode="standard"');
        });

        const sponsorHtml = fs.readFileSync(path.resolve(__dirname, '..', 'sponsor_me.html'), 'utf8');
        expect(sponsorHtml).toContain('data-modal-mode="overlay"');
    });
});

describe('Back To Index Link Coverage', () => {
    const pageExpectations = [
        {
            file: 'match_review.html',
            requiredSnippets: [
                'class="match-info"',
                '<a href="index.html" class="home-link" target="_self">🏠 返回首页</a>'
            ]
        },
        {
            file: 'u10_rules.html',
            requiredSnippets: [
                '<a href="index.html" class="nav-link" target="_self">🏠 首页</a>'
            ]
        },
        {
            file: 'pony_u10_rules.html',
            requiredSnippets: [
                '<a href="index.html" class="nav-link" target="_self">🏠 首页</a>'
            ]
        },
        {
            file: 'tigercup_groupstage.html',
            requiredSnippets: [
                '<a href="index.html" class="nav-link" target="_self">🏠 首页</a>'
            ]
        },
        {
            file: 'tigercup_finalstage.html',
            requiredSnippets: [
                '<a href="index.html" class="nav-link" target="_self">🏠 首页</a>'
            ]
        },
        {
            file: 'sponsor_me.html',
            requiredSnippets: [
                '<a class="brand" href="./index.html">',
                '<a href="./index.html">返回首页</a>'
            ]
        }
    ];

    pageExpectations.forEach(({ file, requiredSnippets }) => {
        test(`${file} should contain a link back to index`, () => {
            const filePath = path.resolve(__dirname, '..', file);
            const html = fs.readFileSync(filePath, 'utf8');

            requiredSnippets.forEach((snippet) => {
                expect(html).toContain(snippet);
            });
        });
    });
});

describe('Floating Baseball Assets', () => {
    const pagesWithFloatingBaseballs = [
        'index.html',
        'match_review.html',
        'u10_rules.html',
        'pony_u10_rules.html',
        'tigercup_groupstage.html',
        'tigercup_finalstage.html'
    ];

    pagesWithFloatingBaseballs.forEach((file) => {
        test(`${file} should include floating baseball css and js`, () => {
            const filePath = path.resolve(__dirname, '..', file);
            const html = fs.readFileSync(filePath, 'utf8');

            expect(html).toContain('href="baseball_floats.css"');
            expect(html).toContain('src="baseball_floats.js"');
        });
    });
});

describe('Baseball Theme Motion Coverage', () => {
    test('index.html should include stadium-style animation hooks', () => {
        const content = getEffectiveContent('index.html');

        expect(content).toContain('@keyframes stadiumRise');
        expect(content).toContain('@keyframes lightSweep');
        expect(content).toContain('@keyframes cardReveal');
        expect(content).toContain('animation: scoreboardDrop 0.9s ease-out;');
        expect(content).toContain('@media (prefers-reduced-motion: reduce)');
    });

    test('rules_style.css should include shared baseball motion system', () => {
        const css = fs.readFileSync(path.resolve(__dirname, '..', 'rules_style.css'), 'utf8');

        expect(css).toContain('@keyframes pageEnter');
        expect(css).toContain('@keyframes headerFlash');
        expect(css).toContain('@keyframes sectionReveal');
        expect(css).toContain('animation: badgePulse 2.8s ease-in-out infinite;');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });

    test('match_review.html should include animated review-page effects', () => {
        const content = getEffectiveContent('match_review.html');

        expect(content).toContain('@keyframes pageFadeIn');
        expect(content).toContain('@keyframes marqueeSweep');
        expect(content).toContain('@keyframes cardLiftIn');
        expect(content).toContain('animation: badgeBob 3s ease-in-out infinite;');
        expect(content).toContain('.video-card:nth-of-type(7) { animation-delay: 0.46s; }');
        expect(content).toContain('@media (prefers-reduced-motion: reduce)');
    });

    test('analysis pages should include report reveal animations', () => {
        const groupstageContent = getEffectiveContent('tigercup_groupstage.html');
        const finalstageContent = getEffectiveContent('tigercup_finalstage.html');

        [groupstageContent, finalstageContent].forEach((content) => {
            expect(content).toContain('@keyframes reportEnter');
            expect(content).toContain('@keyframes scoreboardFlash');
            expect(content).toContain('@keyframes aiReveal');
            expect(content).toContain('@keyframes highlightSweep');
            expect(content).toContain('.ai-card:nth-of-type(3) { animation-delay: 0.4s; }');
            expect(content).toContain('@media (prefers-reduced-motion: reduce)');
        });
    });
});

describe('Floating Baseball Behavior Coverage', () => {
    test('baseball_floats.css should keep floating baseballs passive and icon-based', () => {
        const css = fs.readFileSync(path.resolve(__dirname, '..', 'baseball_floats.css'), 'utf8');

        expect(css).toContain('pointer-events: none;');
        expect(css).toContain('font-size: calc(var(--ball-size, 46px) - 4px);');
        expect(css).not.toContain('.floating-baseball.is-hit');
        expect(css).not.toContain('@keyframes baseball-hit');
    });

    test('baseball_floats.js should create seven passive baseball icons without click handlers', () => {
        const js = fs.readFileSync(path.resolve(__dirname, '..', 'baseball_floats.js'), 'utf8');

        expect(js).toContain('const BALL_COUNT = 7;');
        expect(js).toContain("document.createElement('div')");
        expect(js).toContain("element.setAttribute('aria-hidden', 'true');");
        expect(js).toContain("element.textContent = '⚾';");
        expect(js).toContain('requestAnimationFrame(animate);');
        expect(js).not.toContain("document.createElement('button')");
        expect(js).not.toContain("element.type = 'button'");
        expect(js).not.toContain("element.setAttribute('aria-label'");
        expect(js).not.toContain("addEventListener('click'");
        expect(js).not.toContain('classList.add(\'is-hit\')');
    });
});

describe('Scroll Reveal Assets', () => {
    const pagesWithScrollReveal = [
        'index.html',
        'match_review.html',
        'u10_rules.html',
        'pony_u10_rules.html',
        'tigercup_groupstage.html',
        'tigercup_finalstage.html'
    ];

    pagesWithScrollReveal.forEach((file) => {
        test(`${file} should include scroll_reveal.js`, () => {
            const filePath = path.resolve(__dirname, '..', file);
            const html = fs.readFileSync(filePath, 'utf8');
            expect(html).toContain('src="scroll_reveal.js"');
        });

        test(`${file} should include scroll_reveal.css`, () => {
            const filePath = path.resolve(__dirname, '..', file);
            const html = fs.readFileSync(filePath, 'utf8');
            expect(html).toContain('href="scroll_reveal.css"');
        });
    });

    test('sponsor_me.html should not include scroll_reveal.js', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '..', 'sponsor_me.html'), 'utf8');
        expect(html).not.toContain('scroll_reveal.js');
    });

    test('sponsor_me.html should not include scroll_reveal.css', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '..', 'sponsor_me.html'), 'utf8');
        expect(html).not.toContain('scroll_reveal.css');
    });
});

describe('Count Up Assets', () => {
    const pagesWithCountUp = [
        'u10_rules.html',
        'pony_u10_rules.html',
        'tigercup_groupstage.html',
        'tigercup_finalstage.html'
    ];

    pagesWithCountUp.forEach((file) => {
        test(`${file} should include count_up.js`, () => {
            const filePath = path.resolve(__dirname, '..', file);
            const html = fs.readFileSync(filePath, 'utf8');
            expect(html).toContain('src="count_up.js"');
        });
    });

    test('sponsor_me.html should not include count_up.js', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '..', 'sponsor_me.html'), 'utf8');
        expect(html).not.toContain('count_up.js');
    });
});

describe('Data Reveal Attributes', () => {
    test('index.html should have data-reveal on nav cards', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
        const navCardMatches = html.match(/class="nav-card"[^>]*data-reveal/g);
        expect(navCardMatches.length).toBeGreaterThanOrEqual(5);
    });

    test('match_review.html should have data-reveal on video cards', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '..', 'match_review.html'), 'utf8');
        const videoCardMatches = html.match(/class="video-card"[^>]*data-reveal/g);
        expect(videoCardMatches.length).toBeGreaterThanOrEqual(7);
    });

    test('u10_rules.html should have data-reveal on sections and metric cards', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '..', 'u10_rules.html'), 'utf8');
        expect(html).toContain('<section id="schedule" data-reveal>');
        expect(html).toContain('<div class="metric-card" data-reveal>');
        expect(html).toContain('<tbody data-reveal>');
    });

    test('pony_u10_rules.html should have data-reveal on sections and metric cards', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '..', 'pony_u10_rules.html'), 'utf8');
        expect(html).toContain('<section id="schedule" data-reveal>');
        expect(html).toContain('<section id="field-specs" data-reveal>');
        expect(html).toContain('<div class="metric-card" data-reveal>');
        expect(html).toContain('<tbody data-reveal>');
    });

    test('analysis pages should have data-reveal on sections, ai-cards and metric cards', () => {
        const groupstageHtml = fs.readFileSync(path.resolve(__dirname, '..', 'tigercup_groupstage.html'), 'utf8');
        const finalstageHtml = fs.readFileSync(path.resolve(__dirname, '..', 'tigercup_finalstage.html'), 'utf8');

        [groupstageHtml, finalstageHtml].forEach((html) => {
            expect(html).toContain('<div class="ai-card" data-reveal>');
            expect(html).toContain('<div class="metric-card" data-reveal>');
            expect(html).toContain('<tbody data-reveal>');
        });
    });
});

describe('AI Card Hover Glow', () => {
    test('analysis pages should include AI card hover glow styles', () => {
        const groupstageHtml = fs.readFileSync(path.resolve(__dirname, '..', 'tigercup_groupstage.html'), 'utf8');
        const finalstageHtml = fs.readFileSync(path.resolve(__dirname, '..', 'tigercup_finalstage.html'), 'utf8');

        [groupstageHtml, finalstageHtml].forEach((html) => {
            expect(html).toContain('.ai-card:hover');
            expect(html).toContain('.ai-card:has(.ai-card-header.kimi):hover');
            expect(html).toContain('.ai-card:has(.ai-card-header.gemini):hover');
            expect(html).toContain('.ai-card:has(.ai-card-header.chatgpt):hover');
        });
    });
});

describe('Baseball Field Theme Consistency', () => {
    const themedPages = [
        'index.html',
        'match_review.html',
        'u10_rules.html',
        'pony_u10_rules.html',
        'tigercup_groupstage.html',
        'tigercup_finalstage.html'
    ];

    // getEffectiveContent is defined at module scope above

    test('baseball field background SVG should exist', () => {
        expect(fs.existsSync(path.resolve(__dirname, '../img/baseball_field_bg.svg'))).toBe(true);
    });

    test('all themed pages should reference the baseball field background SVG', () => {
        themedPages.forEach((file) => {
            const content = getEffectiveContent(file);
            expect(content).toContain("img/baseball_field_bg.svg");
        });
    });

    test('sponsor page should not use the baseball field background', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '../sponsor_me.html'), 'utf8');
        expect(html).not.toContain("baseball_field_bg.svg");
    });

    test('all themed pages should share the index-style color system', () => {
        themedPages.forEach((file) => {
            const content = getEffectiveContent(file);
            expect(content).toContain('--fox-red:');
            expect(content).toContain('--dirt-orange:');
            expect(content).toContain('--leather-cream:');
            expect(content).toContain('--stitch-red:');
        });
    });

    test('headers should use the scoreboard style (dirt-orange accents)', () => {
        const pagesWithInlineCss = [
            'index.html',
            'match_review.html',
            'tigercup_groupstage.html',
            'tigercup_finalstage.html'
        ];

        pagesWithInlineCss.forEach((file) => {
            const html = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
            expect(html).toContain('var(--dirt-dark-orange)');
            expect(html).toContain('var(--dirt-light-orange)');
        });

        const css = fs.readFileSync(path.resolve(__dirname, '../rules_style.css'), 'utf8');
        expect(css).toContain('var(--dirt-dark-orange)');
        expect(css).toContain('var(--dirt-light-orange)');
    });

    test('containers and cards should have baseball base styling', () => {
        [
            'index.html',
            'match_review.html',
            'tigercup_groupstage.html',
            'tigercup_finalstage.html'
        ].forEach((file) => {
            const html = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
            expect(html).toContain('var(--leather-tan)');
            expect(html).toContain('var(--stitch-red)');
        });

        const css = fs.readFileSync(path.resolve(__dirname, '../rules_style.css'), 'utf8');
        expect(css).toContain('var(--leather-tan)');
        expect(css).toContain('var(--stitch-red)');
    });

    test('index page nav cards should have the leather-tan border and stitch-red dashed border', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
        expect(html).toContain('border: 3px solid var(--leather-tan)');
        expect(html).toContain('border: 2px dashed var(--stitch-red)');
    });
});
