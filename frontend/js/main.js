/* =============================================================
   EZMART — MAIN SCRIPT
   Sections: Config · Data · State · Rendering · Cart drawer
   Location · Order submission · Hero slider · Google sign-in · Init
============================================================= */

/* ---------- Config — edit these for your shop ---------- */
const OWNER_WHATSAPP = "916399791643"; // country code + number, no + or spaces
const SHOP_NAME = "EZmart";
const GOOGLE_CLIENT_ID = "824990308971-i6ruaje7bi6ihcmv53ugcjfenh927hg3.apps.googleusercontent.com";

/* ---------- Data: flavours & products ---------- */
const FLAVORS = [
  {
    id: "choc",
    name: "Chocolate Truffle",
    base: "#5C3324",
    accent: "#2E1509",
    pricePerPound: 150,
  },
  {
    id: "van",
    name: "Vanilla",
    base: "#EDE0C0",
    accent: "#FFF8E9",
    pricePerPound: 130,
  },
  {
    id: "rv",
    name: "Red Velvet",
    base: "#7A1F2C",
    accent: "#FFF3E9",
    pricePerPound: 280,
  },
  {
    id: "bscotch",
    name: "Butterscotch",
    base: "#B97A33",
    accent: "#6B4420",
    pricePerPound: 130,
  },
  {
    id: "bf",
    imagePrefix: "bf",
    name: "Black Forest",
    base: "#3B1818",
    accent: "#8C1F2B",
    pricePerPound: 130,
  },
  {
    id: "pine",
    name: "Pineapple",
    base: "#E8C24A",
    accent: "#FFF6D8",
    pricePerPound: 130,
  },
  {
    id: "straw",
    name: "Strawberry",
    base: "#D94F70",
    accent: "#FFD9E0",
    pricePerPound: 130,
  },
  {
    id: "darkchoc",
    name: "Dark Chocolate",
    base: "#2B160D",
    accent: "#5C3324",
    pricePerPound: 250,
  },
  {
    id: "mava",
    name: "Special Mava Cake",
    base: "#D8B384",
    accent: "#FFF2DD",
    pricePerPound: 300,
  },
  {
    id: "blueberry",
    name: "Blueberry",
    base: "#3B4A7A",
    accent: "#C7D3F2",
    pricePerPound: 180,
    available: true,
  },
  {
    id: "mango",
    name: "Mango",
    base: "#F2A93B",
    accent: "#FFE9C2",
    pricePerPound: 189,
    available: true,
  },
  {
    id: "elaichi",
    name: "Elaichi",
    base: "#8FA35E",
    accent: "#EAF2DC",
    pricePerPound: 180,
    available: true,
  },
  {
    id: "blackcurrant",
    name: "Black Currant",
    base: "#4A1E4A",
    accent: "#D9B8E0",
    pricePerPound: 180,
    available: true,
  },
  {
    id: "fruitcake",
    name: "Fruit Cake",
    base: "#C9622E",
    accent: "#FFE3C7",
    pricePerPound: 300,
    available: true,
  },
  {
    id: "rasmalai",
    name: "Rasmalai Cake",
    base: "#E9CE8F",
    accent: "#7A5A2E",
    pricePerPound: 300,
    available: true,
  },
  {
    id: "brownie",
    name: "Brownie",
    base: "#3B2415",
    accent: "#1C0E08",
    pricePerPound: 350,
    available: true,
  },
];

const DESIGN_NAMES = ["Classic round", "Heart shape"];
const WEIGHT_OPTIONS = [1, 2, 3]; // in pounds
const COD_SURCHARGE = 20;

/* ---------- Category icons — a simple emoji per flavour for the
   "Shop by Flavor" row (purely decorative, no images needed) ---------- */
const CATEGORY_ICONS = {
  all: "🍰",
  choc: "🍫", van: "🍦", rv: "❤️", bscotch: "🍮", bf: "🍒",
  pine: "🍍", straw: "🍓", darkchoc: "🍫", mava: "🥛", blueberry: "🫐",
  mango: "🥭", elaichi: "🌿", blackcurrant: "🍇", fruitcake: "🍇",
  rasmalai: "🥛", brownie: "🍫",
};

let PRODUCTS = [];

FLAVORS.forEach(flavor => {
  DESIGN_NAMES.forEach((designName, i) => {
    PRODUCTS.push({
      id: `${flavor.id}-${i}`,
      flavorId: flavor.id,
      designIndex: i, // 0 = Classic round, 1 = Heart shape, 2 = Designer drip
      name: `${designName} cake`,
      // Real photo: images/<flavor-id>-<design-index>.png (falls back to .jpg,
      // then to the drawn icon if neither file exists).
      image: `images/${flavor.id}-${i}.png`,
      imageFallback: `images/${flavor.id}-${i}.jpg`,
    });
  });
});

/* ---------- Product visual: real photo (.png or .jpg) if it exists, else a matching icon ----------
   variant: 'grid' (large square card photo) or 'drawer' (small preview thumbnail)
============================================================= */
function productVisual(product, flavor, size = 72, variant = 'grid'){
  const cls = variant === 'drawer' ? 'product-photo-drawer' : 'product-photo';
  return `<img src="${product.image}" alt="${flavor.name} cake" class="${cls}"
            data-tried-fallback="0"
            onerror="handleImageError(this,'${product.imageFallback}','${flavor.base}','${flavor.accent}',${size},${product.designIndex})">`;
}

function handleImageError(imgEl, fallbackPath, base, accent, size, designIndex){
  if (imgEl.dataset.triedFallback === "0"){
    // primary photo didn't load — try the fallback extension before giving up
    imgEl.dataset.triedFallback = "1";
    imgEl.src = fallbackPath;
  } else {
    // neither photo exists — fall back to the drawn icon
    imgEl.replaceWith(iconEl(base, accent, size, designIndex));
  }
}

function iconEl(base, accent, size, designIndex){
  const wrapper = document.createElement('div');
  wrapper.innerHTML = cakeIcon(base, accent, size, designIndex);
  return wrapper.firstElementChild;
}

/* ---------- State ---------- */
let activeFlavor = "all"; // "all" shows one card per flavour; otherwise a flavour id
let cart = null;            // { product, flavor, weight, payment }
let sharedLocation = null;  // { lat, lng }
let signedInUser = null;    // { email, name, picture }

/* ---------- Cake icons (shared vector style, flavor colors) ----------
   designIndex 0 = Classic round, 1 = Heart shape, 2 = Designer drip.
   All three stay in the exact same illustration style and background,
   so the menu looks consistent even before real photos are added.
   The cake-icon-svg class lets these scale to fill the card just like
   a real photo would (see CSS: .product-photo, .cake-icon-svg).
============================================================= */
function cakeIcon(base, accent, size = 64, designIndex = 0){
  if (designIndex === 1) return cakeIconHeart(base, accent, size);
  if (designIndex === 2) return cakeIconDrip(base, accent, size);
  return cakeIconRound(base, accent, size);
}

function cakeIconRound(base, accent, size){
  return `<svg class="cake-icon-svg" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="10" y="34" width="44" height="20" rx="4" fill="${base}"/>
    <rect x="14" y="20" width="36" height="16" rx="4" fill="${base}"/>
    <rect x="10" y="30" width="44" height="6" fill="${accent}" opacity="0.55"/>
    <rect x="14" y="17" width="36" height="6" fill="${accent}" opacity="0.55"/>
    <circle cx="20" cy="14" r="3" fill="${accent}"/>
    <circle cx="32" cy="11" r="3.5" fill="${accent}"/>
    <circle cx="44" cy="14" r="3" fill="${accent}"/>
  </svg>`;
}

function cakeIconHeart(base, accent, size){
  return `<svg class="cake-icon-svg" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 52 C10 38, 4 24, 14 15 C21 8, 30 11, 32 19
             C34 11, 43 8, 50 15 C60 24, 54 38, 32 52 Z" fill="${base}"/>
    <path d="M32 34 C22 27, 18 19, 24 14 C28 11, 31 13, 32 17
             C33 13, 36 11, 40 14 C46 19, 42 27, 32 34 Z" fill="${accent}" opacity="0.6"/>
    <circle cx="24" cy="20" r="2.4" fill="${accent}"/>
    <circle cx="40" cy="20" r="2.4" fill="${accent}"/>
  </svg>`;
}

function cakeIconDrip(base, accent, size){
  return `<svg class="cake-icon-svg" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="46" rx="24" ry="9" fill="${base}"/>
    <rect x="8" y="28" width="48" height="18" fill="${base}"/>
    <ellipse cx="32" cy="28" rx="24" ry="9" fill="${accent}"/>
    <path d="M8 28 q4 14 4 8 q4 12 4 4 q4 13 4 3 q4 11 4 5
             q4 12 4 3 q4 12 4 4 q4 13 4 3 q4 11 4 6 q4-6 4-8"
          fill="${accent}" opacity="0.85"/>
  </svg>`;
}


/* =============================================================
   RENDERING — category row & product grid
============================================================= */
function selectFlavor(id){
  activeFlavor = id;
  renderProducts();
  renderCategoryGrid();
}

function selectCategory(id){
  selectFlavor(id);
}

/* =============================================================
   SHOP BY FLAVOR — circular category row ("All Flavors" + each flavour)
============================================================= */
function renderCategoryGrid(){
  const wrap = document.getElementById('categoryGrid');
  const categories = [{ id: "all", name: "All Flavors" }, ...FLAVORS];

  wrap.innerHTML = categories.map(c => `
    <div class="category-card ${activeFlavor === c.id ? 'active' : ''}" data-id="${c.id}" tabindex="0" role="button">
      <div class="category-icon">${CATEGORY_ICONS[c.id] || '🎂'}</div>
      <span>${c.name}</span>
    </div>
  `).join('');

  wrap.querySelectorAll('.category-card').forEach(el => {
    el.addEventListener('click', () => selectCategory(el.dataset.id));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') selectCategory(el.dataset.id); });
  });
}

function renderProducts(){
  const grid = document.getElementById('productGrid');
  let cardsHtml;

  if (activeFlavor === "all"){
    // "All Flavors" — one representative design (Classic round) per flavour,
    // with currently-available flavours shown first
    document.getElementById('sectionTitle').textContent = "All Flavors";

    const sortedFlavors = [...FLAVORS].sort((a, b) => (b.available ? 1 : 0) - (a.available ? 1 : 0));
    cardsHtml = sortedFlavors.map(flavor => {
      const p = PRODUCTS.find(pr => pr.flavorId === flavor.id && pr.designIndex === 0);
      return productCardHtml(p, flavor);
    }).join('');
  } else {
    const flavor = FLAVORS.find(f => f.id === activeFlavor);
    const items = PRODUCTS.filter(p => p.flavorId === activeFlavor);

    document.getElementById('sectionTitle').textContent = flavor.name;

    cardsHtml = items.map(p => productCardHtml(p, flavor)).join('');
  }

  grid.innerHTML = cardsHtml;

  grid.querySelectorAll('.product-card').forEach(el => {
    el.addEventListener('click', () => openCart(el.dataset.id));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') openCart(el.dataset.id); });
  });
}

/* Shared product-card markup used by the main grid, and reused (styled
   smaller) inside the horizontal-scroll sections below. */
function productCardHtml(product, flavor){
  return `
    <div class="product-card" data-id="${product.id}" tabindex="0" role="button">
      <div class="cake-icon-wrap">
        ${flavor.available ? '<span class="product-available-badge">Available</span>' : ''}
        ${productVisual(product, flavor, 240, 'grid')}
      </div>
      <p class="product-name">${flavor.name}</p>
      <div class="product-price">
        <span class="price-value mono">₹${flavor.pricePerPound}</span>
      </div>
      <button class="order-btn" type="button">Order</button>
    </div>
  `;
}

/* =============================================================
   CART DRAWER
============================================================= */
function openCart(productId){
  if (!signedInUser){
    document.getElementById('signinBanner').classList.remove('hidden');
    document.getElementById('signinBanner').scrollIntoView({ behavior:'smooth', block:'center' });
    if (window.google && !GOOGLE_CLIENT_ID.startsWith('YOUR_')){
      google.accounts.id.prompt();
    }
    return;
  }

  const product = PRODUCTS.find(p => p.id === productId);
  const flavor = FLAVORS.find(f => f.id === product.flavorId);
  cart = { product, flavor, weight: WEIGHT_OPTIONS[0], payment: 'cod' };
  sharedLocation = null;

  document.getElementById('drawerIcon').innerHTML = productVisual(product, flavor, 64, 'drawer');
  document.getElementById('drawerName').textContent = flavor.name;

  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custAddress').value = '';
  document.getElementById('formError').textContent = '';

  const locBtn = document.getElementById('locBtn');
  locBtn.textContent = '📍 Use My Current Location';
  locBtn.classList.remove('loc-ok');

  renderWeightRow();
  renderPayRow();
  updateTotal();

  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function closeCart(){
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}

function renderWeightRow(){
  const row = document.getElementById('weightRow');
  row.innerHTML = WEIGHT_OPTIONS.map(w => `
    <div class="chip ${cart.weight === w ? 'active' : ''}" data-w="${w}">${w} Pound</div>
  `).join('');

  row.querySelectorAll('.chip').forEach(el => {
    el.addEventListener('click', () => {
      cart.weight = parseFloat(el.dataset.w);
      renderWeightRow();
      updateTotal();
    });
  });
}

function renderPayRow(){
  const row = document.getElementById('payRow');
  row.innerHTML = `
    <div class="chip ${cart.payment === 'cod' ? 'active' : ''}" data-p="cod">Cash on delivery</div>
    <div class="chip" style="opacity:0.45; cursor:not-allowed;" title="Coming soon">UPI (coming soon)</div>
  `;

  row.querySelectorAll('.chip').forEach(el => {
    if (!el.dataset.p) return; // the disabled UPI chip has no data-p, skip it
    el.addEventListener('click', () => {
      cart.payment = el.dataset.p;
      renderPayRow();
      updateTotal();
    });
  });
}

function currentPrice(){
  return cart.weight * cart.flavor.pricePerPound + COD_SURCHARGE;
}

function updateTotal(){
  const cakePrice = cart.weight * cart.flavor.pricePerPound;
  document.getElementById('cakePrice').textContent = `₹${cakePrice}`;
  document.getElementById('shippingPrice').textContent = `₹${COD_SURCHARGE}`;
  document.getElementById('totalValue').textContent = `₹${cakePrice + COD_SURCHARGE}`;
}

/* =============================================================
   LOCATION
============================================================= */
document.getElementById('locBtn').addEventListener('click', () => {
  const btn = document.getElementById('locBtn');

  if (!navigator.geolocation){
    btn.textContent = 'Location not supported on this device';
    return;
  }

  btn.textContent = 'Getting your location...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      sharedLocation = { lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) };
      btn.textContent = 'Location shared ✓';
      btn.classList.add('loc-ok');
    },
    () => { btn.textContent = '📍 Use My Current Location'; }
  );
});

/* =============================================================
   ORDER CONFIRMATION → SEND ORDER → BACKEND (/orders) → WHATSAPP
   Clicking "Send order" validates the form and shows a summary in a
   confirmation popup (same pattern as the logout confirmation). The
   actual order is only placed once the customer taps "Confirm Order".
   The backend logs the order to Google Sheet and returns a ready-made
   WhatsApp link. If the backend can't be reached, we fall back to
   opening WhatsApp directly so the order is never lost.
============================================================= */
let pendingOrder = null; // holds validated payload while the confirm popup is open

document.getElementById('sendBtn').addEventListener('click', () => {
  const errorEl = document.getElementById('formError');

  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();

  if (!name || !phone || (!address && !sharedLocation)){
    errorEl.textContent = 'Add your name, phone, and either an address or shared location.';
    return;
  }
  if (!/^\d{10}$/.test(phone)){
    errorEl.textContent = 'Enter a valid 10-digit phone number.';
    return;
  }
  errorEl.textContent = '';

  const locationLink = sharedLocation
    ? `https://maps.google.com/?q=${sharedLocation.lat},${sharedLocation.lng}`
    : null;

  pendingOrder = {
    payload: {
      customer_name: name,
      customer_email: signedInUser.email,
      phone: phone,
      flavor: cart.flavor.name,
      flavor_id: cart.flavor.id,
      weight_pound: cart.weight,
      address: address || null,
      location_link: locationLink,
      payment_method: cart.payment, // always "cod" for now, UPI chip is disabled
      total: currentPrice(),
    },
    displayName: name,
    displayAddress: address,
    displayLocationLink: locationLink,
  };

  showOrderConfirmModal(pendingOrder);
});

function showOrderConfirmModal(order){
  const payLabel = order.payload.payment_method === 'cod' ? 'Cash on delivery' : 'UPI (online)';
  const summary = document.getElementById('confirmOrderSummary');
  summary.innerHTML = `
    <div class="order-row">
      <div class="oname">${cart.flavor.name}</div>
      <div class="ometa">${cart.weight} Pound · ${payLabel}</div>
    </div>
    <div class="order-row">
      <div class="oname">Deliver to</div>
      <div class="ometa">${order.displayName} · ${order.payload.phone}</div>
      <div class="ometa">${order.displayAddress || ''}${order.displayAddress && order.displayLocationLink ? ' · ' : ''}${order.displayLocationLink ? 'Live location shared' : ''}</div>
    </div>
    <div class="order-row" style="border-bottom:none;">
      <div class="breakdown-row total"><span>Total</span><span class="val">₹${order.payload.total}</span></div>
    </div>
  `;
  document.getElementById('confirmOrderModal').classList.add('open');
}

document.getElementById('cancelOrderConfirm').addEventListener('click', () => {
  document.getElementById('confirmOrderModal').classList.remove('open');
});

document.getElementById('confirmOrderBtn').addEventListener('click', async () => {
  if (!pendingOrder) return;
  document.getElementById('confirmOrderModal').classList.remove('open');
  await submitOrder(pendingOrder);
  pendingOrder = null;
});

async function submitOrder(order){
  const { payload, displayName, displayAddress, displayLocationLink } = order;
  const sendBtn = document.getElementById('sendBtn');

  sendBtn.disabled = true;
  sendBtn.textContent = 'Placing order...';

  try {
    const res = await fetch('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok){
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Order could not be saved.');
    }
    const data = await res.json();
    window.open(data.whatsapp_link, '_blank');
    closeCart();
  } catch (err){
    // Backend unreachable or errored — open WhatsApp directly so the order
    // still reaches the owner (it just won't be logged to the Sheet).
    const payLabel = payload.payment_method === 'cod' ? 'Cash on delivery' : 'UPI (online)';
    let msg = `New order — ${SHOP_NAME}\n\n`;
    msg += `Cake: ${cart.flavor.name}\n`;
    msg += `Cake Size: ${cart.weight} Pound\n`;
    msg += `Name: ${displayName}\n`;
    msg += `Phone: ${payload.phone}\n`;
    if (displayAddress) msg += `Address: ${displayAddress}\n`;
    if (displayLocationLink) msg += `Live location: ${displayLocationLink}\n`;
    msg += `Payment: ${payLabel}\n`;
    msg += `Total: ₹${payload.total}`;
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
    closeCart();
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send order on WhatsApp';
  }
}

document.getElementById('closeDrawer').addEventListener('click', closeCart);
document.getElementById('overlay').addEventListener('click', closeCart);

/* "Filter" link on the All Flavors section scrolls up to the
   Shop by Flavor category row so the customer can pick one. */
document.getElementById('filterBtn').addEventListener('click', () => {
  document.getElementById('categoryGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

/* =============================================================
   HERO SLIDER
============================================================= */
const heroSlides = document.querySelectorAll('.hero-slide');
const heroDotsWrap = document.getElementById('heroDots');
let heroIndex = 0;

heroDotsWrap.innerHTML = Array.from(heroSlides)
  .map((_, i) => `<div class="hero-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></div>`)
  .join('');

function goToSlide(i){
  heroSlides.forEach(s => s.classList.remove('active'));
  heroDotsWrap.querySelectorAll('.hero-dot').forEach(d => d.classList.remove('active'));
  heroSlides[i].classList.add('active');
  heroDotsWrap.children[i].classList.add('active');
  heroIndex = i;
}

heroDotsWrap.querySelectorAll('.hero-dot').forEach(d => {
  d.addEventListener('click', () => { goToSlide(parseInt(d.dataset.i)); restartHeroAutoplay(); });
});

document.getElementById('heroPrev').addEventListener('click', () => {
  goToSlide((heroIndex - 1 + heroSlides.length) % heroSlides.length);
  restartHeroAutoplay();
});
document.getElementById('heroNext').addEventListener('click', () => {
  goToSlide((heroIndex + 1) % heroSlides.length);
  restartHeroAutoplay();
});

let heroTimer = setInterval(() => goToSlide((heroIndex + 1) % heroSlides.length), 4500);
function restartHeroAutoplay(){
  clearInterval(heroTimer);
  heroTimer = setInterval(() => goToSlide((heroIndex + 1) % heroSlides.length), 4500);
}

/* =============================================================
   GOOGLE SIGN-IN (customer login)
   response.credential is verified server-side via POST /auth/google.
   Login state is cached in localStorage so the customer stays signed
   in across visits, until they hit Logout.
============================================================= */
async function handleGoogleSignIn(response){
  try {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });
    if (!res.ok) throw new Error('Google verification failed');

    const user = await res.json(); // { email, name, picture } — verified server-side
    signedInUser = user;
    localStorage.setItem('user', JSON.stringify(user));

    renderSignedInUI(user);
  } catch (err){
    console.error(err);
    document.getElementById('signinBanner').textContent = 'Sign-in failed — refresh and try again.';
  }
}

function renderSignedInUI(user){
  document.getElementById('googleBtnWrap').style.display = 'none';

  const userMenu = document.getElementById('userMenu');
  userMenu.classList.remove('hidden');
  document.getElementById('userAvatar').src = user.picture;
  document.getElementById('userFirstName').textContent = (user.name || user.email).split(' ')[0];
  document.getElementById('userAvatarBig').src = user.picture;
  document.getElementById('userFullName').textContent = user.name || user.email;
  document.getElementById('userEmailText').textContent = user.email;

  document.getElementById('signinBanner').classList.add('hidden');
}

function setupUserMenu(){
  const chipBtn = document.getElementById('userChipBtn');
  const dropdown = document.getElementById('userDropdown');
  if (!chipBtn || !dropdown) return;

  chipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    chipBtn.setAttribute('aria-expanded', isOpen);
    chipBtn.classList.toggle('open', isOpen);
  });

  // Close the dropdown when clicking anywhere else on the page
  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
    chipBtn.setAttribute('aria-expanded', 'false');
    chipBtn.classList.remove('open');
  });

  // "Your Orders" — closes the dropdown, opens the orders modal, fetches history
  document.getElementById('yourOrdersBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.remove('open');
    openOrdersModal();
  });
  document.getElementById('closeOrders').addEventListener('click', () => {
    document.getElementById('ordersModal').classList.remove('open');
  });

  // "Log Out" menu item — closes the dropdown, opens the confirmation modal
  document.getElementById('logoutTriggerBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.remove('open');
    document.getElementById('logoutConfirmModal').classList.add('open');
  });
  document.getElementById('cancelLogout').addEventListener('click', () => {
    document.getElementById('logoutConfirmModal').classList.remove('open');
  });
  document.getElementById('confirmLogout').addEventListener('click', () => {
    localStorage.removeItem('user');
    signedInUser = null;
    location.reload();
  });
}

async function openOrdersModal(){
  const modal = document.getElementById('ordersModal');
  const list = document.getElementById('ordersList');
  modal.classList.add('open');
  list.innerHTML = '<p class="orders-loading">Loading your orders...</p>';

  try {
    const res = await fetch(`/orders/mine?email=${encodeURIComponent(signedInUser.email)}`);
    if (!res.ok) throw new Error('Could not load orders');
    const data = await res.json();

    if (!data.orders || data.orders.length === 0){
      list.innerHTML = '<p class="orders-empty">No orders yet — your first cake is one click away!</p>';
      return;
    }

    list.innerHTML = data.orders.map(o => `
      <div class="order-row">
        <div class="oname">${o.flavor}</div>
        <div class="ometa">${o.weight} · ₹${o.total} · ${o.created_at}</div>
        <span class="ostatus">${o.status}</span>
      </div>
    `).join('');
  } catch (err){
    list.innerHTML = '<p class="orders-empty">Could not load your orders right now.</p>';
  }
}

function initGoogleSignIn(){
  if (!window.google || GOOGLE_CLIENT_ID.startsWith('YOUR_')) return;
  if (localStorage.getItem('user')) return; // already signed in, button not needed

  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleSignIn });
  google.accounts.id.renderButton(document.getElementById('googleBtnWrap'), {
    theme:'outline', size:'medium', shape:'pill', text:'signin', logo_alignment:'left',
  });
}

/* =============================================================
   INIT
============================================================= */
renderProducts();
renderCategoryGrid();
setupUserMenu();

const savedUser = localStorage.getItem('user');
if (savedUser){
  signedInUser = JSON.parse(savedUser);
  renderSignedInUI(signedInUser);
}