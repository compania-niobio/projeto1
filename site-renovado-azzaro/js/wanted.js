/* ==========================================================================
   AZZARO — Dobra II · Azzaro Wanted
   - Entrada coreografada por blocos (texto, frasco, cards) quando entram na tela;
     a saída é a mesma coreografia em reverso, acelerada, ao voltar para o filme.
   - Paralaxe presa ao scroll (frasco, tambor e texto em planos diferentes).
   - Poeira dourada em canvas, ativa só com a dobra visível.
   - Ponteiro fino: inclinação 3D do frasco, luz nos tambores e lanterna nos cards.
   Sem GSAP, tudo permanece visível e estático (os estados iniciais são do JS).
   ========================================================================== */
(() => {
    'use strict';

    const section = document.getElementById('wanted');
    if (!section) return;

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
    const gsap = window.gsap;

    const stage = $('#wStage');
    const copy = $('#wCopy');
    const cardsWrap = $('.w-cards-wrap', section);

    /* ======================================================================
       1. LINKS DO MENU → DOBRAS II e III ([data-scroll-to])
       ====================================================================== */
    $$('[data-scroll-to]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const target = $(a.dataset.scrollTo);
            if (!target) return;
            const keyboard = e.detail === 0;
            if (a.closest('#menu')) { const close = $('#menuClose'); if (close) close.click(); }
            setTimeout(() => {
                const lenis = window.azzaroLenis;
                if (lenis) lenis.scrollTo(target, { duration: REDUCED ? 0 : 2.4, immediate: REDUCED, force: true });
                else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
                if (keyboard) {
                    const h = $('h1, h2', target) || target;
                    h.setAttribute('tabindex', '-1');
                    h.focus({ preventScroll: true });
                }
            }, 140);
        });
    });

    /* ======================================================================
       2. POEIRA DOURADA (canvas)
       ====================================================================== */
    function initDust() {
        const cv = $('#wDust');
        if (!cv || REDUCED) return;
        const ctx = cv.getContext('2d');
        if (!ctx) return;

        // Sprite pré-renderizado: um brilho radial dourado
        const sprite = document.createElement('canvas');
        sprite.width = sprite.height = 32;
        const sc = sprite.getContext('2d');
        const g = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, 'rgba(251,245,220,1)');
        g.addColorStop(0.25, 'rgba(231,204,140,.85)');
        g.addColorStop(0.6, 'rgba(235,145,11,.25)');
        g.addColorStop(1, 'rgba(235,145,11,0)');
        sc.fillStyle = g;
        sc.fillRect(0, 0, 32, 32);

        let w = 0, h = 0, dpr = 1, raf = 0, visible = false, last = 0;
        const parts = [];
        const count = () => (w < 480 ? 26 : 48);

        const spawn = (p, initial) => {
            p.x = w * (0.18 + Math.random() * 0.64);
            p.y = initial ? Math.random() * h : h * (0.82 + Math.random() * 0.2);
            p.s = 2 + Math.random() * 5.5;                 // tamanho
            p.v = 9 + Math.random() * 22;                  // subida (px/s)
            p.a = 0;                                       // alfa atual
            p.max = 0.25 + Math.random() * 0.6;
            p.ph = Math.random() * Math.PI * 2;            // fase do balanço
            p.sw = 6 + Math.random() * 18;                 // amplitude do balanço
            p.life = 0;
            p.ttl = 4 + Math.random() * 6;
            return p;
        };

        function resize() {
            const r = cv.getBoundingClientRect();
            dpr = Math.min(2, devicePixelRatio || 1);
            w = r.width; h = r.height;
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            while (parts.length < count()) parts.push(spawn({}, true));
            parts.length = count();
        }

        function tick(t) {
            raf = visible ? requestAnimationFrame(tick) : 0;
            const dt = Math.min(0.05, (t - (last || t)) / 1000);
            last = t;
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';
            for (const p of parts) {
                p.life += dt;
                p.y -= p.v * dt;
                const k = p.life / p.ttl;
                p.a = p.max * Math.sin(Math.min(1, k) * Math.PI);          // nasce e apaga suavemente
                const x = p.x + Math.sin(p.ph + p.life * 0.9) * p.sw;
                const tw = 0.7 + 0.3 * Math.sin(p.life * 6 + p.ph);       // cintilação
                ctx.globalAlpha = Math.max(0, p.a * tw);
                ctx.drawImage(sprite, x - p.s, p.y - p.s, p.s * 2, p.s * 2);
                if (k >= 1 || p.y < -10) spawn(p, false);
            }
            ctx.globalAlpha = 1;
        }

        resize();
        new ResizeObserver(resize).observe(cv);
        new IntersectionObserver(([en]) => {
            visible = en.isIntersecting;
            if (visible && !raf) { last = 0; raf = requestAnimationFrame(tick); }
        }, { rootMargin: '120px' }).observe(stage);
    }

    /* ======================================================================
       3. COREOGRAFIA (GSAP)
       ====================================================================== */
    /** Toca ao entrar; ao voltar para cima, reverte mais rápido (saída). */
    function bindReveal(trigger, tl, start = 'top 78%') {
        ScrollTrigger.create({
            trigger, start,
            onEnter: () => tl.timeScale(1).play(),
            onLeaveBack: () => tl.timeScale(1.9).reverse(),
        });
    }

    const setDraw = els => gsap.set(els, { strokeDashoffset: 60 });

    function buildCopy() {
        const Y = REDUCED ? 0 : 1;
        const count = $('#wCount');
        const n = { v: 0 };
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

        tl.from('.w-top > .t-label', { autoAlpha: 0, y: 14 * Y, duration: 0.8, stagger: 0.08 }, 0)
          .from('.w-top-rule', { scaleX: 0, duration: 1.6, ease: 'expo.out' }, 0)
          .from('.w-kicker', { autoAlpha: 0, y: 16 * Y, duration: 0.8 }, 0.1)
          .from('.w-line-in', { yPercent: 110 * Y, rotate: 2 * Y, autoAlpha: REDUCED ? 0 : 1, duration: 1.3, stagger: 0.12, ease: 'expo.out' }, 0.15)
          .from('.w-stat', { autoAlpha: 0, y: 22 * Y, duration: 0.9 }, 0.45)
          .fromTo(n, { v: 0 }, {
              v: 3, duration: 1.1, ease: 'power2.out',
              onUpdate: () => { count.textContent = String(Math.round(n.v)).padStart(2, '0'); },
          }, 0.5)
          .from('.w-lede', { autoAlpha: 0, y: 20 * Y, filter: REDUCED ? 'none' : 'blur(8px)', duration: 1 }, 0.6)
          .from('[data-w="perk"]', { autoAlpha: 0, x: -18 * Y, duration: 0.8, stagger: 0.1 }, 0.75);

        const perkDraw = $$('.w-perks .w-draw');
        setDraw(perkDraw);
        tl.to(perkDraw, { strokeDashoffset: 0, duration: 1.2, stagger: 0.05, ease: 'power2.inOut' }, 0.85);

        bindReveal(copy, tl);
    }

    function buildStage() {
        const Y = REDUCED ? 0 : 1;
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
        const sheen = $('.w-sheen', section);

        tl.from('#wRing', { autoAlpha: 0, scale: REDUCED ? 1 : 0.72, rotation: -70 * Y, duration: 2 }, 0)
          .from('.w-halo', { autoAlpha: 0, scale: REDUCED ? 1 : 0.5, duration: 1.8 }, 0.1)
          .from('#wBottle', {
              autoAlpha: 0, yPercent: 16 * Y, scale: REDUCED ? 1 : 0.92,
              filter: REDUCED ? 'none' : 'blur(14px) brightness(.35)', duration: 1.7,
              clearProps: 'filter',
          }, 0.15)
          .from('.w-floor', { scaleX: 0, autoAlpha: 0, duration: 1.4 }, 0.5)
          .from('.w-dust', { autoAlpha: 0, duration: 1.2, ease: 'none' }, 0.6);

        if (!REDUCED) {
            tl.fromTo(sheen, { backgroundPosition: '130% 0' }, { backgroundPosition: '-30% 0', duration: 1.3, ease: 'power2.inOut' }, 1.05);
        }

        $$('.w-callout', section).forEach((c, i) => {
            const at = 1.1 + i * 0.16;
            const left = c.classList.contains('left');
            tl.from($('.dot', c), { scale: 0, duration: 0.7, ease: 'back.out(3)' }, at)
              .from($('.lead', c), { scaleX: 0, duration: 0.7, ease: 'power3.inOut' }, at + 0.1)
              .from($('.t-label', c), { autoAlpha: 0, x: (left ? 12 : -12) * Y, duration: 0.7, ease: 'power3.out' }, at + 0.3);
        });

        bindReveal(stage, tl, 'top 82%');

        // Paralaxe: frasco sobe mais devagar que a página, tambor gira com o scroll
        if (!REDUCED) {
            gsap.fromTo('#wParallax', { y: 70 }, {
                y: -40, ease: 'none',
                scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
            });
            gsap.fromTo('.w-ring-chambers', { rotation: -30, svgOrigin: '200 200' }, {
                rotation: 90, svgOrigin: '200 200', ease: 'none',
                scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
            });
            gsap.fromTo(copy, { y: 50 }, {
                y: -20, ease: 'none',
                scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom bottom', scrub: true },
            });
        }
    }

    function buildCards() {
        const Y = REDUCED ? 0 : 1;
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
        const draws = $$('.w-cards .w-draw');
        setDraw(draws);

        tl.from('.w-cards-label', { autoAlpha: 0, y: 12 * Y, duration: 0.7 }, 0)
          .from('.w-cards-rule', { scaleX: 0, transformOrigin: 'left', duration: 1 }, 0.1)
          .from('[data-w="card"]', { autoAlpha: 0, y: 48 * Y, duration: 1.1, stagger: 0.14, ease: 'expo.out' }, 0.1)
          .from('.w-card-ico', { scale: REDUCED ? 1 : 0.4, rotation: -40 * Y, duration: 1, stagger: 0.14, ease: 'back.out(2)', clearProps: 'transform' }, 0.25)   // libera o hover do CSS
          .to(draws, { strokeDashoffset: 0, duration: 1.4, stagger: 0.04, ease: 'power2.inOut' }, 0.35)
          .from('.w-sign', { autoAlpha: 0, y: 24 * Y, duration: 1.2 }, 0.5);

        bindReveal(cardsWrap, tl, 'top 88%');
    }

    function initMotion() {
        gsap.registerPlugin(ScrollTrigger);
        buildCopy();
        buildStage();
        buildCards();
    }

    /* ======================================================================
       4. PONTEIRO: inclinação 3D, luz nos tambores, lanterna nos cards
       ====================================================================== */
    function initPointer() {
        if (!FINE || REDUCED) return;
        const lit = $('#wCylLit');
        const cards = $$('.flashlight-card', section);

        let tiltX, tiltY, ringX, ringY, haloX;
        if (HAS_GSAP) {
            gsap.set('#wTilt', { transformPerspective: 1100 });
            tiltX = gsap.quickTo('#wTilt', 'rotationY', { duration: 1.1, ease: 'power3.out' });
            tiltY = gsap.quickTo('#wTilt', 'rotationX', { duration: 1.1, ease: 'power3.out' });
            ringX = gsap.quickTo('.w-ring svg', 'x', { duration: 1.6, ease: 'power3.out' });
            ringY = gsap.quickTo('.w-ring svg', 'y', { duration: 1.6, ease: 'power3.out' });
            haloX = gsap.quickTo('.w-halo', 'x', { duration: 1.8, ease: 'power3.out' });
        }

        let mx = 0, my = 0, queued = false;
        section.addEventListener('pointermove', e => {
            mx = e.clientX; my = e.clientY;
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                const sr = section.getBoundingClientRect();
                lit.style.setProperty('--sx', `${mx - sr.left}px`);
                lit.style.setProperty('--sy', `${my - sr.top}px`);

                if (tiltX) {
                    const r = stage.getBoundingClientRect();
                    const nx = clamp((mx - (r.left + r.width / 2)) / (r.width / 2), -1.4, 1.4);
                    const ny = clamp((my - (r.top + r.height / 2)) / (r.height / 2), -1.4, 1.4);
                    tiltX(nx * 11); tiltY(-ny * 6);
                    ringX(nx * -14); ringY(ny * -10);
                    haloX(nx * 18);
                }
            });
        }, { passive: true });

        section.addEventListener('pointerleave', () => {
            if (tiltX) { tiltX(0); tiltY(0); ringX(0); ringY(0); haloX(0); }
        });

        cards.forEach(card => card.addEventListener('pointermove', e => {
            const b = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', `${e.clientX - b.left}px`);
            card.style.setProperty('--mouse-y', `${e.clientY - b.top}px`);
        }, { passive: true }));
    }

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    /* Navegação com vidro quando a dobra II chega ao topo */
    function initNavGlass() {
        const nav = $('#nav');
        let ticking = false;
        const read = () => {
            ticking = false;
            document.documentElement.classList.toggle('past-hero', section.getBoundingClientRect().top <= nav.offsetHeight);
        };
        addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(read); } }, { passive: true });
        read();
    }

    /* ======================================================================
       5. BOOT
       ====================================================================== */
    if (HAS_GSAP) {
        try { initMotion(); } catch (err) { console.error('[azzaro] wanted motion failed; section stays static', err); }
    }
    initNavGlass();
    initDust();
    initPointer();
})();
