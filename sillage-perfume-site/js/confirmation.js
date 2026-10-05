(function () {
  const root = document.getElementById('confirm-root');
  const params = new URLSearchParams(location.search);
  const orderNumber = params.get('order');
  const justOrdered = params.get('new') === '1';
  const user = Auth.current();
  const sub = user && user.subscription;
  if (sub) { Sub.catchUp(sub); Auth.save(user); }
  const order = sub && sub.history.find(h => h.orderNumber === orderNumber);

  const $ = id => document.getElementById(id);

  if (!order) {
    $('c-eyebrow').textContent = 'Order not found';
    $('c-title').textContent = "We couldn't find that order.";
    $('c-text').textContent = user
      ? 'It may have been replaced by a newer order. Your current subscription and order history are in your account.'
      : 'Sign in to see your subscription and order history.';
    root.innerHTML = `
      <div class="confirm-actions" style="margin-top:0;">
        <a class="btn btn-primary" href="account.html#order-history">${user ? 'Go to order history' : 'Sign in'}</a>
        <a class="btn btn-outline-dark" href="products.html">Browse the collection</a>
      </div>`;
    return;
  }

  // Remove ?new=1 so a refresh or a later visit reads as a saved order
  if (justOrdered) history.replaceState(null, '', 'confirmation.html?order=' + encodeURIComponent(orderNumber));

  const ids = orderIds(order);
  const multi = order.mode === 'chosen' && ids.length > 1;
  const stage = Sub.stage(order);
  const delivered = stage === 4;
  const isLatest = sub.history.every(h => new Date(h.date) <= new Date(order.date));

  /* ---------- page heading ---------- */
  if (justOrdered) {
    const first = (user.name || '').split(/\s+/)[0];
    $('c-eyebrow').textContent = 'Order confirmed';
    $('c-title').textContent = first ? `Thank you, ${first}.` : 'Thank you.';
    $('c-text').textContent = order.mode === 'chosen'
      ? (multi ? `Your subscription has started and your first box of ${ids.length} bottles is being prepared.`
               : 'Your subscription has started and your first bottle is being prepared.')
      : 'Your subscription has started. Your first mystery bottle is being prepared.';
    document.title = `Order ${orderNumber} confirmed — Sillage`;
  } else {
    $('c-eyebrow').textContent = 'Order confirmation';
    $('c-title').textContent = `Order ${orderNumber}`;
    $('c-text').textContent = `Placed on ${fmtDate(order.date)}.`;
    document.title = `Order ${orderNumber} — Sillage`;
    const cta = document.querySelector('.nav-cta');
    if (cta) { cta.textContent = 'Back to order history'; cta.href = 'account.html#order-history'; }
  }

  /* ---------- product side ---------- */
  const f = findFragrance(ids[0]);
  let productHTML;
  if (multi) {
    const bottles = ids.map(findFragrance).filter(Boolean);
    productHTML = `
      <div class="confirm-grid confirm-grid-${Math.min(bottles.length, 4)}">
        ${bottles.map(b => `<img src="${b.img}" alt="${esc(b.name)} bottle">`).join('')}
      </div>
      <p class="fam">Choose my own</p>
      <h2>${bottleCount(bottles.length)}</h2>
      <ul class="confirm-bottles">
        ${bottles.map(b => `
          <li><strong>${esc(b.name)}</strong><span>${esc(b.family)}. ${esc(b.notes)}</span><em>$${formatPrice(b.price)}</em></li>`).join('')}
      </ul>`;
  } else if (order.mode === 'random' && !delivered) {
    const pool = (sub.pool || []).map(findFragrance).filter(Boolean);
    productHTML = `
      <div class="confirm-photo">${mysteryVialSVG(120)}</div>
      <p class="fam">Surprise me</p>
      <h2>Mystery bottle</h2>
      <p class="notes">It's one of the ${pool.length} fragrances in your rotation. You'll find out which when it arrives.</p>
      <div class="rotation-strip">
        ${pool.map(p => `
          <figure>
            <img src="${p.img}" alt="${esc(p.name)} bottle" loading="lazy">
            <figcaption>${esc(p.name)}</figcaption>
          </figure>`).join('')}
      </div>`;
  } else if (f) {
    productHTML = `
      <div class="confirm-photo has-img"><img src="${f.img}" alt="${esc(f.name)} bottle"></div>
      <p class="fam">${order.mode === 'random' ? 'Your surprise pick' : esc(f.family)}</p>
      <h2>${esc(f.name)}</h2>
      <p class="notes">${esc(f.notes)}</p>`;
  } else {
    productHTML = `<h2>Bottle</h2>`;
  }

  /* ---------- details side ---------- */
  const a = order.address || user.address || {};
  const priceLabel = order.mode === 'chosen'
    ? (multi ? `Subscription (${bottleCount(ids.length)})` : 'Subscription')
    : 'Subscription (avg. of rotation)';
  const showNextBilling = isLatest && sub.status === 'active';
  const email = order.email || user.contactEmail || user.email;

  /* ---------- shipping status ---------- */
  const steps = [
    { label: 'Order placed', date: order.date },
    { label: 'Being prepared', date: order.date },
    { label: 'Shipped', date: addDays(order.date, 3) },
    { label: 'Delivered', date: addDays(order.date, 5) }
  ];
  const statusNow = steps[stage - 1].label;
  const trackerHTML = `
    <div class="ship-status" id="shipping-status">
      <div class="ship-status-head">
        <h2>Shipping status</h2>
        <span class="status">${statusNow}</span>
      </div>
      <ol class="tracker">
        ${steps.map((s, i) => {
          const n = i + 1;
          const state = n < stage ? 'done' : n === stage ? 'current' : 'todo';
          const when = n <= stage ? fmtDate(s.date) : `Expected ${fmtDate(s.date)}`;
          return `
            <li class="tracker-step ${state}" ${state === 'current' ? 'aria-current="step"' : ''}>
              <span class="tracker-dot" aria-hidden="true"></span>
              <strong>${s.label}</strong>
              <span>${when}</span>
            </li>`;
        }).join('')}
      </ol>
      <div class="demo-shipping-note" role="note">
        <strong>This is a demo website.</strong>
        Sillage isn't a real store, so nothing is actually being shipped. No bottle will arrive, no card was charged, and these shipping updates are simulated to show how order tracking would work.
      </div>
    </div>`;

  root.innerHTML = `
    <div class="confirm-layout">
      <div class="confirm-product">${productHTML}</div>
      <div class="confirm-details">
        <h2>Order details</h2>
        <p class="order-no">Order number <strong>${esc(orderNumber)}</strong></p>
        <div class="summary-line"><span>Ordered on</span><span>${fmtDate(order.date)}</span></div>
        <div class="summary-line"><span>${priceLabel}</span><span>$${formatPrice(order.price)}/month</span></div>
        <div class="summary-line"><span>Shipping</span><span>Free</span></div>
        <div class="summary-line"><span>Status</span><span><a href="#shipping-status" style="color:inherit;">${statusNow}</a></span></div>
        ${showNextBilling ? `<div class="summary-line"><span>Next billing date</span><span>${fmtDate(sub.nextShip)}</span></div>` : ''}
        <p class="ship-to">
          <span>Shipping to</span>
          ${esc([a.first, a.last].filter(Boolean).join(' '))}<br>
          ${esc(a.street)}<br>
          ${esc([a.city, a.zip].filter(Boolean).join(' '))}
        </p>
        <p style="font-size:14px;color:#5a5a5a;margin:22px 0 0;">${justOrdered ? 'A confirmation email is on its way to' : 'Confirmation sent to'} <strong style="color:var(--ink);">${esc(email)}</strong>.${justOrdered ? ' You can change your fragrance, skip a month, pause or cancel any time from your account.' : ''}</p>
        <div class="confirm-actions">
          <a class="btn btn-primary" href="account.html#order-history">${justOrdered ? 'Go to my account' : 'Back to order history'}</a>
          <a class="btn btn-outline-dark" href="products.html">Keep browsing</a>
        </div>
      </div>
    </div>
    ${trackerHTML}`;
})();
