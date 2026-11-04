/* ==========================================================================
   AZZARO — Luxury Perfume Experience
   Motor de "video scroll scrubbing": a posição do scroll define video.currentTime.
   - GSAP ScrollTrigger lê o progresso (0 → 1) da hero.
   - Um único requestAnimationFrame por quadro converte progresso em frame.
   - Seeks são "coalescidos": nunca há mais de um seek pendente; ao terminar,
     o próximo salta direto para o alvo mais recente (estável em scroll rápido).
   - Lenis suaviza a roda do mouse e alimenta o ScrollTrigger (sem conflito).
   ========================================================================== */
(() => {
    'use strict';

    const doc = document.documentElement;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
    const gsap = window.gsap;

    /* ---------- Constantes do filme ---------- */
    const FPS = 24;                 // Azzaro.webm: VP9 1280×720, 24 fps, ~8.01 s (192 frames)
    const VIDEO_END = 0.94;         // o último frame é alcançado em 94% da pista; os 6% finais seguram a assinatura
    const MOBILE_Q = '(max-width: 820px), (max-aspect-ratio: 4/5)';

    /* Destinos de navegação (progresso da pista) por capítulo */
    const GOTO = [0, 0.175, 0.31, 0.465, 1];

    /* Janelas dos capítulos [entrada, saída]; sincronizadas aos atos do filme */
    const WINDOWS = [
        [0.000, 0.105],   // 0 · prólogo        (0.0 – 0.9 s)  tambor no escuro
        [0.110, 0.235],   // I · The Chamber    (0.9 – 2.0 s)  câmaras, feixes de luz
        [0.250, 0.370],   // II · Ignition      (2.1 – 3.2 s)  clarão, explosão dourada
        [0.390, 0.540],   // III · The Reveal   (3.3 – 4.6 s)  frasco na fumaça dourada
        [0.720, 1.000],   // IV · The Mark      (6.1 – 8.0 s)  parede de cartuchos
        // 0.54 – 0.72: respiro sem texto, transição para a parede de cartuchos
    ];

    /* ---------- Elementos ---------- */
    const hero = $('#hero');
    const film = $('#film');
    const video = $('#video');
    const source = $('source', video);
    const intro = $('#intro');
    const curtain = $('#curtain');
    const curtainPct = $('#curtainPct');
    const navProgress = $('#navProgress');
    const navLinks = $$('.nav-link[data-goto]');
    const menu = $('#menu');
    const menuBtn = $('#menuBtn');
    const menuClose = $('#menuClose');

    /* ======================================================================
       1. MOTOR DO FILME
       ====================================================================== */
    const filmState = {
        duration: 8.009,       // substituído por video.duration após loadedmetadata
        maxFrame: 191,
        ready: false,          // metadados disponíveis → currentTime pode ser escrito
        pending: false,        // houve novo alvo enquanto um seek estava em curso
        targetFrame: 0,
        shownFrame: -1,
        unlocking: false,
    };

    let progress = 0;          // progresso bruto do scroll (0 → 1)
    let rafId = 0;
    let lastChapter = -1;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const frameToTime = f => clamp((f + 0.5) / FPS, 0, filmState.duration - 0.001); // centro do frame: evita erro de arredondamento
    const progressToFrame = p => {
        const t = clamp(p / VIDEO_END, 0, 1) * filmState.duration;
        return clamp(Math.floor(t * FPS), 0, filmState.maxFrame);
    };

    /** Escreve currentTime somente quando necessário e nunca empilha seeks. */
    function seekToTarget() {
        if (!filmState.ready) return;
        if (video.seeking) { filmState.pending = true; return; }
        const goal = frameToTime(filmState.targetFrame);
        if (Math.abs(video.currentTime - goal) < 0.5 / FPS) { filmState.shownFrame = filmState.targetFrame; return; }
        try { video.currentTime = goal; } catch (_) { /* elemento ainda não pronto */ }
    }

    video.addEventListener('seeked', () => {
        filmState.shownFrame = Math.floor(video.currentTime * FPS);
        if (filmState.pending) { filmState.pending = false; seekToTarget(); }
    });

    /* O filme nunca roda sozinho: qualquer play externo (teclas de mídia etc.) é desfeito. */
    video.addEventListener('play', () => { if (!filmState.unlocking) video.pause(); });
    video.loop = false;
    video.autoplay = false;

    /** Agenda uma única atualização por quadro (rAF). */
    function setProgress(p) {
        progress = clamp(p, 0, 1);
        if (!rafId) rafId = requestAnimationFrame(frame);
    }

    function frame() {
        rafId = 0;
        filmState.targetFrame = progressToFrame(progress);
        seekToTarget();
        paintUI();
    }

    /* ---------- HUD ---------- */
    function chapterAt(p) {
        for (let i = WINDOWS.length - 1; i >= 1; i--) if (p >= WINDOWS[i][0] - 0.02) return i;
        return 0;
    }

    function paintUI() {
        const p = progress.toFixed(4);
        navProgress.style.setProperty('--p', p);

        const ch = chapterAt(progress);
        if (ch !== lastChapter) {
            lastChapter = ch;
            navLinks.forEach(a => a.classList.toggle('is-active', +a.dataset.goto === ch && ch > 0));
            if (!HAS_GSAP) paintChaptersWithoutGsap(ch);
        }
    }

    /* ---------- Carregamento progressivo ---------- */
    let curtainOpened = false;
    const t0 = performance.now();

    function openCurtain() {
        if (curtainOpened) return;
        curtainOpened = true;
        const wait = Math.max(0, 650 - (performance.now() - t0)); // mínimo elegante, nunca bloqueante
        setTimeout(() => {
            curtain.classList.add('open');
            setTimeout(() => doc.classList.add('is-in'), 180);
            setTimeout(() => curtain.classList.add('gone'), 1300);
            if (lenis) lenis.start();
        }, wait);
    }

    function updateBufferPct() {
        try {
            const d = video.duration;
            if (!d || !isFinite(d) || !video.buffered.length) return;
            const end = video.buffered.end(video.buffered.length - 1);
            curtainPct.textContent = String(Math.min(99, Math.round((end / d) * 100))).padStart(2, '0');
        } catch (_) { /* buffered pode lançar durante troca de fonte */ }
    }

    function useFallback(reason) {
        /* Se o filme já exibiu o primeiro frame, nunca troca para a imagem estática:
           durante seeks o readyState cai para 1 temporariamente e não indica falha. */
        if (doc.classList.contains('is-fallback') || doc.classList.contains('film-ready')) return;
        doc.classList.add('is-fallback');
        console.warn('[azzaro] film unavailable, showing still fallback:', reason);
        openCurtain();
    }

    function onMetadata() {
        const d = video.duration;
        if (d && isFinite(d)) {
            filmState.duration = d;
            filmState.maxFrame = Math.max(0, Math.ceil(d * FPS) - 1);
            while (filmState.maxFrame > 0 && (filmState.maxFrame + 0.5) / FPS >= d) filmState.maxFrame--;
        }
        filmState.ready = true;
        filmState.targetFrame = progressToFrame(progress);

        /* iOS/Safari só pinta frames após uma reprodução iniciada (muted é permitido).
           Toca e pausa imediatamente; depois sincroniza com o scroll. */
        filmState.unlocking = true;
        const pr = video.play();
        const done = () => { video.pause(); filmState.unlocking = false; seekToTarget(); };
        if (pr && pr.then) pr.then(done, done); else done();
    }

    function onFirstFrame() {
        doc.classList.add('film-ready');
        doc.classList.remove('is-fallback');
        curtainPct.textContent = '99';
        openCurtain();
    }

    function initFilm() {
        const canWebm = video.canPlayType('video/webm; codecs="vp9"') || video.canPlayType('video/webm');
        if (!canWebm) { useFallback('webm/vp9 not supported'); return; }

        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;

        video.addEventListener('loadedmetadata', onMetadata, { once: true });
        video.addEventListener('loadeddata', onFirstFrame, { once: true });
        video.addEventListener('progress', updateBufferPct);
        video.addEventListener('error', () => useFallback('media element error'));
        source.addEventListener('error', () => useFallback('source failed to load'));

        if (video.readyState >= 1) onMetadata();
        if (video.readyState >= 2) onFirstFrame();

        /* A rolagem nunca fica presa: a cortina abre mesmo se a rede estiver lenta. */
        setTimeout(openCurtain, 2600);
        /* Rede muito lenta: mostra a imagem estática até o filme chegar (onFirstFrame a remove). */
        setTimeout(() => {
            if (!doc.classList.contains('film-ready') && video.readyState < 2) useFallback('slow network (still loading)');
        }, 9000);
    }

    /* ======================================================================
       2. SCROLL: GSAP ScrollTrigger + Lenis
       ====================================================================== */
    let lenis = null;
    let mainTrigger = null;
    const isMobile = () => matchMedia(MOBILE_Q).matches;

    function trackRange() {
        if (mainTrigger) return [mainTrigger.start, mainTrigger.end];
        const top = hero.getBoundingClientRect().top + scrollY;
        return [top, top + hero.offsetHeight - innerHeight];
    }
    const progressToY = p => { const [a, b] = trackRange(); return a + (b - a) * clamp(p, 0, 1); };

    function initScroll() {
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });

        if (window.Lenis && !REDUCED) {
            lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true, anchors: false });
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add(time => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
            if (!curtainOpened) lenis.stop();
            window.azzaroLenis = lenis;   // compartilhado com js/wanted.js (rolagem até a dobra II)
        }

        /* Fonte da verdade do progresso: o filme segue exatamente o scroll. */
        mainTrigger = ScrollTrigger.create({
            trigger: hero,
            start: 'top top',
            end: 'bottom bottom',
            onUpdate: self => setProgress(self.progress),
            onRefresh: self => setProgress(self.progress),
        });

        buildTimeline();
    }

    /* Narrativa tipográfica: uma timeline (duração 1 = pista inteira) presa ao scroll. */
    function buildTimeline() {
        const Y = REDUCED ? 0 : 1;
        const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
                trigger: hero, start: 'top top', end: 'bottom bottom',
                scrub: (lenis || REDUCED) ? true : 0.45,
                invalidateOnRefresh: true,
            },
        });

        // Profundidade: o filme recua lentamente (dolly-out) durante todo o percurso
        tl.fromTo(film,
            { scale: () => (REDUCED ? 1 : isMobile() ? 1.06 : 1.12), xPercent: 0 },
            { scale: 1, xPercent: () => (isMobile() ? 0 : -3), duration: 1 }, 0);

        // Prólogo sai
        tl.to(intro, { autoAlpha: 0, y: -70 * Y, duration: 0.085, ease: 'power1.in' }, 0.015);
        tl.to('.scroll-cue > *', { autoAlpha: 0, duration: 0.03 }, 0);

        // Clarão sincronizado com a ignição do filme (~2.3 s)
        if (!REDUCED) {
            tl.to('#flash', { opacity: 0.3, duration: 0.025, ease: 'power2.out' }, 0.245)
              .to('#flash', { opacity: 0, duration: 0.06, ease: 'power1.in' }, 0.275);
        }

        // Sombra lateral respira com a luz do filme
        tl.to('#shadeLeft', { opacity: 0.72, duration: 0.05 }, 0.25)
          .to('#shadeLeft', { opacity: 1, duration: 0.06 }, 0.56)
          .fromTo('#shadeDeep', { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.66);

        // Sem legendas de capítulo: depois do prólogo, o filme corre sozinho até a dobra II

        tl.set({}, {}, 1); // garante duração total = 1
    }

    /* Sem GSAP (CDN bloqueado): progresso nativo + capítulos por classe. */
    function initScrollWithoutGsap() {
        doc.classList.add('no-gsap');
        let ticking = false;
        const read = () => {
            ticking = false;
            const [a, b] = trackRange();
            setProgress(b > a ? (scrollY - a) / (b - a) : 0);
        };
        addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(read); } }, { passive: true });
        addEventListener('resize', read, { passive: true });
        read();
    }

    function paintChaptersWithoutGsap(ch) {
        intro.classList.toggle('is-off', ch > 0);
    }

    /* ======================================================================
       3. NAVEGAÇÃO AUTOMÁTICA (botões, menu, régua)
       ====================================================================== */
    let autoTween = null;
    const cancelKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

    function cancelAuto() {
        if (autoTween) { autoTween.kill(); autoTween = null; }
    }
    ['wheel', 'touchstart'].forEach(ev => addEventListener(ev, cancelAuto, { passive: true }));
    addEventListener('keydown', e => { if (cancelKeys.has(e.key)) cancelAuto(); });

    /**
     * Rola até um ponto da pista. O vídeo acompanha porque o scroll é real.
     * @param {number} p      progresso alvo (0 → 1)
     * @param {object} opts   { cinematic: bool, focus: Element }
     */
    function scrollToProgress(p, opts = {}) {
        cancelAuto();
        const y = progressToY(p);
        const from = lenis ? lenis.scroll : scrollY;
        const dist = Math.abs(y - from) / Math.max(1, hero.offsetHeight);
        const done = () => {
            autoTween = null;
            if (opts.focus) opts.focus.focus({ preventScroll: true });
        };

        if (REDUCED || !HAS_GSAP) {
            if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
            else window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
            done();
            return;
        }

        const proxy = { y: from };
        autoTween = gsap.to(proxy, {
            y,
            duration: opts.cinematic ? clamp(dist * 11, 2, 10) : clamp(0.9 + dist * 2.2, 1, 2.8),
            ease: opts.cinematic ? 'sine.inOut' : 'power3.inOut',
            onUpdate: () => {
                if (lenis) lenis.scrollTo(proxy.y, { immediate: true, force: true });
                else window.scrollTo(0, proxy.y);
            },
            onComplete: done,
        });
    }

    function bindGoto() {
        $$('[data-goto]').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                const i = +el.dataset.goto;
                const fromMenu = !!el.closest('#menu');
                const keyboard = e.detail === 0;
                const go = () => scrollToProgress(GOTO[i], { focus: keyboard ? chapterFocusTarget(i) : null });
                if (fromMenu) { closeMenu(false); setTimeout(go, 120); } else go();
            });
        });

        $('#exploreBtn').addEventListener('click', () => scrollToProgress(1, { cinematic: true }));
    }

    function chapterFocusTarget(i) {
        const el = i === 0 ? $('#hero-title') : $('#stage');   // sem capítulos: o foco vai para o palco do filme
        if (el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        return el;
    }

    /* ---------- Menu ---------- */
    function onMenuKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
        if (e.key !== 'Tab') return;
        const items = $$('a, button', menu);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function openMenu() {
        cancelAuto();
        menu.hidden = false;
        requestAnimationFrame(() => menu.classList.add('is-open'));
        menuBtn.setAttribute('aria-expanded', 'true');
        if (lenis) lenis.stop();
        document.addEventListener('keydown', onMenuKey);
        setTimeout(() => { const a = $('a', menu); if (a) a.focus(); }, 60);
    }

    function closeMenu(returnFocus = true) {
        if (menu.hidden) return;
        menu.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', onMenuKey);
        if (lenis) lenis.start();
        setTimeout(() => { menu.hidden = true; }, REDUCED ? 0 : 450);
        if (returnFocus) menuBtn.focus();
    }

    menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu(true)));
    menuClose.addEventListener('click', () => closeMenu(true));
    menu.addEventListener('click', e => { if (e.target === menu) closeMenu(true); });

    /* ======================================================================
       4. MICROINTERAÇÕES (apenas ponteiro fino, sem movimento reduzido)
       ====================================================================== */
    function initPointer() {
        if (!FINE || REDUCED || !HAS_GSAP) return;

        const light = $('#heroLight');
        const headline = $('.headline');
        const filmX = gsap.quickTo(video, 'x', { duration: 1.4, ease: 'power3.out' });
        const filmY = gsap.quickTo(video, 'y', { duration: 1.4, ease: 'power3.out' });
        const headX = gsap.quickTo(headline, 'x', { duration: 1.2, ease: 'power3.out' });
        gsap.set(video, { scale: 1.03 }); // margem para a paralaxe não revelar bordas
        let mx = 0, my = 0, queued = false;

        addEventListener('pointermove', e => {
            mx = e.clientX; my = e.clientY;
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                const nx = mx / innerWidth - 0.5, ny = my / innerHeight - 0.5;
                light.style.setProperty('--mx', `${(mx / innerWidth) * 100}%`);
                light.style.setProperty('--my', `${(my / innerHeight) * 100}%`);
                filmX(nx * -18); filmY(ny * -10);   // vídeo e texto em planos opostos = profundidade
                headX(nx * 10);
            });
        }, { passive: true });

        // Botões magnéticos (DS .magnetic)
        $$('.magnetic').forEach(el => {
            const qx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
            const qy = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                qx((e.clientX - (r.left + r.width / 2)) * 0.22);
                qy((e.clientY - (r.top + r.height / 2)) * 0.3);
            });
            el.addEventListener('pointerleave', () => { qx(0); qy(0); });
        });
    }

    /* ======================================================================
       5. BOOT
       ====================================================================== */
    function boot() {
        try {
            if (HAS_GSAP) initScroll(); else initScrollWithoutGsap();
        } catch (err) {
            console.error('[azzaro] scroll init failed, falling back to native scroll', err);
            if (!doc.classList.contains('no-gsap')) initScrollWithoutGsap();
        }
        bindGoto();
        initPointer();
        initFilm();
        if (!HAS_GSAP) paintChaptersWithoutGsap(chapterAt(progress));

        // Fontes carregadas mudam métricas: recalcula posições da pista
        if (HAS_GSAP && document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

        addEventListener('pagehide', () => {
            cancelAuto();
            if (rafId) cancelAnimationFrame(rafId);
        });
    }

    boot();
})();
