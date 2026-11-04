/* ==========================================================================
   AZZARO — Polimento final (elementos globais)
   - Scrollspy: nav e régua de seções marcam a dobra atual.
   - Régua: linha de progresso da página inteira.
   - Cursor-mira: anel que segue o ponteiro com atraso e "trava" em links/botões.
   - Toast ao abrir a loja; divisor dourado que se desenha entre as dobras.
   ========================================================================== */
(() => {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* ======================================================================
       1. SCROLLSPY + PROGRESSO DA PÁGINA
       ====================================================================== */
    const sections = ['hero', 'wanted', 'desejo'].map(id => document.getElementById(id)).filter(Boolean);
    const spyLinks = $$('[data-spy]');
    const railFill = $('#pageRailFill');
    let current = '';
    let ticking = false;

    function readScroll() {
        ticking = false;
        const line = innerHeight * 0.5;
        let id = sections[0].id;
        for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id;
        if (id !== current) {
            current = id;
            spyLinks.forEach(a => {
                const on = a.dataset.spy === id;
                a.classList.toggle('is-current', on);
                if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
            });
        }
        const max = document.documentElement.scrollHeight - innerHeight;
        if (railFill) railFill.style.setProperty('--p', (max > 0 ? scrollY / max : 0).toFixed(4));
    }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(readScroll); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    readScroll();

    /* ======================================================================
       2. CURSOR-MIRA (apenas ponteiro fino, sem movimento reduzido)
       ====================================================================== */
    function initCursor() {
        const cursor = $('#cursor');
        if (!cursor || !FINE || REDUCED) return;
        const ring = $('.cursor-ring', cursor);
        const dot = $('.cursor-dot', cursor);
        const HOT = 'a, button, [role="button"], .w-card, .d-notes li';

        let x = -100, y = -100, rx = -100, ry = -100, raf = 0;

        function loop() {
            rx += (x - rx) * 0.18;
            ry += (y - ry) * 0.18;
            ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
            raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
        }

        addEventListener('pointermove', e => {
            if (e.pointerType !== 'mouse') return;
            x = e.clientX; y = e.clientY;
            dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            cursor.classList.add('on');
            cursor.classList.toggle('is-hover', !!(e.target.closest && e.target.closest(HOT)));
            if (!raf) raf = requestAnimationFrame(loop);
        }, { passive: true });

        addEventListener('pointerdown', () => cursor.classList.add('is-down'), { passive: true });
        addEventListener('pointerup', () => cursor.classList.remove('is-down'), { passive: true });
        document.documentElement.addEventListener('pointerleave', () => cursor.classList.remove('on'));
        addEventListener('blur', () => cursor.classList.remove('on'));
    }

    /* ======================================================================
       3. TOAST (DS .toast)
       ====================================================================== */
    const toastEl = $('#toast');
    let toastTimer = 0;
    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add('on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2400);
    }
    const buy = $('#dCta');
    if (buy) buy.addEventListener('click', () => toast('Abrindo azzaro.com em uma nova aba ↗'));

    /* ======================================================================
       4. DIVISOR ENTRE DOBRAS: desenha ao entrar, desfaz ao sair
       ====================================================================== */
    const divider = $('#secDivider');
    if (divider) {
        if (REDUCED || !('IntersectionObserver' in window)) divider.classList.add('in');
        else new IntersectionObserver(([en]) => divider.classList.toggle('in', en.isIntersecting), { threshold: 1, rootMargin: '0px 0px -12% 0px' }).observe(divider);
    }

    initCursor();
})();
