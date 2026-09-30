(() => {
  document.documentElement.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Full-screen menu
  const menu = document.getElementById('menu');
  const toggle = document.querySelector('.menu-toggle');
  const closeBtn = menu.querySelector('.menu-close');
  const previews = menu.querySelectorAll('.menu-preview img');

  function showPreview(i) {
    previews.forEach((img) => img.classList.toggle('is-active', img.dataset.preview === String(i)));
  }

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('menu-open', open);
    if (open) {
      const current = menu.querySelector('[aria-current="page"]');
      showPreview(current ? current.dataset.preview : 0);
      setTimeout(() => closeBtn.focus({ preventScroll: true }), 50);
    } else {
      toggle.focus({ preventScroll: true });
    }
  }

  toggle.addEventListener('click', () => setMenu(true));
  closeBtn.addEventListener('click', () => setMenu(false));
  menu.querySelectorAll('.menu-list a').forEach((a) => {
    a.addEventListener('mouseenter', () => showPreview(a.dataset.preview));
    a.addEventListener('focus', () => showPreview(a.dataset.preview));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
  });

  // Reveal on scroll
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 90}ms`;
      io.observe(el);
    });
  } else {
    items.forEach((el) => el.classList.add('is-visible'));
  }

  // Footer year
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Client marquee: clone each track once so the loop is seamless
  document.querySelectorAll('.marquee-row').forEach((row) => {
    const track = row.querySelector('.marquee-track');
    // Repeat the logos until one track is wider than any likely screen
    const originals = [...track.children];
    for (let n = originals.length; n < 12; n += originals.length) {
      originals.forEach((li) => {
        const copy = li.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.querySelector('img').alt = '';
        track.appendChild(copy);
      });
    }
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('img').forEach((img) => { img.alt = ''; });
    row.appendChild(clone);
  });

  // Work rails: arrow buttons scroll by roughly one screen of cards
  document.querySelectorAll('.rail-section').forEach((section) => {
    const railEl = section.querySelector('.rail');
    section.querySelectorAll('.rail-btn').forEach((btn) => btn.addEventListener('click', () => {
      railEl.scrollBy({ left: Number(btn.dataset.dir) * railEl.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
  });

  // Pillar list: an image follows the cursor on devices with a fine pointer
  const pillarList = document.querySelector('.pillar-list');
  const float = document.querySelector('.pillar-float');
  if (pillarList && float && window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    let x = 0, y = 0, fx = 0, fy = 0, raf = 0;
    const loop = () => {
      fx += (x - fx) * 0.16;
      fy += (y - fy) * 0.16;
      float.style.transform = `translate(${fx}px, ${fy}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    pillarList.querySelectorAll('.pillar-row').forEach((row) => {
      row.addEventListener('mouseenter', () => { float.src = row.dataset.img; float.classList.add('is-visible'); });
    });
    pillarList.addEventListener('mousemove', (e) => {
      const r = pillarList.parentElement.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!raf) { fx = x; fy = y; raf = requestAnimationFrame(loop); }
    });
    pillarList.addEventListener('mouseleave', () => {
      float.classList.remove('is-visible');
      cancelAnimationFrame(raf);
      raf = 0;
    });
  }

  // Work: filter chips (also driven by #fashion, #marketing... in the URL) + lightbox
  const grid = document.querySelector('.work-grid');
  if (grid) {
    const chips = document.querySelectorAll('.chip');
    const workItems = [...grid.querySelectorAll('.work-item')];
    const applyFilter = (cat) => {
      const chip = [...chips].find((c) => c.dataset.filter === cat) || chips[0];
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      workItems.forEach((item) => { item.hidden = chip.dataset.filter !== 'all' && item.dataset.cat !== chip.dataset.filter; });
    };
    chips.forEach((chip) => chip.addEventListener('click', () => {
      applyFilter(chip.dataset.filter);
      history.replaceState(null, '', chip.dataset.filter === 'all' ? location.pathname : `#${chip.dataset.filter}`);
    }));
    if (location.hash) applyFilter(location.hash.slice(1));

    const box = document.querySelector('.lightbox');
    const img = box.querySelector('img');
    const cap = box.querySelector('.lightbox-caption');
    const count = box.querySelector('.lightbox-count');
    let list = [];
    let index = 0;
    const show = (i) => {
      index = (i + list.length) % list.length;
      const src = list[index].querySelector('img');
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      cap.textContent = src.alt;
      count.textContent = `${index + 1} / ${list.length}`;
    };
    workItems.forEach((item) => item.querySelector('button').addEventListener('click', () => {
      list = workItems.filter((it) => !it.hidden);
      show(list.indexOf(item));
      box.showModal();
    }));
    box.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1));
    box.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1));
    box.querySelector('.lightbox-close').addEventListener('click', () => box.close());
    box.addEventListener('click', (e) => { if (e.target === box || e.target.tagName === 'FIGURE') box.close(); });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
  }

  // Contact: pre-select the pillar a visitor came from (?interest=fashion)
  const interest = new URLSearchParams(location.search).get('interest');
  if (interest) {
    const box = document.querySelector(`.check-chip input[data-slug="${CSS.escape(interest)}"]`);
    if (box) box.checked = true;
  }

  // Forms are Netlify Forms: post url-encoded to "/" and report the result inline
  document.querySelectorAll('form[data-netlify]').forEach((form) => {
    const status = form.querySelector('[role="status"]');
    const done = form.dataset.success || 'Thank you.';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = 'Sending…';
      try {
        const res = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        status.textContent = done;
      } catch {
        status.textContent = 'Something went wrong. Please try again.';
      }
    });
  });
})();
