(function () {
    'use strict';

    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DURATION = 1200;

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function animateValue(el, target, prefix, suffix, decimalPlaces) {
        const start = performance.now();

        function step(now) {
            const progress = Math.min((now - start) / DURATION, 1);
            const current = target * easeOutQuart(progress);
            const formatted = decimalPlaces > 0
                ? current.toFixed(decimalPlaces)
                : Math.round(current).toString();
            el.textContent = prefix + formatted + suffix;

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                // Ensure final value is exact
                const final = decimalPlaces > 0
                    ? target.toFixed(decimalPlaces)
                    : Math.round(target).toString();
                el.textContent = prefix + final + suffix;
            }
        }

        requestAnimationFrame(step);
    }

    function init() {
        const elements = document.querySelectorAll('.metric-value');
        if (!elements.length) return;

        if (REDUCED_MOTION) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const text = el.textContent || '';
                    const match = text.match(/^(.*?)(\d+(?:\.\d+)?)(.*)$/);
                    if (match) {
                        const prefix = match[1];
                        const target = parseFloat(match[2]);
                        const suffix = match[3];
                        const decimalPlaces = (match[2].split('.')[1] || '').length;
                        if (!isNaN(target)) {
                            animateValue(el, target, prefix, suffix, decimalPlaces);
                        }
                    }
                    observer.unobserve(el);
                }
            });
        }, {
            threshold: 0.3,
            rootMargin: '0px 0px -30px 0px'
        });

        elements.forEach(el => observer.observe(el));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
