# AGENTS.md - Red Foxes Baseball Team Website

> This file provides essential context for AI coding agents working on this project.
> Last updated: 2026-04-22

---

## Project Overview

This is a **static website** for **烈光少棒赤狐队 (Red Foxes Youth Baseball Team)** featuring:

1. **Navigation Hub** (`index.html`) - Entry point with links to all content
2. **Match Review** (`match_review.html`) - Seven tactical video clips with analysis
3. **U10 Tournament Rules** (`u10_rules.html`) - Complete competition regulations  
4. **Groupstage Analysis** (`tigercup_groupstage.html`) - Multi-AI performance analysis
5. **Finalstage Analysis** (`tigercup_finalstage.html`) - Multi-AI final match analysis
6. **Sponsor Page** (`sponsor_me.html`) - Sponsor support with global like counter (Supabase Edge Function)

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
| Like Counter Backend | Supabase Edge Functions + Postgres + Upstash Redis |

---

## Project Structure

```
redfoxes-baseball/
├── index.html                 # Navigation hub - entry point
├── match_review.html          # Match review page (7 tactical clips, password protected)
├── u10_rules.html             # U10 tournament rules page
├── pony_u10_rules.html        # PONY U10 tournament rules page
├── tigercup_groupstage.html   # Groupstage performance analysis
├── tigercup_finalstage.html   # Finalstage performance analysis
├── sponsor_me.html            # Sponsor page (independent theme, global like widget)
├── site_analytics.js          # Shared Google Analytics bootstrap
├── image_modal.js             # Shared lightbox behavior for zoomable images
├── baseball_theme.css         # Shared baseball field theme CSS
├── rules_style.css            # Shared rules page styling
├── u10_rules.js               # Legacy compatibility stub for older U10 modal script references
├── supabase/                  # Supabase backend for global like counter
│   ├── functions/
│   │   └── sponsor-likes/     # Edge Function API
│   ├── migrations/            # SQL schema + function setup
│   └── README.md              # Deployment and secret guide
├── workers/                   # Legacy Cloudflare Worker implementation
│   ├── sponsor_likes.js       # Legacy Worker script
│   ├── wrangler.toml          # Legacy deployment config
│   └── README.md              # Legacy setup guide
├── README.md                  # Project documentation
├── AGENTS.md                  # This file
├── rfc/
│   ├── 001_like_counter.md    # Like feature architecture design (RFC)
│   └── 002_supabase_like_counter.md # Active Supabase like counter design (RFC)
├── LICENSE                    # CC BY-NC-SA 4.0 License
└── img/                       # Static image assets
    ├── baseball_field_bg.svg  # Aerial baseball field background
    ├── schedule.jpg                  # U10 tournament schedule (猛虎杯)
    ├── pony_u10_tianjin_schedule.png # U10 PONY Tianjin division schedule
    ├── venue_map.jpg                 # Venue map
    ├── groupstage_data.png           # Groupstage match statistics
    ├── finalstage_data.png           # Finalstage match statistics
    └── tigercup_final_ranking.jpg    # Final tournament ranking
```

### File Organization Notes

- **index.html**: Navigation hub with card-based layout
- **match_review.html**: Password protected; links shared `baseball_theme.css` plus inline page-specific styles
- **u10_rules.html** / **pony_u10_rules.html**: Link `baseball_theme.css` + `rules_style.css`; both include schedule images with lightbox support
- **tigercup_groupstage.html** / **tigercup_finalstage.html**: Link `baseball_theme.css` plus inline page-specific styles
- **sponsor_me.html**: Independent styling, does not use baseball field background or floating assets
- **supabase/**: Edge Function and SQL migration for the active global like counter backend
- **workers/**: Legacy Cloudflare implementation retained for reference and rollback
- **baseball_theme.css**: Shared theme variables, body background, resets, and common animations
- **site_analytics.js**: Centralized GA initialization used by all HTML pages
- **image_modal.js**: Shared lightbox behavior used by rules (both U10 and PONY), report, and sponsor pages
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

Uses a shared `baseball_theme.css` with CSS custom properties (variables) for the baseball field theme:
- --grass-vibrant: #4caf50 (Field green)
- --dirt-orange: #e67e22 (Infield dirt)
- --dirt-dark-orange: #d35400 (Dirt shadow)
- --dirt-light-orange: #f39c12 (Scoreboard accent)
- --leather-cream: #fff9e6 (Base leather)
- --leather-tan: #f5e6c8 (Stitch border)
- --stitch-red: #c41e3a (Baseball stitch)
- --fox-red: #c0392b (Team red)
- --color-primary: #c0392b (Primary brand)
- --color-accent: #f39c12 (Accent)
- --color-kimi: #00a8e8 (Kimi blue)
- --color-gemini: #4285f4 (Gemini blue)
- --color-chatgpt: #10a37f (ChatGPT green)

All themed pages link `baseball_theme.css` for the shared background (`img/baseball_field_bg.svg`), resets, and common animations. Page-specific styles remain inline in each HTML file.

### Key CSS Classes

index.html:
- .header - Main header with team branding
- .nav-grid - Grid layout for navigation cards
- .nav-card - Individual navigation card

match_review.html:
- #passwordOverlay - Full-screen password modal
- .video-card - Container for each video clip
- .video-container - 16:9 responsive video wrapper

u10_rules.html / pony_u10_rules.html:
- .page-nav - Sticky navigation bar
- .image-modal - Full-screen image lightbox
- .metric-card - Stats card
- #schedule - Tournament schedule section with image and caption

tigercup_groupstage.html / tigercup_finalstage.html:
- .ai-card - Container for AI analysis
- .ai-card-header.kimi/gemini/chatgpt - Brand colors
- .summary-section - Key metrics summary
- .page-nav - Sticky navigation with cross-page links

sponsor_me.html:
- .like-widget - Like button container
- .like-btn - The 👍 button (toggleable)
- .like-btn.liked - Active/liked state
- .like-count - Live counter display
- .like-label - Supporting text label

### JavaScript Components

site_analytics.js:
- Shared Google Analytics bootstrap (`gtag` + config)

image_modal.js:
- Shared image lightbox/modal behavior
- Supports both report/rules modals and sponsor page zoom modal

u10_rules.js:
- Backward-compatibility stub; shared lightbox behavior now lives in `image_modal.js`

match_review.html:
- Password verification (SHA-256)
- Video autopause with IntersectionObserver

sponsor_me.html:
- Global like counter powered by Supabase Edge Function
- localStorage fallback when the API is unreachable or unconfigured
- IP-based rate limiting (5-second cooldown) via Upstash Redis
- See `rfc/002_supabase_like_counter.md` for the active architecture

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
- Like widget DOM and interaction tests
- Image modal and lightbox coverage

### Deployment

- Platform: GitHub Pages
- Branch: main
- Source: Root directory
- URL: https://ben1009.github.io/redfoxes-baseball/

### Supabase Like Counter Deployment

The active like counter backend lives under `supabase/`:
- SQL migration: `supabase/migrations/20260421_sponsor_likes.sql`
- Edge Function: `supabase/functions/sponsor-likes/index.ts`
- Setup guide: `supabase/README.md`

### Legacy Cloudflare Worker Deployment

The old Worker remains in `workers/` for reference and rollback:
- Workflow: `.github/workflows/deploy-worker.yml`
- Requires repository secret: `CLOUDFLARE_API_TOKEN`
- Manual deploy: `cd workers && npx wrangler deploy`

---

## Security Considerations

### Password Protection
- Client-side only - SHA-256 hash verification
- Not cryptographically secure for sensitive content
- Intended for casual access control only
- Session persists via sessionStorage (cleared on tab close)

### Supabase Edge Function
- CORS is restricted to an explicit `ALLOWED_ORIGINS` whitelist (production GitHub Pages + common local dev ports)
- IP-based rate limiting prefers infrastructure-set headers (`cf-connecting-ip`, `x-real-ip`) over `X-Forwarded-For` to prevent spoofing
- Internal errors are logged server-side; clients receive generic `"Internal server error"` messages
- Write-oriented SQL functions are revoked from `anon`/`public` and granted only to `service_role`

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

### u10_rules.html / pony_u10_rules.html
- Sticky navigation displays and sticks on scroll
- Images display correctly
- Schedule section displays tournament image and caption
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
Modify CSS variables in `baseball_theme.css`. If a page needs an override (e.g. a different border radius), keep the override in that page's inline `:root`.

### Update Google Analytics ID
Replace G-QJ6EXQH8SW in script src and gtag config.

---

## Contact & Attribution

- Author: Project maintainer (see GitHub repository)
- Teams: Red Foxes Youth Baseball Team, Feixue Baseball Team
- Motto: "友谊第一，比赛第二 · 烈光少棒加油" (Friendship First, Competition Second)
