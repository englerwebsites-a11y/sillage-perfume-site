(function(){
  const grid = document.getElementById('product-grid');
  const modeRandomBtn = document.getElementById('mode-random');
  const modeChosenBtn = document.getElementById('mode-chosen');
  const caption = document.getElementById('mode-caption');
  const mysteryBanner = document.getElementById('mystery-banner');
  const mysteryHeading = document.getElementById('mystery-heading');
  const mysteryGlass = document.getElementById('mystery-glass');
  const selSummary = document.getElementById('sel-summary');

  const ALL_IDS = FRAGRANCES.map(f => f.id);

  // Editing an existing plan from the account page (products.html?edit=1)
  const user = (typeof Auth !== 'undefined') ? Auth.current() : null;
  const editing = new URLSearchParams(location.search).get('edit') === '1' && user && user.subscription;
  if (editing) {
    const s = user.subscription;
    localStorage.setItem('sillage_mode', s.mode);
    if (s.mode === 'chosen') setCartSelections(subSelections(s));
    localStorage.setItem('sillage_pool', JSON.stringify(s.pool));
  }

  // Links from the homepage: products.html?mode=random | ?mode=chosen | ?pick=<id>
  if (!editing) {
    const qp = new URLSearchParams(location.search);
    const m = qp.get('mode');
    if (m === 'random' || m === 'chosen') localStorage.setItem('sillage_mode', m);
    const pick = qp.get('pick');
    if (pick && ALL_IDS.includes(pick)) {
      localStorage.setItem('sillage_mode', 'chosen');
      const current = getCartSelections();
      if (!current.includes(pick)) setCartSelections(current.concat([pick]));
    }
  }

  let mode = localStorage.getItem('sillage_mode') || 'random';
  let selectedIds = getCartSelections();

  let pool;
  try {
    pool = JSON.parse(localStorage.getItem('sillage_pool'));
  } catch (e) { pool = null; }
  if (!Array.isArray(pool) || pool.length === 0) {
    pool = ALL_IDS.slice();
  }

  mysteryGlass.innerHTML = mysteryVialSVG(48);

  function savePool(){
    localStorage.setItem('sillage_pool', JSON.stringify(pool));
  }

  function renderGrid(){
    grid.innerHTML = FRAGRANCES.map((f, i) => {
      const classes = ['product-card'];
      let flagText = '';

      if (mode === 'chosen') {
        if (selectedIds.includes(f.id)) { classes.push('selected'); flagText = 'In your box'; }
      } else {
        const included = pool.includes(f.id);
        if (included) { classes.push('in-pool'); flagText = 'In rotation'; }
        else { classes.push('excluded'); }
      }

      const idx = String(i + 1).padStart(2, '0');

      return `
        <div class="${classes.join(' ')}" data-id="${f.id}" role="button" tabindex="0"
             aria-pressed="${mode === 'chosen' ? selectedIds.includes(f.id) : pool.includes(f.id)}"
             aria-label="${f.name}, ${f.family}, $${f.price}">
          <span class="pick-flag">${flagText}</span>
          <p class="idx">${idx}</p>
          <div class="product-photo"><img src="${f.img}" alt="${f.name} bottle" loading="lazy"></div>
          <p class="fam">${f.family}</p>
          <h3>${f.name}</h3>
          <p class="notes">${f.notes}</p>
          <p class="price">$${f.price}</p>
        </div>`;
    }).join('');

    grid.querySelectorAll('.product-card').forEach(card => {
      const toggle = () => {
        const id = card.getAttribute('data-id');
        if (mode === 'chosen') {
          if (selectedIds.includes(id)) {
            if (selectedIds.length === 1) { flashNote('Keep at least one bottle in your box.'); return; }
            selectedIds = selectedIds.filter(x => x !== id);
          } else {
            selectedIds = selectedIds.concat([id]);
          }
          setCartSelections(selectedIds);
        } else {
          if (pool.includes(id)) {
            if (pool.length === 1) return;
            pool = pool.filter(p => p !== id);
          } else {
            pool = pool.concat([id]);
          }
          savePool();
        }
        renderGrid();
        updateSummary();
        const again = grid.querySelector(`[data-id="${id}"]`);
        if (again) again.focus({ preventScroll: true });
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  let noteTimer = null;
  function flashNote(text){
    const prev = caption.dataset.prev || caption.textContent;
    caption.dataset.prev = prev;
    caption.textContent = text;
    caption.classList.add('flash');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      caption.textContent = caption.dataset.prev;
      delete caption.dataset.prev;
      caption.classList.remove('flash');
    }, 2200);
  }

  function updateMode(next){
    mode = next;
    localStorage.setItem('sillage_mode', mode);

    modeRandomBtn.classList.toggle('active', mode === 'random');
    modeChosenBtn.classList.toggle('active', mode === 'chosen');

    if (mode === 'random') {
      caption.textContent = "Click any fragrance below to include or leave it out of your surprise rotation — we'll only ever send you one from that group.";
      mysteryBanner.style.display = 'flex';
    } else {
      caption.textContent = "Click fragrances below to add them to your monthly box. Pick one, or several: each one ships as its own full-size bottle every month.";
      mysteryBanner.style.display = 'none';
      if (!selectedIds.length) {
        selectedIds = [FRAGRANCES[0].id];
        setCartSelections(selectedIds);
      }
    }
    renderGrid();
    updateSummary();
  }

  function updateSummary(){
    if (mode === 'random') {
      const avg = averagePrice(pool);
      mysteryHeading.textContent = `Your rotation: ${pool.length} of ${ALL_IDS.length} fragrances`;
      selSummary.innerHTML = `Mode: <span>Surprise me</span> — ${pool.length} of ${ALL_IDS.length} included — avg. $${formatPrice(avg)}/month`;
    } else {
      const names = selectedIds.map(id => (findFragrance(id) || {}).name).filter(Boolean);
      const list = names.length > 2 ? `${names.slice(0, 2).join(', ')} + ${names.length - 2} more` : names.join(' and ');
      selSummary.innerHTML = `Mode: <span>Choose my own</span> — ${bottleCount(names.length)} (${list}) — $${formatPrice(totalPrice(selectedIds))}/month`;
    }
  }

  if (editing) {
    const head = document.querySelector('.page-head');
    head.querySelector('.eyebrow').textContent = 'Your account';
    head.querySelector('h1').textContent = 'Change your plan.';
    head.querySelector('p:last-child').textContent = 'Switch modes, change which bottles are in your box, or adjust your rotation. Changes apply from your next shipment.';
    const btn = document.getElementById('continue-btn');
    btn.textContent = 'Save to my plan';
    btn.setAttribute('href', 'account.html');
    btn.addEventListener('click', e => {
      e.preventDefault();
      const u = Auth.current();
      if (!u || !u.subscription) { location.href = 'account.html'; return; }
      u.subscription.mode = mode;
      u.subscription.selection = null;
      u.subscription.selections = mode === 'chosen' ? selectedIds.slice() : [];
      u.subscription.pool = pool.slice();
      Auth.save(u);
      location.href = 'account.html?updated=1';
    });
    const cta = document.querySelector('.nav-cta');
    if (cta) { cta.textContent = 'Back to account'; cta.setAttribute('href', 'account.html'); }
  }

  modeRandomBtn.addEventListener('click', () => updateMode('random'));
  modeChosenBtn.addEventListener('click', () => updateMode('chosen'));

  updateMode(mode);
})();
