/* ============================================================
   LED Technica — shared interactions
   - theme toggle (light/dark/system, persisted)
   - scroll-driven floating logo morph (home page only)
   - TOC scrollspy (article page)
   ============================================================ */

(function () {
  const THEME_KEY = 'ledtechnica:theme';
  function applyTheme(mode) {
    const html = document.documentElement;
    const isDark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    html.classList.toggle('dark', isDark);
    html.dataset.themeMode = mode;
    document.querySelectorAll('[data-theme-btn]').forEach(b => {
      b.dataset.active = String(b.dataset.themeBtn === mode);
    });
  }
  window.__getTheme = () => localStorage.getItem(THEME_KEY) || 'system';
  window.__setTheme = (m) => { localStorage.setItem(THEME_KEY, m); applyTheme(m); };
  // Apply asap
  applyTheme(window.__getTheme());
  // Watch OS changes while in 'system' mode
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (window.__getTheme() === 'system') applyTheme('system');
  });

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(window.__getTheme());

    // ----- Theme toggle clicks -----
    document.querySelectorAll('[data-theme-btn]').forEach(b => {
      b.addEventListener('click', () => window.__setTheme(b.dataset.themeBtn));
    });

    // ----- Scroll-driven floating logo (home) -----
    const floater = document.querySelector('.logo-floater');
    const navbar = document.querySelector('[data-navbar]');
    const stage = document.querySelector('[data-logo-stage]');
    const slot = document.querySelector('[data-logo-slot]');

    if (floater && stage && slot && navbar) {
      function tick() {
        const stageRect = stage.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        const startW = 168, endW = 38;
        const total = stage.offsetHeight - 80;
        const progress = Math.max(0, Math.min(1, -stageRect.top / total));

        const w = startW + (endW - startW) * progress;
        const startX = stageRect.left + stageRect.width / 2;
        const startY = stageRect.top + stageRect.height / 2;
        const endX = slotRect.left + slotRect.width / 2;
        const endY = slotRect.top + slotRect.height / 2;
        const cx = startX + (endX - startX) * progress;
        const cy = startY + (endY - startY) * progress;

        floater.style.width = w + 'px';
        floater.style.height = w + 'px';
        floater.style.marginLeft = (-w/2) + 'px';
        floater.style.marginTop = (-w/2) + 'px';
        floater.style.top = cy + 'px';
        floater.style.left = cx + 'px';
        floater.style.transform = 'none';

        if (progress > 0.6) floater.dataset.mode = 'pinned';
        else delete floater.dataset.mode;

        if (progress > 0.5) navbar.dataset.pinned = 'true';
        else delete navbar.dataset.pinned;
      }
      tick();
      window.addEventListener('scroll', tick, { passive: true });
      window.addEventListener('resize', tick);
    } else if (navbar) {
      navbar.dataset.pinned = 'true';
    }

    // ----- TOC scrollspy -----
    const tocLinks = document.querySelectorAll('[data-toc] a[href^="#"]');
    if (tocLinks.length) {
      const headings = [...tocLinks].map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
      function spy() {
        let active = headings[0];
        for (const h of headings) if (h.getBoundingClientRect().top < 140) active = h;
        tocLinks.forEach(a => a.dataset.active = String(a.getAttribute('href').slice(1) === (active?.id || '')));
      }
      spy();
      window.addEventListener('scroll', spy, { passive: true });
    }
  });
})();
