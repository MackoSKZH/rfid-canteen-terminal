let menu = [];
let order = {};

function resetPayButton() {
    const input = document.getElementById('card-input');
    const payButton = document.querySelector('.fixed-pay-button');
    if (input) {
        input.value = '';
        input.style.display = 'none';
    }
    if (payButton) {
        payButton.style.backgroundColor = '#28a745';
        payButton.innerText = 'ZAPLATIŤ';
    }
}

function flashOverlay(type = 'success') {
    const overlay = document.getElementById('overlay-feedback');
    if (!overlay) return;

    overlay.className = type;
    overlay.style.opacity = '1';

    setTimeout(() => {
        overlay.style.opacity = '0';
    }, 500);
}

function showStatusMessage(element, message, duration = 500, hideInput = true) {
    element.innerText = message;
    setTimeout(() => {
        element.innerText = '';
        if (hideInput) resetPayButton();
    }, duration);
}

async function fetchMenu() {
    const res = await fetch('/api/menu');
    menu = await res.json();

    const menuDiv = document.getElementById('menu');
    menuDiv.innerHTML = '';
    menu.forEach(item => {
        const btn = document.createElement('button');
        btn.innerText = `${item.name} ${item.points}`;
        btn.className = 'menu-button';
        btn.style.fontSize = '35px';
        btn.style.padding = '20px';
        btn.onclick = () => addToOrder(item.name, item.points);
        menuDiv.appendChild(btn);
    });
}

function addToOrder(name, points) {
    cancelPendingPayment();
    if (!order[name]) {
        order[name] = { count: 1, points };
    } else {
        order[name].count++;
    }
    updateOrderUI();
}

function updateOrderUI() {
    const summary = document.getElementById('order-summary');
    summary.innerHTML = '<h3>Vybrané položky:</h3>';
    let total = 0;

    Object.entries(order).forEach(([name, data]) => {
        const item = document.createElement('div');
        item.className = 'order-item';

        const title = document.createElement('span');
        title.innerText = `${name} (${data.points}b)`;

        const counter = document.createElement('div');
        counter.className = 'counter';

        const btnMinus = document.createElement('button');
        btnMinus.innerText = '−';
        btnMinus.onclick = () => {
            data.count--;
            if (data.count <= 0) delete order[name];
            cancelPendingPayment();
            updateOrderUI();
        };

        const countDisplay = document.createElement('span');
        countDisplay.innerText = data.count;

        const btnPlus = document.createElement('button');
        btnPlus.innerText = '+';
        btnPlus.onclick = () => {
            data.count++;
            cancelPendingPayment();
            updateOrderUI();
        };

        counter.appendChild(btnMinus);
        counter.appendChild(countDisplay);
        counter.appendChild(btnPlus);

        item.appendChild(title);
        item.appendChild(counter);

        summary.appendChild(item);
        total += data.points * data.count;
    });

    if (total > 0) {
        const totalDisplay = document.createElement('h3');
        totalDisplay.innerText = `Spolu: ${total} bodov`;
        summary.appendChild(totalDisplay);
    }
}

function cancelPendingPayment() {
    resetPayButton();
    const status = document.getElementById('consume-status');

    if (status) status.innerText = '';
}

function startPayment() {
    const total = Object.entries(order).reduce((sum, [_, d]) => sum + d.points * d.count, 0);
    const input = document.getElementById('card-input');
    const status = document.getElementById('consume-status');
    const payButton = document.querySelector('.fixed-pay-button');

    if (input.style.display === 'block') {
        resetPayButton();
        status.innerText = '';
        return;
    }

    if (total === 0) {
        alert("Nevybrali ste žiadne jedlo.");
        return;
    }

    input.value = '';
    input.style.display = 'block';
    input.focus();
    status.innerText = 'Prilož kartu...';

    if (payButton) {
        payButton.style.backgroundColor = '#dc3545';
        payButton.innerText = 'ZRUŠIŤ PLATBU';
    }
}

document.getElementById('card-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        const uid = e.target.value.trim();
        if (uid) {
            consume(uid);
        }
    }
});

document.getElementById('toggle-users').addEventListener('click', function () {
    const section = document.getElementById('animator-list-section').parentElement.querySelector('.section:last-of-type');
    const btn = this;

    if (section.style.display === 'none' || section.style.display === '') {
        section.style.display = 'block';
        btn.innerText = 'Skryť animátorov';
    } else {
        section.style.display = 'none';
        btn.innerText = 'Zobraziť animátorov';
    }
});

document.getElementById('refresh-button').addEventListener('click', () => {
    location.reload();
});

async function consume(uid) {
    const status = document.getElementById('consume-status');

    const items = [];
    Object.entries(order).forEach(([name, data]) => {
        items.push({ item: name, count: data.count, cost: data.points });
    });

    if (items.length === 0) {
        showStatusMessage(status, "Objednávka je prázdna.");
        return;
    }

    try {
        const res = await fetch('/api/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, items })
        });

        const out = await res.json();

        if (!res.ok) {
            flashOverlay('error');
            showStatusMessage(status, `${out.error}`, 1000, true);
            return;
        }

        flashOverlay('success');
        showStatusMessage(status, `Zostáva bodov: ${out.points}`, 500, true);
    } catch (err) {
        showStatusMessage(status, `Chyba komunikácie so serverom`, 3000, true);
        console.error(err);
        return;
    }

    resetPayButton();
    order = {};
    updateOrderUI();
    loadUsers();
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

document.getElementById('register-uid').addEventListener('keydown', handleRegisterEnter);
document.getElementById('register-name').addEventListener('keydown', handleRegisterEnter);

function handleRegisterEnter(e) {
    if (e.key === 'Enter') {
        register();
    }
}

async function register() {
    const uid = document.getElementById('register-uid').value.trim();
    const name = document.getElementById('register-name').value.trim();
    const status = document.getElementById('register-status');

    if (!uid || !name) {
        showStatusMessage(status, "Zadaj UID aj meno.");
        return;
    }

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, name })
    });

    const out = await res.json();

    if (res.ok) {
        showStatusMessage(status, `Registrovaný ${name}`);
        loadUsers();
    } else {
        showStatusMessage(status, `Chyba: ${out.error}`);
        document.getElementById('register-uid').value = '';
        document.getElementById('register-name').value = '';
        return;
    }

    document.getElementById('register-uid').value = '';
    document.getElementById('register-name').value = '';
}

async function loadUsers() {
    const res = await fetch('/api/users');
    const users = await res.json();

    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';

    users.forEach(u => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${u.name}</td><td>${u.uid}</td><td>${u.points}</td>`;
        tbody.appendChild(row);
    });
}

fetchMenu();
loadUsers();