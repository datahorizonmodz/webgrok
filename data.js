import { auth, db } from "./firebase.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// PENTING: Tambahkan fungsi openVerifyModal dari app.js
import { enforceMinLoaderTime, activePageId, openModal, resetProductModalScroll, openVerifyModal } from "./app.js";

// --- STATE ---
let rawApps = [], rawStore = [], rawProfiles = [];
let queryText = '';
let activeCategory = 'all';

// Virtualization Constants
const ITEM_HEIGHT = 88; // 76px card + 12px gap
const BUFFER = 4; // Render items outside viewport

// DOM Elements
const lists = {
    apps: document.getElementById('apps-list'),
    store: document.getElementById('store-list'),
    profiles: document.getElementById('profiles-list')
};
const empties = {
    apps: document.getElementById('apps-empty'),
    store: document.getElementById('store-empty'),
    profiles: document.getElementById('profiles-empty')
};

// DOM Node Pools (Map of ID to HTMLElement)
const domPools = { apps: new Map(), store: new Map() };

// --- FULL RESET FUNCTION (Wipes DOM to Force Animation) ---
function clearPools() {
    domPools.apps.forEach(node => node.remove());
    domPools.store.forEach(node => node.remove());
    domPools.apps.clear();
    domPools.store.clear();
    
    // Clear HTML completely so NO elements linger, forcing a total UI rebuild
    lists.apps.innerHTML = '';
    lists.store.innerHTML = '';
    lists.profiles.innerHTML = ''; 
}

// --- RESIZE LISTENER FOR VIRTUALIZED GRID RE-RENDER ---
// BREAKPOINT DITURUNKAN KE 700PX: 
// Ini akan mendeteksi mode desktop Android Chrome di zoom 100% dengan sempurna.
let currentCols = window.matchMedia('(min-width: 700px)').matches ? 2 : 1;
window.addEventListener('resize', () => {
    const newCols = window.matchMedia('(min-width: 700px)').matches ? 2 : 1;
    if (newCols !== currentCols) {
        currentCols = newCols;
        clearPools();
        renderActiveView();
    }
});

// --- INITIALIZATION ---
let loadedCount = 0;
function checkAllLoaded() {
    loadedCount++;
    if(loadedCount === 3) enforceMinLoaderTime(() => renderActiveView());
}

async function initData() {
    try {
        await signInAnonymously(auth);
    } catch (e) {
        console.warn("Auth failed, continuing anyway", e);
    }

    // Listeners
    onSnapshot(collection(db, 'apps'), snap => {
        rawApps = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        if(loadedCount < 3) checkAllLoaded(); else renderActiveView();
    });
    onSnapshot(collection(db, 'products'), snap => {
        rawStore = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        if(loadedCount < 3) checkAllLoaded(); else renderActiveView();
    });
    onSnapshot(collection(db, 'profiles'), snap => {
        rawProfiles = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        if(loadedCount < 3) checkAllLoaded(); else renderActiveView();
    });
}

// --- FILTERS & SEARCH ---
const categories = ['ALL', 'POPULAR', 'EDITING', 'ENHANCER', 'MUSIC', 'FILM', 'ANIME', 'RANDOM'];
const filterScroll = document.getElementById('filter-scroll');

function initFilters() {
    categories.forEach(cat => {
        const btn = document.createElement('div');
        btn.className = `filter-tag ${cat === 'ALL' ? 'active' : ''}`;
        btn.textContent = cat;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = cat.toLowerCase();
            window.scrollTo(0,0);
            
            clearPools(); 
            renderActiveView();
        });
        filterScroll.appendChild(btn);
    });
    
    document.getElementById('filter-prev').addEventListener('click', () => {
        filterScroll.scrollBy({ left: -100, behavior: 'smooth' });
    });
    document.getElementById('filter-next').addEventListener('click', () => {
        filterScroll.scrollBy({ left: 100, behavior: 'smooth' });
    });
}

export function setPageFilter(text) {
    queryText = text.toLowerCase();
    window.scrollTo(0,0);
    
    clearPools();
    renderActiveView();
}

// --- RENDERING ENGINE (VIRTUALIZATION & LAZY) ---

function getProcessedData(type) {
    let data = type === 'apps' ? rawApps : type === 'store' ? rawStore : rawProfiles;
    
    // --- BUG FIX (KODE PENJAGAAN GANDA) ---
    // Pastikan nge-filter mau dia tipe boolean false atau text "false"
    data = data.filter(item => item.isActive !== false && item.isActive !== "false");
    
    // Search Filter
    if(queryText) {
        data = data.filter(item => (item.name || item.title || '').toLowerCase().includes(queryText));
    }
    
    // Category Filter (Apps only)
    if(type === 'apps' && activeCategory !== 'all') {
        data = data.filter(item => {
            const cats = Array.isArray(item.category) ? item.category.map(c=>c.toLowerCase()) : [(item.category||'').toLowerCase()];
            return cats.includes(activeCategory);
        });
    }
    
    // Sort profiles
    if(type === 'profiles') {
        data = data.sort((a,b) => (a.order||0) - (b.order||0));
    }
    return data;
}

// Central render function
function renderActiveView() {
    if(activePageId === 'apps' || activePageId === 'store') {
        renderVirtualList(activePageId);
    } else if (activePageId === 'profiles') {
        renderProfiles();
    }
}

// Virtualized Renderer for Apps and Store
function renderVirtualList(type) {
    const data = getProcessedData(type);
    const container = lists[type];
    const emptyEl = empties[type];
    const pool = domPools[type];

    if(data.length === 0) {
        container.style.height = '0px';
        emptyEl.style.display = 'block';
        pool.forEach(node => node.remove());
        pool.clear();
        return;
    }
    emptyEl.style.display = 'none';

    // Kalkulasi Kolom Secara Akurat (akan bernilai 2 jika viewport > 700px)
    const cols = currentCols;
    const rowCount = Math.ceil(data.length / cols);

    // Set height to preserve scrollbar based on rows
    container.style.height = `${rowCount * ITEM_HEIGHT}px`;

    // Calculate visible range (by Row)
    const scrollTop = window.scrollY;
    // Offset by header/margin (~150px approx)
    const viewTop = Math.max(0, scrollTop - 150);
    
    const startRow = Math.max(0, Math.floor(viewTop / ITEM_HEIGHT) - BUFFER);
    const endRow = Math.min(rowCount - 1, Math.ceil((viewTop + window.innerHeight) / ITEM_HEIGHT) + BUFFER);

    const startIdx = startRow * cols;
    const endIdx = Math.min(data.length - 1, ((endRow + 1) * cols) - 1);

    const activeIds = new Set();

    // Create fragment for batch insert
    const frag = document.createDocumentFragment();

    for(let i = startIdx; i <= endIdx; i++) {
        const item = data[i];
        activeIds.add(item.id);

        let node = pool.get(item.id);
        if(!node) {
            node = createCardNode(item, type);
            pool.set(item.id, node);
            frag.appendChild(node);
        }
        
        // Posisikan Card berdasarkan Baris (Row) dan Kolom (Col)
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        node.style.setProperty('--y', `${row * ITEM_HEIGHT}px`);
        
        if (cols === 2) {
            // Posisi Kiri atau Kanan dalam Grid
            // Menggunakan transform 100% lebarnya sendiri + 12px gap
            node.style.setProperty('--x', col === 0 ? '0px' : 'calc(100% + 12px)');
            node.style.width = 'calc(50% - 6px)'; 
        } else {
            // Lebar Penuh untuk Mobile
            node.style.setProperty('--x', '0px');
            node.style.width = '100%';
        }
    }

    if(frag.childNodes.length > 0) container.appendChild(frag);

    // Cleanup nodes outside viewport
    for(const [id, node] of pool.entries()) {
        if(!activeIds.has(id)) {
            node.remove();
            pool.delete(id);
        }
    }
}

// Standard Renderer for Profiles
function renderProfiles() {
    const data = getProcessedData('profiles');
    const container = lists.profiles;
    container.innerHTML = '';
    
    if(data.length === 0) { empties.profiles.style.display = 'block'; return; }
    empties.profiles.style.display = 'none';

    data.forEach(item => {
        const a = document.createElement('a');
        a.href = item.targetLink || item.link || '#';
        a.target = '_blank';
        // PENAMBAHAN CLASS 'profile-card' KHUSUS DI MENU PROFILE
        a.className = 'item-card profile-card card-enter'; 
        a.innerHTML = `
            <img src="${item.imageUrl || 'https://via.placeholder.com/50'}" class="item-icon" alt="icon">
            <div class="item-info"><div class="item-title">${item.name || 'Link'}</div></div>
            <div class="item-action"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 11h12.17l-5.58-5.59L12 4l8 8-8 8-1.41-1.41L16.17 13H4v-2z"/></svg></div>
        `;
        container.appendChild(a);
    });
}

// --- PRICE RANGE CALCULATOR ---
function getPriceRange(priceText) {
    if (!priceText) return "Lihat detail harga";

    const textArray = Array.isArray(priceText) ? priceText : [priceText];
    let allPrices = [];

    // Regex Explanation:
    // 1. Rp[.\s]*(\d[\d.]*) -> Matches "Rp", optional dots/spaces, then captures numbers and dots (e.g. "Rp. 4.000")
    // 2. |\b(\d{1,3}(?:\.\d{3})+)\b -> OR matches standalone numbers with thousands separators (e.g. "18.000")
    const regex = /Rp[.\s]*(\d[\d.]*)|\b(\d{1,3}(?:\.\d{3})+)\b/gi;

    textArray.forEach(text => {
        if (typeof text !== 'string') return;
        
        // Reset regex index for safety since we're using the 'g' flag in a loop
        regex.lastIndex = 0; 
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            // Get the matched string from whichever capture group fired
            let numStr = match[1] || match[2];
            
            if (numStr) {
                // Strip out the formatting dots so we can parse as a clean integer
                let cleanNumStr = numStr.replace(/[^\d]/g, '');
                let num = parseInt(cleanNumStr, 10);
                
                if (!isNaN(num)) {
                    allPrices.push(num);
                }
            }
        }
    });

    // Fallback if no valid currency numbers were detected
    if (allPrices.length === 0) {
        return "Lihat detail harga";
    }

    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);

    // Format output with indonesian standard (Intl.NumberFormat id-ID natively adds dots for thousands)
    const formatRp = (num) => "Rp. " + new Intl.NumberFormat('id-ID').format(num);

    if (min === max) {
        return formatRp(min);
    } else {
        return `${formatRp(min)} - ${formatRp(max)}`;
    }
}

// DOM Node Builder
function createCardNode(item, type) {
    const el = type === 'apps' ? document.createElement('a') : document.createElement('div');
    el.className = 'item-card card-enter'; // Class Card Animasi akan selalu ditambahkan ke Node Baru
    
    const icon = item.imageUrl || 'https://via.placeholder.com/50';
    const title = item.name || item.title || '';
    
    let sub = '';
    if(type === 'apps') {
        // PENTING: Matikan link asli, aktifkan popup modal
        el.href = 'javascript:void(0)'; 
        el.addEventListener('click', (e) => {
            e.preventDefault();
            // Panggil fungsi modal pop-up
            openVerifyModal(item.targetLink || '#');
        });

        sub = item.updateDate ? (item.updateDate.toDate ? item.updateDate.toDate().toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : item.updateDate) : '';
        const catDisp = Array.isArray(item.category) ? item.category.join(' - ') : (item.category || '');
        if(sub && catDisp) sub += ` - ${catDisp}`; else if (catDisp) sub = catDisp;
    } else if (type === 'store') {
        // --- PRICE RANGE INJECTION ---
        sub = getPriceRange(item.priceText);
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => populateProductModal(item));
    }

    el.innerHTML = `
        <img src="${icon}" class="item-icon" alt="icon" loading="lazy">
        <div class="item-info">
            <div class="item-title">${title} ${item.version ? `<span style="font-weight:400; font-size:0.8rem; color:var(--text-muted)">${item.version}</span>` : ''}</div>
            <div class="item-sub">${sub}</div>
        </div>
        <div class="item-action">
            ${type === 'apps' ? 
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>` : 
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`}
        </div>
    `;
    return el;
}

// Modal Populator
function populateProductModal(item) {
    document.getElementById('pm-img').src = item.imageUrl || '';
    document.getElementById('pm-title').textContent = item.name || item.title || '';
    
    let pText = Array.isArray(item.priceText) ? item.priceText.map(p=>`<div>- ${p}</div>`).join('') : `<div>- ${item.priceText||'-'}</div>`;
    document.getElementById('pm-prices').innerHTML = pText;
    document.getElementById('pm-desc').textContent = item.description || '-';
    
    const wa = document.getElementById('pm-wa-btn');
    wa.href = item.whatsappLink || item.targetLink || '#';
    
    openModal('product-modal');
    resetProductModalScroll();
}

// --- EVENT BINDINGS ---
window.addEventListener('scroll', () => {
    // Only fire virtual render if on apps or store
    if(activePageId === 'apps' || activePageId === 'store') renderVirtualList(activePageId);
}, {passive: true});

window.addEventListener('pageChanged', () => {
    // PENTING: Force hancurkan node lama dan render ulang tiap kali ganti tab halaman
    clearPools();
    renderActiveView(); 
});

// Boot
initFilters();
initData();
