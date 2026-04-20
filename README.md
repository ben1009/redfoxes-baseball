# ⚾ Red Foxes Baseball Team

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://ben1009.github.io/redfoxes-baseball/)

> 烈光少棒赤狐队 · Red Foxes Youth Baseball Team

## 📋 Project Introduction

This is the official website for **烈光少棒赤狐队 (Red Foxes Youth Baseball Team)**, featuring:

- **Match Reviews** - Tactical analysis videos from friendship matches
- **Tournament Information** - Rules and schedules for competitions
- **Performance Analysis** - Data-driven player performance insights (groupstage + finalstage)
- **Sponsor Support** - Sponsor page with global like counter (Cloudflare Worker + KV)

## 🔗 Live Demo

**https://ben1009.github.io/redfoxes-baseball/**

## 📁 Project Structure

```
redfoxes-baseball/
├── index.html                 # Navigation hub - entry point for all content
├── match_review.html          # Match review page (7 tactical clips with password protection)
├── u10_rules.html             # U10 tournament rules page
├── pony_u10_rules.html        # PONY U10 tournament rules page
├── tigercup_groupstage.html   # Groupstage performance analysis with multi-AI insights
├── tigercup_finalstage.html   # Finalstage performance analysis with multi-AI insights
├── sponsor_me.html            # Sponsor support page
├── site-analytics.js          # Shared Google Analytics bootstrap
├── image-modal.js             # Shared lightbox behavior across pages
├── baseball-theme.css         # Shared baseball field theme stylesheet
├── rules_style.css            # Shared rules page styling
├── u10_rules.js               # Legacy compatibility stub for older U10 modal references
├── baseball_floats.css/js     # Floating baseball background animation
├── scroll_reveal.css/js       # Scroll-triggered reveal animations
├── count_up.js                # Animated number counter
├── img/                       # Static image assets
│   ├── baseball-field-bg.svg  # Aerial baseball field background
│   ├── *.png                  # Decorative icons for pages
│   ├── schedule.jpg           # U10 tournament schedule
│   ├── venue_map.jpg          # Venue map
│   ├── groupstage_data.png    # Groupstage match statistics
│   ├── finalstage_data.png    # Finalstage match statistics
│   └── tigercup_final_ranking.jpg  # Final tournament ranking
├── README.md                  # Project documentation
├── AGENTS.md                  # Developer guide for AI coding agents
└── LICENSE                    # CC BY-NC-SA 4.0 License
```

## 🧭 Navigation Hub (index.html)

The main entry point featuring:
- Team branding and motto
- Quick navigation cards to all content pages
- Responsive card-based layout

## 🎥 Match Review (match_review.html)

**烈光 vs 飞雪 Friendship Match** - Seven Tactical Clips Deep Analysis

1. **Clip 1** - Dropped Third Strike Rule Analysis
2. **Clip 2** - Base Running Training: The Art of Running All Out
3. **Clip 3** - Force Out at First Base Tactical Analysis
4. **Clip 4** - Mental Focus and Defensive Awareness
5. **Clip 5** - Throwing and Catching Errors Analysis
6. **Clip 6** - Experience Issues: Missing Scoring Opportunities
7. **Clip 7** - Pitcher Details: Watch the Situation When Returning to Mound

**Access**: Password protected (SHA-256 hashed)

## 📅 U10 Tournament Rules (u10_rules.html)

Complete regulations for the 猛虎杯 (Tiger Cup) U10 Baseball Competition:

- **Team**: 烈光少棒（赤狐队）/ Red Foxes (Red Fox Team)
- **Features**:
  - 📍 Sticky navigation with quick links to all sections
  - 📅 Tournament schedule with image lightbox
  - 🗺️ Venue map with facility locations
  - 📋 Complete rules: eligibility, game format, pitcher limits, field specs
  - 🖨️ Print-friendly styles

## 📊 Groupstage Analysis (tigercup_groupstage.html)

**猛虎杯小组赛数据分析** - Multi-AI Performance Analysis

- **Data Source**: 猛虎杯小组赛 match statistics
- **Analysis by**: Kimi, Gemini, ChatGPT
- **Content**:
  - Player batting statistics (13 players)
  - Pitcher and fielder performance analysis
  - Tactical recommendations for training
  - "攻强守弱" (Strong Offense, Weak Defense) theme
- **Features**:
  - AI analysis cards with distinct branding
  - Player statistics tables
  - Key metrics summary
  - Responsive tables and navigation
  - Cross-page links to finalstage analysis and index

## 🏆 Finalstage Analysis (tigercup_finalstage.html)

**猛虎杯决赛数据分析** - Multi-AI Final Match Analysis

- **Data Source**: 猛虎杯决赛 match statistics
- **Analysis by**: Kimi, Gemini, ChatGPT
- **Content**:
  - Player batting statistics and attack index rankings
  - Major defensive errors and player grading
  - Groupstage vs finalstage comparison
  - Match score records (vs 北京励豹, 飞雪陨劫, 北京同心)
  - Final tournament ranking image
  - "核心被针对，深度制胜" theme
- **Features**:
  - AI analysis cards with distinct branding
  - Player statistics tables and grading tables
  - Key metrics summary
  - Responsive tables and navigation
  - Cross-page links to groupstage analysis and index

## 🔐 Access Instructions

The match review page (`match_review.html`) requires a password to enter:

> **Hint**: In what year did Zhang Jinxin start playing baseball?
> 
> (Answer: 4-digit year, SHA-256 hashed verification)

**Note**: This is client-side only password protection for casual access control, not cryptographically secure.

## 🛠️ Tech Stack

- HTML5
- CSS3 (Flexbox + Grid, CSS Custom Properties, `prefers-reduced-motion`)
- Vanilla JavaScript (ES6+)
- Google Fonts (Noto Serif SC, Segoe UI)
- Bilibili Video Embedding
- Google Analytics 4
- Cloudflare Workers + KV (global like counter)
- 🦊 SVG Emoji Favicon

### Theme Architecture
All themed pages share a unified **Baseball Field Theme** via `baseball-theme.css`:
- Aerial baseball field background (`img/baseball-field-bg.svg`) with mowing-stripe fallback
- Scoreboard-style headers with dirt-orange accents
- Leather-cream card styling with baseball-stitch dashed borders
- Shared CSS custom properties for consistent colors across pages

### Shared JavaScript
- `site-analytics.js` centralizes the Google Analytics bootstrap used by every page
- `image-modal.js` centralizes lightbox behavior for rules, report, and sponsor pages

## 📊 Analytics

This site uses Google Analytics 4 to track visitor engagement and improve content.

## 🧪 Testing

Comprehensive test suite with **145 tests** covering:
- Page structure and navigation tests
- Video autopause functionality tests
- Cross-page link verification
- File existence checks
- **Baseball Field Theme Consistency** — shared CSS variables, backgrounds, and scoreboard headers
- **Baseball Theme Motion Coverage** — animation hooks and reduced-motion support
- **Floating Baseball Behavior Coverage** — passive background animations
- **Like Widget Coverage** — DOM presence, toggle interaction, localStorage persistence
- Scroll reveal and count-up asset coverage

Run tests locally:
```bash
npm install
npm test
```

## 📜 License

This project is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/).

You are free to:
- ✅ Share — copy and redistribute the material in any medium or format
- ✅ Adapt — remix, transform, and build upon the material

Under the following terms:
- 📝 Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- 🚫 NonCommercial — You may not use the material for commercial purposes
- 🔄 ShareAlike — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original

See [LICENSE](./LICENSE) file for details.

## 👏 Acknowledgments

- All players of Red Foxes Youth Baseball Team
- Feixue Baseball Team
- All coaches and parents supporting youth baseball development
- AI assistants (Kimi, Gemini, ChatGPT) for match data analysis

---

<p align="center">Friendship First, Competition Second · 友谊第一，比赛第二 · Go Red Foxes! ⚾</p>
