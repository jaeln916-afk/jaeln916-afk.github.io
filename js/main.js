(() => {
  const d = document;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const WA = '18092695140';
  d.documentElement.classList.add('js');

  const nav = $('.nav');
  const burger = $('.burger');
  const links = $('#menu');

  const progress = $('.progress');
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 24);
    const max = d.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggleMenu = open => {
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    links.classList.toggle('open', open);
  };
  burger.addEventListener('click', () => toggleMenu(burger.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', e => e.target.closest('a') && toggleMenu(false));
  window.addEventListener('keydown', e => e.key === 'Escape' && toggleMenu(false));

  const bubbles = $('.bubbles');
  if (bubbles && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (let i = 0; i < 16; i++) {
      const s = d.createElement('span');
      const z = 10 + Math.random() * 34;
      s.style.cssText = `left:${Math.random() * 100}%;width:${z}px;height:${z}px;` +
        `animation-duration:${9 + Math.random() * 10}s;animation-delay:${-Math.random() * 14}s;` +
        `--dx:${(Math.random() - 0.5) * 80}px`;
      bubbles.append(s);
    }
  }

  const MENU = {
    cerdo: { label: '🐖 Del cerdo', items: [
      ['Chicharrón de cerdo', 'Trozos dorados y crujientes, con limón.', '🐖'],
      ['Chicharrón con yuca frita', 'El clásico de siempre, para compartir.', '🍟'],
      ['Costillitas fritas', 'Jugosas por dentro, crocantes por fuera.', '🍖'],
      ['Mofongo de chicharrón', 'Plátano majado con chicharrón y ajo.', '🥘']
    ]},
    mar: { label: '🐟 Del mar', items: [
      ['Pescado frito entero', 'Dorado al momento, con tostones.', '🐟'],
      ['Chicharrón de pescado', 'Bocados crujientes con salsa de la casa.', '🎣'],
      ['Camarones al ajillo', 'Salteados con ajo y un toque de limón.', '🦐'],
      ['Arroz con mariscos', 'Arroz sazonado con lo mejor del mar.', '🍤']
    ]},
    lados: { label: '🍌 Acompañantes', items: [
      ['Tostones', 'Plátano verde frito, bien crujiente.', '🍌'],
      ['Yuca frita', 'Dorada por fuera, suave por dentro.', '🥔'],
      ['Maduros', 'Dulces y caramelizados.', '🟡'],
      ['Ensalada fresca', 'Para equilibrar la mesa.', '🥗']
    ]},
    bebidas: { label: '🥤 Bebidas', items: [
      ['Jugos naturales', 'Pregúntanos por las frutas del día.', '🍹'],
      ['Refrescos', 'Bien fríos.', '🥤'],
      ['Cerveza fría', 'La compañera ideal del chicharrón.', '🍺'],
      ['Agua', 'Para refrescarte entre bocado y bocado.', '💧']
    ]}
  };

  const tabs = $('.tabs');
  const grid = $('#dishes');
  const keys = Object.keys(MENU);

  const render = k => {
    grid.innerHTML = MENU[k].items.map(([name, text, emoji], i) =>
      `<article class="dish" style="--i:${i}" data-name="${name}" tabindex="0"><span class="em" aria-hidden="true">${emoji}</span>` +
      `<h3>${name}</h3><p>${text}</p>` +
      `<a href="https://wa.me/${WA}?text=${encodeURIComponent('Hola Chichamar, quiero pedir: ' + name)}" target="_blank" rel="noopener">Pedir por WhatsApp</a></article>`
    ).join('');
    $$('.tab', tabs).forEach(t => {
      const on = t.dataset.k === k;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    });
    grid.setAttribute('aria-labelledby', 't-' + k);
  };

  tabs.innerHTML = keys.map(k => `<button class="tab" type="button" role="tab" id="t-${k}" data-k="${k}">${MENU[k].label}</button>`).join('');
  tabs.addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) render(t.dataset.k);
  });
  tabs.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const cur = keys.indexOf($('.tab[aria-selected=true]', tabs).dataset.k);
    const next = keys[(cur + step + keys.length) % keys.length];
    render(next);
    $('#t-' + next).focus();
  });
  render(keys[0]);

  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 90}ms`;
      io.observe(el);
    });
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  const happy = $('#happy');
  const burst = $('.happy-burst');
  const emojis = ['🐖', '🐟', '✨', '🍤', '💛', '🔥'];
  let lastFocus = null;

  const openHappy = card => {
    const name = card.dataset.name;
    lastFocus = card;
    $('#happy-p').textContent = `${name}. Hasta el pez y el cerdito están felices con esa idea.`;
    $('#happy-wa').href = `https://wa.me/${WA}?text=${encodeURIComponent('Hola Chichamar, quiero pedir: ' + name)}`;
    burst.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const s = d.createElement('span');
      const a = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
      const dist = 110 + Math.random() * 90;
      s.textContent = emojis[i % emojis.length];
      s.style.cssText = `--bx:${Math.cos(a) * dist}px;--by:${Math.sin(a) * dist - 40}px;--br:${(Math.random() - 0.5) * 120}deg;animation-delay:${Math.random() * 0.25}s`;
      burst.append(s);
    }
    happy.hidden = false;
    d.body.classList.add('lock');
    $('#happy-wa').focus();
  };

  const closeHappy = () => {
    if (happy.hidden) return;
    happy.hidden = true;
    d.body.classList.remove('lock');
    if (lastFocus) lastFocus.focus();
  };

  grid.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const card = e.target.closest('.dish');
    if (card) openHappy(card);
  });
  grid.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('dish')) {
      e.preventDefault();
      openHappy(e.target);
    }
  });
  happy.addEventListener('click', e => {
    if (e.target === happy || e.target.closest('[data-close]')) closeHappy();
  });
  window.addEventListener('keydown', e => {
    if (happy.hidden) return;
    if (e.key === 'Escape') closeHappy();
    if (e.key === 'Tab') {
      const f = $$('a[href],button', happy);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  const hero = $('.hero');
  if (hero && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const set = (x, y) => { hero.style.setProperty('--px', x); hero.style.setProperty('--py', y); };
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    });
    hero.addEventListener('pointerleave', () => set(0, 0));
  }

  grid.addEventListener('pointermove', e => {
    const c = e.target.closest('.dish');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  });

  $('#yr').textContent = new Date().getFullYear();
})();
