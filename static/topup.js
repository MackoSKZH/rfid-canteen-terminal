let pointsOptions = [];
let selectedTopup = null;

const topupStatus = () => document.getElementById('topup-status');
const topupInput  = () => document.getElementById('topup-card-input');

function flashTopupOverlay(type = 'success') {
    const overlay = document.getElementById('overlay-feedback');
    if (!overlay) return;
    overlay.className = type;
    overlay.style.opacity = '1';
    setTimeout(() => { overlay.style.opacity = '0'; }, 500);
}

function showTopupMessage(message, duration = 1200, clearSelection = false) {
    const st = topupStatus();
    if (!st) return;
    st.innerText = message;
    setTimeout(() => {
        st.innerText = '';
        if (clearSelection) clearTopupSelection();
    }, duration);
}

function clearTopupSelection() {
    selectedTopup = null;
    const buttons = document.querySelectorAll('#points-menu .points-button');
    buttons.forEach(b => b.classList.remove('selected-item'));
    const inp = topupInput();
    if (inp) { inp.value = ''; inp.blur(); }
}

async function fetchPointsMenu() {
    const res = await fetch('/api/points_menu');
    pointsOptions = await res.json();

    const wrap = document.getElementById('points-menu');
    wrap.innerHTML = '';

    pointsOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'points-button';
        btn.innerText = `+${opt.points} b`;
        btn.onclick = () => {
            selectedTopup = opt.points;
            document.querySelectorAll('#points-menu .points-button')
                .forEach(b => b.classList.remove('selected-item'));
            btn.classList.add('selected-item');

            const inp = topupInput();
            const st = topupStatus();
            if (inp && st) {
                inp.value = '';
                inp.style.display = 'block';
                st.innerText = 'Prilož kartu...';
                inp.focus();
            }
        };
        wrap.appendChild(btn);
    });
}

async function doTopup(uid) {
    const st = topupStatus();
    if (!selectedTopup) {
        showTopupMessage('Najprv vyber počet bodov.');
        return;
    }

    try {
        const res = await fetch('/api/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, points: selectedTopup })
        });
        const out = await res.json();

        if (!res.ok) {
            flashTopupOverlay('error');
            showTopupMessage(out.error || 'Chyba dobíjania', 2000, true);
            return;
        }

        flashTopupOverlay('success');
        showTopupMessage(`Dobité +${selectedTopup} b • Stav: ${out.points} b`, 1200, true);

        if (typeof loadUsers === 'function') loadUsers();
    } catch (e) {
        console.error(e);
        showTopupMessage('Chyba komunikácie so serverom', 2000, true);
    }
}

function topupStartIfReady() {
    const inp = topupInput();
    if (!inp || !selectedTopup) return;
    const uid = (inp.value || '').trim();
    if (uid) doTopup(uid);
}
window.topupStartIfReady = topupStartIfReady;

document.addEventListener('DOMContentLoaded', () => {
    const inp = topupInput();
    if (!inp) return;
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const uid = e.target.value.trim();
            if (uid) doTopup(uid);
        }
    });
});

fetchPointsMenu();
