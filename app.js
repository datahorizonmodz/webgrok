import { setPageFilter } from "./data.js";

// --- DOM ELEMENTS ---
const html = document.documentElement;
const overlay = document.getElementById('global-overlay');
const sidebar = document.getElementById('sidebar');
const headerTitle = document.getElementById('header-title');
const searchToggle = document.getElementById('search-toggle');
const searchWrapper = document.getElementById('search-wrapper');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const themeBtn = document.getElementById('theme-btn');
const pages = document.querySelectorAll('.page');
const sideLinks = document.querySelectorAll('.side-link:not(.ext)');

// DOCK ELEMENTS
const dock = document.getElementById('mainDock');
const indicator = document.getElementById('dockIndicator');
const tabs = document.querySelectorAll('.dock-tab');

// --- TIMING / LOADER LOGIC ---
const START_TIME = Date.now();
let loaderInterval;

export function initLoaderAnimation() {
    const txt = document.getElementById('loader-text');
    let dots = 0;
    loaderInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        txt.textContent = 'Loading' + '.'.repeat(dots);
    }, 400);
}

export function enforceMinLoaderTime(callback) {
    const elapsed = Date.now() - START_TIME;
    if (elapsed >= 3000) {
        finishLoader();
        if(callback) callback();
    } else {
        setTimeout(() => {
            finishLoader();
            if(callback) callback();
        }, 3000 - elapsed);
    }
}

function finishLoader() {
    clearInterval(loaderInterval);
    document.getElementById('loader').classList.remove('active');
    checkActiveOverlays();
    
    // START ONBOARDING SETELAH LOADER HILANG (Dengan delay agar smooth)
    setTimeout(initOnboarding, 500);
}

// --- OVERLAY / MODAL MANAGER ---
export function openModal(id) {
    overlay.classList.add('active');
    const m = document.getElementById(id);
    if(m) m.classList.add('active');
}

export function closeModal(id) {
    const m = document.getElementById(id);
    if(m) m.classList.remove('active');
    
    // Khusus untuk reset saat Verify Modal ditutup
    if(id === 'verify-modal') {
        document.body.style.overflow = ''; // Unlock scroll
        overlay.classList.remove('dark-mode'); // Hapus background hitam pekat
    }
    
    checkActiveOverlays();
}

function checkActiveOverlays() {
    const activeLayers = document.querySelectorAll('.modal-layer.active, .sidebar.active');
    if (activeLayers.length === 0) {
        overlay.classList.remove('active');
        document.body.style.overflow = ''; // Guard clause unlock scroll
    }
}

// Bind close buttons (untuk modal standar seperti admin, product, dan verifikasi)
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
overlay.addEventListener('click', () => {
    // Prevent overlay click from closing the verification modal (force user to click BATAL)
    const verifyModal = document.getElementById('verify-modal');
    if (verifyModal && verifyModal.classList.contains('active')) {
        return; 
    }

    document.querySelectorAll('.modal-layer').forEach(m => {
        m.classList.remove('active');
    });
    sidebar.classList.remove('active');
    checkActiveOverlays();
});

// --- SIDEBAR ---
document.getElementById('hamburger').addEventListener('click', () => {
    overlay.classList.add('active');
    sidebar.classList.add('active');
});
document.getElementById('close-sidebar').addEventListener('click', () => {
    sidebar.classList.remove('active');
    checkActiveOverlays();
});

// --- THEME ---
themeBtn.addEventListener('click', () => {
    const isLight = html.getAttribute('data-theme') === 'light';
    html.setAttribute('data-theme', isLight ? 'dark' : 'light');
});

// --- SEARCH ---
searchToggle.addEventListener('click', () => {
    searchWrapper.classList.add('active');
    headerTitle.classList.add('hide');
    searchInput.focus();
});

searchClear.addEventListener('click', () => {
    searchWrapper.classList.remove('active');
    headerTitle.classList.remove('hide');
    searchInput.value = '';
    setPageFilter('');
});

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        setPageFilter(e.target.value);
    }, 120); // Debounce
});

// --- ADMIN ROUTE ---
headerTitle.addEventListener('click', () => {
    const expiry = localStorage.getItem('datzon_admin_auth_expiry');
    if (expiry && Date.now() < parseInt(expiry)) {
        window.location.href = 'admin.html';
    } else {
        openModal('admin-modal');
    }
});

document.getElementById('admin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    if (u === 'izindatzon' && p === 'qwert67') {
        localStorage.setItem('datzon_admin_auth_expiry', Date.now() + (60 * 60 * 1000));
        window.location.href = 'admin.html';
    } else {
        const box = document.querySelector('#admin-modal .modal-box');
        box.style.transform = 'translateY(0) translateX(-5px)';
        setTimeout(() => box.style.transform = 'translateY(0) translateX(5px)', 100);
        setTimeout(() => box.style.transform = 'scale(1) translateY(0)', 200);
    }
});

// --- NAVIGATION & DOCK LOGIC ---
export let activePageId = 'apps';
let isDragging = false, startX = 0;
let baseTranslateX = 0;
let maxTranslateX = 0;

export function updateNavIndicator() {
    if (!dock || dock.offsetWidth === 0) return; // Prevent calc errors on desktop when hidden

    const activeTab = Array.from(tabs).find(t => t.dataset.target === activePageId);
    if (!activeTab) return;
    
    const index = parseInt(activeTab.dataset.index);
    const indicatorWidth = indicator.offsetWidth;
    
    // 12px represents padding (6px left, 6px right inside dock)
    maxTranslateX = dock.offsetWidth - indicatorWidth - 12; 
    
    let targetX = 0;
    if (index === 1) targetX = maxTranslateX / 2;
    if (index === 2) targetX = maxTranslateX;
    
    baseTranslateX = targetX;
    indicator.style.transform = `translateX(${targetX}px) scale(1)`;
    
    tabs.forEach((tab, i) => {
        if (i === index) tab.classList.add('active-tab');
        else tab.classList.remove('active-tab');
    });
}

function switchPage(targetId) {
    if(activePageId === targetId) return;
    activePageId = targetId;
    
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + targetId).classList.add('active');
    
    sideLinks.forEach(link => link.classList.toggle('active', link.dataset.target === targetId));
    
    sidebar.classList.remove('active');
    if(searchWrapper.classList.contains('active')) searchClear.click();
    checkActiveOverlays();
    
    updateNavIndicator();
    
    // Opsional: Update URL di browser tanpa reload halaman (agar tersinkronisasi)
    if (window.location.hash !== '#' + targetId) {
        window.history.replaceState(null, null, '#' + targetId);
    }
    
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: targetId }));
}

// Bind Dock Tabs Click
tabs.forEach(tab => tab.addEventListener('click', () => switchPage(tab.dataset.target)));

// Bind Sidebar Links
sideLinks.forEach(link => link.addEventListener('click', (e) => {
    e.preventDefault();
    switchPage(link.dataset.target);
}));

// --- DOCK DRAG & LIFT LOGIC ---
function startDockDrag(e) {
    if (!dock || dock.offsetWidth === 0) return; // Guard for desktop

    isDragging = true;
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    
    maxTranslateX = dock.offsetWidth - indicator.offsetWidth - 12; 
    indicator.classList.add('lifted');
    indicator.style.transform = `translateX(${baseTranslateX}px) scale(1.05)`;
}

function moveDockDrag(e) {
    if (!isDragging) return;
    e.preventDefault(); // Stop scrolling while sliding indicator
    
    const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const deltaX = currentX - startX;
    
    let newX = baseTranslateX + deltaX;
    
    // STRICT CLAMPING BOUNDARIES
    if (newX < 0) newX = 0;
    if (newX > maxTranslateX) newX = maxTranslateX;
    
    indicator.style.transform = `translateX(${newX}px) scale(1.05)`;
}

function endDockDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    indicator.classList.remove('lifted');
    
    // Get current transform reliably
    const currentTransform = indicator.style.transform;
    const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
    const currentX = match ? parseFloat(match[1]) : baseTranslateX;
    
    let targetIndex = 0;
    if (currentX > maxTranslateX * 0.66) {
        targetIndex = 2; // Right Tab
    } else if (currentX > maxTranslateX * 0.33) {
        targetIndex = 1; // Center Tab
    } else {
        targetIndex = 0; // Left Tab
    }
    
    switchPage(tabs[targetIndex].dataset.target);
}

// Attach Drag Events
dock.addEventListener('mousedown', startDockDrag);
window.addEventListener('mousemove', moveDockDrag, {passive: false});
window.addEventListener('mouseup', endDockDrag);

dock.addEventListener('touchstart', startDockDrag, {passive: false});
window.addEventListener('touchmove', moveDockDrag, {passive: false});
window.addEventListener('touchend', endDockDrag);

// ==========================================
// --- VERIFICATION / AD MODAL LOGIC ---
// ==========================================

// Daftar link adsterra (Sekarang ada 3 link)
const adLinks = [
    "https://www.effectivegatecpm.com/z55w4h3qx2?key=b3e81a33d4a9ac5be6d499f5f1bd6274",
    "https://www.effectivegatecpm.com/ei197f8i?key=7296ce5ce218473810261eabd049ad7d",
    "https://www.effectivegatecpm.com/uyd5pi1y7g?key=ecda7388108e4bf6b485ab620343f53a"
];
let currentAdIndex = 0;
let pendingDownloadUrl = "";
let verifyState = "idle"; // 'idle' | 'loading' | 'success'

const verifyTrigger = document.getElementById('verify-trigger');
const verifyCircle = document.getElementById('verify-circle');
const verifyCheck = document.getElementById('verify-check');
const verifyText = document.getElementById('verify-text');
const btnVerifyNext = document.getElementById('btn-verify-next');

export function openVerifyModal(url) {
    pendingDownloadUrl = url;
    
    // Reset state modal ke awal
    verifyState = "idle";
    
    verifyCircle.className = "v-circle empty";
    verifyCheck.classList.add('hidden');
    verifyText.textContent = "VERIFIKASI";
    verifyText.style.color = "var(--text-main)";
    
    btnVerifyNext.classList.add('disabled');
    
    // Tambahkan class khusus ke overlay untuk membuatnya hitam pekat dan lock body
    overlay.classList.add('active', 'dark-mode');
    document.body.style.overflow = 'hidden'; 
    
    const modal = document.getElementById('verify-modal');
    modal.classList.add('active');
}

// Handler saat trigger oval diklik
verifyTrigger.addEventListener('click', () => {
    if (verifyState !== "idle") return; // Hanya merespon jika state idle
    
    // Pindah state ke loading
    verifyState = "loading";
    verifyCircle.className = "v-circle loading";
    verifyText.textContent = "LOADING...";
    
    // Buka link iklan di tab baru secara bergantian
    window.open(adLinks[currentAdIndex], '_blank');
    
    // Update index iklan untuk klik user selanjutnya
    currentAdIndex = (currentAdIndex + 1) % adLinks.length;
    
    // Mulai hitung waktu 5 Detik
    setTimeout(() => {
        // Pindah state ke success
        verifyState = "success";
        verifyCircle.className = "v-circle success";
        verifyCheck.classList.remove('hidden'); // Munculkan icon centang
        
        verifyText.textContent = "BERHASIL";
        verifyText.style.color = "var(--accent)";
        
        // Aktifkan tombol BERIKUTNYA
        btnVerifyNext.classList.remove('disabled');
        
    }, 5000);
});

// Handler untuk tombol BERIKUTNYA
btnVerifyNext.addEventListener('click', () => {
    if (btnVerifyNext.classList.contains('disabled')) {
        // Tombol dikunci: Mainkan animasi bergetar
        btnVerifyNext.classList.remove('shake-anim');
        void btnVerifyNext.offsetWidth; // Trigger reflow
        btnVerifyNext.classList.add('shake-anim');
        return;
    }
    
    // Jika tombol sudah di-enable (Verifikasi Berhasil)
    window.open(pendingDownloadUrl, '_blank');
    closeModal('verify-modal');
});


// --- ONBOARDING / GUIDED TOUR FEATURE ---
let currentObStep = 0;
const obSteps = [
    {
        text: "KLIK DISINI UNTUK MENCARI APLIKASI MOD ATAU KEMBALI KE HOME YAA, KAMU JUGA BISA SLIDE HALAMAN DENGAN MENEKAN BULATAN NYA YAA",
        btn: "NEXT"
    },
    {
        text: "KLIK DISINI UNTUK STORE YA, KALIAN BISA MEMBELI PREMIUM ACCOUNT YANG MURAH DAN TERPERCAYA YA",
        btn: "NEXT"
    },
    {
        text: "NAH DISINI UNTUK TEMPATNYA SOSMED DATZON YA, JANGAN LUPA UNTUK SUBSCRIBE FOLLOW DAN SUPPORT TERUS YA, TERIMAKASIH",
        btn: "DONE"
    }
];

function initOnboarding() {
    // Mengecek apakah onboarding belum expired (24 jam)
    const expiry = localStorage.getItem('datzon_onboarding_done_until');
    if (expiry && Date.now() < parseInt(expiry)) return;
    
    const obContainer = document.getElementById('onboarding-container');
    if(!obContainer) return;
    
    currentObStep = 0;
    
    // Set posisi Spotlight awal sesaat sebelum transisi opacity dimulai
    updateOnboardingSpotlight(currentObStep);
    renderObStepText(true); // true = start rendering without transition
    
    // Munculkan overlay hitam pelan-pelan
    obContainer.classList.add('active');
    
    // Munculkan Popup Bubble secara smooth
    setTimeout(() => {
        const popup = document.getElementById('onboarding-popup');
        popup.classList.add('visible');
    }, 150);
}

function renderObStepText(isInit = false) {
    const step = obSteps[currentObStep];
    const textEl = document.getElementById('onboarding-text');
    const btnEl = document.getElementById('onboarding-btn');
    
    if (isInit) {
        textEl.textContent = step.text;
        btnEl.textContent = step.btn;
    } else {
        // Animasi Teks saat ganti step
        textEl.style.opacity = '0';
        textEl.style.transform = 'translateY(5px)';
        
        setTimeout(() => {
            textEl.textContent = step.text;
            btnEl.textContent = step.btn;
            textEl.style.opacity = '1';
            textEl.style.transform = 'translateY(0)';
        }, 150);
    }
    
    updateOnboardingSpotlight(currentObStep);
}

function updateOnboardingSpotlight(index) {
    const tab = tabs[index];
    const dockEl = document.getElementById('mainDock');
    if(!tab || !dockEl) return;
    
    // Dapatkan koordinat exact dari element Tab active dan Dock utuh
    const rect = tab.getBoundingClientRect();
    const dockRect = dockEl.getBoundingClientRect();
    
    // Padding oval agar spotlight sedikit lebih besar dari icon tab
    const padX = 16; 
    const padY = 10;
    
    const spotlight = document.getElementById('onboarding-spotlight');
    spotlight.style.width = `${rect.width + padX * 2}px`;
    spotlight.style.height = `${rect.height + padY * 2}px`;
    spotlight.style.left = `${rect.left - padX}px`;
    spotlight.style.top = `${rect.top - padY}px`;
    
    const popup = document.getElementById('onboarding-popup');
    const arrow = document.getElementById('onboarding-arrow');
    
    const dockCenter = dockRect.left + (dockRect.width / 2);
    popup.style.left = `${dockCenter}px`;
    
    const tabCenter = rect.left + (rect.width / 2);
    let arrowOffset = tabCenter - dockCenter;
    
    const maxOffset = 110;
    if (arrowOffset > maxOffset) arrowOffset = maxOffset;
    if (arrowOffset < -maxOffset) arrowOffset = -maxOffset;
    
    arrow.style.transform = `translateX(${arrowOffset}px)`;
    
    const bottomOffset = window.innerHeight - dockRect.top + 18;
    popup.style.bottom = `${bottomOffset}px`;
}

const obBtn = document.getElementById('onboarding-btn');
if(obBtn) {
    obBtn.addEventListener('click', () => {
        if (currentObStep < obSteps.length - 1) {
            currentObStep++;
            renderObStepText();
            switchPage(tabs[currentObStep].dataset.target); 
        } else {
            const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24 Hours in ms
            localStorage.setItem('datzon_onboarding_done_until', expiryTime.toString());
            
            document.getElementById('onboarding-container').classList.remove('active');
            document.getElementById('onboarding-popup').classList.remove('visible');
        }
    });
}

window.addEventListener('resize', () => {
    if (!isDragging) updateNavIndicator();
    
    const obContainer = document.getElementById('onboarding-container');
    if (obContainer && obContainer.classList.contains('active')) {
        updateOnboardingSpotlight(currentObStep);
    }
});

// --- MODAL SCROLL INDICATOR ---
const pmScroll = document.getElementById('pm-scroll-area');
const pmIndicator = document.getElementById('pm-indicator');
if(pmScroll && pmIndicator) {
    pmScroll.addEventListener('scroll', () => {
        const distanceToBottom = pmScroll.scrollHeight - (pmScroll.scrollTop + pmScroll.clientHeight);
        if (distanceToBottom < 10) pmIndicator.style.opacity = '0';
        else pmIndicator.style.opacity = '1';
    }, {passive:true});
}

export function resetProductModalScroll() {
    if(pmScroll) pmScroll.scrollTop = 0;
    setTimeout(() => {
        if(pmScroll.scrollHeight > pmScroll.clientHeight + 5) pmIndicator.style.opacity = '1';
        else pmIndicator.style.opacity = '0';
    }, 50);
}

// ==========================================
// --- HASH ROUTING LOGIC (DEEP LINKING) ---
// ==========================================
function handleHashNavigation() {
    // Ambil string di dalam URL setelah tanda "#" (contoh: "store")
    const hash = window.location.hash.replace('#', '');
    const validSections = ['apps', 'store', 'profiles'];
    
    // Jika hash tersebut valid/ada di dalam array seksi yang kita izinkan
    if (validSections.includes(hash)) {
        // Panggil fungsi switchPage untuk memanipulasi tampilan secara dinamis
        switchPage(hash);
    }
}

// 1. Eksekusi pengecekan Hash pada saat script pertama kali dimuat
handleHashNavigation();

// 2. Pasang pendengar kejadian (listener) jika hash URL berubah secara manual (misal: tombol 'Back' ditekan)
window.addEventListener('hashchange', handleHashNavigation);


// Init startup
setTimeout(updateNavIndicator, 100);
initLoaderAnimation();
