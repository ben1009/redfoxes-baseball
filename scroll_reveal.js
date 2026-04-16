(function () {
    'use strict';

    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function revealAll(elements) {
        elements.forEach(el => el.classList.add('is-visible'));
    }

    function init() {
        const elements = document.querySelectorAll('[data-reveal]');
        if (!elements.length) return;

        if (REDUCED_MOTION) {
            revealAll(elements);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.05,
            rootMargin: '0px 0px 50px 0px'
        });

        elements.forEach(el => observer.observe(el));

        // Safety net 1: reveal any remaining elements after 3 seconds
        setTimeout(() => {
            revealAll(Array.from(elements).filter(el => !el.classList.contains('is-visible')));
        }, 3000);

        // Safety net 2: check viewport position after scroll stops (Safari iOS fallback)
        let scrollTimeout;
        function onScroll() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                elements.forEach(el => {
                    if (el.classList.contains('is-visible')) return;
                    const rect = el.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        el.classList.add('is-visible');
                    }
                });
            }, 150);
        }
        window.addEventListener('scroll', onScroll, { passive: true });

        // Safety net 3: reveal all if page is already near bottom on load
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
            setTimeout(() => revealAll(elements), 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
