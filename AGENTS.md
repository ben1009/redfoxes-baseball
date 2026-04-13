# AGENTS.md - Red Foxes Baseball Team Website

> This file provides essential context for AI coding agents working on this project.
> Last updated: 2026-04-13

---

## Project Overview

This is a **static website** for **烈光少棒赤狐队 (Red Foxes Youth Baseball Team)** featuring:

1. **Navigation Hub** (`index.html`) - Entry point with links to all content
2. **Match Review** (`match_review.html`) - Seven tactical video clips with analysis
3. **U10 Tournament Rules** (`u10_rules.html`) - Complete competition regulations  
4. **Groupstage Analysis** (`tigercup_groupstage.html`) - Multi-AI performance analysis
5. **Finalstage Analysis** (`tigercup_finalstage.html`) - Multi-AI final match analysis

- **Live Site**: https://ben1009.github.io/redfoxes-baseball/
- **Language**: Chinese (Simplified)
- **Target Audience**: Youth baseball players, coaches, and parents
- **License**: CC BY-NC-SA 4.0

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Markup | HTML5 |
| Styling | CSS3 (embedded, no preprocessor) |
| Scripting | Vanilla JavaScript (ES6+) |
| Fonts | Google Fonts (Noto Serif SC, Segoe UI) |
| Video Hosting | Bilibili iframe embedding |
| Analytics | Google Analytics 4 (G-QJ6EXQH8SW) |
| Deployment | GitHub Pages |
| Testing | Jest + Puppeteer |

---

## Project Structure

```
redfoxes-baseball/
├── index.html                 # Navigation hub - entry point
├── match_review.html          # Match review page (7 tactical clips, password protected)
├── u10_rules.html             # U10 tournament rules page
├── tigercup_groupstage.html   # Groupstage performance analysis
├── tigercup_finalstage.html   # Finalstage performance analysis
├── u10_rules.js               # U10 page JavaScript (image modal)
├── README.md                  # Project documentation
├── AGENTS.md                  # This file
├── LICENSE                    # CC BY-NC-SA 4.0 License
└── img/                       # Static image assets
    ├── 01_本垒打_主图.png ... 16_称霸全国_主图.png
    ├── schedule.jpg           # U10 tournament schedule
    ├── venue_map.jpg          # Venue map
    ├── groupstage_data.png    # Groupstage match statistics
    ├── finalstage_data.png    # Finalstage match statistics
    └── tigercup_final_ranking.jpg  # Final tournament ranking
```

### File Organization Notes

- **index.html**: Navigation hub with card-based layout
- **match_review.html**: Single-file architecture (HTML + CSS + JS), password protected
- **u10_rules.html**: External CSS in style tag, external JS via u10_rules.js
- **tigercup_groupstage.html**: Multi-AI analysis page with tables
- **tigercup_finalstage.html**: Multi-AI final analysis page with tables, match scores, and ranking image
- No build process or bundling required
- No framework dependencies

---

## Code Organization

### HTML Structure (index.html) - Navigation Hub

```html
<!DOCTYPE html>
├── head
│   ├── Favicon (SVG data URI with fox emoji)
│   ├── Google Analytics 4 (gtag.js)
│   └── style (CSS embedded with CSS variables)
├── body
│   ├── header (Team logo, name, motto)
│   ├── nav class="nav-grid" (3 navigation cards)
│   └── footer (Copyright)
```

### HTML Structure (match_review.html)

Single-file architecture with embedded CSS and JavaScript.
- Password protection modal (#passwordOverlay)
- Main content with 7 video cards
- Video autopause functionality

### HTML Structure (tigercup_groupstage.html)

- Data image section
- Summary section with key metrics
- Kimi analysis card
- Gemini analysis card
- ChatGPT analysis card
- Image modal for lightbox

### CSS Architecture

Uses CSS custom properties (variables) for theming:
- --color-primary: #8B4513 (Saddle brown)
- --color-accent: #c41e3a (Crimson red)
- --color-bg-dark: #1e3c2f (Dark green)
- --color-paper: #f5f1e8 (Paper background)
- --color-kimi: #00a8e8 (Kimi blue)
- --color-gemini: #4285f4 (Gemini blue)
- --color-chatgpt: #10a37f (ChatGPT green)

### Key CSS Classes

index.html:
- .header - Main header with team branding
- .nav-grid - Grid layout for navigation cards
- .nav-card - Individual navigation card

match_review.html:
- #passwordOverlay - Full-screen password modal
- .video-card - Container for each video clip
- .video-container - 16:9 responsive video wrapper

u10_rules.html:
- .page-nav - Sticky navigation bar
- .image-modal - Full-screen image lightbox
- .metric-card - Stats card

tigercup_groupstage.html / tigercup_finalstage.html:
- .ai-card - Container for AI analysis
- .ai-card-header.kimi/gemini/chatgpt - Brand colors
- .summary-section - Key metrics summary
- .page-nav - Sticky navigation with cross-page links

### JavaScript Components

u10_rules.js:
- Image Modal/Lightbox functionality
- Navigation smooth scroll

match_review.html:
- Password verification (SHA-256)
- Video autopause with IntersectionObserver

**Password**: 4-digit year (SHA-256 hashed: "1972")
**Hint**: "张锦新 哪年开始接触从事棒球运动？"

---

## Build and Deployment

### Local Development

No build step required. Serve the file directly:
```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .
```

### Running Tests

```bash
npm install
npm test
```

Tests include:
- Page structure and navigation tests
- Video autopause functionality tests
- Cross-page link verification
- File existence checks

### Deployment

- Platform: GitHub Pages
- Branch: main
- Source: Root directory
- URL: https://ben1009.github.io/redfoxes-baseball/

---

## Security Considerations

### Password Protection
- Client-side only - SHA-256 hash verification
- Not cryptographically secure for sensitive content
- Intended for casual access control only
- Session persists via sessionStorage (cleared on tab close)

---

## Testing Checklist

### index.html (Navigation Hub)
- Header displays team logo and motto
- 5 navigation cards are present and clickable
- All links navigate to correct pages
- Responsive layout works on mobile

### match_review.html
- Password overlay displays correctly
- Password "1972" unlocks content
- All 7 video iframes load without errors
- Video autopause feature works when scrolling

### u10_rules.html
- Sticky navigation displays and sticks on scroll
- Images display correctly
- Image click opens lightbox/modal
- Modal closes properly

### tigercup_groupstage.html
- Data image displays correctly
- All 3 AI analysis cards are present
- Tables render correctly on mobile
- Navigation links work (including cross-page links to index and finalstage)

### tigercup_finalstage.html
- Data image and final ranking image display correctly
- Match score records are present
- All 3 AI analysis cards are present
- Tables render correctly on mobile
- Navigation links work (including cross-page links to index and groupstage)

### General
- Responsive layout works on mobile (320px+)
- No console errors
- Chinese characters display correctly
- Favicon displays in browser tab
- All tests pass (npm test)

---

## License Compliance

This project uses CC BY-NC-SA 4.0:
- Share - Copy and redistribute
- Adapt - Remix and build upon
- Attribution - Give credit
- NonCommercial - No commercial use
- ShareAlike - Same license for derivatives

---

## Common Tasks

### Add New Page to Navigation
Update index.html navigation grid with a new nav-card element.

### Update Password
1. Generate new SHA-256 hash of 4-digit year
2. Update PASSWORD_HASH constant in match_review.html
3. Update hint text in password overlay

### Change Color Theme
Modify CSS variables in :root across all HTML files.

### Update Google Analytics ID
Replace G-QJ6EXQH8SW in script src and gtag config.

---

## Contact & Attribution

- Author: Project maintainer (see GitHub repository)
- Teams: Red Foxes Youth Baseball Team, Feixue Baseball Team
- Motto: "友谊第一，比赛第二 · 烈光少棒加油" (Friendship First, Competition Second)
