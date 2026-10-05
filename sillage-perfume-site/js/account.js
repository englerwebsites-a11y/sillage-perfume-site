(function () {
  const params = new URLSearchParams(location.search);
  const ALLOWED_NEXT = ['checkout.html', 'products.html'];
  const next = ALLOWED_NEXT.includes(params.get('next')) ? params.get('next') : null;

  const $ = id => document.getElementById(id);
  const signedOut = $('signed-out');
  const signedIn = $('signed-in');
  const notice = $('notice');

  let openPanel = null; // 'pause' | 'cancel' | null

  function showNotice(text) {
    notice.textContent = text;
    notice.hidden = false;
  }
  function clearNotice() { notice.hidden = true; notice.textContent = ''; }

  function afterAuth() {
    if (next) { location.href = next; return; }
    clearNotice();
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- signed out: switch between sign in and create account ---------- */
  const tabs = { signin: $('tab-signin'), signup: $('tab-signup') };
  const forms = { signin: $('signin-form'), signup: $('signup-form') };

  function showAuth(which, focus) {
    Object.keys(forms).forEach(k => {
      const on = k === which;
      forms[k].hidden = !on;
      tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[k].tabIndex = on ? 0 : -1;
      tabs[k].classList.toggle('active', on);
    });
    $('si-error').textContent = '';
    $('su-error').textContent = '';
    // Carry a typed email across, so switching doesn't lose it
    const from = which === 'signin' ? $('su-email') : $('si-email');
    const to = which === 'signin' ? $('si-email') : $('su-email');
    if (from.value && !to.value) to.value = from.value;
    if (!Auth.current()) {
      $('head-title').textContent = which === 'signup' ? 'Create your account.' : 'Sign in to Sillage.';
    }
    if (focus === 'tab') tabs[which].focus();
    else if (focus) (which === 'signin' ? (to.value ? $('si-pass') : $('si-email')) : $('su-name')).focus();
    history.replaceState(null, '', location.pathname + location.search + (which === 'signup' ? '#create' : ''));
  }

  tabs.signin.addEventListener('click', () => showAuth('signin'));
  tabs.signup.addEventListener('click', () => showAuth('signup'));
  // Arrow keys move between tabs
  Object.values(tabs).forEach(t => t.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      showAuth(t === tabs.signin ? 'signup' : 'signin', 'tab');
    }
  }));
  document.querySelectorAll('[data-show]').forEach(b =>
    b.addEventListener('click', () => showAuth(b.getAttribute('data-show'), true)));

  showAuth(location.hash === '#create' ? 'signup' : 'signin');

  /* ---------- signed out ---------- */
  $('signin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await Auth.signIn($('si-email').value, $('si-pass').value);
    if (r.error) { $('si-error').textContent = r.error; return; }
    afterAuth();
  });

  $('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await Auth.signUp($('su-name').value, $('su-email').value, $('su-pass').value);
    if (r.error) { $('su-error').textContent = r.error; return; }
    afterAuth();
  });

  $('use-sample').addEventListener('click', () => {
    Auth.useSample();
    afterAuth();
  });

  /* ---------- signed in: subscription ---------- */
  function planItemHTML(sub) {
    const picks = subSelections(sub);
    if (sub.mode === 'chosen' && picks.length > 1) {
      return `<div class="summary-list plan-list">
        <p class="summary-list-head">Choose my own: <strong>${bottleCount(picks.length)} every month</strong></p>
        ${bottleRowsHTML(picks)}
      </div>`;
    }
    if (sub.mode === 'chosen') {
      const f = findFragrance(picks[0]);
      if (f) {
        return `
          <div class="glass-wrap" style="width:64px;height:80px;display:flex;align-items:center;justify-content:center;background:var(--paper-2);">
            <img src="${f.img}" alt="${esc(f.name)} bottle" style="height:100%;width:auto;object-fit:contain;">
          </div>
          <div>
            <p class="fam">${esc(f.family)}</p>
            <h3>${esc(f.name)}</h3>
            <p style="font-size:13.5px;color:#5a5a5a;margin-top:4px;">Choose my own: the same bottle every month</p>
          </div>`;
      }
    }
    const names = sub.pool.map(id => (findFragrance(id) || {}).name).filter(Boolean);
    return `
      <div class="glass-wrap">${mysteryVialSVG(46)}</div>
      <div>
        <p class="fam">Surprise me</p>
        <h3>Mystery bottle</h3>
        <p style="font-size:13.5px;color:#5a5a5a;margin-top:4px;">Picked from your ${names.length}-fragrance rotation: ${esc(names.join(', '))}</p>
      </div>`;
  }

  function statusHTML(sub) {
    const map = { active: 'Active', paused: 'Paused', cancelled: 'Cancelled' };
    return `<span class="status status-${sub.status}">${map[sub.status]}</span>`;
  }

  function planLinesHTML(sub) {
    const price = `$${formatPrice(Sub.price(sub))}/month`;
    const priceLabel = sub.mode === 'random' ? 'Price (avg. of rotation)' : 'Price';
    let lines = `<div class="summary-line"><span>${priceLabel}</span><span>${price}</span></div>`;
    if (sub.status === 'active') {
      lines += `<div class="summary-line"><span>Next shipment</span><span>${fmtDate(sub.nextShip)}</span></div>`;
      if (sub.skippedDate) {
        lines += `<div class="summary-line"><span>Skipped</span><span>${fmtDate(sub.skippedDate)} shipment</span></div>`;
      }
    } else if (sub.status === 'paused') {
      lines += `<div class="summary-line"><span>Paused until</span><span>${fmtDate(sub.pausedUntil)}</span></div>`;
    } else {
      lines += `<div class="summary-line"><span>Cancelled on</span><span>${fmtDate(sub.cancelledAt)}</span></div>`;
    }
    const u = Auth.current();
    if (u) lines += `<div class="summary-line"><span>Order emails go to</span><span>${esc(u.contactEmail || u.email)}</span></div>`;
    lines += `<div class="summary-line"><span>Member since</span><span>${fmtDate(sub.history.reduce((m, h) => new Date(h.date) < new Date(m) ? h.date : m, sub.startedAt))}</span></div>`;
    return `<div class="plan-lines">${lines}</div>`;
  }

  function actionsHTML(sub) {
    const change = `<a class="btn btn-outline-dark btn-small" href="products.html?edit=1">Change fragrances</a>`;
    if (sub.status === 'active') {
      const skip = sub.skippedDate
        ? `<button class="btn btn-outline-dark btn-small" type="button" data-act="unskip">Undo skip</button>`
        : `<button class="btn btn-outline-dark btn-small" type="button" data-act="skip">Skip next shipment</button>`;
      return `${change}${skip}
        <button class="btn btn-outline-dark btn-small" type="button" data-act="open-pause">Pause</button>
        <button class="btn btn-outline-dark btn-small" type="button" data-act="open-cancel">Cancel subscription</button>`;
    }
    if (sub.status === 'paused') {
      return `<button class="btn btn-primary btn-small" type="button" data-act="resume">Resume now</button>
        ${change}
        <button class="btn btn-outline-dark btn-small" type="button" data-act="open-cancel">Cancel subscription</button>`;
    }
    return `<button class="btn btn-primary btn-small" type="button" data-act="restart">Restart subscription</button>${change}`;
  }

  function pausePanelHTML(sub) {
    return `
      <div class="inline-panel">
        <h3>Pause your subscription</h3>
        <p style="margin:0 0 18px;">You won't be charged and nothing ships while you're paused.</p>
        <div class="field">
          <label for="pause-len">Pause for</label>
          <select id="pause-len">
            <option value="1">1 month</option>
            <option value="2">2 months</option>
            <option value="3">3 months</option>
          </select>
        </div>
        <p id="pause-preview" style="margin:0 0 20px;"></p>
        <div class="action-row">
          <button class="btn btn-primary btn-small" type="button" data-act="pause">Pause subscription</button>
          <button class="btn btn-outline-dark btn-small" type="button" data-act="close">Never mind</button>
        </div>
      </div>`;
  }

  function cancelPanelHTML() {
    return `
      <div class="inline-panel">
        <h3>Cancel your subscription</h3>
        <ul>
          <li>Any bottle that's already being prepared will still ship.</li>
          <li>No further charges after today.</li>
          <li>You can restart from this page any time.</li>
        </ul>
        <div class="field">
          <label for="cancel-reason">Tell us why (optional)</label>
          <select id="cancel-reason">
            <option value="">Prefer not to say</option>
            <option value="too-expensive">Too expensive</option>
            <option value="not-my-scent">Fragrances weren't right for me</option>
            <option value="too-frequent">Bottles arrive too often</option>
            <option value="other">Other</option>
          </select>
        </div>
        <p id="cancel-tip" style="margin:0 0 20px;" hidden>Getting too many bottles? You can <button class="link-btn" type="button" data-act="open-pause">pause instead</button> and keep your plan.</p>
        <div class="action-row">
          <button class="btn btn-primary btn-small" type="button" data-act="cancel">Confirm cancellation</button>
          <button class="btn btn-outline-dark btn-small" type="button" data-act="close">Keep my subscription</button>
        </div>
      </div>`;
  }

  function renderSub(user) {
    const block = $('sub-block');
    const sub = user.subscription;
    if (!sub) {
      block.innerHTML = `
        <div class="sub-head"><h2>Your subscription</h2></div>
        <p style="margin:0 0 22px;">You don't have a subscription yet. Choose a fragrance, or let us surprise you each month.</p>
        <a class="btn btn-primary" href="products.html">Browse the collection</a>`;
      return;
    }
    block.innerHTML = `
      <div class="sub-head"><h2>Your subscription</h2>${statusHTML(sub)}</div>
      ${sub.mode === 'chosen' && subSelections(sub).length > 1 ? planItemHTML(sub) : `<div class="summary-item">${planItemHTML(sub)}</div>`}
      ${planLinesHTML(sub)}
      <div class="action-row">${actionsHTML(sub)}</div>
      ${openPanel === 'pause' ? pausePanelHTML(sub) : ''}
      ${openPanel === 'cancel' ? cancelPanelHTML() : ''}`;

    if (openPanel === 'pause') {
      const sel = $('pause-len');
      const preview = $('pause-preview');
      const update = () => {
        const until = addMonths(new Date().toISOString(), Number(sel.value));
        preview.textContent = `Your next bottle would ship on ${fmtDate(until)}.`;
      };
      sel.addEventListener('change', update);
      update();
      sel.focus();
    }
    if (openPanel === 'cancel') {
      const sel = $('cancel-reason');
      sel.addEventListener('change', () => {
        $('cancel-tip').hidden = sel.value !== 'too-frequent';
      });
      sel.focus();
    }
  }

  function renderHistory(user) {
    const el = $('history');
    const list = user.subscription ? user.subscription.history.slice() : [];
    if (!list.length) {
      el.innerHTML = `<p class="history-empty">No orders yet. Your shipments will show up here.</p>`;
      return;
    }
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    const rows = list.map(h => {
      const ids = orderIds(h);
      const f = findFragrance(ids[0]);
      let name, sub;
      if (h.mode === 'chosen' && ids.length > 1) {
        const names = ids.map(id => (findFragrance(id) || {}).name).filter(Boolean);
        name = names.length > 2 ? `${names[0]} + ${names.length - 1} more` : names.join(' and ');
        sub = bottleCount(ids.length);
      } else if (h.mode === 'random' && h.status === 'preparing') {
        name = 'Mystery bottle';
        sub = 'Revealed when it arrives';
      } else {
        name = f ? f.name : 'Bottle';
        sub = h.mode === 'random' ? 'Surprise pick' : (f ? f.family : '');
      }
      const stage = Sub.stage(h);
      const status = ['', 'Order placed', 'Being prepared', 'Shipped', 'Delivered'][stage];
      const statusClass = stage === 4 ? 'delivered' : 'preparing';
      return `
        <div class="history-row">
          <span class="h-date">${fmtDate(h.date)}<small>${esc(h.orderNumber)}</small></span>
          <span class="h-name"><strong>${esc(name)}</strong><small>${esc(sub)}</small></span>
          <span class="h-price">$${formatPrice(h.price)}</span>
          <span class="h-status ${statusClass}">${status}</span>
          <a class="h-view" href="confirmation.html?order=${encodeURIComponent(h.orderNumber)}" aria-label="View order ${esc(h.orderNumber)}">View order</a>
        </div>`;
    }).join('');
    el.innerHTML = `
      <div class="history">
        <div class="history-row head"><span>Date</span><span>Fragrance</span><span>Price</span><span>Status</span><span></span></div>
        ${rows}
      </div>`;
  }

  function renderProfile(user) {
    $('profile').innerHTML = `
      <div class="summary-line"><span>Name</span><span>${esc(user.name)}</span></div>
      <div class="summary-line"><span>Email</span><span>${esc(user.email)}</span></div>
      <div class="summary-line"><span>Account created</span><span>${fmtDate(user.createdAt)}</span></div>`;
    const a = user.address || {};
    $('a-first').value = a.first || '';
    $('a-last').value = a.last || '';
    $('a-street').value = a.street || '';
    $('a-city').value = a.city || '';
    $('a-zip').value = a.zip || '';
  }

  /* ---------- actions ---------- */
  function act(action) {
    const user = Auth.current();
    if (!user || !user.subscription) return;
    const sub = user.subscription;
    const now = new Date().toISOString();

    switch (action) {
      case 'open-pause': openPanel = 'pause'; renderSub(user); return;
      case 'open-cancel': openPanel = 'cancel'; renderSub(user); return;
      case 'close': openPanel = null; renderSub(user); return;

      case 'skip':
        sub.skippedDate = sub.nextShip;
        sub.nextShip = addMonths(sub.nextShip, 1);
        showNotice(`Skipped. Your next bottle now ships on ${fmtDate(sub.nextShip)}.`);
        break;
      case 'unskip':
        sub.nextShip = sub.skippedDate;
        sub.skippedDate = null;
        showNotice(`Skip undone. Your next bottle ships on ${fmtDate(sub.nextShip)}.`);
        break;
      case 'pause': {
        const months = Number(($('pause-len') || {}).value || 1);
        sub.prePauseNext = sub.nextShip;
        sub.pausedUntil = addMonths(now, months);
        sub.nextShip = sub.pausedUntil;
        sub.skippedDate = null;
        sub.status = 'paused';
        showNotice(`Paused. Your subscription resumes on ${fmtDate(sub.pausedUntil)}.`);
        break;
      }
      case 'resume': {
        const soonest = addDays(now, 3);
        sub.nextShip = sub.prePauseNext && new Date(sub.prePauseNext) > new Date(soonest) ? sub.prePauseNext : soonest;
        sub.status = 'active';
        sub.pausedUntil = null;
        sub.prePauseNext = null;
        showNotice(`Resumed. Your next bottle ships on ${fmtDate(sub.nextShip)}.`);
        break;
      }
      case 'cancel':
        sub.cancelReason = ($('cancel-reason') || {}).value || '';
        sub.status = 'cancelled';
        sub.cancelledAt = now;
        sub.skippedDate = null;
        sub.pausedUntil = null;
        showNotice('Cancelled. No further charges will go out. You can restart any time.');
        break;
      case 'restart':
        sub.status = 'active';
        sub.cancelledAt = null;
        sub.cancelReason = '';
        sub.history.push(Sub.shipment(sub, now, 'preparing'));
        sub.nextShip = addMonths(now, 1);
        showNotice('Welcome back. Your first bottle is being prepared.');
        break;
      default: return;
    }
    openPanel = null;
    Auth.save(user);
    render();
    notice.scrollIntoView({ block: 'nearest' });
  }

  $('sub-block').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (btn) act(btn.getAttribute('data-act'));
  });

  $('address-form').addEventListener('submit', e => {
    e.preventDefault();
    const user = Auth.current();
    if (!user) return;
    user.address = {
      first: $('a-first').value.trim(),
      last: $('a-last').value.trim(),
      street: $('a-street').value.trim(),
      city: $('a-city').value.trim(),
      zip: $('a-zip').value.trim()
    };
    Auth.save(user);
    const msg = $('address-saved');
    msg.textContent = 'Address saved';
    setTimeout(() => { msg.textContent = ''; }, 2500);
  });

  $('sign-out').addEventListener('click', () => {
    Auth.signOut();
    openPanel = null;
    clearNotice();
    render();
    window.scrollTo(0, 0);
  });

  $('delete-account').addEventListener('click', async () => {
    if (!confirm('Delete your account and its order history? This permanently removes your account.')) return;
    await Auth.deleteAccount();
    render();
    showNotice('Your account has been deleted.');
  });

  /* ---------- render ---------- */
  function render() {
    const user = Auth.current();
    if (!user) {
      signedIn.hidden = true;
      signedOut.hidden = false;
      $('head-eyebrow').textContent = 'Your account';
      $('head-title').textContent = forms.signup.hidden ? 'Sign in to Sillage.' : 'Create your account.';
      $('head-text').textContent = next === 'checkout.html'
        ? 'Sign in or create an account to finish starting your subscription.'
        : 'Sign in to manage your subscription, or create an account to start one.';
      return;
    }
    if (user.subscription) {
      Sub.catchUp(user.subscription);
      Auth.save(user);
    }
    signedOut.hidden = true;
    signedIn.hidden = false;
    const first = (user.name || '').split(/\s+/)[0] || 'there';
    $('head-eyebrow').textContent = 'Your account';
    $('head-title').textContent = `Hi, ${first}.`;
    $('head-text').textContent = 'Manage your subscription, shipping address and past orders.';
    renderSub(user);
    renderHistory(user);
    renderProfile(user);
  }

  render();
  // Re-render when account data arrives or changes (sign-in resolving,
  // or a sync from the cloud after a change was made on another device).
  document.addEventListener('sillage:auth', render);

  if (params.get('welcome') === '1' && Auth.current()) {
    showNotice('Your subscription has started. Your first bottle is being prepared.');
  } else if (params.get('updated') === '1' && Auth.current()) {
    showNotice('Your plan has been updated. The change applies from your next shipment.');
  }
  if (params.has('welcome') || params.has('updated')) {
    history.replaceState(null, '', 'account.html' + (next ? '?next=' + next : ''));
  }
})();
