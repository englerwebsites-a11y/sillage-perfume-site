/* Homepage: "Choose your mode" visuals */
(function () {
  if (typeof FRAGRANCES === 'undefined') return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Surprise me: a blurred reel that keeps shuffling ---- */
  const reel = document.getElementById('reel');
  if (reel) {
    const order = FRAGRANCES.slice().sort(() => Math.random() - 0.5);
    reel.innerHTML = order.map((f, i) =>
      `<img src="${f.img}" alt="" loading="lazy" class="${i === 0 ? 'on' : ''}">`).join('');
    const imgs = reel.querySelectorAll('img');
    let i = 0, timer = null;
    const step = () => {
      imgs[i].classList.remove('on');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('on');
    };
    const start = (ms) => { stop(); timer = setInterval(step, ms); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    if (!reduce) {
      // Only run while visible, and shuffle faster on hover
      const card = reel.closest('.path-card');
      let visible = false;
      new IntersectionObserver(es => {
        visible = es[0].isIntersecting;
        visible ? start(1400) : stop();
      }, { threshold: 0.2 }).observe(reel);
      card.addEventListener('mouseenter', () => { if (visible) start(260); });
      card.addEventListener('mouseleave', () => { if (visible) start(1400); });
    }
  }

  /* ---- Choose my own: hover or focus a bottle to preview, click to pick it ---- */
  const picker = document.getElementById('picker');
  const caption = document.getElementById('picker-caption');
  if (picker) {
    const items = FRAGRANCES.slice(0, 8);
    picker.innerHTML = items.map(f => `
      <a href="products.html?pick=${encodeURIComponent(f.id)}" data-id="${f.id}" aria-label="Choose ${f.name}">
        <img src="${f.img}" alt="" loading="lazy">
      </a>`).join('');
    const links = picker.querySelectorAll('a');
    const idle = window.matchMedia('(hover: none)').matches ? 'Tap a bottle to choose it' : 'Hover a bottle to preview it';
    caption.textContent = idle;
    const select = (a) => {
      links.forEach(l => l.classList.toggle('on', l === a));
      const f = items.find(x => x.id === a.dataset.id);
      caption.innerHTML = `<strong>${f.name}</strong>, ${f.family.toLowerCase()}. $${f.price}/month`;
    };
    links.forEach(a => {
      a.addEventListener('mouseenter', () => select(a));
      a.addEventListener('focus', () => select(a));
    });
    picker.addEventListener('mouseleave', () => {
      links.forEach(l => l.classList.remove('on'));
      caption.textContent = idle;
    });
  }
})();
