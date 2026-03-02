import { auth, db } from "./firebase.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { enforceMinLoaderTime, activePageId, openModal, resetProductModalScroll } from "./app.js";

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
    renderActiveView();
}

// --- RENDERING ENGINE (VIRTUALIZATION & LAZY) ---

function getProcessedData(type) {
    let data = type === 'apps' ? rawApps : type === 'store' ? rawStore : rawProfiles;
    
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
        data = data.filter(s => s.isActive !== false).sort((a,b) => (a.order||0) - (b.order||0));
    }
    return data;
}

// Central render function
function renderActiveView() {
    // Clear unused pools if memory tight, but keeping them caches DOM.
    // For lazy rendering, we only update the active page.
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

    // Set height to preserve scrollbar
    container.style.height = `${data.length * ITEM_HEIGHT}px`;

    // Calculate visible range
    const scrollTop = window.scrollY;
    // Offset by header/margin (~150px approx)
    const viewTop = Math.max(0, scrollTop - 150);
    
    const startIdx = Math.max(0, Math.floor(viewTop / ITEM_HEIGHT) - BUFFER);
    const endIdx = Math.min(data.length - 1, Math.ceil((viewTop + window.innerHeight) / ITEM_HEIGHT) + BUFFER);

    const activeIds = new Set();

    // Create fragment for batch insert
    const frag = document.createDocumentFragment();

    for(let i = startIdx; i <= endIdx; i++) {
        const item = data[i];
        activeIds.add(item.id);

        let node = pool.get(item.id);
        if(!node) {
            // Create DOM Node
            node = createCardNode(item, type);
            pool.set(item.id, node);
            frag.appendChild(node);
        }
        
        // Update Y position purely via transform (hardware accelerated)
        node.style.transform = `translateY(${i * ITEM_HEIGHT}px)`;
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
        a.className = 'item-card';
        a.innerHTML = `
            <img src="${item.imageUrl || 'https://via.placeholder.com/50'}" class="item-icon" alt="icon">
            <div class="item-info"><div class="item-title">${item.name || 'Link'}</div></div>
            <div class="item-action"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 11h12.17l-5.58-5.59L12 4l8 8-8 8-1.41-1.41L16.17 13H4v-2z"/></svg></div>
        `;
        container.appendChild(a);
    });
}

// DOM Node Builder
function createCardNode(item, type) {
    const el = type === 'apps' ? document.createElement('a') : document.createElement('div');
    el.className = 'item-card';
    
    const icon = item.imageUrl || 'https://via.placeholder.com/50';
    const title = item.name || item.title || '';
    
    let sub = '';
    if(type === 'apps') {
        el.href = item.targetLink || '#';
        el.target = '_blank';
        sub = item.updateDate ? (item.updateDate.toDate ? item.updateDate.toDate().toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : item.updateDate) : '';
        const catDisp = Array.isArray(item.category) ? item.category.join(' - ') : (item.category || '');
        if(sub && catDisp) sub += ` - ${catDisp}`; else if (catDisp) sub = catDisp;
    } else if (type === 'store') {
        sub = item.price || '-';
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
    renderActiveView(); // Lazy render active page
});

// Boot
initFilters();
initData();
