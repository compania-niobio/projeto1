/* ==========================================================================
   AZZARO — Dobra III · O desejo (compra)
   - A mira e a luz do cursor são presas ao centro do frasco na foto
     (cálculo do object-fit: cover), em qualquer proporção de tela.
   - Entrada: a foto abre como cortina, a mira se desenha, o título sobe e
     o cartão de compra desliza; a saída é o reverso, ao voltar para cima.
   - Paralaxe: a foto recua (zoom-out) enquanto a dobra atravessa a tela.
   - Botão de compra: trava a mira e solta faíscas no clique (o magnetismo vem de main.js).
   Sem GSAP, a dobra fica visível e estática (estados iniciais vêm do JS).
   ========================================================================== */
(() => {
    'use strict';

    const section = document.getElementById('desejo');
    if (!section) return;

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
    const gsap = window.gsap;

    const zoom = $('#dZoom');
    const img = $('.d-img', zoom);
    const lit = $('#dLit');
    const reticle = $('#dReticle');
    const ctaWrap = $('#dCtaWrap');
    const cta = $('#dCta');
    const card = $('#dCard');

    /* Frasco na foto perfume-balas (frações da imagem quadrada) */
    const BOTTLE = { cx: 0.517, cy: 0.555, h: 0.69 };
    const OBJ_POS = { x: 0.5, y: 0.45 };   // espelha object-position do .d-img

    /* ======================================================================
       1. MIRA + LUZ PRESAS AO FRASCO
       ====================================================================== */
    let bottle = { x: 0, y: 0 };

    function place() {
        const W = zoom.clientWidth, H = zoom.clientHeight;
        const iw = img.naturalWidth || 1200, ih = img.naturalHeight || 1200;
        const s = Math.max(W / iw, H / ih);
        const x = (W - iw * s) * OBJ_POS.x + BOTTLE.cx * iw * s;
        const y = (H - ih * s) * OBJ_POS.y + BOTTLE.cy * ih * s;
        const d = Math.min(BOTTLE.h * ih * s * 0.78, W * 0.92, H * 0.8);
        bottle = { x, y };
        reticle.style.setProperty('--rx', `${x}px`);
        reticle.style.setProperty('--ry', `${y}px`);
        reticle.style.setProperty('--rd', `${d}px`);
        setLight(x, y);
    }

    function setLight(x, y) {
        lit.style.setProperty('--lx', `${x}px`);
        lit.style.setProperty('--ly', `${y}px`);
    }

    new ResizeObserver(place).observe(zoom);
    if (img.complete) place(); else img.addEventListener('load', place, { once: true });

    /* ======================================================================
       2. COREOGRAFIA (GSAP)
       ====================================================================== */
    function initMotion() {
        gsap.registerPlugin(ScrollTrigger);
        const Y = REDUCED ? 0 : 1;
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });

        // Foto abre como a cortina do DS, do centro para as bordas
        tl.fromTo('#dBg', { clipPath: REDUCED ? 'inset(0% 0% 0% 0%)' : 'inset(14% 46% 14% 46%)', autoAlpha: REDUCED ? 0 : 1 },
                  { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1, duration: 1.8, ease: 'expo.inOut' }, 0)
          .from('.d-corners i', { autoAlpha: 0, scale: 0.4, duration: 0.9, stagger: 0.06, ease: 'back.out(2)' }, 0.9)

          // Mira desenha: anéis, cruz, colchetes, ponto
          .fromTo('.ret-ring', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, stagger: 0.15, ease: 'power3.inOut' }, 0.7)
          .fromTo('.ret-cross path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, stagger: 0.1, ease: 'power3.inOut' }, 0.95)
          .from('.ret-spin', { autoAlpha: 0, duration: 2 }, 0.75)   // o giro contínuo é CSS
          .from('.ret-brackets path', { autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 1.3)
          .from('.ret-dot', { scale: 0, transformOrigin: '50% 50%', duration: 0.8, ease: 'back.out(4)' }, 1.5)
          .from('.ret-label', { autoAlpha: 0, duration: 0.8 }, 1.6)

          // Título
          .from('.d-eyebrow', { autoAlpha: 0, y: 14 * Y, duration: 0.9 }, 0.8)
          .from('.d-line-in', { yPercent: 112 * Y, rotate: 2 * Y, autoAlpha: REDUCED ? 0 : 1, duration: 1.4, stagger: 0.12 }, 0.9)
          .from('.d-sign', { autoAlpha: 0, y: 14 * Y, duration: 0.9 }, 1.4)

          // Cartão de compra
          .from(card, { autoAlpha: 0, x: 60 * Y, filter: REDUCED ? 'none' : 'blur(12px)', duration: 1.4, clearProps: 'filter' }, 1.0)
          .from('[data-d="card"]', { autoAlpha: 0, y: 18 * Y, duration: 0.9, stagger: 0.07, ease: 'power3.out' }, 1.2)
          .from('[data-d="foot"]', { autoAlpha: 0, y: 16 * Y, duration: 1 }, 1.5);

        ScrollTrigger.create({
            trigger: section, start: 'top 62%',
            onEnter: () => tl.timeScale(1).play(),
            onLeaveBack: () => tl.timeScale(1.9).reverse(),
        });

        // Paralaxe: a foto recua enquanto a dobra sobe
        if (!REDUCED) {
            gsap.fromTo(zoom, { scale: 1.16, yPercent: -4 }, {
                scale: 1, yPercent: 3, ease: 'none',
                scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom bottom', scrub: true },
            });
            gsap.fromTo('.d-copy', { y: 60 }, {
                y: 0, ease: 'none',
                scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom bottom', scrub: true },
            });
        }
    }

    /* ======================================================================
       3. BOTÃO DE COMPRA: trava a mira, faíscas, magnetismo
       ====================================================================== */
    const lock = on => section.classList.toggle('is-locked', on);
    ctaWrap.addEventListener('pointerenter', () => lock(true));
    ctaWrap.addEventListener('pointerleave', () => lock(false));
    cta.addEventListener('focus', () => lock(true));
    cta.addEventListener('blur', () => lock(false));

    cta.addEventListener('click', e => {
        if (REDUCED) return;
        const r = ctaWrap.getBoundingClientRect();
        const ox = e.detail === 0 ? r.width / 2 : e.clientX - r.left;
        const oy = e.detail === 0 ? r.height / 2 : e.clientY - r.top;
        for (let i = 0; i < 18; i++) {
            const s = document.createElement('i');
            const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
            const dist = 40 + Math.random() * 70;
            s.className = 'd-spark';
            s.style.cssText = `--sx:${ox}px;--sy:${oy}px;--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist}px;animation-delay:${Math.random() * 0.08}s`;
            ctaWrap.appendChild(s);
            s.addEventListener('animationend', () => s.remove(), { once: true });
        }
    });

    /* ======================================================================
       4. PONTEIRO: luz segue o cursor, lanterna no cartão, magnetismo
       ====================================================================== */
    function initPointer() {
        if (!FINE || REDUCED) return;

        let mx = 0, my = 0, queued = false, inside = false;
        section.addEventListener('pointermove', e => {
            mx = e.clientX; my = e.clientY; inside = true;
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                if (!inside) return;
                const zr = zoom.getBoundingClientRect();
                // coordenadas no espaço do .d-zoom (desfaz o scale da paralaxe)
                const k = zoom.offsetWidth / zr.width || 1;
                setLight((mx - zr.left) * k, (my - zr.top) * k);
                const b = card.getBoundingClientRect();
                card.style.setProperty('--mouse-x', `${mx - b.left}px`);
                card.style.setProperty('--mouse-y', `${my - b.top}px`);
            });
        }, { passive: true });

        section.addEventListener('pointerleave', () => { inside = false; setLight(bottle.x, bottle.y); });
        // Em trava, a luz volta para o frasco
        ctaWrap.addEventListener('pointerenter', () => { inside = false; setLight(bottle.x, bottle.y); });
        // magnetismo do botão: classe .magnetic, tratada em js/main.js
    }

    /* ======================================================================
       5. REVER O FILME
       ====================================================================== */
    $('#dTop').addEventListener('click', e => {
        const lenis = window.azzaroLenis;
        if (lenis) lenis.scrollTo(0, { duration: REDUCED ? 0 : 3.2, immediate: REDUCED, force: true });
        else window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
        if (e.detail === 0) { const h = $('#hero-title'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    });

    /* ======================================================================
       6. BOOT
       ====================================================================== */
    if (HAS_GSAP) {
        try { initMotion(); } catch (err) { console.error('[azzaro] desire motion failed; section stays static', err); }
    }
    initPointer();
})();
