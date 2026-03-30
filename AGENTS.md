# AGENTS.md - Red Foxes Baseball Match Review

> This file provides essential context for AI coding agents working on this project.
> Last updated: 2026-03-30

---

## Project Overview

This is a **static website** for reviewing a youth baseball friendship match between Red Foxes (烈光) and Feixue (飞雪) teams. The website presents seven tactical video clips with detailed analysis, rule explanations, and coaching suggestions.

- **Live Site**: https://ben1009.github.io/redfoxes-baseball/
- **Language**: Chinese (Simplified)
- **Target Audience**: Youth baseball players, coaches, and parents
- **License**: CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International)

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Markup | HTML5 |
| Styling | CSS3 (embedded, no preprocessor) |
| Scripting | Vanilla JavaScript (ES6+, embedded) |
| Fonts | Google Fonts (Noto Serif SC) |
| Video Hosting | Bilibili iframe embedding |
| Analytics | Google Analytics 4 (G-QJ6EXQH8SW) |
| Deployment | GitHub Pages |

### External Dependencies

- **Google Fonts**: `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap`
- **Bilibili Player**: `https://player.bilibili.com/player.html` (7 embedded videos)
- **Google Analytics**: `https://www.googletagmanager.com/gtag/js?id=G-QJ6EXQH8SW`

---

## Project Structure

```
redfoxes-baseball/
├── index.html          # Single-file application (HTML + CSS + JS)
├── README.md           # Project documentation (Chinese)
├── LICENSE             # CC BY-NC-SA 4.0 full text
├── AGENTS.md           # This file
└── img/                # Static image assets (16 PNG files)
    ├── 01_本垒打_主图.png
    ├── 02_盗垒成功_主图.png
    ├── ... (16 total decorative images)
    └── 16_称霸全国_主图.png
```

### File Organization Notes

- **Single-file architecture**: All HTML, CSS, and JavaScript are contained in `index.html`
- No build process or bundling required
- No package managers (npm, pip, cargo, etc.)
- No framework dependencies

---

## Code Organization

### HTML Structure (`index.html`)

```html
<!DOCTYPE html>
├── <head>
│   ├── Favicon (SVG data URI with 🦊 emoji)
│   ├── Google Analytics 4 (gtag.js)
│   ├── Google Fonts preconnect
│   └── <style> (CSS embedded, ~280 lines)
├── <body>
│   ├── #passwordOverlay (Password protection modal)
│   ├── #mainContent
│   │   ├── <header> (Page title and match info)
│   │   ├── <main>
│   │   │   └── 7× <article class="video-card"> (Video clips)
│   │   └── <footer> (Team logos and slogan)
│   └── <script> (JavaScript embedded, ~55 lines)
```

### CSS Architecture

Uses **CSS custom properties (variables)** for theming:

```css
:root {
    --color-primary: #8B4513;    /* Saddle brown - baseball theme */
    --color-accent: #DC143C;      /* Crimson red - accent */
    --color-bg-dark: #2d5a27;     /* Dark green - field */
    --color-bg-darker: #1a3d17;   /* Darker green */
    --color-text: #555;
    --color-text-light: #fafafa;
    --font-serif: 'Noto Serif SC', serif;
    --font-mono: 'Courier New', monospace;
    --font-sans: -apple-system, ...;
}
```

### Key CSS Classes

| Class | Purpose |
|-------|---------|
| `#passwordOverlay` | Full-screen password modal |
| `.video-card` | Container for each video clip |
| `.video-container` | 16:9 responsive video wrapper |
| `.tactic-highlight` | Red emphasized tactic titles |
| `.mistake-point` | Red-left-border mistake analysis |
| `.rule-highlight` | Blue-left-border rule explanation |

### JavaScript Components

```javascript
// Password verification (SHA-256)
const PASSWORD_HASH = '0a95adbf8581859ae0cc477127abeaf4ad89916405c41855af8fbc482e1634e8';

// Key functions:
- sha256(message)           // Hash calculation using Web Crypto API
- checkPassword()           // Verify and show content
- Event listeners           // Enter key support, session persistence
```

**Password**: 4-digit year (SHA-256 hashed: "1972")
**Hint**: "张锦新 哪年开始接触从事棒球运动？" (When did Zhang Jinxin start playing baseball?)

---

## Build and Deployment

### Local Development

No build step required. Serve the file directly:

```bash
# Python 3
python -m http.server 8000

# Node.js (if installed)
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000`

### Deployment

- **Platform**: GitHub Pages
- **Branch**: `main` (or `master`)
- **Source**: Root directory
- **URL**: https://ben1009.github.io/redfoxes-baseball/

Simply push to GitHub; GitHub Pages will auto-deploy.

---

## Code Style Guidelines

### HTML
- Semantic elements: `<article>`, `<header>`, `<main>`, `<footer>`
- Chinese comments for section headers
- `target="_blank"` on base element (all links open in new tab)

### CSS
- Mobile-first responsive design
- CSS Grid and Flexbox for layout
- BEM-like naming: `.video-card`, `.video-header`, `.video-container`
- Organized in sections with comment blocks:
  ```css
  /* ============================================
     Password Overlay
     ============================================ */
  ```

### JavaScript
- ES6+ features: `async/await`, arrow functions, `const/let`
- Web Crypto API for SHA-256: `crypto.subtle.digest()`
- Session storage for auth persistence: `sessionStorage.setItem('baseball_auth', 'true')`
- JSDoc-style comments for functions

---

## Content Management

### Adding New Video Clips

To add a new tactical clip, insert a new `<article class="video-card">`:

```html
<article class="video-card">
    <div class="video-header">
        <img src="img/XX_标题_主图.png" alt="描述">
        <span class="video-title-text">片段X：标题</span>
    </div>
    <div class="video-container">
        <iframe 
            src="https://player.bilibili.com/player.html?bvid=BVxxxxx&page=1&high_quality=1&danmaku=0&autoplay=0" 
            scrolling="no" 
            frameborder="0" 
            allowfullscreen 
            sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts"
        ></iframe>
    </div>
    <div class="video-desc">
        <span class="tactic-highlight">📋 标题</span>
        <!-- Analysis content -->
        <div class="mistake-point"><strong>问题：</strong>...</div>
        <div class="rule-highlight"><strong>规则：</strong>...</div>
    </div>
</article>
```

### Bilibili Video Parameters

- `bvid`: Bilibili video ID
- `page=1`: Video page number
- `high_quality=1`: High quality playback
- `danmaku=0`: Disable bullet comments
- `autoplay=0`: No auto-play

---

## Security Considerations

### Password Protection
- **Client-side only** - SHA-256 hash verification
- Not cryptographically secure for sensitive content
- Intended for casual access control only
- Session persists via `sessionStorage` (cleared on tab close)

### iframe Sandboxing
Bilibili iframes use restrictive sandbox:
```html
sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts"
```

---

## Testing Checklist

Before committing changes:

- [ ] Password overlay displays correctly
- [ ] Password "1972" unlocks content
- [ ] All 7 video iframes load without errors
- [ ] Responsive layout works on mobile (320px+)
- [ ] Images in `img/` folder load correctly
- [ ] No console errors
- [ ] Chinese characters display correctly (Google Fonts loaded)
- [ ] Favicon (🦊) displays in browser tab
- [ ] Google Analytics is tracking (check GA dashboard)

---

## License Compliance

This project uses **CC BY-NC-SA 4.0**:

- ✅ **Share** — Copy and redistribute
- ✅ **Adapt** — Remix and build upon
- 📝 **Attribution** — Give credit
- 🚫 **NonCommercial** — No commercial use
- 🔄 **ShareAlike** — Same license for derivatives

**When modifying**: Update copyright notices and maintain license terms.

---

## Common Tasks

### Update Password
1. Generate new SHA-256 hash of 4-digit year
2. Update `PASSWORD_HASH` constant in `<script>`
3. Update hint text in password overlay

### Change Color Theme
Modify CSS variables in `:root`:
```css
--color-primary: #newColor;    /* Main brand color */
--color-accent: #newAccent;     /* Highlight color */
```

### Add More Videos
Follow the 7 existing `<article>` patterns in `<main>`.

### Update Google Analytics ID
1. Replace `G-QJ6EXQH8SW` in both the script src URL and the gtag config

### Change Favicon
Replace the SVG data URI in the `<link rel="icon">` tag with a new emoji or image.

---

## Contact & Attribution

- **Author**: Project maintainer (see GitHub repository)
- **Teams**: Red Foxes Youth Baseball Team, Feixue Baseball Team
- **Motto**: "友谊第一，比赛第二 · 烈光少棒加油" (Friendship First, Competition Second)
