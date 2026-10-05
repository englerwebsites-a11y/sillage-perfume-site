(function () {
  const $ = id => document.getElementById(id);
  const form = $('support-form');
  const sent = $('support-sent');
  const user = Auth.current();

  // Prefill for signed-in visitors, and offer their order numbers
  if (user) {
    $('s-name').value = user.name || '';
    $('s-email').value = user.contactEmail || user.email || '';
    const orders = (user.subscription && user.subscription.history || [])
      .slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (orders.length) {
      const field = $('s-order-field');
      field.innerHTML = `
        <label for="s-order">Order (optional)</label>
        <select id="s-order">
          <option value="">Not about a specific order</option>
          ${orders.map(o => {
            const ids = orderIds(o);
            const f = findFragrance(ids[0]);
            const name = ids.length > 1 ? bottleCount(ids.length)
              : (o.mode === 'random' && o.status === 'preparing' ? 'Mystery bottle' : (f ? f.name : 'Bottle'));
            return `<option value="${esc(o.orderNumber)}">${esc(o.orderNumber)}, ${esc(name)}, ${fmtDate(o.date)}</option>`;
          }).join('')}
        </select>`;
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('s-name').value.trim();
    const email = $('s-email').value.trim();
    const topic = $('s-topic').value;
    const message = $('s-message').value.trim();
    const err = $('s-error');
    if (!name) { err.textContent = 'Enter your name.'; $('s-name').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter a valid email address, like name@example.com.'; $('s-email').focus(); return; }
    if (!topic) { err.textContent = 'Choose a topic.'; $('s-topic').focus(); return; }
    if (message.length < 10) { err.textContent = 'Add a little more detail to your message.'; $('s-message').focus(); return; }
    err.textContent = '';

    $('sent-name').textContent = name.split(/\s+/)[0];
    $('sent-email').textContent = email;
    $('sent-ref').textContent = 'HELP-' + String(Math.floor(10000 + Math.random() * 90000));
    form.hidden = true;
    sent.hidden = false;
    sent.focus();
  });

  $('send-another').addEventListener('click', () => {
    $('s-topic').value = '';
    $('s-message').value = '';
    sent.hidden = true;
    form.hidden = false;
    $('s-topic').focus();
  });
})();
