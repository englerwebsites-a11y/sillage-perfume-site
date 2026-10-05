(function(){
  const mode = localStorage.getItem('sillage_mode') || 'random';
  const selectedIds = getCartSelections();
  const container = document.getElementById('summary-item');
  const priceLabel = document.getElementById('price-label');
  const priceValue = document.getElementById('price-value');
  const priceTotal = document.getElementById('price-total');
  const accountBox = document.getElementById('checkout-account');
  const placeBtn = document.getElementById('place-order');
  const errorEl = document.getElementById('checkout-error');

  let pool;
  try {
    pool = JSON.parse(localStorage.getItem('sillage_pool'));
  } catch (e) { pool = null; }
  if (!Array.isArray(pool) || pool.length === 0) {
    pool = FRAGRANCES.map(f => f.id);
  }

  function setPrice(amount, label){
    priceLabel.textContent = label;
    priceValue.textContent = `$${formatPrice(amount)}`;
    priceTotal.textContent = `$${formatPrice(amount)}`;
  }

  /* ---------- order summary ---------- */
  // "Choose my own" box: one or more bottles. Falls back to Surprise me if the box is empty.
  const chosen = mode === 'chosen' && selectedIds.length ? selectedIds.map(findFragrance).filter(Boolean) : null;
  if (chosen) {
    container.className = 'summary-list';
    container.innerHTML = `
      <p class="summary-list-head">Your monthly box: <strong>${bottleCount(chosen.length)}</strong></p>
      ${bottleRowsHTML(selectedIds, 'Ships monthly')}`;
    setPrice(totalPrice(selectedIds), `Subscription (${bottleCount(chosen.length)})`);
  } else {
    const avg = averagePrice(pool);
    container.innerHTML = `
      <div class="glass-wrap">${mysteryVialSVG(46)}</div>
      <div>
        <p class="fam">Surprise me</p>
        <h3>Mystery bottle</h3>
        <p style="font-size:13.5px;color:var(--ink);opacity:0.65;margin-top:4px;">Picked from your ${pool.length}-fragrance rotation each month</p>
      </div>`;
    setPrice(avg, 'Subscription (avg. of rotation)');
  }

  /* ---------- account ---------- */
  const emailField = document.getElementById('email');
  const fields = {
    first: document.getElementById('fname'),
    last: document.getElementById('lname'),
    street: document.getElementById('addr'),
    city: document.getElementById('city'),
    zip: document.getElementById('zip')
  };

  function renderAccount(){
    const user = Auth.current();
    if (!user) {
      accountBox.className = 'checkout-account';
      accountBox.innerHTML = `
        <h2>Sign in to continue</h2>
        <p>Your subscription lives in your account, where you can change fragrances, skip a month, pause or cancel.</p>
        <a class="btn btn-primary btn-small" href="account.html?next=checkout.html">Sign in or create an account</a>`;
      placeBtn.disabled = true;
      placeBtn.textContent = 'Sign in to start your subscription';
      return;
    }

    const existing = user.subscription && user.subscription.status !== 'cancelled';
    accountBox.className = 'checkout-account signed-in';
    accountBox.innerHTML = `
      <p>Signed in as <strong>${esc(user.name)}</strong> (${esc(user.email)})</p>
      <button class="link-btn" type="button" id="checkout-signout">Not you? Sign out</button>
      ${existing ? `<p style="flex-basis:100%;color:var(--amber-deep);">You already have a subscription. Starting this one will replace it.</p>` : ''}`;
    document.getElementById('checkout-signout').addEventListener('click', () => {
      Auth.signOut();
      Object.values(fields).forEach(f => { f.value = ''; });
      emailField.value = '';
      renderAccount();
    });

    if (!emailField.value) emailField.value = user.contactEmail || user.email;
    const a = user.address || {};
    Object.keys(fields).forEach(k => {
      if (!fields[k].value) fields[k].value = a[k] || '';
    });
    placeBtn.disabled = false;
    placeBtn.textContent = existing ? 'Replace my subscription' : 'Start subscription';
  }

  /* ---------- confirm pop-up ---------- */
  const dialog = document.getElementById('confirm-dialog');
  const dialogBody = document.getElementById('confirm-body');
  const confirmBtn = document.getElementById('confirm-order');
  let pending = null;

  function validate(){
    const email = emailField.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorEl.textContent = 'Enter a valid email address, like name@example.com.';
      emailField.focus();
      return null;
    }
    const missing = Object.keys(fields).filter(k => !fields[k].value.trim());
    if (missing.length) {
      errorEl.textContent = 'Fill in your full shipping address to continue.';
      fields[missing[0]].focus();
      return null;
    }
    errorEl.textContent = '';
    const address = {};
    Object.keys(fields).forEach(k => { address[k] = fields[k].value.trim(); });
    return { email, address };
  }

  function openConfirm(details){
    const user = Auth.current();
    const replacing = user.subscription && user.subscription.status !== 'cancelled';
    const a = details.address;
    let product;
    if (chosen && chosen.length === 1) {
      const f = chosen[0];
      product = `
        <div class="cd-photo"><img src="${f.img}" alt="${esc(f.name)} bottle"></div>
        <p class="fam">${esc(f.family)}</p>
        <h3 id="confirm-title">${esc(f.name)}</h3>
        <p class="cd-sub">The same bottle every month</p>`;
    } else if (chosen) {
      product = `
        <div class="cd-photos cd-photos-${Math.min(chosen.length, 4)}">
          ${chosen.map(f => `<img src="${f.img}" alt="${esc(f.name)} bottle">`).join('')}
        </div>
        <p class="fam">Choose my own</p>
        <h3 id="confirm-title">${bottleCount(chosen.length)} a month</h3>
        <p class="cd-sub">${esc(chosen.map(f => f.name).join(', '))}</p>`;
    } else {
      product = `
        <div class="cd-photo cd-mystery">${mysteryVialSVG(70)}</div>
        <p class="fam">Surprise me</p>
        <h3 id="confirm-title">Mystery bottle</h3>
        <p class="cd-sub">One of ${pool.length} fragrances in your rotation, picked each month</p>`;
    }
    const price = chosen ? totalPrice(selectedIds) : averagePrice(pool);
    dialogBody.innerHTML = `
      ${product}
      <div class="cd-lines">
        <div class="summary-line"><span>${chosen ? `Subscription (${bottleCount(chosen.length)})` : 'Subscription (avg.)'}</span><span>$${formatPrice(price)}/month</span></div>
        <div class="summary-line"><span>Ships to</span><span>${esc(a.street)}, ${esc(a.city)}</span></div>
        <div class="summary-line"><span>Confirmation to</span><span>${esc(details.email)}</span></div>
      </div>
      ${replacing ? `<p class="cd-warn">This replaces your current subscription.</p>` : ''}`;
    confirmBtn.textContent = replacing ? 'Confirm and replace' : 'Confirm subscription';
    pending = details;
    dialog.showModal();
    confirmBtn.focus();
  }

  function placeOrder(details){
    const user = Auth.current();
    if (!user) return;
    user.contactEmail = details.email;
    user.address = details.address;

    const subMode = chosen ? 'chosen' : 'random';
    const sub = Sub.create(subMode, chosen ? selectedIds : [], pool);
    const orderNumber = sub.history[0].orderNumber;
    sub.history[0].email = details.email;
    sub.history[0].orderNumber = orderNumber;
    sub.history[0].address = Object.assign({}, details.address);
    // Keep past orders, but drop any order that hasn't shipped yet:
    // the new checkout replaces it rather than adding a second one.
    const old = user.subscription;
    if (old && old.history) {
      const kept = old.history.filter(h => h.status !== 'preparing');
      sub.history = kept.concat(sub.history);
    }
    user.subscription = sub;
    Auth.save(user);
    location.href = 'confirmation.html?order=' + orderNumber + '&new=1';
  }

  placeBtn.addEventListener('click', () => {
    if (!Auth.current()) return;
    const details = validate();
    if (details) openConfirm(details);
  });

  confirmBtn.addEventListener('click', () => {
    if (!pending) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Placing order…';
    setTimeout(() => placeOrder(pending), 600);
  });

  document.getElementById('confirm-back').addEventListener('click', () => dialog.close());
  // Click outside the box to close
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { pending = null; placeBtn.focus(); });

  renderAccount();
  // Reflect the sign-in state as soon as it resolves, so a returning
  // visitor sees their account without refreshing.
  document.addEventListener('sillage:auth', renderAccount);
})();
