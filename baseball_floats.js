(function () {
    const BALL_COUNT = 7;
    const EDGE_PADDING = 18;
    const MIN_SPEED = 0.08;
    const MAX_SPEED = 0.2;
    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    function createBall(index, viewportWidth, viewportHeight) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'floating-baseball';
        element.setAttribute('aria-label', '弹跳棒球');
        element.textContent = '⚾';

        const size = Math.round(randomBetween(38, 56));
        element.style.setProperty('--ball-size', `${size}px`);
        element.style.setProperty('--ball-size-mobile', `${Math.max(32, size - 10)}px`);

        const horizontalBand = index % 2 === 0;
        const x = horizontalBand
            ? randomBetween(EDGE_PADDING, Math.max(EDGE_PADDING + 1, viewportWidth - size - EDGE_PADDING))
            : (index % 4 === 1 ? randomBetween(EDGE_PADDING, 90) : randomBetween(Math.max(EDGE_PADDING, viewportWidth - size - 90), viewportWidth - size - EDGE_PADDING));
        const y = horizontalBand
            ? (index % 4 === 0 ? randomBetween(EDGE_PADDING, 120) : randomBetween(Math.max(EDGE_PADDING, viewportHeight - size - 140), viewportHeight - size - EDGE_PADDING))
            : randomBetween(EDGE_PADDING, Math.max(EDGE_PADDING + 1, viewportHeight - size - EDGE_PADDING));

        const vx = (Math.random() > 0.5 ? 1 : -1) * randomBetween(MIN_SPEED, MAX_SPEED);
        const vy = (Math.random() > 0.5 ? 1 : -1) * randomBetween(MIN_SPEED, MAX_SPEED);

        return { element, x, y, size, vx, vy };
    }

    function mountFloatingBaseballs() {
        const layer = document.createElement('div');
        layer.className = 'floating-baseball-layer';
        document.body.appendChild(layer);

        let viewportWidth = window.innerWidth;
        let viewportHeight = window.innerHeight;
        const balls = Array.from({ length: BALL_COUNT }, (_, index) => {
            const ball = createBall(index, viewportWidth, viewportHeight);
            layer.appendChild(ball.element);

            return ball;
        });

        function clampBall(ball) {
            const maxX = Math.max(EDGE_PADDING, viewportWidth - ball.size - EDGE_PADDING);
            const maxY = Math.max(EDGE_PADDING, viewportHeight - ball.size - EDGE_PADDING);

            if (ball.x <= EDGE_PADDING) {
                ball.x = EDGE_PADDING;
                ball.vx = Math.abs(ball.vx);
            } else if (ball.x >= maxX) {
                ball.x = maxX;
                ball.vx = -Math.abs(ball.vx);
            }

            if (ball.y <= EDGE_PADDING) {
                ball.y = EDGE_PADDING;
                ball.vy = Math.abs(ball.vy);
            } else if (ball.y >= maxY) {
                ball.y = maxY;
                ball.vy = -Math.abs(ball.vy);
            }
        }

        function animate() {
            balls.forEach((ball) => {
                if (!REDUCED_MOTION) {
                    ball.x += ball.vx;
                    ball.y += ball.vy;
                    ball.vx *= 0.993;
                    ball.vy *= 0.993;

                    if (Math.abs(ball.vx) < MIN_SPEED) {
                        ball.vx = Math.sign(ball.vx || 1) * MIN_SPEED;
                    }

                    if (Math.abs(ball.vy) < MIN_SPEED) {
                        ball.vy = Math.sign(ball.vy || 1) * MIN_SPEED;
                    }
                }

                clampBall(ball);
                ball.element.style.transform = `translate3d(${ball.x}px, ${ball.y}px, 0)`;
            });

            requestAnimationFrame(animate);
        }

        window.addEventListener('resize', () => {
            viewportWidth = window.innerWidth;
            viewportHeight = window.innerHeight;
            balls.forEach(clampBall);
        });

        requestAnimationFrame(animate);
    }

    window.addEventListener('load', mountFloatingBaseballs);
})();
