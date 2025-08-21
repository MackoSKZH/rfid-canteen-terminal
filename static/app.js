const btnTopup   = document.getElementById('mode-topup');
const btnConsume = document.getElementById('mode-consume');

const sectionTopup   = document.getElementById('credit-topup');
const sectionConsume = document.getElementById('credit-consume');
const registerPanel  = document.getElementById('register-section');

function showOnlyModeButtons() {
    btnTopup.style.display = 'inline-block';
    btnConsume.style.display = 'inline-block';
    sectionTopup.style.display = 'none';
    sectionConsume.style.display = 'none';
    if (registerPanel) registerPanel.style.display = 'none';
}

function hideModeButtons() {
    btnTopup.style.display = 'none';
    btnConsume.style.display = 'none';
}

function openTopup() {
    hideModeButtons();
    sectionConsume.style.display = 'none';
    sectionTopup.style.display = 'block';
    if (registerPanel) registerPanel.style.display = 'block';
}

function openConsume() {
    hideModeButtons();
    sectionTopup.style.display = 'none';
    if (registerPanel) registerPanel.style.display = 'none';
    sectionConsume.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', showOnlyModeButtons);

btnTopup.addEventListener('click', openTopup);
btnConsume.addEventListener('click', openConsume);
