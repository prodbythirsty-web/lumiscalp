'use strict';

/* ── PRICING (must mirror order.js server-side prices exactly) ── */
const BUNDLES = {
  1: { qty: 1, price: 79,  was: 158 },
  2: { qty: 2, price: 138, was: 316 },
};
const ADDON_LIST = [
  { id: 'ship', icon: '\u{1F4E6}',     name: 'Shipping Protection',          price: 6  },
  { id: 'warr', icon: '\u{1F6E1}\uFE0F', name: 'Extended 90-Day Warranty',   price: 7  },
  { id: 'myst', icon: '\u{1F381}',     name: 'Mystery Scalp Serum Gift',     price: 15 },
  { id: 'supp', icon: '\u{1F48A}',     name: 'LumiScalp Hair Supplement',    price: 15 },
];

let selBundle = 2;
let cartItems = [];
let curStep   = 1;

/* ── COUNTDOWN ── */
(function () {
  const KEY = 'lumiscalp_sale_end_v1';
  let end = Number(sessionStorage.getItem(KEY));
  if (!end || end < Date.now()) {
    end = Date.now() + ((2 * 86400) + (23 * 3600) + (55 * 60)) * 1000;
    sessionStorage.setItem(KEY, end);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    let d = Math.max(0, end - Date.now());
    const D = Math.floor(d / 86400000); d %= 86400000;
    const H = Math.floor(d / 3600000);  d %= 3600000;
    const M = Math.floor(d / 60000);    d %= 60000;
    const S = Math.floor(d / 1000);
    const dEl = document.getElementById('cd-d');
    const hEl = document.getElementById('cd-h');
    const mEl = document.getElementById('cd-m');
    const sEl = document.getElementById('cd-s');
    if (dEl) dEl.textContent = pad(D);
    if (hEl) hEl.textContent = pad(H);
    if (mEl) mEl.textContent = pad(M);
    if (sEl) sEl.textContent = pad(S);
  }
  tick(); setInterval(tick, 1000);
})();

/* ── MEDIA SWITCHER ── */
function switchMedia(btn, type, src, label) {
  const img = document.getElementById('main-img');
  const vid = document.getElementById('main-video');
  if (type === 'video') {
    img.style.display = 'none';
    vid.style.display = 'block';
    if (vid.src !== src) { vid.src = src; }
    vid.play();
  } else {
    vid.style.display = 'none';
    img.style.display = 'block';
    img.src = src;
    img.alt = 'LumiScalp Hair Therapy Cap \u2014 ' + label;
  }
  document.querySelectorAll('.thumb').forEach(t =>
    t.setAttribute('aria-selected', t === btn ? 'true' : 'false')
  );
}
function switchImg(btn, src, label) { switchMedia(btn, 'image', src, label); }

/* ── BUNDLE SELECT ── */
function selectBundle(n) {
  selBundle = n;
  [1, 2].forEach(i => {
    const c   = document.getElementById('card-' + i);
    const sel = (i === n);
    c.classList.toggle('selected', sel);
    c.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  const b = BUNDLES[n];
  const heroPrice = document.getElementById('hero-price');
  const heroWas   = document.getElementById('hero-was');
  if (heroPrice) heroPrice.textContent = '$' + b.price + '.00';
  if (heroWas)   heroWas.textContent   = '$' + b.was   + '.00';
  updateTotalPrice();
}

function updateTotalPrice() {
  const b     = BUNDLES[selBundle];
  const ads   = getAddonsForBundle(selBundle);
  const extra = ADDON_LIST.reduce((s, a) => s + (ads[a.id] ? a.price : 0), 0);
  const total = b.price + extra;
  const totalEl  = document.getElementById('total-price');
  const atcPrice = document.getElementById('atc-price');
  if (totalEl)  totalEl.textContent  = '$' + total + '.00';
  if (atcPrice) atcPrice.textContent = '$' + total + '.00';
}

function toggleAddon(e, el, bundleId, addonId) {
  e.stopPropagation();
  const on = !el.classList.contains('checked');
  el.classList.toggle('checked', on);
  el.innerHTML = on ? '\u2713' : '';
  el.setAttribute('aria-checked', on ? 'true' : 'false');
  updateTotalPrice();
}

function getAddonsForBundle(n) {
  const card = document.getElementById('addons-' + n);
  const res  = {};
  ADDON_LIST.forEach(a => {
    const check = card ? card.querySelector('[data-addon="' + a.id + '"] .addon-check') : null;
    res[a.id] = check ? check.classList.contains('checked') : false;
  });
  return res;
}

function cartTotal() {
  return cartItems.reduce((sum, item) => {
    const b   = BUNDLES[item.bundle];
    const ext = ADDON_LIST.reduce((s, a) => s + (item.addons[a.id] ? a.price : 0), 0);
    return sum + b.price + ext;
  }, 0);
}

/* ── CART RENDER ── */
function renderCart() {
  const itemsEl  = document.getElementById('drawer-items');
  const footerEl = document.getElementById('drawer-footer');
  const emptyEl  = document.getElementById('empty-cart');
  const THUMB    = 'hat1.jpg';

  if (!cartItems.length) {
    if (emptyEl)  emptyEl.style.display  = 'block';
    if (footerEl) footerEl.style.display = 'none';
    // clear any old rendered items
    const oldItems = itemsEl ? itemsEl.querySelectorAll('.cart-item') : [];
    oldItems.forEach(el => el.remove());
    return;
  }

  if (emptyEl)  emptyEl.style.display  = 'none';
  if (footerEl) footerEl.style.display = 'block';

  // Remove old items, re-render
  const oldItems = itemsEl ? itemsEl.querySelectorAll('.cart-item') : [];
  oldItems.forEach(el => el.remove());

  let html = '';
  cartItems.forEach((item, idx) => {
    const b     = BUNDLES[item.bundle];
    const saved = b.was - b.price;
    html += `
      <div class="cart-item">
        <div class="cart-item-top">
          <img class="cart-item-img" src="${THUMB}" alt="LumiScalp Hair Therapy Cap">
          <div class="cart-item-info">
            <div class="cart-item-name">LumiScalp Hair Therapy Cap</div>
            <div class="cart-item-detail">Qty: ${b.qty} &bull; Red Light Therapy</div>
            <div class="cart-item-price">$${b.price}.00</div>
          </div>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-stepper">
            <button class="qty-btn" onclick="changeBundleQty(${idx},-1)">&#8722;</button>
            <span class="qty-num">${b.qty}</span>
            <button class="qty-btn" onclick="changeBundleQty(${idx},1)">+</button>
          </div>
          <button class="cart-item-remove" onclick="removeItem(${idx})" aria-label="Remove item">Remove</button>
        </div>
      </div>`;

    ADDON_LIST.forEach(a => {
      if (!item.addons[a.id]) return;
      html += `
        <div class="cart-item">
          <div class="cart-item-top">
            <div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:30px;background:var(--dark-mid)">${a.icon}</div>
            <div class="cart-item-info">
              <div class="cart-item-name">${a.name}</div>
              <div class="cart-item-detail">Add-on</div>
              <div class="cart-item-price">$${a.price}.00</div>
            </div>
          </div>
          <div class="cart-item-bottom">
            <span></span>
            <button class="cart-item-remove" onclick="removeAddonFromItem(${idx},'${a.id}')" aria-label="Remove add-on">Remove</button>
          </div>
        </div>`;
    });
  });

  // Inject before footer
  if (itemsEl) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
      itemsEl.insertBefore(tempDiv.firstChild, footerEl || null);
    }
  }

  // Update total in drawer
  const drawerTotal = document.getElementById('drawer-total-price');
  if (drawerTotal) drawerTotal.textContent = '$' + cartTotal() + '.00';
}

function changeBundleQty(idx, delta) {
  const newBundle = cartItems[idx].bundle + delta;
  if (newBundle < 1) { removeItem(idx); return; }
  if (newBundle > 2) return;
  cartItems[idx].bundle = newBundle;
  updateBadge(); renderCart();
}

function removeAddonFromItem(idx, addonId) {
  if (cartItems[idx]) { cartItems[idx].addons[addonId] = false; }
  updateBadge(); renderCart();
}

function removeItem(i) { cartItems.splice(i, 1); updateBadge(); renderCart(); }

function updateBadge() {
  const badge = document.getElementById('cart-badge');
  const n = cartItems.reduce((s, item) => {
    return s + BUNDLES[item.bundle].qty + ADDON_LIST.filter(a => item.addons[a.id]).length;
  }, 0);
  if (badge) {
    badge.textContent = n;
    badge.classList.toggle('show', n > 0);
  }
}

function addToCart() {
  const addons = getAddonsForBundle(selBundle);
  cartItems.push({ bundle: selBundle, addons });
  updateBadge();
  renderCart();
  toast('\u{1F6D2} Added to cart!');
  setTimeout(openCart, 350);
}

function buyNow() {
  const addons = getAddonsForBundle(selBundle);
  cartItems = [{ bundle: selBundle, addons }];
  updateBadge();
  renderCart();
  openCheckout();
}

/* ── CART DRAWER ── */
function openCart() {
  renderCart();
  document.getElementById('cart-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── CHECKOUT ── */
function openCheckout() {
  closeCart();
  try {
    sessionStorage.setItem('ls_cart', JSON.stringify(cartItems));
  } catch(e) {}
  window.location.href = '/checkout.html';
}
function closeCheckout() {
  // no-op: checkout is a separate page
}
function closeAll() { closeCart(); closeCheckout(); }

function showSuccess() {
  document.getElementById('form-wrap').style.display    = 'none';
  document.getElementById('success-wrap').style.display = 'block';
  document.getElementById('checkout-box').scrollTop = 0;
}

function showStep(n) {
  if (curStep === 2 && n !== 2) {
    const errEl = document.getElementById('stripe-element-errors');
    if (errEl) errEl.textContent = '';
  }
  curStep = n;
  [1, 2, 3].forEach(i => {
    document.getElementById('panel-' + i).classList.toggle('active', i === n);
    const tab = document.getElementById('tab-' + i);
    tab.classList.remove('active', 'done');
    if (i === n)    tab.classList.add('active');
    else if (i < n) tab.classList.add('done');
  });
  if (n === 3) renderReview();
  if (n === 2) initStripePaymentElement();
  document.getElementById('checkout-box').scrollTop = 0;
}

function checkField(fieldId, groupId, fn) {
  const el  = document.getElementById(fieldId);
  const grp = document.getElementById(groupId);
  const ok  = fn ? fn(el.value.trim()) : el.value.trim().length > 0;
  grp.classList.toggle('has-err', !ok);
  return ok;
}
function validateStep(n) {
  if (n === 1) {
    return !!(
      checkField('f-fn', 'fg-fn') &
      checkField('f-ln', 'fg-ln') &
      checkField('f-em', 'fg-em', v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) &
      checkField('f-ad', 'fg-ad') &
      checkField('f-ct', 'fg-ct') &
      checkField('f-zp', 'fg-zp')
    );
  }
  if (n === 2) return validatePaymentElement();
  return true;
}
function goStep(n) {
  if (n > curStep && !validateStep(curStep)) return;
  showStep(n);
}

/* ── ORDER REVIEW ── */
function renderReview() {
  const sum = document.getElementById('review-summary');
  const ael = document.getElementById('review-addons');
  if (!cartItems.length) {
    sum.innerHTML = '<p style="color:var(--text-muted)">Your cart is empty.</p>';
    return;
  }

  let rows = '', sub = 0;
  cartItems.forEach(item => {
    const b = BUNDLES[item.bundle];
    rows += `<div class="cos-row"><span class="cn">LumiScalp Cap &times;${b.qty}</span><span class="cp">$${b.price}.00</span></div>`;
    sub  += b.price;
  });

  const masterAddons = cartItems[0].addons;
  let aTotal = 0;
  ADDON_LIST.forEach(a => {
    if (masterAddons[a.id]) {
      rows   += `<div class="cos-row"><span class="cn">${a.icon} ${a.name}</span><span class="cp">+$${a.price}.00</span></div>`;
      aTotal += a.price;
    }
  });

  const tot = sub + aTotal;
  sum.innerHTML = rows
    + '<div class="cos-div"></div>'
    + '<div class="cos-row"><span class="cn">Shipping</span><span class="cp" style="color:var(--success)">FREE</span></div>'
    + '<div class="cos-div"></div>'
    + `<div class="cos-total"><span>Total</span><span id="rev-total">$${tot}.00</span></div>`;

  let ah = '';
  ADDON_LIST.forEach(a => {
    const on = masterAddons[a.id];
    ah += `<div class="ca-row${on ? ' on' : ''}" id="ra-${a.id}" onclick="toggleRevAddon('${a.id}')"
      style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer;gap:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:22px;height:22px;border-radius:5px;border:2px solid ${on ? 'var(--crimson)' : 'var(--border-mid)'};background:${on ? 'var(--crimson)' : 'transparent'};display:flex;align-items:center;justify-content:center;font-size:12px;color:white;flex-shrink:0">${on ? '\u2713' : ''}</div>
        <span style="font-size:13px;color:var(--text-secondary)">${a.icon} ${a.name}</span>
      </div>
      <span style="font-size:13px;color:var(--text-muted)">+$${a.price}.00</span>
    </div>`;
  });
  ael.innerHTML = ah;
}

function toggleRevAddon(id) {
  cartItems.forEach(item => { item.addons[id] = !item.addons[id]; });
  renderReview();
}

/* ── STRIPE ── */
const STRIPE_PK = 'pk_live_51TdPvsK2cuhO8Q3M3WKZoAGbe9AxlUndp85LfhfqO48Dyr5y25zwlfqr45ZUA2cSrCpFsxF1nmeo1gPy5VxNcaNE00qwrYSW2R';

let stripeInstance    = null;
let stripeElements    = null;
let paymentElement    = null;
let clientSecretCache = null;

async function initStripePaymentElement() {
  if (paymentElement) return;
  try {
    stripeInstance = Stripe(STRIPE_PK);
    const total = cartTotal();
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total * 100, items: cartItems }),
    });
    const data = await res.json();
    if (!data.clientSecret) throw new Error('Could not initialise payment.');
    clientSecretCache = data.clientSecret;
    stripeElements = stripeInstance.elements({ clientSecret: clientSecretCache });
    paymentElement = stripeElements.create('payment');
    paymentElement.mount('#stripe-payment-element');
  } catch (err) {
    const errEl = document.getElementById('stripe-element-errors');
    if (errEl) errEl.textContent = 'Payment setup failed: ' + err.message;
  }
}

function validatePaymentElement() {
  if (!paymentElement) {
    const errEl = document.getElementById('stripe-element-errors');
    if (errEl) errEl.textContent = 'Payment form not ready. Please wait a moment and try again.';
    return false;
  }
  const errEl = document.getElementById('stripe-element-errors');
  if (errEl) errEl.textContent = '';
  return true;
}

async function placeOrder() {
  const btn = document.getElementById('place-btn');
  btn.textContent = '\u23F3 Placing...';
  btn.disabled = true;

  try {
    if (!stripeInstance || !stripeElements || !clientSecretCache) {
      throw new Error('Payment not initialised. Please go back to the Payment step.');
    }

    const { error, paymentIntent } = await stripeInstance.confirmPayment({
      elements: stripeElements,
      confirmParams: {
        return_url: window.location.origin + '/?order=success',
        receipt_email: document.getElementById('f-em').value.trim(),
        shipping: {
          name: document.getElementById('f-fn').value.trim() + ' ' + document.getElementById('f-ln').value.trim(),
          address: {
            line1:       document.getElementById('f-ad').value.trim(),
            city:        document.getElementById('f-ct').value.trim(),
            postal_code: document.getElementById('f-zp').value.trim(),
            state:       document.getElementById('f-st').value.trim(),
            country:     document.getElementById('f-co').value,
          },
        },
      },
      redirect: 'if_required',
    });

    if (error) {
      const errEl = document.getElementById('stripe-element-errors');
      if (errEl) errEl.textContent = error.message;
      btn.textContent = '\u2713 Place Order';
      btn.disabled = false;
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      showSuccess();
      resetCart();
    } else {
      const errEl = document.getElementById('stripe-element-errors');
      if (errEl) errEl.textContent = 'Payment was not completed. Please try again.';
      btn.textContent = '\u2713 Place Order';
      btn.disabled = false;
    }
  } catch (err) {
    alert('Error: ' + err.message);
    btn.textContent = '\u2713 Place Order';
    btn.disabled = false;
  }
}

function resetCart() {
  cartItems = [];
  paymentElement    = null;
  stripeElements    = null;
  clientSecretCache = null;
  updateBadge();
  renderCart();
}

/* ── TOAST ── */
let toastTimer = null;
function toast(msg) {
  let t = document.getElementById('ls-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ls-toast';
    t.style.cssText = [
      'position:fixed','bottom:32px','left:50%','transform:translateX(-50%) translateY(20px)',
      'background:var(--dark-mid)','color:var(--text-primary)',
      'border:1px solid var(--border-mid)',
      'padding:12px 24px','border-radius:40px',
      'font-size:14px','font-weight:600',
      'z-index:9999','opacity:0',
      'transition:opacity .25s,transform .25s',
      'pointer-events:none','white-space:nowrap',
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2600);
}

/* ── SCROLL REVEAL ── */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── ESC KEY ── */
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

/* ── INIT ── */
selectBundle(2);
renderCart();
updateTotalPrice();
