const FRAGRANCES = [
  {
    id: "amber-hour",
    name: "Amber Hour",
    family: "Warm & oriental",
    notes: "Vanilla absolute, amber resin, tobacco leaf",
    price: 42,
    color: "#bc8a52",
    img: "img/amber-hour.jpg"
  },
  {
    id: "velvet-fig",
    name: "Velvet Fig",
    family: "Gourmand",
    notes: "Fig milk, cashmere wood, sandalwood",
    price: 42,
    color: "#9c5b5b",
    img: "img/velvet-fig.jpg"
  },
  {
    id: "salt-air",
    name: "Salt Air",
    family: "Aquatic",
    notes: "Sea salt, bergamot, sun-warmed driftwood",
    price: 38,
    color: "#8fa9ac",
    img: "img/salt-air.jpg"
  },
  {
    id: "midnight-iris",
    name: "Midnight Iris",
    family: "Floral",
    notes: "Iris root, violet leaf, black pepper",
    price: 44,
    color: "#a884a8",
    img: "img/midnight-iris.jpg"
  },
  {
    id: "copper-leaf",
    name: "Copper Leaf",
    family: "Woody",
    notes: "Oakmoss, vetiver, aged cedar",
    price: 40,
    color: "#8a7148",
    img: "img/copper-leaf.jpg"
  },
  {
    id: "peony-rain",
    name: "Peony Rain",
    family: "Floral",
    notes: "Peony, rain accord, white musk",
    price: 38,
    color: "#c39bb8",
    img: "img/peony-rain.jpg"
  },
  {
    id: "smoked-cedar",
    name: "Smoked Cedar",
    family: "Woody & smoky",
    notes: "Cedar, birch tar, worn leather",
    price: 46,
    color: "#5c4c3c",
    img: "img/smoked-cedar.jpg"
  },
  {
    id: "citrus-veil",
    name: "Citrus Veil",
    family: "Fresh",
    notes: "Yuzu, neroli, green tea leaf",
    price: 36,
    color: "#9db98f",
    img: "img/citrus-veil.jpg"
  }
];

function averagePrice(ids){
  const list = (ids && ids.length) ? FRAGRANCES.filter(f => ids.includes(f.id)) : FRAGRANCES;
  const source = list.length ? list : FRAGRANCES;
  const total = source.reduce((sum, f) => sum + f.price, 0);
  return Math.round((total / source.length) * 100) / 100;
}

function formatPrice(n){
  return n.toFixed(2).replace(/\.00$/, '');
}

function vialSVG(color, size){
  size = size || 56;
  return `
  <svg class="glass" width="${size}" height="${size*1.35}" viewBox="0 0 56 76" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="21" y="2" width="14" height="10" rx="1.5" fill="none" stroke="${color}" stroke-width="1.4"/>
    <path d="M23 12h10v9.5c6 3 9 9.5 9 16.5v27a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4v-27c0-7 3-13.5 9-16.5V12z"
          fill="none" stroke="${color}" stroke-width="1.4"/>
    <path d="M15.4 46h25.2v19.5a4 4 0 0 1-4 4H19.4a4 4 0 0 1-4-4V46z" fill="${color}" opacity="0.85"/>
  </svg>`;
}

function mysteryVialSVG(size){
  size = size || 56;
  return `
  <svg class="glass" width="${size}" height="${size*1.35}" viewBox="0 0 56 76" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="21" y="2" width="14" height="10" rx="1.5" fill="none" stroke="#0a0a0a" stroke-width="1.4"/>
    <path d="M23 12h10v9.5c6 3 9 9.5 9 16.5v27a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4v-27c0-7 3-13.5 9-16.5V12z"
          fill="none" stroke="#0a0a0a" stroke-width="1.4" stroke-dasharray="3 3"/>
    <text x="28" y="58" text-anchor="middle" font-family="Anton, sans-serif" font-size="16" fill="#c1440e">?</text>
  </svg>`;
}
