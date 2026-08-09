// ==UserScript==
// @name         CW Things List [RA Team]
// @version      1.0
// @description  Мобильный список предметов для CatWar – при наведении на предмет показывается вся информация о нём!
// @author       RA couple ( Krivodushie & Psiii )
// @copyright    Roman Kotenkov  ( https://vk.ru/krivodushie / https://github.com/krivodushie )
// @copyright    Amina Kotenkova ( https://vk.ru/psiiiiiii / https://github.com/Psiiiiiii )
// @updateURL    https://raw.githubusercontent.com/Krivodushie/userscripts/main/things-list.user.js
// @downloadURL  https://raw.githubusercontent.com/Krivodushie/userscripts/main/things-list.user.js
// @match        https://catwar.su/*
// @match        https://catwar.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// @icon         https://catwar.net/cw3/things/647.png
// ==/UserScript==

(function () {
'use strict';

const DB_URL = 'https://raw.githubusercontent.com/Krivodushie/userscripts/refs/heads/main/data/things.json';
const CACHE_KEY = 'kti-things-db';
const FETCH_TIMEOUT = 10 * 1000;
const REFRESH_EVERY = 10 * 60 * 1000;
const DB_KEY_CODES = [
    110, 117, 45, 105, 45, 122, 97, 99, 104, 101, 109, 45, 116, 105, 45, 115,
    117, 100, 97, 45, 115, 109, 111, 116, 114, 105, 115, 99, 104, 45, 109, 97,
    119, 119,
];
const DB_KEY = String.fromCharCode(...DB_KEY_CODES);

function decryptPayload(b64, key) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const keyBytes = new TextEncoder().encode(key);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];

    return JSON.parse(new TextDecoder().decode(out));
}

const TEST_DB = {
    '1035': {
        name: 'Just a Thing',
        grade: 100,
        weight: 0,
        description: 'Just test item',
        date: '2026-08-06',
        history: 'Выдавался за победу над кибергугагоргом на летней Каре Небесной в 2035 году',
        effects: [
            { text: 'Добавляет +100 к иммунитету', type: 'positive' },
            { text: 'Высасывает душу', type: 'negative' },
            { text: '100 использований', type: 'neutral' },
        ],
    }
};

const THING_RE = /things(?:\/|%2F)+(\d+)\.png/i;

let itemsDb = {};

const SETTINGS_PREFIX = 'kti_settings_';

const DEF = {
    tableEnabled: true, //          Включено ли окошко с информацией о предметах в целом
    tooltipWidth: 260, //           Ширина поля всплывашки      (px)
    hoverRadius: 70, //             Радиус наведения на предмет (px)
    showDescription: true, //       Показывать описание
    showEffect: true, //            Показывать эффекты
    showDate: true, //              Показывать дату (я не помню зачем её добавил, удалю потом)
    showHistory: true, //           Показывать способ получения предмета
    showGrade: true, //             Показывать баллы
    showWeight: true, //            Показывать вес
    seenSettings: false, //           Техническое: заходили ли уже в настройки
    lastUpdateDate: '', //            Техническое: Дата последнего успешного обновления базы (YYYY-MM-DD)
    lastUpdateFailed: false, //       Техническое: Провалилась ли последняя попытка обновления
    lastUpdateFailedSeen: true, //    Техническое: Видел ли пользователь уведомление о провале
//                                  Рома фембойчик
};

function getSetting(key) {
    const val = window.localStorage.getItem(SETTINGS_PREFIX + key);
    if (val === null) return null;
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
}
function setSetting(key, val) {
    window.localStorage.setItem(SETTINGS_PREFIX + key, String(val));
    SETTINGS[key] = val;
}

const SETTINGS = {};
for (const key in DEF) {
    const s = getSetting(key);
    SETTINGS[key] = s === null
        ? DEF[key]
        : (typeof DEF[key] === 'number' ? parseFloat(s) : s);
}

function loadCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
}
function saveCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
}
function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fetchDb() {
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: DB_URL + (DB_URL.includes('?') ? '&' : '?') + '_=' + Date.now(),
            timeout: FETCH_TIMEOUT,
            onload: r => {
                try { resolve(decryptPayload(r.responseText.trim(), DB_KEY)); }
                catch (e) { console.error('[CW:TL] Не смог расшифровать/распарсить ответ сервера, получился бред', e); resolve(null); }
            },
            onerror: () => resolve(null),
            ontimeout: () => resolve(null),
        });
    });
}

async function initDb() {

    itemsDb = loadCache() || TEST_DB;
}

let updating = false;

async function performUpdate() {
    if (updating) return false;
    updating = true;
    setLinkSpinning(true);

    const fresh = await fetchDb();
    if (fresh) {
        itemsDb = fresh;
        saveCache(fresh);
        setSetting('lastUpdateDate', todayStr());
        setSetting('lastUpdateFailed', false);
        setSetting('lastUpdateFailedSeen', true);
    } else {
        setSetting('lastUpdateFailed', true);
        setSetting('lastUpdateFailedSeen', false);
    }

    updating = false;
    setLinkSpinning(false);
    refreshDot();
    renderUpdateStatus();
    return !!fresh;
}

async function maybeAutoUpdate() {
    if (SETTINGS.lastUpdateDate === todayStr()) return;
    await performUpdate();
}

initDb().then(maybeAutoUpdate);
setInterval(maybeAutoUpdate, REFRESH_EVERY);

function extractThingId(url) {
    const m = url && url.match(THING_RE);
    return m ? m[1] : null;
}

function parseBgThings(el) {
    const cs = getComputedStyle(el);
    const bgImage = cs.backgroundImage;
    if (!bgImage || bgImage === 'none') return [];

    const urls = [...bgImage.matchAll(/url\((['"]?)(.*?)\1\)/g)].map(m => m[2]);
    const positions = cs.backgroundPosition.split(',').map(s => s.trim());

    const items = [];
    urls.forEach((url, i) => {
        const id = extractThingId(url);
        if (!id) return;
        const posStr = positions[i] || positions[positions.length - 1] || '0% 0%';
        const parts = posStr.split(/\s+/);
        const x = parseFloat(parts[0]) / 100 || 0;
        const y = parseFloat(parts[1]) / 100 || 0;
        items.push({ id, url, x, y });
    });
    return items;
}

const ICON_HIT_SIZE = 70;

function nearestBgItem(rect, items, clientX, clientY) {
    if (!rect || !rect.width || !rect.height) return null;
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    let best = null, bestDist = Infinity;
    for (const it of items) {
        const anchorX = it.x * (rect.width  - ICON_HIT_SIZE) + ICON_HIT_SIZE / 2;
        const anchorY = it.y * (rect.height - ICON_HIT_SIZE) + ICON_HIT_SIZE / 2;
        const d = Math.hypot(px - anchorX, py - anchorY);
        if (d < bestDist) { bestDist = d; best = it; }
    }
    const radius = SETTINGS.hoverRadius || DEF.hoverRadius;
    return bestDist <= radius ? best : null;
}

GM_addStyle(`
#kti-tooltip {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 2147483647;
    max-width: 260px;
    background: #1d1c1d;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 10px;
    color: #e8e3e7;
    font: 12px "Segoe UI", Tahoma, sans-serif;
    box-shadow: 0 12px 30px rgba(0,0,0,0.5);
    pointer-events: none;
    display: none;
    will-change: transform;
}
#kti-tooltip.visible { display: block; }
.kti-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.kti-thumb { width: 32px; height: 32px; object-fit: contain; flex-shrink: 0; image-rendering: pixelated; }
.kti-name { font-weight: 600; color: #fff; line-height: 1.2; }
.kti-id { color: #a09ea0; font-size: 11px; }
.kti-grade {
    margin-left: auto;
    flex-shrink: 0;
    min-width: 20px;
    text-align: center;
    padding: 2px 6px;
    border-radius: 5px;
    font-weight: 700;
    color: #fff;
}
.kti-desc { color: #cfc9cf; margin-bottom: 4px; }
.kti-effect {
    font-weight: 600;
    margin-bottom: 2px;
}
.kti-effect-positive { color: #8fbf7a; }
.kti-effect-negative { color: #e05555; }
.kti-effect-neutral { color: #a09ea0; }
.kti-weight-zero { color: #8fbf7a; font-weight: 600; }
.kti-unique { color: #c9782e; font-weight: 700; font-style: italic; }
.kti-row { color: #a09ea0; margin-top: 2px; }
.kti-row b { color: #cfc9cf; }
.kti-muted { font-style: italic; }

.kti-settings-link {
    display: inline;
}
.kti-settings-dot {
    display: inline-block;
    vertical-align: super;
    position: relative;
    top: 1px;
    left: 6px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e05555;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}
.kti-settings-spinner {
    display: none;
    width: 8px;
    height: 8px;
    margin-left: 4px;
    border: 2px solid rgba(232,227,231,0.25);
    border-top-color: #cfc9cf;
    border-radius: 50%;
    vertical-align: middle;
    animation: kti-spin 0.7s linear infinite;
}
@keyframes kti-spin { to { transform: rotate(360deg); } }

#kti-settings-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    background: rgba(0,0,0,0.55);
    align-items: center;
    justify-content: center;
}
#kti-settings-overlay.visible { display: flex; }
#kti-settings-box {
    width: 320px;
    max-width: 90vw;
    background: #1d1c1d;
    border: 1px solid rgba(176,194,115,0.25);
    border-radius: 12px;
    color: #e8e3e7;
    font: 13px "Segoe UI", Tahoma, sans-serif;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
}
#kti-settings-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}
#kti-settings-title { display: flex; flex-direction: column; gap: 3px; }
#kti-settings-title-main { font-weight: 700; font-size: 14px; color: #fff; letter-spacing: 0.2px; }
#kti-settings-title-team { font-size: 10px; font-weight: 400; color: #fff; opacity: 0.45; margin-left: 2px; }
#kti-settings-title-sub { font-size: 11.5px; font-weight: 400; color: #a09ea0; }
#kti-settings-close {
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    color: #a09ea0;
    padding: 0 4px;
}
#kti-settings-close:hover { color: #fff; }
#kti-settings-body { padding: 10px 12px; }
#kti-settings-body .kti-set-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 6px 0;
}
#kti-settings-body label { cursor: pointer; user-select: none; }
#kti-settings-body input[type=checkbox] { cursor: pointer; margin: 0; }
#kti-settings-body input[type=number] {
    width: 70px;
    background: #222;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 2px 4px;
    font-size: 12px;
}
#kti-settings-body hr {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.1);
    margin: 8px 0;
}
#kti-update-status {
    display: block;
    margin: 6px 0;
    color: #a09ea0;
    font-size: 11px;
}
#kti-update-status.kti-update-error { color: #e05555; }
#kti-settings-body .kti-set-footer {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.1);
    font-size: 11px;
    line-height: 1.55;
    color: #8a8789;
}
#kti-settings-body .kti-set-footer a { color: #b0c273; text-decoration: none; }
#kti-settings-body .kti-set-footer a:hover { text-decoration: underline; }
#kti-settings-body .kti-set-footer b { color: #c9c6c9; }
#kti-update-btn {
    background: #333;
    color: #e8e3e7;
    border: 1px solid #555;
    border-radius: 5px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
}
#kti-update-btn:hover { background: #3d3d3d; }
#kti-update-btn:disabled { opacity: 0.6; cursor: default; }


`);

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// TODO: Подобрать цвета под реальные грейд цвета ВАЖНО
function gradeColor(grade) {
    if (grade >= 9) return '#c9782e';
    if (grade >= 7) return '#8a5fc9';
    if (grade >= 5) return '#4f8fd6';
    if (grade >= 3) return '#5a9e5a';
    return '#6b6b6b';
}

let tooltipEl = null;
function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'kti-tooltip';
    document.body.appendChild(tooltipEl);
    return tooltipEl;
}

function renderTooltip(id, thumbUrl) {
    const data = itemsDb[id];
    const el = ensureTooltip();
    el.style.maxWidth = (SETTINGS.tooltipWidth || DEF.tooltipWidth) + 'px';

    const hasEffects  = Array.isArray(data?.effects) && data.effects.length > 0;
    const showGrade   = SETTINGS.showGrade  && data?.grade != null;
    const showWeight  = SETTINGS.showWeight && !!data;
    const showDesc    = SETTINGS.showDescription && data?.description;
    const showEffect  = SETTINGS.showEffect && hasEffects;
    const showNoEffect = SETTINGS.showEffect && data && !hasEffects && !data?.description;
    const showDate    = SETTINGS.showDate   && data?.date;
    const showHist    = SETTINGS.showHistory && data?.history;
    const showUnique  = !!data?.unique;

    el.innerHTML = `
        <div class="kti-head">
            <img class="kti-thumb" src="${escapeHtml(thumbUrl)}">
            <div>
                <div class="kti-name">${escapeHtml(data?.name || 'Неизвестный предмет')}</div>
                <div class="kti-id">#${escapeHtml(id)}</div>
            </div>
            ${showGrade ? `<div class="kti-grade" style="background:${gradeColor(data.grade)}">${escapeHtml(String(data.grade))}</div>` : ''}
        </div>
        ${showDesc ? `<div class="kti-desc">${escapeHtml(data.description)}</div>` : ''}
        ${showWeight ? (data.weight === 0
            ? `<div class="kti-row kti-weight-zero">Невесомый</div>`
            : `<div class="kti-row"><b>Вес:</b> ${data.weight != null ? escapeHtml(String(data.weight)) : 'неизвестно'}</div>`
        ) : ''}
        ${showUnique ? `<div class="kti-row kti-unique">В единственном экземпляре</div>` : ''}
        ${showEffect ? data.effects.map(fx => {
            const cls = fx?.type === 'negative' ? 'kti-effect-negative'
                : fx?.type === 'neutral' ? 'kti-effect-neutral'
                : 'kti-effect-positive';
            return `<div class="kti-effect ${cls}">${escapeHtml(fx?.text ?? '')}</div>`;
        }).join('') : ''}
        ${showNoEffect ? `<div class="kti-row kti-muted">Эффекта нет</div>` : ''}
        ${showDate ? `<div class="kti-row"><b>Дата:</b> ${escapeHtml(data.date)}</div>` : ''}
        ${showHist ? `<div class="kti-row"><b>Получение:</b> ${escapeHtml(data.history)}</div>` : ''}
        ${!data ? `<div class="kti-row kti-muted">Нет данных в базе</div>` : ''}
    `;
    el.classList.add('visible');
}

function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
}

function positionTooltip(clientX, clientY) {
    if (!tooltipEl) return;
    const pad = 24;
    if (!tooltipRect) tooltipRect = tooltipEl.getBoundingClientRect();
    const rect = tooltipRect;
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + rect.width > innerWidth)  x = clientX - rect.width - pad;
    if (y + rect.height > innerHeight) y = clientY - rect.height - pad;
    x = Math.max(4, x);
    y = Math.max(4, y);
    tooltipEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

let activeBgEl = null;
let activeBgItems = null;
let activeBgRect = null;

let lastEventTarget = null;
let lastKind = null;
let lastImg = null;

let lastRenderedId = null;
let tooltipRect = null;

let rafId = null;
let pendingTarget = null;
let pendingClientX = 0;
let pendingClientY = 0;

function closestThingImg(target) {
    const img = target.closest?.('img');
    if (img && extractThingId(img.src)) return img;
    return null;
}
function closestThingBgEl(target) {
    let el = target;
    while (el && el !== document.body) {
        if (/things[\/%2F]/i.test(el.getAttribute?.('style') || '')) return el;
        el = el.parentElement;
    }
    return null;
}

function clearActiveBg() {
    activeBgEl = null;
    activeBgItems = null;
    activeBgRect = null;
}

function refreshActiveBgRect() {
    if (activeBgEl) activeBgRect = activeBgEl.getBoundingClientRect();
}
window.addEventListener('scroll', refreshActiveBgRect, true);
window.addEventListener('resize', refreshActiveBgRect);
window.addEventListener('resize', () => { tooltipRect = null; });

function resolveTarget(target) {
    if (target === lastEventTarget) return;
    lastEventTarget = target;

    const img = closestThingImg(target);
    if (img) {
        lastKind = 'img';
        lastImg = img;
        if (activeBgEl) clearActiveBg();
        return;
    }
    lastImg = null;

    const bgEl = closestThingBgEl(target);
    if (bgEl) {
        lastKind = 'bg';
        if (activeBgEl !== bgEl) {
            activeBgEl = bgEl;
            activeBgItems = parseBgThings(bgEl);
            refreshActiveBgRect();
        }
        return;
    }

    lastKind = null;
    if (activeBgEl) clearActiveBg();
}

function renderTooltipIfNeeded(id, thumbUrl) {
    if (id === lastRenderedId) return;
    lastRenderedId = id;
    renderTooltip(id, thumbUrl);
    tooltipRect = null;
}

function processPointer(clientX, clientY) {
    if (!SETTINGS.tableEnabled) {
        hideTooltip();
        lastRenderedId = null;
        return;
    }

    if (lastKind === 'img' && lastImg) {
        renderTooltipIfNeeded(extractThingId(lastImg.src), lastImg.src);
        positionTooltip(clientX, clientY);
        return;
    }

    if (lastKind === 'bg' && activeBgEl) {
        if (!activeBgRect) refreshActiveBgRect();
        const hit = activeBgItems && activeBgItems.length
            ? nearestBgItem(activeBgRect, activeBgItems, clientX, clientY)
            : null;
        if (hit) {
            renderTooltipIfNeeded(hit.id, hit.url);
            positionTooltip(clientX, clientY);
        } else {
            hideTooltip();
            lastRenderedId = null;
        }
        return;
    }

    hideTooltip();
    lastRenderedId = null;
}

function handlePointer(e) {
    pendingTarget = e.target;
    pendingClientX = e.clientX;
    pendingClientY = e.clientY;

    if (!rafId) {
        rafId = requestAnimationFrame(() => {
            rafId = null;
            resolveTarget(pendingTarget);
            processPointer(pendingClientX, pendingClientY);
        });
    }
}

document.addEventListener('mouseover', handlePointer, true);
document.addEventListener('mousemove', handlePointer, true);

document.addEventListener('mouseout', e => {
    if (!e.relatedTarget) {
        hideTooltip();
        lastRenderedId = null;
    }
}, true);

function shouldShowDot() {
    return !SETTINGS.seenSettings || (SETTINGS.lastUpdateFailed && !SETTINGS.lastUpdateFailedSeen);
}

function insertSettingsLink() {
    const spans = document.querySelectorAll('span.small');
    spans.forEach(span => {
        if (span.querySelector('.kti-settings-link')) return;

        span.appendChild(document.createTextNode(' | '));

        const link = document.createElement('a');
        link.href = '#';
        link.className = 'kti-settings-link';
        link.textContent = 'CW Things List';

        const spinner = document.createElement('span');
        spinner.className = 'kti-settings-spinner';
        link.appendChild(spinner);

        const dot = document.createElement('span');
        dot.className = 'kti-settings-dot';
        dot.style.display = shouldShowDot() ? '' : 'none';
        link.appendChild(dot);

        link.addEventListener('click', e => {
            e.preventDefault();
            openSettingsModal();
        });

        span.appendChild(link);
    });
}

function refreshDot() {
    const show = shouldShowDot();
    document.querySelectorAll('.kti-settings-dot').forEach(dot => {
        dot.style.display = show ? '' : 'none';
    });
}

function setLinkSpinning(spinning) {
    document.querySelectorAll('.kti-settings-spinner').forEach(sp => {
        sp.style.display = spinning ? 'inline-block' : 'none';
    });
}

function markSettingsSeen() {
    let changed = false;
    if (!SETTINGS.seenSettings) { setSetting('seenSettings', true); changed = true; }
    if (SETTINGS.lastUpdateFailed && !SETTINGS.lastUpdateFailedSeen) { setSetting('lastUpdateFailedSeen', true); changed = true; }
    if (changed) refreshDot();
}

let settingsOverlayEl = null;

function buildSettingsModal() {
    const overlay = document.createElement('div');
    overlay.id = 'kti-settings-overlay';
    overlay.innerHTML = `
        <div id="kti-settings-box">
            <div id="kti-settings-header">
                <div id="kti-settings-title">
                    <span id="kti-settings-title-main">CW Things List <span id="kti-settings-title-team">[ra.team]</span></span>
                    <span id="kti-settings-title-sub">Настройки</span>
                </div>
                <span id="kti-settings-close">&times;</span>
            </div>
            <div id="kti-settings-body">
                <div class="kti-set-row">
                    <input type="checkbox" id="kti-set-tableEnabled">
                    <label for="kti-set-tableEnabled"><b>Включить информацию о предметах</b></label>
                </div>
                <hr>
                <div class="kti-set-row">
                    <input type="checkbox" id="kti-set-showDescription">
                    <label for="kti-set-showDescription">Показывать описание</label>
                </div>
                <div class="kti-set-row">
                    <input type="checkbox" id="kti-set-showEffect">
                    <label for="kti-set-showEffect">Показывать эффекты</label>
                </div>
                <div class="kti-set-row">
                    <input type="checkbox" id="kti-set-showDate">
                    <label for="kti-set-showDate">Показывать дату</label>
                </div>
                <div class="kti-set-row">
                    <input type="checkbox" id="kti-set-showHistory">
                    <label for="kti-set-showHistory">Показывать историю</label>
                </div>
                <div class="kti-set-row">
                    <input type="checkbox" id="kti-set-showGrade">
                    <label for="kti-set-showGrade">Показывать балл</label>
                </div>
                <div class="kti-set-row">
                    <input type="checkbox" id="kti-set-showWeight">
                    <label for="kti-set-showWeight">Показывать вес</label>
                </div>
                <hr>
                <div class="kti-set-row">
                    <input type="number" id="kti-set-tooltipWidth" min="150" max="500" step="10">
                    <label for="kti-set-tooltipWidth">Ширина всплывающего окна (px)</label>
                </div>
                <div class="kti-set-row">
                    <input type="number" id="kti-set-hoverRadius" min="20" max="200" step="5">
                    <label for="kti-set-hoverRadius">Радиус наведения (px)</label>
                </div>
                <hr>
                <div class="kti-set-row">
                    <button id="kti-update-btn" type="button">Обновить таблицу</button>
                </div>
                <span id="kti-update-status"></span>
                <div class="kti-set-footer">
                    Пока что в списке есть не все предметы — потихоньку дополняем список и информацию по каждому из них. Будем рады любой помощи, пишите в личку сообщества <a href="https://vk.com/raa.team" target="_blank" rel="noopener noreferrer">RA Team</a> в ВК.
                    <br><br>
                    Отдельное спасибо <b>Тис</b> за массив с данными о многих предметах 💚
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#kti-set-tableEnabled').checked = !!SETTINGS.tableEnabled;
    overlay.querySelector('#kti-set-showDescription').checked = !!SETTINGS.showDescription;
    overlay.querySelector('#kti-set-showEffect').checked = !!SETTINGS.showEffect;
    overlay.querySelector('#kti-set-showDate').checked = !!SETTINGS.showDate;
    overlay.querySelector('#kti-set-showHistory').checked = !!SETTINGS.showHistory;
    overlay.querySelector('#kti-set-showGrade').checked = !!SETTINGS.showGrade;
    overlay.querySelector('#kti-set-showWeight').checked = !!SETTINGS.showWeight;
    overlay.querySelector('#kti-set-tooltipWidth').value = SETTINGS.tooltipWidth;
    overlay.querySelector('#kti-set-hoverRadius').value = SETTINGS.hoverRadius;

    overlay.querySelector('#kti-set-tableEnabled').addEventListener('change', function () {
        setSetting('tableEnabled', this.checked);
        if (!this.checked) hideTooltip();
    });
    overlay.querySelector('#kti-set-showDescription').addEventListener('change', function () { setSetting('showDescription', this.checked); });
    overlay.querySelector('#kti-set-showEffect').addEventListener('change', function () { setSetting('showEffect', this.checked); });
    overlay.querySelector('#kti-set-showDate').addEventListener('change', function () { setSetting('showDate', this.checked); });
    overlay.querySelector('#kti-set-showHistory').addEventListener('change', function () { setSetting('showHistory', this.checked); });
    overlay.querySelector('#kti-set-showGrade').addEventListener('change', function () { setSetting('showGrade', this.checked); });
    overlay.querySelector('#kti-set-showWeight').addEventListener('change', function () { setSetting('showWeight', this.checked); });
    overlay.querySelector('#kti-set-tooltipWidth').addEventListener('change', function () {
        const v = parseFloat(this.value);
        setSetting('tooltipWidth', Number.isFinite(v) && v > 0 ? v : DEF.tooltipWidth);
        tooltipRect = null;
    });
    overlay.querySelector('#kti-set-hoverRadius').addEventListener('change', function () {
        const v = parseFloat(this.value);
        setSetting('hoverRadius', Number.isFinite(v) && v > 0 ? v : DEF.hoverRadius);
    });

    overlay.querySelector('#kti-update-btn').addEventListener('click', async function () {
        this.disabled = true;
        this.textContent = 'Обновляем…';
        await performUpdate();
        this.disabled = false;
        this.textContent = 'Обновить таблицу';
    });

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeSettingsModal();
    });
    overlay.querySelector('#kti-settings-close').addEventListener('click', closeSettingsModal);

    renderUpdateStatus(overlay);
    return overlay;
}

function renderUpdateStatus(overlay) {
    const el = (overlay || settingsOverlayEl)?.querySelector('#kti-update-status');
    if (!el) return;
    if (SETTINGS.lastUpdateFailed) {
        el.textContent = 'Обновление таблицы ценности не удалось: сайт с данными недоступен с вашей сетью.';
        el.classList.add('kti-update-error');
    } else {
        el.classList.remove('kti-update-error');
        el.textContent = SETTINGS.lastUpdateDate
            ? `Последнее обновление: ${SETTINGS.lastUpdateDate}`
            : 'Таблица ещё не обновлялась с сайта.';
    }
}

function escSettingsHandler(e) {
    if (e.key === 'Escape') closeSettingsModal();
}

function openSettingsModal() {
    markSettingsSeen();
    if (!settingsOverlayEl) settingsOverlayEl = buildSettingsModal();
    renderUpdateStatus();
    settingsOverlayEl.classList.add('visible');
    document.addEventListener('keydown', escSettingsHandler);
}

function closeSettingsModal() {
    if (settingsOverlayEl) settingsOverlayEl.classList.remove('visible');
    document.removeEventListener('keydown', escSettingsHandler);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertSettingsLink);
} else {
    insertSettingsLink();
}

})();
