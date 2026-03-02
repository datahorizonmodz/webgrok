export function renderPage(page, data) {
    const main = document.getElementById('main-content');
    main.innerHTML = '';
    let html = '';

    if (page === 'home' || page === 'apps') {
        html += `<div class="msg-box">Kumpulan Aplikasi MOD yang bisa kalian download secara gratis. Terkadang ada beberapa aplikasi yang mungkin error karena belum update atau bermasalah. Gua bukan MODER ya, gua cuma mencari MOD yang berguna untuk di-share ke orang yang membutuhkan aplikasinya. Thanks all.</div>`;
        if (page === 'apps') {
            html += renderFilterBar();
        }
        html += `<div id="apps-list" class="list"></div>`;
    } else if (page === 'store') {
        html += `<div class="msg-box">Datzon Store nyediain produk premium original, tutorial premium, dan layanan suntik sosial media. Bukan akun bajakan, bukan janji palsu, dan bukan toko hit and run. Sudah dipakai banyak orang, trusted, prosesnya jelas, dan harganya masih ramah dompet. Kalau mau yang murah tapi ga murahan, ya di sini. Simple.</div>`;
        html += `<div id="store-list" class="list"></div>`;
    } else if (page === 'profiles') {
        html += `<div id="profiles-list" class="list"></div>`;
    }

    main.innerHTML = html;

    // Attach filter listeners
    if (page === 'apps') {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterAndRender(); // From app.js
            });
        });
        const filterBar = document.querySelector('.filter-bar');
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                filterBar.scrollBy({ left: btn.dataset.dir === 'left' ? -100 : 100, behavior: 'smooth' });
            });
        });
    }
}

function renderFilterBar() {
    const cats = ['ALL', 'POPULAR', 'EDITING', 'ENHANCER', 'MUSIC', 'FILM', 'ANIME', 'RANDOM'];
    return `
        <div class="filter-bar">
            <button class="arrow-btn" data-dir="left">&lt;</button>
            ${cats.map(c => `<button class="filter-btn ${c === 'ALL' ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}
            <button class="arrow-btn" data-dir="right">&gt;</button>
        </div>
    `;
}

export function renderCard(item, type) {
    const frag = document.createDocumentFragment();
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.id = item.id;
    card.dataset.type = type;
    card.innerHTML = `
        <img src="${item.imageUrl || ''}" alt="">
        <div class="card-info">
            <div class="card-title">${item.name || item.title}</div>
            <div class="card-subtitle">${formatSubtitle(item, type)}</div>
        </div>
    `;
    if (type === 'apps') card.addEventListener('click', () => location.href = item.targetLink);
    frag.appendChild(card);
    return card;
}

function formatSubtitle(item, type) {
    if (type === 'apps') {
        let date = item.updateDate ? new Date(item.updateDate.seconds * 1000).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        let cat = Array.isArray(item.category) ? item.category.join(' - ') : item.category || '';
        return [date, cat].filter(Boolean).join(' - ');
    } else if (type === 'store') {
        return item.priceText ? item.priceText.join(' / ') : item.price || '';
    } else {
        return '';
    }
}

export function showModal(product) {
    document.getElementById('modal-img').src = product.imageUrl;
    document.getElementById('modal-title').textContent = product.name;
    document.getElementById('modal-prices').innerHTML = `<h3>LIST HARGA</h3>${product.priceText.map(p => `<p>- ${p}</p>`).join('')}`;
    document.getElementById('modal-desc').innerHTML = `<h3>DESKRIPSI PRODUK</h3><p>${product.description}</p>`;
    document.getElementById('modal-wa-btn').href = product.whatsappLink;
    productModal.classList.remove('hidden');
    globalOverlay.classList.remove('hidden');

    const content = productModal.querySelector('.modal-content');
    const indicator = document.getElementById('scroll-indicator');
    setTimeout(() => {
        indicator.style.opacity = content.scrollHeight > content.clientHeight ? 1 : 0;
    }, 100);
    content.addEventListener('scroll', () => {
        indicator.style.opacity = content.scrollTop < content.scrollHeight - content.clientHeight ? 1 : 0;
    }, { passive: true });
}
