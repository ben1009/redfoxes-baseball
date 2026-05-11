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
        expect(navLinks).toContain('#claude');
    }));

    test('should have Kimi analysis first', async () => harness.withBrowser(async () => {
        const sections = await harness.page.$$('section[data-ai-source]');
        expect(sections.length).toBe(4);

        const firstSource = await sections[0].evaluate(el => el.getAttribute('data-ai-source'));
        expect(firstSource).toBe('Kimi');
    }));

    test('should have AI analysis cards', async () => harness.withBrowser(async () => {
        const aiCards = await harness.page.$$('.ai-card');
        expect(aiCards.length).toBe(4);
    }));

    test('should have summary section with key metrics', async () => harness.withBrowser(async () => {
        const summarySection = await harness.page.$('.summary-section');
        expect(summarySection).not.toBeNull();

        const metricCards = await summarySection.$$('.metric-card');
        expect(metricCards.length).toBe(4);
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

    describe('程思乐 updated batting stats (2026-05-11)', () => {
        test('程思乐 row should show updated OPS 1.50 and AVG .730', async () => harness.withBrowser(async () => {
            const row = await harness.page.evaluateHandle(() => {
                const rows = Array.from(document.querySelectorAll('#data table tbody tr'));
                return rows.find(r => r.textContent.includes('程思乐')) || null;
            });
            const isNull = await row.evaluate(r => r === null);
            expect(isNull).toBe(false);

            const cells = await row.evaluate(r => Array.from(r.querySelectorAll('td')).map(td => td.textContent.trim()));
            // Columns: 球员, 打席, 打数, 得点, 一垒, 二垒, 本垒, 总安, 垒打, 打点, 盗垒, 保送, 三振, 残垒, AVG, SLG, OBP, OPS
            expect(cells[0]).toBe('程思乐');
            expect(cells[4]).toBe('10');  // 一垒
            expect(cells[5]).toBe('1');   // 二垒
            expect(cells[7]).toBe('11');  // 总安
            expect(cells[8]).toBe('12');  // 垒打
            expect(cells[14]).toBe('.730'); // AVG
            expect(cells[15]).toBe('.800'); // SLG
            expect(cells[16]).toBe('.700'); // OBP
            expect(cells[17]).toBe('1.50'); // OPS
        }));

        test('Kimi 进攻领跑者表 should list 程思乐 as OPS leader at 1.50', async () => harness.withBrowser(async () => {
            const kimiSection = await harness.page.$('#kimi');
            const hasLeader = await kimiSection.evaluate(s => {
                const rows = Array.from(s.querySelectorAll('table tbody tr'));
                const opsRow = rows.find(r => r.textContent.includes('OPS') && r.textContent.includes('程思乐'));
                return opsRow ? opsRow.textContent.includes('1.50') : false;
            });
            expect(hasLeader).toBe(true);
        }));

        test('Gemini OPS ranking should start with 程思乐 at #1', async () => harness.withBrowser(async () => {
            const firstRanking = await harness.page.evaluate(() => {
                const gemini = document.querySelector('#gemini');
                const h3s = Array.from(gemini.querySelectorAll('h3'));
                const rankingH3 = h3s.find(h => h.textContent.includes('球员逐一点评'));
                if (!rankingH3) return null;
                // First h4 sibling after the ranking h3
                let node = rankingH3.nextElementSibling;
                while (node && node.tagName !== 'H4') node = node.nextElementSibling;
                return node ? node.textContent.trim() : null;
            });
            expect(firstRanking).not.toBeNull();
            expect(firstRanking).toContain('1. 程思乐');
            expect(firstRanking).toContain('1.50');
        }));

        test('ChatGPT 程思乐 highlight box should show updated 打率 0.730', async () => harness.withBrowser(async () => {
            const chatgptText = await harness.page.$eval('#chatgpt', el => el.textContent);
            expect(chatgptText).toContain('打率 0.730');
            expect(chatgptText).toContain('OPS 1.500');
            expect(chatgptText).not.toContain('打率 0.530');
        }));
    });

    describe('Pitcher stats table (投手数据)', () => {
        test('should have a 投手数据 table with 7 pitchers', async () => harness.withBrowser(async () => {
            const dataSection = await harness.page.$('#data');
            const pitcherHeading = await dataSection.evaluate(s => {
                const hs = Array.from(s.querySelectorAll('h3'));
                return hs.some(h => h.textContent.includes('投手数据'));
            });
            expect(pitcherHeading).toBe(true);

            const tables = await dataSection.$$('.table-responsive table');
            expect(tables.length).toBeGreaterThanOrEqual(2); // 打击 + 投手

            const pitcherNames = await dataSection.evaluate(s => {
                const tables = Array.from(s.querySelectorAll('.table-responsive table'));
                const pitcherTable = tables[tables.length - 1];
                return Array.from(pitcherTable.querySelectorAll('tbody tr td:first-child'))
                    .map(td => td.textContent.trim());
            });
            expect(pitcherNames).toEqual(expect.arrayContaining([
                '闫勋捷', '田雨稷', 'Max', '孙嘉泽', '瞿裕桐', '刘景天', '程思乐'
            ]));
            expect(pitcherNames.length).toBe(7);
        }));

        test('pitcher table should have 10 columns (球员 + 9 stats)', async () => harness.withBrowser(async () => {
            const headers = await harness.page.evaluate(() => {
                const tables = Array.from(document.querySelectorAll('#data .table-responsive table'));
                const pitcherTable = tables[tables.length - 1];
                return Array.from(pitcherTable.querySelectorAll('thead th'))
                    .map(th => th.textContent.trim());
            });
            expect(headers).toEqual([
                '球员', '主投局数', '投球数', '好球', '被安打',
                '失分', '保送', '三振', '触身球', '好球率'
            ]);
        }));

        test('田雨稷 pitching row should have 9 IP and .40 strike rate', async () => harness.withBrowser(async () => {
            const cells = await harness.page.evaluate(() => {
                const tables = Array.from(document.querySelectorAll('#data .table-responsive table'));
                const pitcherTable = tables[tables.length - 1];
                const rows = Array.from(pitcherTable.querySelectorAll('tbody tr'));
                const row = rows.find(r => r.textContent.includes('田雨稷'));
                return row ? Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim()) : null;
            });
            expect(cells).not.toBeNull();
            expect(cells[1]).toBe('9');    // 主投局数
            expect(cells[2]).toBe('127');  // 投球数
            expect(cells[9]).toBe('.40');  // 好球率
        }));
    });

    describe('Kimi pitcher deep analysis (📈 投手衍生指标深度分析)', () => {
        test('should contain 投手衍生指标深度分析 heading with ERA/WHIP/K/BB table', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#kimi', el => el.textContent);
            expect(text).toContain('投手衍生指标深度分析');

            const headers = await harness.page.evaluate(() => {
                const kimi = document.querySelector('#kimi');
                const tables = Array.from(kimi.querySelectorAll('table'));
                const ddTable = tables.find(t => /ERA/.test(t.textContent) && /WHIP/.test(t.textContent));
                if (!ddTable) return null;
                return Array.from(ddTable.querySelectorAll('thead th')).map(th => th.textContent.trim());
            });
            expect(headers).toEqual(['球员', 'ERA', 'WHIP', 'K/BB', '每局用球', 'K/9', 'BB/9']);
        }));

        test('should include 全队投手问题总结 section', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#kimi', el => el.textContent);
            expect(text).toContain('全队投手问题总结');
            expect(text).toContain('保送失控');
            expect(text).toContain('好球率偏低');
            expect(text).toContain('工作量不均');
        }));

        test('should NOT contain removed 投手专项分析 subjective rating block', async () => harness.withBrowser(async () => {
            const kimi = await harness.page.$('#kimi');
            const hasOldHeading = await kimi.evaluate(s => {
                const h3s = Array.from(s.querySelectorAll('h3'));
                return h3s.some(h => h.textContent.trim().includes('投手专项分析'));
            });
            expect(hasOldHeading).toBe(false);

            // The old table had a 综合评级 column with star emojis
            const hasStarRating = await kimi.evaluate(s => {
                const tables = Array.from(s.querySelectorAll('table'));
                return tables.some(t => {
                    const headerTxt = t.querySelector('thead')?.textContent || '';
                    return headerTxt.includes('综合评级');
                });
            });
            expect(hasStarRating).toBe(false);
        }));
    });

    describe('Gemini pitcher analysis (🎯 投手数据专项点评)', () => {
        test('should contain 投手数据专项点评 heading above OPS ranking', async () => harness.withBrowser(async () => {
            const headings = await harness.page.$$eval('#gemini h3', hs =>
                hs.map(h => h.textContent.trim())
            );
            const pitcherIdx = headings.findIndex(h => h.includes('投手数据专项点评'));
            const rankingIdx = headings.findIndex(h => h.includes('球员逐一点评'));
            expect(pitcherIdx).toBeGreaterThanOrEqual(0);
            expect(rankingIdx).toBeGreaterThan(pitcherIdx);
        }));

        test('should describe Max as the most efficient pitcher', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#gemini', el => el.textContent);
            expect(text).toContain('最高效的压制者');
            expect(text).toContain('吃局数');
            expect(text).toContain('强力三振型');
            expect(text).toContain('控球迷失');
        }));
    });

    describe('ChatGPT pitcher analysis (⚾ 投手数据分析)', () => {
        test('should contain 投手数据分析 heading with 3 pitcher type classifications', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#chatgpt', el => el.textContent);
            expect(text).toContain('投手数据分析');
            expect(text).toContain('压制型');
            expect(text).toContain('稳定型');
            expect(text).toContain('比赛型');
        }));

        test('should highlight all 5 primary pitchers (Max, 闫勋捷, 田雨稷, 孙嘉泽, 程思乐)', async () => harness.withBrowser(async () => {
            const h4Texts = await harness.page.$$eval('#chatgpt h4', hs =>
                hs.map(h => h.textContent.trim())
            );
            const combined = h4Texts.join(' | ');
            expect(combined).toContain('Max');
            expect(combined).toContain('闫勋捷');
            expect(combined).toContain('田雨稷');
            expect(combined).toContain('孙嘉泽');
            expect(combined).toContain('程思乐');
        }));
    });

    describe('Claude analysis card (📊 数据结构派)', () => {
        test('should have a Claude section with data-ai-source="Claude"', async () => harness.withBrowser(async () => {
            const claude = await harness.page.$('#claude');
            expect(claude).not.toBeNull();

            const dataSource = await claude.evaluate(el => el.getAttribute('data-ai-source'));
            expect(dataSource).toBe('Claude');
        }));

        test('should have .ai-card-header.claude with Claude branding', async () => harness.withBrowser(async () => {
            const header = await harness.page.$('#claude .ai-card-header.claude');
            expect(header).not.toBeNull();

            const headerText = await header.evaluate(el => el.textContent);
            expect(headerText).toContain('Claude');
            expect(headerText).toContain('📊');
        }));

        test('should appear last in the AI sections order', async () => harness.withBrowser(async () => {
            const sources = await harness.page.$$eval('section[data-ai-source]', secs =>
                secs.map(s => s.getAttribute('data-ai-source'))
            );
            expect(sources).toEqual(['Kimi', 'Gemini', 'ChatGPT', 'Claude']);
        }));

        test('should contain 4 core structural insights and training priorities', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#claude', el => el.textContent);
            // 4 key structural findings
            expect(text).toContain('选球 + 速度');
            expect(text).toContain('同一枚硬币的两面');
            expect(text).toContain('进攻产出高度集中');
            expect(text).toContain('高 OPS ≠ 高"得点贡献"');
            // two-way player analysis
            expect(text).toContain('两面人');
            expect(text).toContain('孙嘉泽');
            // training priorities
            expect(text).toContain('下一阶段训练优先级');
            // contrarian observation
            expect(text).toContain('保送 27');
            expect(text).toContain('三振 22');
        }));

        test('should include the two-way player cross table with Max/闫勋捷/孙嘉泽/田雨稷/程思乐', async () => harness.withBrowser(async () => {
            const names = await harness.page.evaluate(() => {
                const claude = document.querySelector('#claude');
                const tables = Array.from(claude.querySelectorAll('table'));
                const twoWay = tables.find(t => {
                    const headerTxt = t.querySelector('thead')?.textContent || '';
                    return headerTxt.includes('OPS') && headerTxt.includes('投手');
                });
                if (!twoWay) return null;
                return Array.from(twoWay.querySelectorAll('tbody tr td:first-child'))
                    .map(td => td.textContent.trim());
            });
            expect(names).toEqual(expect.arrayContaining([
                'Max', '闫勋捷', '孙嘉泽', '田雨稷', '程思乐'
            ]));
        }));

        test('should have method-disclosure info box at the bottom', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#claude', el => el.textContent);
            expect(text).toContain('方法说明');
            expect(text).toContain('sabermetrics');
        }));
    });

    describe('四AI共识总结 (summary section update)', () => {
        test('should use "四AI共识总结" heading (not the old "三AI")', async () => harness.withBrowser(async () => {
            const heading = await harness.page.$eval('#summary h2', el => el.textContent.trim());
            expect(heading).toBe('四AI共识总结');
        }));

        test('should have 4 metric cards with updated labels', async () => harness.withBrowser(async () => {
            const labels = await harness.page.$$eval('#summary .metric-card .metric-label', els =>
                els.map(el => el.textContent.trim())
            );
            expect(labels).toEqual([
                '进攻火力强劲',
                '选球纪律顶级',
                '投手控球短板',
                '防守稳定性不足'
            ]);
        }));

        test('should reference all 4 AIs with role labels in the view-分工 box', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#summary', el => el.textContent);
            expect(text).toContain('四AI视角分工');
            expect(text).toContain('Kimi');
            expect(text).toContain('指标派');
            expect(text).toContain('Gemini');
            expect(text).toContain('架构派');
            expect(text).toContain('ChatGPT');
            expect(text).toContain('叙事派');
            expect(text).toContain('Claude');
            expect(text).toContain('结构派');
        }));

        test('consensus bullets should mention updated key metrics and Claude insights', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#summary', el => el.textContent);
            // updated stats
            expect(text).toContain('程思乐');
            expect(text).toContain('1.50');
            expect(text).toContain('BB/K 1.92');
            expect(text).toContain('ERA 2.25');
            // Claude-specific structural insights
            expect(text).toContain('高 OPS ≠ 高得点贡献');
            expect(text).toContain('后排深度');
            expect(text).toContain('孙嘉泽');
            expect(text).toContain('#2 打者');
        }));

        test('should not contain outdated "三位AI" phrasing', async () => harness.withBrowser(async () => {
            const text = await harness.page.$eval('#summary', el => el.textContent);
            expect(text).not.toContain('三AI共识');
            expect(text).not.toContain('三位AI');
        }));
    });

    describe('Claude styling hook (baseball_theme.css)', () => {
        test('--color-claude CSS variable should be defined on :root', async () => harness.withBrowser(async () => {
            const color = await harness.page.evaluate(() => {
                const value = getComputedStyle(document.documentElement)
                    .getPropertyValue('--color-claude')
                    .trim();
                return value;
            });
            // Allow either the hex or a browser-normalized rgb; just verify non-empty
            expect(color.length).toBeGreaterThan(0);
        }));

        test('.ai-card-header.claude should render with a non-transparent background', async () => harness.withBrowser(async () => {
            const bg = await harness.page.$eval('#claude .ai-card-header.claude', el => {
                return getComputedStyle(el).backgroundImage;
            });
            // linear-gradient(...) must be present
            expect(bg).toMatch(/linear-gradient/);
        }));
    });
});
