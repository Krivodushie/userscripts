// ==UserScript==
// @name         Облегчалочка
// @version      1.0
// @description  Набор простеньких улучшений для облегчения активных боёв в CatWar.
// @author       Krivodushie
// @copyright    Roman Kotenkov ( https://vk.ru/Krivodushie / https://github.com/Krivodushie )
// @updateURL    https://raw.githubusercontent.com/Krivodushie/userscripts/main/oblegschalochka.user.js
// @downloadURL  https://raw.githubusercontent.com/Krivodushie/userscripts/main/oblegschalochka.user.js
// @match        *://catwar.su/*
// @match        *://catwar.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @icon         https://i.ibb.co/7NZjNffJ/cringe.png
// @require      https://code.jquery.com/jquery-3.4.1.min.js
// @require      https://code.jquery.com/ui/1.13.3/jquery-ui.min.js
// ==/UserScript==

'use strict';

const def = {
   vis_uiDarkTheme: false //                      Тёмная тема (Дуров верни стену)
  ,vis_fieldCellBorders: false //                  Сетка ячеек
  ,vis_fieldCellBorders_opacity: 0.1 //             Прозрачность сетки (0–1)
  ,vis_fieldCellBorders_color: '#ffffff' //       Цвет сетки
  ,vis_fieldAlwaysLight: false //                 Не затемнять игровую
  ,vis_showHighWounds3: true //                   Иконка при 3 стадии ран
  ,vis_showHighWounds4: true //                   Иконка при 4 стадии ран
  ,vis_showBeatedCats: true //                    Выделение выбитых
  ,vis_showBeatedCats_variant: 2 //                 Вариант выделения выбитых (0=батарейка аним., 1=батарейка стат., 2=стрелка)
  ,vis_replaceFamilyBlock: false //               Заменить семью на настройки Облегчалочки
  ,func_shortFightLog: false //                   Сжимать повторные удары в логе
  ,func_moveFightLog: true //                     Перетаскиваемый лог
  ,func_blockStatusOverlay: true //               Визуальный сигнал при активном блоке
  ,func_blockStatusOverlay_variant: 1 //            Вариант сигнала блока (0–3)
  ,func_blockOverlay_color: '#e05555' //          Цвет рамки блока (вар. 2–3)
  ,aud_blockOnSound: false //                     Звук при зажатии блока
  ,aud_blockOffSound: false //                    Звук при отжатии блока
  ,var_playerId: 0 //                             Мой айди (catwar.su/catXXXXX → число)
  ,on_teamFights: false //                         Командные стрелочки
  ,tf_resetOnRefresh: true //                       Сбрасывать команды при обновлении списка
  ,tf_autoTeam: 0 //                                Авто-определение команд (0=ручной, 1=шахматы, 2=прямо, 3=от стен)
  ,tf_color_g_team1: '#41cd70' //                 Цвет зелёной стрелки команды 1
  ,tf_color_g_team2: '#429dde' //                 Цвет зелёной стрелки команды 2
  ,tf_color_g_team3: '#f6c739' //                 Цвет зелёной стрелки команды 3
  ,tf_color_g_team4: '#ee91d7' //                 Цвет зелёной стрелки команды 4
  ,tf_color_r_team1: '#cd4141' //                 Цвет красной стрелки команды 1
  ,tf_color_r_team2: '#cd4141' //                 Цвет красной стрелки команды 2
  ,tf_color_r_team3: '#cd4141' //                 Цвет красной стрелки команды 3
  ,tf_color_r_team4: '#cd4141' //                 Цвет красной стрелки команды 4
  ,tf_max_height: 100 //                            Макс. высота списка команд (px)
};

// CHANGELOG
// 1.0 (Без изменения версии)
// Убрал тёмную тему из дефолтных настроек
// Скоро закину хотфиксы для известных багов:
// Командные стрелочки ломают лог при наведении на обновить список
// Визуальный сигнал при блоке: выделение рамки у игровой работает криво на разных масштабах
// Выделение выбитых батарейкой и выделение раненых конфликтует: сделаю новую свгшку на случай если игрок и ранен и выбит

const glob = {};
for (const key in def) {
  const s = getSettings(key);
  glob[key] = s === null           ? def[key]
    : Array.isArray(def[key])      ? JSON.parse(s)
    : typeof def[key] === 'number' ? parseFloat(s)
    : s;
}

function getSettings(key) {
  const val = window.localStorage.getItem('bh_' + key);
  if (val === null)   return null;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}

function setSettings(key, val) {
  window.localStorage.setItem('bh_' + key, String(val));
  glob[key] = val;
}

const pageurl = window.location.href;
const isCW3   = /^https:\/\/\w?\.?catwar\.(su|net)\/cw3(?!(\/kns|\/jagd))/.test(pageurl);
const isSett  = /^https:\/\/\w?\.?catwar\.(su|net)\/settings/.test(pageurl);

try {
  if (isCW3)  cw3();
  if (isSett) sett();
} catch (error) {
  console.error('Облегчалочка: ошибка —', error);
}


function cw3() { // Инициализация игровой
  const css = [];

  if (glob.on_teamFights)        { initTeamFightsDOM(); css.push(...teamFightsCSS()); }
  if (glob.func_shortFightLog)   initShortFightLog();
  if (glob.func_moveFightLog)    { initMoveFightLogDOM(); css.push(...moveFightLogCSS()); }
  if (glob.vis_uiDarkTheme)      css.push(cssDarkTheme());
  if (glob.vis_fieldCellBorders) css.push(cssFieldCellBorders());
  if (glob.vis_fieldAlwaysLight) css.push(cssFieldAlwaysLight());
  if (glob.vis_showBeatedCats)   css.push(cssBeatedCats());
  if (glob.vis_showHighWounds3 || glob.vis_showHighWounds4) css.push(cssHighWounds());

  css.push(`@keyframes bh-flash { 0% { opacity: 1; } 100% { opacity: 0; } }`);
  $('head').append(`<style id='battleHelperUI'>${css.join('\n')}</style>`);

  initBlockObserver();
  initInGameSettings();
}

function rebuildCSS() {
  const css = [];
  if (glob.on_teamFights)        css.push(...teamFightsCSS());
  if (glob.func_moveFightLog)    css.push(...moveFightLogCSS());
  if (glob.vis_uiDarkTheme)      css.push(cssDarkTheme());
  if (glob.vis_fieldCellBorders) css.push(cssFieldCellBorders());
  if (glob.vis_fieldAlwaysLight) css.push(cssFieldAlwaysLight());
  if (glob.vis_showBeatedCats)   css.push(cssBeatedCats());
  if (glob.vis_showHighWounds3 || glob.vis_showHighWounds4) css.push(cssHighWounds());
  css.push(`@keyframes bh-flash { 0% { opacity: 1; } 100% { opacity: 0; } }`);
  $('#battleHelperUI').text(css.join('\n'));
}

function initInGameSettings() { // Настроечки в игровой
  $('#app').ready(function () {
    const $family = $('td#family');
    if (!$family.length) return;

    $family.css({ padding: '6px', verticalAlign: 'top' });

    const $familyInner = $family.children().wrapAll('<div id="bh-family-inner">').parent();

    $family.prepend(`
      <style>
        #bh-cw3-settings {
          font-size: 11px;
          line-height: 1.5;
          color: #ccc;
        }
        #bh-cw3-settings .bh-section       { margin-bottom: 6px; }
        #bh-cw3-settings .bh-section-title {
          font-size: 10px; font-weight: bold; text-transform: uppercase;
          letter-spacing: .5px; color: #888; margin-bottom: 3px;
          border-bottom: 1px solid #444; padding-bottom: 2px;
        }
        #bh-cw3-settings .bh-row           { display: flex; align-items: center; gap: 4px; margin: 2px 0; flex-wrap: wrap; }
        #bh-cw3-settings label             { cursor: pointer; user-select: none; }
        #bh-cw3-settings input[type=checkbox] { cursor: pointer; margin: 0; }
        #bh-cw3-settings input[type=color]    { width: 28px; height: 18px; padding: 1px; cursor: pointer; border: none; }
        #bh-cw3-settings input[type=number]   { width: 46px; background: #222; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 1px 3px; font-size: 11px; }
        #bh-cw3-settings select               { background: #222; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 1px; font-size: 11px; max-width: 110px; }
        #bh-cw3-settings .bh-colors           { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; margin-top: 2px; }
        #bh-cw3-settings .bh-colors-label     { font-size: 10px; color: #666; text-align: center; }
        #bh-cw3-settings .bh-dim              { font-size: 10px; color: #666; margin-top: 4px; }
      </style>

      <div id="bh-cw3-settings">

        <h2><a href="#" id="bh-cw3-h2">Настройки Облегчалочки</a></h2>

        <div class="bh-section">
          <div class="bh-section-title">Визуал</div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_vis_uiDarkTheme">
            <label for="lv_vis_uiDarkTheme">Тёмная тема</label>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_vis_fieldAlwaysLight">
            <label for="lv_vis_fieldAlwaysLight">Не затемнять поле</label>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_vis_fieldCellBorders">
            <label for="lv_vis_fieldCellBorders">Сетка</label>
            <input class="bh-live" type="color"  id="lv_vis_fieldCellBorders_color">
            <input class="bh-live" type="number" id="lv_vis_fieldCellBorders_opacity" step="0.05" min="0" max="1">
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_vis_showHighWounds3">
            <label for="lv_vis_showHighWounds3">Иконка при 3 ст. ран</label>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_vis_showHighWounds4">
            <label for="lv_vis_showHighWounds4">Иконка при 4 ст. ран</label>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_vis_showBeatedCats">
            <label for="lv_vis_showBeatedCats">Выделение выбитых</label><br>
            <select class="bh-live" id="lv_vis_showBeatedCats_variant">
              <option value="0">Батарейка (аним.)</option>
              <option value="1">Батарейка (стат.)</option>
              <option value="2">Стрелка</option>
            </select>
          </div>
        </div>

        <div class="bh-section">
          <div class="bh-section-title">Лог</div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_func_shortFightLog">
            <label for="lv_func_shortFightLog">Сжимать повторы</label>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_func_moveFightLog">
            <label for="lv_func_moveFightLog">Перетаскивать лог</label>
          </div>
        </div>

        <div class="bh-section">
          <div class="bh-section-title">Блок</div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_func_blockStatusOverlay">
            <label for="lv_func_blockStatusOverlay">Визуал</label>
            <select class="bh-live" id="lv_func_blockStatusOverlay_variant">
              <option value="0">Замочек</option>
              <option value="1">Затемнение</option>
              <option value="2">Рамка панели</option>
              <option value="3">Рамка поля</option>
            </select>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="color" id="lv_func_blockOverlay_color">
            <label for="lv_func_blockOverlay_color">Цвет рамки</label>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_aud_blockOnSound">
            <label for="lv_aud_blockOnSound">Звук ↓</label>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_aud_blockOffSound">
            <label for="lv_aud_blockOffSound">Звук ↑</label>
          </div>
        </div>

        <div class="bh-section">
          <div class="bh-section-title">Команды</div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_on_teamFights">
            <label for="lv_on_teamFights">Включить</label>
          </div>
          <div class="bh-row">
            <input class="bh-live" type="checkbox" id="lv_tf_resetOnRefresh">
            <label for="lv_tf_resetOnRefresh">Сброс при обновлении</label>
          </div>
          <div class="bh-row">
            <label>Авто:</label>
            <select class="bh-live" id="lv_tf_autoTeam">
              <option value="0">Ручной</option>
              <option value="1">Шахматы</option>
              <option value="2">Прямо</option>
              <option value="3">От стен</option>
            </select>
          </div>
          <div class="bh-row">
            <label>Мой ID:</label>
            <input class="bh-live" type="number" id="lv_var_playerId" min="0" style="width:70px">
          </div>
          <div class="bh-row">
            <label>Выс. списка:</label>
            <input class="bh-live" type="number" id="lv_tf_max_height" min="40" max="600" step="10" style="width:46px">px
          </div>

          <div class="bh-dim">Зелёные стрелки</div>
          <div class="bh-colors">
            <div class="bh-colors-label">К1</div>
            <div class="bh-colors-label">К2</div>
            <div class="bh-colors-label">К3</div>
            <div class="bh-colors-label">К4</div>
            <input class="bh-live" type="color" id="lv_tf_color_g_team1">
            <input class="bh-live" type="color" id="lv_tf_color_g_team2">
            <input class="bh-live" type="color" id="lv_tf_color_g_team3">
            <input class="bh-live" type="color" id="lv_tf_color_g_team4">
          </div>
          <div class="bh-dim">Красные стрелки</div>
          <div class="bh-colors">
            <div class="bh-colors-label">К1</div>
            <div class="bh-colors-label">К2</div>
            <div class="bh-colors-label">К3</div>
            <div class="bh-colors-label">К4</div>
            <input class="bh-live" type="color" id="lv_tf_color_r_team1">
            <input class="bh-live" type="color" id="lv_tf_color_r_team2">
            <input class="bh-live" type="color" id="lv_tf_color_r_team3">
            <input class="bh-live" type="color" id="lv_tf_color_r_team4">
          </div>
        </div>

      </div>
    `);

    $('#bh-cw3-settings .bh-live').each(function () {
      const key = this.id.replace(/^lv_/, '');
      if (!(key in glob)) return;
      if (this.type === 'checkbox') this.checked = !!glob[key];
      else $(this).val(glob[key]);
    });

    $(document).on('change', '#bh-cw3-settings .bh-live', function () {
      const key = this.id.replace(/^lv_/, '');
      const val = this.type === 'checkbox' ? this.checked : this.value;
      setSettings(key, val);
      applySettingLive(key, val);
    });

    function applyFamilyToggle() {
      if (glob.vis_replaceFamilyBlock) {
        $familyInner.hide();
        $('#bh-cw3-settings').show();
      } else {
        $familyInner.show();
        $('#bh-cw3-settings').hide();
      }
    }

    $('#relatives').on('click', function (e) {
      e.preventDefault();
      setSettings('vis_replaceFamilyBlock', true);
      applyFamilyToggle();
    });

    $('#bh-cw3-h2').on('click', function (e) {
      e.preventDefault();
      setSettings('vis_replaceFamilyBlock', false);
      applyFamilyToggle();
    });

    applyFamilyToggle();
  });
}

function applySettingLive(key, val) {
  switch (key) {
    case 'vis_uiDarkTheme':
    case 'vis_fieldCellBorders':
    case 'vis_fieldCellBorders_color':
    case 'vis_fieldCellBorders_opacity':
    case 'vis_fieldAlwaysLight':
    case 'vis_showBeatedCats':
    case 'vis_showBeatedCats_variant':
    case 'vis_showHighWounds3':
    case 'vis_showHighWounds4':
    case 'tf_color_g_team1': case 'tf_color_g_team2':
    case 'tf_color_g_team3': case 'tf_color_g_team4':
    case 'tf_color_r_team1': case 'tf_color_r_team2':
    case 'tf_color_r_team3': case 'tf_color_r_team4':
      rebuildCSS();
      break;

    case 'tf_max_height':
      $('#fteams-wrap').css('max-height', parseInt(val) + 'px');
      break;

    case 'func_blockStatusOverlay':
    case 'func_blockStatusOverlay_variant':
    case 'func_blockOverlay_color': {
      $('#bh-block-v0').remove();
      const panel = document.getElementById('fightPanel');
      const field = document.getElementById('tr_field');
      if (panel) { panel.style.opacity = '1'; panel.style.outline = ''; panel.style.boxShadow = ''; }
      if (field)   field.style.outline = '';
      break;
    }

    case 'func_moveFightLog':
      if (val) {
        if (!$('#fightPanelHandle').length) {
          $('#fightPanel').prepend(`<a id="fightPanelHandle"></a>`);
        }
        $('#fightPanel').draggable({ handle: '#fightPanelHandle' });
      } else {
        $('#fightPanel').draggable('destroy');
        $('#fightPanelHandle').remove();
      }
      rebuildCSS();
      break;
  }
}

function initTeamFightsDOM() { // Команды в боережиме
  $('#app').ready(function () {
    if ($('#fteams-wrap').length) return; // защита от дублей (!)

    let ids = {};

    $('#fightPanel').append(`<div id="fteams-wrap">
      <table id="fteams-table">
        <thead>
          <tr>
            <th class="tf-color">Имя</th>
            <th class="tf-color" colspan="4">Команда</th>
          </tr>
        </thead>
        <tbody id="fightColors"></tbody>
      </table>
      <button id="refresh-team">Обновить список</button>
    </div>`);

    function applyTeamColor(id) {
      const style = `#arrow${id} .arrow_green { background: var(--team${ids[id]}g); }\n`
                  + `#arrow${id} .arrow_red   { background: var(--team${ids[id]}r); }\n`;
      $('#cws_team_fights').append(style);
      $(`#arrow${id} .arrow_green`).css('background', `var(--team${ids[id]}g)`);
      $(`#arrow${id} .arrow_red`).css('background',   `var(--team${ids[id]}r)`);
    }

    function getCatsOnField() {
      const $gameRows = $('#cages tbody tr').filter((_, tr) => $(tr).find('td.cage').length > 0);
      return $('.arrow').map(function () {
        const id    = $(this).attr('id').match(/\d+/)[0];
        const $cage = $(this).closest('td.cage');
        const $row  = $cage.closest('tr');
        return {
          id,
          name: $(".cat_tooltip a[href='/cat" + id + "']").html(),
          col:  $row.find('td.cage').index($cage) + 1,
          row:  $gameRows.index($row) + 1,
        };
      }).get();
    }

    function pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function autoDetectTeams(cats, mode) {
      const playerId = String(parseInt(glob.var_playerId) || 0);
      const myCat    = cats.find(c => c.id === playerId);
      const result   = {};

      // Нормализация столбца: кот мог шагнуть вперёд от центра.
      // col 4 → считается как 5, col 7 → считается как 6.
      // Только col 5 и 6 (и один шаг вперёд) участвуют в шахматах/прямо.
      function effectiveCol(col) {
        if (col <= 4) return 5;
        if (col >= 7) return 6;
        return col; // уже 5 или 6
      }

      // Режим 3 — от стен: только столбцы 1–2 и 9–10, ряды 1–5
      if (mode === 3) {
        if (!myCat || myCat.row === 6) return result;
        const mySide = myCat.col <= 2 ? 'left' : myCat.col >= 9 ? 'right' : null;
        if (!mySide) return result; // меня нет у стены — не можем определить сторону

        const enemyTeam = pickRandom([2, 3, 4]);
        cats
          .filter(c => c.row >= 1 && c.row <= 5 && c.id !== playerId)
          .filter(c => c.col <= 2 || c.col >= 9)
          .forEach(c => {
            const side = c.col <= 2 ? 'left' : 'right';
            result[c.id] = side === mySide ? 1 : enemyTeam;
          });
        return result;
      }

      // Режимы 1 (шахматы) и 2 (прямо): без меня определить стороны невозможно
      if (!myCat || myCat.row === 6) return result;

      const myEff = effectiveCol(myCat.col);
      const myRow = myCat.row;
      const enemyTeam = pickRandom([2, 3, 4]);

      cats
        .filter(c => c.row >= 1 && c.row <= 5 && c.id !== playerId)
        .filter(c => c.col >= 4 && c.col <= 7) // центр + один шаг вперёд
        .forEach(c => {
          const cEff = effectiveCol(c.col);
          let isTeammate;
          if (mode === 1) {
            isTeammate = (cEff + c.row) % 2 === (myEff + myRow) % 2;
          } else {
            isTeammate = cEff === myEff;
          }
          result[c.id] = isTeammate ? 1 : enemyTeam;
        });

      return result;
    }

    $('#refresh-team').on('click', function () {
      const prevIds  = glob.tf_resetOnRefresh ? {} : Object.assign({}, ids);
      const autoMode = parseInt(glob.tf_autoTeam) || 0;
      $('#fightColors').html('');
      $('#cws_team_fights').html('');
      ids = {};

      const cats       = getCatsOnField();
      const autoAssign = autoMode > 0 ? autoDetectTeams(cats, autoMode) : {};

      cats.filter(c => c.row !== 6).forEach(function (cat) {
        const { id, name } = cat;

        ids[id] = autoMode > 0 && autoAssign[id] !== undefined ? autoAssign[id]
                : !glob.tf_resetOnRefresh && prevIds[id]       ? prevIds[id]
                : 1;

        const ch = t => ids[id] == t ? 'checked' : '';
        $('#fightColors').append(`<tr id="team_member_${id}">
          <td class="tf-color">${name}</td>
          <td class="lbl"><input type="radio" class="cws-team-chk" name="chk${id}" ${ch(1)} value="1" id="chk${id}-team-1"><label class="cws-team team-1" for="chk${id}-team-1">*</label></td>
          <td class="lbl"><input type="radio" class="cws-team-chk" name="chk${id}" ${ch(2)} value="2" id="chk${id}-team-2"><label class="cws-team team-2" for="chk${id}-team-2">*</label></td>
          <td class="lbl"><input type="radio" class="cws-team-chk" name="chk${id}" ${ch(3)} value="3" id="chk${id}-team-3"><label class="cws-team team-3" for="chk${id}-team-3">*</label></td>
          <td class="lbl"><input type="radio" class="cws-team-chk" name="chk${id}" ${ch(4)} value="4" id="chk${id}-team-4"><label class="cws-team team-4" for="chk${id}-team-4">*</label></td>
        </tr>`);

        applyTeamColor(id);
      });
    });

    $(document).on('change', '.cws-team-chk', function () {
      const id = $(this).attr('id').match(/\d+/)[0];
      ids[id] = parseInt($(this).val());
      applyTeamColor(id);
    });

    $('head').append(`<style id="cws_team_fights"></style>`);
  });
}

function teamFightsCSS() {
  return [`
:root {
  --team1g: ${glob.tf_color_g_team1}; --team1r: ${glob.tf_color_r_team1};
  --team2g: ${glob.tf_color_g_team2}; --team2r: ${glob.tf_color_r_team2};
  --team3g: ${glob.tf_color_g_team3}; --team3r: ${glob.tf_color_r_team3};
  --team4g: ${glob.tf_color_g_team4}; --team4r: ${glob.tf_color_r_team4};
}
.arrow_green { background: var(--team1g); }
.arrow_red   { background: var(--team1r); }
label.team-1 { background: var(--team1g); color: var(--team1g); }
label.team-2 { background: var(--team2g); color: var(--team2g); }
label.team-3 { background: var(--team3g); color: var(--team3g); }
label.team-4 { background: var(--team4g); color: var(--team4g); }
#fteams-table { width: 100%; background-color: #ccccccd7; }
#fteams-table input[type="radio"] { display: none; }
#fteams-table td, #fteams-table th { border: 1px solid black; text-align: center; vertical-align: middle; }
.lbl { width: 25px; }
.cws-team {
  text-align: center; display: block;
  width: 20px; height: 15px; margin: 2px;
  border: 2px solid transparent;
}
input:checked + .cws-team { border: 2px solid black; font-weight: bold; color: black; }
#fightPanel  { height: max-content; }
#fteams-wrap { margin: 5px 0; max-height: ${glob.tf_max_height}px; overflow-y: scroll; }
#refresh-team { width: 100%; }
.tf-color { color: black; }`];
}

function initShortFightLog() { // Короткий лог
  $(document).ready(function () {
    let prevLog   = '';
    let prevClass = '';
    let hitCount  = 1;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type !== 'childList') return;
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.tagName !== 'SPAN') return;
          if ($(node).hasClass('cws-hit-count')) return;

          const thisLog   = $(node).html();
          const thisClass = $(node).attr('class');

          if (thisLog === prevLog && thisClass === prevClass) {
            $(node).prev('span:not(.cws-hit-count)').remove();
            $(node).remove();
            $('#fightLog > br:first-child').remove();
            hitCount++;
            const $counter = $('.cws-hit-count').first();
            $counter.attr('count', hitCount);
            $counter.html(' (х' + hitCount + ')');
          } else {
            $('<span class="cws-hit-count ' + thisClass + '" count=1></span>').insertAfter($(node));
            hitCount = 1;
          }

          prevLog   = thisLog;
          prevClass = thisClass;
        });
      });
    });

    observer.observe($('#fightLog')[0], { childList: true });
  });
}

function initMoveFightLogDOM() { // Перетаскиваемый лог
  $('#app').ready(function () {
    if ($('#fightPanelHandle').length) return;
    $('#fightPanel').prepend(`<a id="fightPanelHandle"></a>`);
    $('#fightPanel').draggable({ handle: '#fightPanelHandle' });
  });
}

function moveFightLogCSS() {
  return [`
#fightPanelHandle {
  display: inline-block;
  height: 16px; width: 16px;
  background: url(https://abstract-class-shed.github.io/cwshed/untargeted.png) center no-repeat;
  background-color: #ccc;
  margin-right: 4px; border-radius: 5px; padding: 1px;
  position: relative; top: 5px; left: 3px;
}
#fightPanelHandle:active {
  background: url(https://abstract-class-shed.github.io/cwshed/targeted.png) center no-repeat;
  background-color: #ccc;
}`];
}

function initBlockObserver() { // Обсервер для блока
  $('#app').ready(function () {
    const blockImg = document.getElementById('block');
    if (!blockImg) return;

    const blockObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const src      = blockImg.getAttribute('src');
          const isLocked = src.includes('lock.png') && !src.includes('unlock');
          onBlockStateChange(isLocked);
        }
      });
    });

    blockObserver.observe(blockImg, { attributes: true });
  });
}

function onBlockStateChange(isLocked) {
  if (glob.func_blockStatusOverlay)        blockOverlaySignal(isLocked);
  if (isLocked  && glob.aud_blockOnSound)  playBlockSound(true);
  if (!isLocked && glob.aud_blockOffSound) playBlockSound(false);
}

function blockOverlaySignal(isLocked) {
  const v     = parseInt(glob.func_blockStatusOverlay_variant);
  const color = glob.func_blockOverlay_color || '#e05555';

  switch (v) {
    case 0: {
      let styleEl = document.getElementById('bh-block-v0');
      if (!styleEl) {
        styleEl    = document.createElement('style');
        styleEl.id = 'bh-block-v0';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = isLocked
        ? `div.no-select img[src*='lock.png']:not([src*='unlock']) { filter: invert(1); }`
        : '';
      break;
    }
    case 1: {
      const panel = document.getElementById('fightPanel');
      if (!panel) return;
      panel.style.opacity = isLocked ? '0.5' : '1';
      break;
    }
    case 2: {
      const panel = document.getElementById('fightPanel');
      if (!panel) return;
      panel.style.outline   = isLocked ? `3px solid ${color}` : '';
      panel.style.boxShadow = isLocked ? `0 0 12px 4px ${color}88` : '';
      break;
    }
    case 3: {
      const field = document.getElementById('tr_field');
      if (!field) return;
      field.style.outline = isLocked ? `3px solid ${color}` : '';
      break;
    }
  }
}

function playBlockSound(isLocked) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    if (isLocked) {
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.04);
    } else {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.04);
    }
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
    osc.onended = () => ctx.close();
  } catch (e) {}
}

function cssDarkTheme() {
  return `
html {
  --BBO:  rgb(20, 20, 20);
  --BKG:  rgb(34, 34, 34);
  --BKCH: rgb(41, 41, 41);
  --BRDR: rgb(54, 55, 56);
  --LBKG: #000;
  --BTOS: #000;
  --TXT:  rgb(205, 207, 210);
  --TXT2: rgb(195, 197, 200);
  --TXT3: rgb(113, 170, 235);
  --TXT4: #0d0d0d;
}
#parameter          { background: var(--BKG)  !important; color: var(--TXT) !important; }
#tr_tos             { background: var(--BTOS) !important; }
#history.infos      { background: var(--BKG)  !important; color: var(--TXT) !important; }
#family             { background: var(--BKG)  !important; color: var(--TXT) !important; }
#tr_field           { background: var(--LBKG) !important; border: var(--BRDR) 3px solid !important; }
#app>br:first-of-type { display: none; }
.small              { color: var(--TXT) !important; }
span.other_cats_list        { color: var(--TXT); }
span.other_cats_list:after  { content: " |"; }
#newchat, #newls    { color: var(--TXT4) !important; font-weight: bolder !important; }
#tr_chat            { background: var(--BKCH); color: var(--TXT) !important; }
#tr_chat>br         { display: none; }
#chat_form          { margin: 5px; padding: 0; }
#text               { background-color: var(--BBO); border: var(--BRDR) 2px solid !important; color: var(--TXT) !important; }
#msg_send           { margin: 0; background-color: var(--BKG); border: var(--BRDR) 2px solid !important; color: var(--TXT) !important; }
#volume             { margin: 2px; margin-top: 4px; }
.ui-state-default,
.ui-widget-content .ui-state-default,
.ui-widget-header  .ui-state-default { background: #555 !important; border: #252525 1px solid; }
#volume             { background-color: var(--BBO) !important; border: var(--BRDR) solid 2px !important; color: var(--TXT) !important; }
.ui-widget-content  { background-color: var(--BBO) !important; border: var(--BRDR) solid 2px !important; color: var(--TXT) !important; }
.myname             { background: #ef9a00; color: #090909; }
#tr_actions         { background: var(--BKG) !important; color: var(--TXT) !important; }
#mit                { background-color: var(--BBO); border: var(--BRDR) solid 2px; color: var(--TXT); }
#mitok              { background-color: var(--BBO); border: var(--BRDR) solid 2px; color: var(--TXT); }
#tr_mouth           { background: var(--BKG) !important; color: var(--TXT) !important; }
body                { background: var(--BBO); }
div                 { border: 0 !important; }
td#history.infos>h2,
#parameters.toggle  { display: none; }
a         { color: var(--TXT);  }
a:visited { color: var(--TXT);  }
a:active  { color: var(--TXT2); }
a:hover   { color: var(--TXT2); }
hr { border: 0.5px solid var(--BRDR) !important; }
#app>p:not([id])    { color: var(--TXT) !important; }
div#tos             { position: relative; top: 2px; }
::-webkit-scrollbar        { width: 18px; }
::-webkit-scrollbar-track  { background: transparent !important; }
::-webkit-scrollbar-thumb  { background: transparent !important; }
::-webkit-scrollbar-corner { background: transparent !important; }
div#fightPanel {
  ::-webkit-scrollbar        { width: 5px !important; background: transparent !important; }
  ::-webkit-scrollbar-track  { background: transparent !important; }
  ::-webkit-scrollbar-thumb  { background: #787878 !important; border-radius: 4px !important; }
  ::-webkit-scrollbar-corner { background: transparent !important; }
}`;
}

function cssFieldCellBorders() {
  return `.cage { box-shadow: inset 0px ${glob.vis_fieldCellBorders_opacity}px 0px ${glob.vis_fieldCellBorders_opacity}px ${glob.vis_fieldCellBorders_color}; }`;
}

function cssFieldAlwaysLight() {
  return `#cages_div { opacity: 1 !important; }`;
}

function cssBeatedCats() {
  const base = `table#cages tbody tr td.cage div.cage_items:has(span.catWithArrow div div table tbody tr td.arrow_green[style*="width: 0px"])`;

  const svgBatteryStatic = `data:image/svg+xml,` + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 701 800">` +
    `<path fill="#ED333B" d="M201,50v50h-50c0,0-35.4-0.8-72.5,17.8C41.6,136.3,1,183.4,1,250v400` +
    `c0,0-0.8,35.4,17.8,72.5C37.3,759.4,84.4,800,151,800h100V700H151c-27.7,0-50-22.3-50-50V250` +
    `c0-27.7,22.3-50,50-50h300c27.7,0,50,22.3,50,50v100h100V250c0-66.6-40.6-113.7-77.5-132.2` +
    `C486.4,99.2,451,100,451,100h-50V50c0-50-50-50-50-50H251C251,0,201,0,201,50z` +
    ` M376,400c-41.6,0-75,33.4-75,75v250c0,41.6,33.4,75,75,75h250c41.6,0,75-33.4,75-75V475` +
    `c0-41.6-33.4-75-75-75H376z` +
    ` M451,450h100v125c0,0,0,25-25,25h-50c-25,0-25-25-25-25V450z` +
    ` M476,650h50c13.9,0,25,11.1,25,25v50c0,13.9-11.1,25-25,25h-50` +
    `c-13.9,0-25-11.1-25-25v-50C451,661.1,462.1,650,476,650z"/>` +
    `</svg>`
  );

  const svgBatteryAnim = `data:image/svg+xml,` + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 701 800">` +
    `<g>` +
    `<animate attributeName="visibility" values="visible;hidden;visible" dur="1s" repeatCount="indefinite" begin="0s"/>` +
    `<path fill="#ED333B" d="M201,50v50h-50c0,0-35.4-0.8-72.5,17.8C41.6,136.3,1,183.4,1,250v400c0,0-0.8,35.4,17.8,72.5C37.3,759.4,84.4,800,151,800h100V700H151c-27.7,0-50-22.3-50-50V250c0-27.7,22.3-50,50-50h300c27.7,0,50,22.3,50,50v100h100V250c0-66.6-40.6-113.7-77.5-132.2C486.4,99.2,451,100,451,100h-50V50c0-50-50-50-50-50H251C251,0,201,0,201,50z M376,400c-41.6,0-75,33.4-75,75v250c0,41.6,33.4,75,75,75h250c41.6,0,75-33.4,75-75V475c0-41.6-33.4-75-75-75H376z M451,450h100v125c0,0,0,25-25,25h-50c-25,0-25-25-25-25V450z M476,650h50c13.9,0,25,11.1,25,25v50c0,13.9-11.1,25-25,25h-50c-13.9,0-25-11.1-25-25v-50C451,661.1,462.1,650,476,650z"/>` +
    `</g>` +
    `<g>` +
    `<animate attributeName="visibility" values="hidden;visible;hidden" dur="1s" repeatCount="indefinite" begin="0s"/>` +
    `<path fill="#ED333B" d="M201,50v50h-50c0,0-35.4-0.8-72.5,17.8C41.6,136.3,1,183.4,1,250v400c0,0-0.8,35.4,17.8,72.5C37.3,759.4,84.4,800,151,800h100V700H151c-27.7,0-50-22.3-50-50V250c0-27.7,22.3-50,50-50h300c27.7,0,50,22.3,50,50v100h100V250c0-66.6-40.6-113.7-77.5-132.2C486.4,99.2,451,100,451,100h-50V50c0-50-50-50-50-50H251C251,0,201,0,201,50z M376,400c-41.6,0-75,33.4-75,75v250c0,41.6,33.4,75,75,75h250c41.6,0,75-33.4,75-75V475c0-41.6-33.4-75-75-75H376z"/>` +
    `</g>` +
    `</svg>`
  );

  const overlay = (url) => `
    ${base} { position: relative; }
    ${base}::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url("${url}");
      background-size: 85%;
      background-position: center;
      background-repeat: no-repeat;
      opacity: 0.95;
      z-index: 10;
      pointer-events: none;
    }`;

  switch (parseInt(glob.vis_showBeatedCats_variant)) {
    case 0:  return overlay(svgBatteryAnim);
    case 1:  return overlay(svgBatteryStatic);
    case 2:  return `td.arrow_green[style*="width: 0px"] ~ td { background: #fff !important; transform-origin: left; transform: rotate(180deg); width: 50% !important; }`;
    default: return '';
  }
}

function cssHighWounds() {
  const svgWound3 = `data:image/svg+xml,` + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 698 700">` +
    `<path fill="#ED333B" stroke="#ED333B" d="M588.7,324.7c0.9,9.8,12.9,14.1,19.6,6.8l30.6-33.2c76-76.3,74.7-173.1,5.7-242.7` +
    `c-69-70-166.4-70.3-243.1,5.7l-34.1,31.6c-7.1,6.6-3.1,18.5,6.5,19.5c20,2.2,40.7,12.4,62.1,34l122.2,121.9` +
    `C578.4,288.5,587.1,306.7,588.7,324.7z` +
    ` M298.6,518.3c33.5,33.5,65.6,34.5,100.1,0L520.6,396c34.8-34.5,33.8-66.3,0.3-99.8L403.7,178.7` +
    `c-33.5-33.5-65.3-34.2-100.1,0.7L181.7,301.3c-34.5,34.5-33.5,66.6,0,100.1L298.6,518.3z` +
    ` M329.1,300.6c-12.7-12.7-12.7-32.5-0.3-44.9c12.7-12.7,32.1-12.7,44.9,0c12.1,12.4,12.7,31.8-0.7,44.9` +
    `C361.2,312.3,341.1,312.3,329.1,300.6z` +
    ` M258.1,371.3c-12.7-12.7-12.7-32.1,0-44.9c12.7-12.7,32.1-12.4,44.9,0.3c12.1,12.1,12.4,31.8,0,43.9` +
    `C289.9,384,270.5,383.3,258.1,371.3z` +
    ` M443.9,371.3c-12.1,12.1-31.8,12.1-44.5-0.7c-12.1-11.7-12.1-31.8,0-43.9c13.1-13.1,32.5-12.7,44.5-0.3` +
    `C456.6,339.1,456.6,358.5,443.9,371.3z` +
    ` M57.5,642.1c69,70,167.1,70.6,243.1-5.7l33.7-31.7c7.1-6.7,2.9-18.5-6.8-19.4c-19.3-2-39.3-11.8-60.4-32.9` +
    `L144.9,430.2c-20.6-20.6-29.3-39-30.8-57.1c-0.8-9.8-12.8-14-19.5-6.8l-31,33.2C-12.8,475.4-11.4,572.5,57.5,642.1z` +
    ` M328.7,441.6c-12.4-12.1-12.7-31.5,0.3-44.5c12.4-12.4,32.1-12.1,43.9,0c12.7,12.4,13.4,32.5,0.7,44.5` +
    `C360.5,454.3,341.5,454.3,328.7,441.6z"/>` +
    `</svg>`
  );

  const svgWound4 = `data:image/svg+xml,` + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 698 700">` +
    `<path fill="#ED333B" stroke="#ED333B" d="M113.4,325.7c-0.9,9.8-12.9,14.1-19.6,6.8l-30.6-33.2` +
    `c-76-76.3-74.7-173.1-5.7-242.7c69-70,166.4-70.3,243.1,5.7l34.1,31.6c7.1,6.6,3.1,18.5-6.5,19.5` +
    `c-20,2.2-40.7,12.4-62.1,34L144,269.1C123.6,289.5,114.9,307.7,113.4,325.7z` +
    ` M557.1,431.2c20.6-20.6,29.3-39,30.8-57.1c0.8-9.8,12.8-14,19.5-6.8l31,33.2` +
    `c76.3,76,75,173.1,6,242.7c-69,70-167.1,70.6-243.1-5.7l-33.7-31.7c-7.1-6.7-2.9-18.5,6.8-19.4` +
    `c19.3-2,39.3-11.8,60.4-32.9"/>` +
    `<path fill="#ED333B" stroke="#ED333B" d="M588.7,324.7c0.9,9.8,12.9,14.1,19.6,6.8l30.6-33.2` +
    `c76-76.3,74.7-173.1,5.7-242.7c-69-70-166.4-70.3-243.1,5.7l-34.1,31.6c-7.1,6.6-3.1,18.5,6.5,19.5` +
    `c20,2.2,40.7,12.4,62.1,34l122.2,121.9C578.4,288.5,587.1,306.7,588.7,324.7z` +
    ` M298.6,518.3c33.5,33.5,65.6,34.5,100.1,0L520.6,396c34.8-34.5,33.8-66.3,0.3-99.8L403.7,178.7` +
    `c-33.5-33.5-65.3-34.2-100.1,0.7L181.7,301.3c-34.5,34.5-33.5,66.6,0,100.1L298.6,518.3z` +
    ` M329.1,300.6c-12.7-12.7-12.7-32.5-0.3-44.9c12.7-12.7,32.1-12.7,44.9,0c12.1,12.4,12.7,31.8-0.7,44.9` +
    `C361.2,312.3,341.1,312.3,329.1,300.6z` +
    ` M258.1,371.3c-12.7-12.7-12.7-32.1,0-44.9c12.7-12.7,32.1-12.4,44.9,0.3c12.1,12.1,12.4,31.8,0,43.9` +
    `C289.9,384,270.5,383.3,258.1,371.3z` +
    ` M443.9,371.3c-12.1,12.1-31.8,12.1-44.5-0.7c-12.1-11.7-12.1-31.8,0-43.9c13.1-13.1,32.5-12.7,44.5-0.3` +
    `C456.6,339.1,456.6,358.5,443.9,371.3z` +
    ` M57.5,642.1c69,70,167.1,70.6,243.1-5.7l33.7-31.7c7.1-6.7,2.9-18.5-6.8-19.4c-19.3-2-39.3-11.8-60.4-32.9` +
    `L144.9,430.2c-20.6-20.6-29.3-39-30.8-57.1c-0.8-9.8-12.8-14-19.5-6.8l-31,33.2C-12.8,475.4-11.4,572.5,57.5,642.1z` +
    ` M328.7,441.6c-12.4-12.1-12.7-31.5,0.3-44.5c12.4-12.4,32.1-12.1,43.9,0c12.7,12.4,13.4,32.5,0.7,44.5` +
    `C360.5,454.3,341.5,454.3,328.7,441.6z"/>` +
    `</svg>`
  );

  const overlayStyle = (url) => `
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("${url}");
    background-size: 95%;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.95;
    z-index: 10;
    pointer-events: none;
  `;

  const sel3 = `[style*="wound/3.png"]`;
  const sel4 = `[style*="wound/4.png"]`;

  let out = '';
  if (glob.vis_showHighWounds3) {
    out += `${sel3} { position: relative; }\n`;
    out += `${sel3}::after { ${overlayStyle(svgWound3)} }\n`;
  }
  if (glob.vis_showHighWounds4) {
    out += `${sel4} { position: relative; }\n`;
    out += `${sel4}::after { ${overlayStyle(svgWound4)} }\n`;
  }
  return out;
}

function sett() {
  function chk(id, label) {
    return `<div><input class="bh-set" id="${id}" type="checkbox"><label for="${id}"> ${label}</label></div>`;
  }
  function sel(id, label, options) {
    const opts = options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    return `<div><select class="bh-set" id="${id}">${opts}</select><label for="${id}"> ${label}</label></div>`;
  }
  function color(id, label) {
    return `<div><input class="bh-set" id="${id}" type="color" style="width:40px;height:24px;padding:1px;"> <label for="${id}">${label}</label></div>`;
  }
  function num(id, label, attrs = '') {
    return `<div><input class="bh-set" id="${id}" type="number" style="width:80px;" ${attrs}> <label for="${id}">${label}</label></div>`;
  }
  function hr()    { return `<hr>`; }
  function h(text) { return `<h3 style="margin:8px 0 4px 15px">${text}</h3>`; }

  const tableColor = $('body div#site_table div#branch form[method=post]:first-of-type').css('color');

  const html = `<br><hr>
<div id="bh-settings">
<h2>Настройки Облегчалочки</h2>

${h('Команды в боережиме')}
${chk('on_teamFights', 'Включить')}
${chk('tf_resetOnRefresh', 'Сбрасывать выбор команды при обновлении списка')}
${num('var_playerId', 'Мой айди (catwar.su/catXXXXX → число)', 'min="0"')}
${sel('tf_autoTeam', 'Авто-определение команд', [
  [0, 'Ручной (как раньше)'],
  [1, 'От центра — шахматы'],
  [2, 'От центра — прямо'],
  [3, 'От стен'],
])}
<table id="colorArrowsTable">
  <tr><th colspan="4">Зелёный</th></tr>
  <tr>
    <td><input class="bh-set" id="tf_color_g_team1" type="color"></td>
    <td><input class="bh-set" id="tf_color_g_team2" type="color"></td>
    <td><input class="bh-set" id="tf_color_g_team3" type="color"></td>
    <td><input class="bh-set" id="tf_color_g_team4" type="color"></td>
  </tr>
  <tr><th colspan="4">Красный</th></tr>
  <tr>
    <td><input class="bh-set" id="tf_color_r_team1" type="color"></td>
    <td><input class="bh-set" id="tf_color_r_team2" type="color"></td>
    <td><input class="bh-set" id="tf_color_r_team3" type="color"></td>
    <td><input class="bh-set" id="tf_color_r_team4" type="color"></td>
  </tr>
</table>

${hr()}${h('Лог боережима')}
${chk('func_shortFightLog', 'Сокращать повторные удары')}
${chk('func_moveFightLog', 'Перетаскиваемый лог')}

${hr()}${h('Игровая')}
${chk('vis_replaceFamilyBlock', 'Заменить блок семьи на быстрые настройки Облегчалочки (поменять семью на боёвку)')}
${chk('vis_uiDarkTheme', 'Тёмная тема')}
${chk('vis_fieldAlwaysLight', 'Не затемнять поле игровой')}
${chk('vis_fieldCellBorders', 'Сетка ячеек')}
${num('vis_fieldCellBorders_opacity', 'Прозрачность сетки', 'step="0.1" min="0" max="1"')}
${color('vis_fieldCellBorders_color', 'Цвет сетки')}
${chk('vis_showHighWounds3', '3 стадия ран — иконка')}
${chk('vis_showHighWounds4', '4 стадия ран — иконка')}
${chk('vis_showBeatedCats', 'Выделение выбитых котов')}
${sel('vis_showBeatedCats_variant', 'Вариант выделения', [
  [0, 'Батарейка (аним.)'],
  [1, 'Батарейка (стат.)'],
  [2, 'Стрелочка'],
])}

${hr()}${h('Сигнал при зажатии/отжатии блока')}
${chk('func_blockStatusOverlay', 'Визуальный сигнал')}
${sel('func_blockStatusOverlay_variant', 'Вариант отображения', [
  [0, 'Белый замочек в панели'],
  [1, 'Затемнение панели'],
  [2, 'Рамка на панели'],
  [3, 'Рамка на поле'],
])}
${color('func_blockOverlay_color', 'Цвет рамки (вар. 3 и 4)')}
${chk('aud_blockOnSound', 'Звук при зажатии блока')}
${chk('aud_blockOffSound', 'Звук при отжатии блока')}

</div>
<style>
  #bh-settings { margin-left: 10px; }
  #bh-settings div { margin: 3px 0 3px 15px; }
  #bh-settings h2 { margin-left: 0; }
  table#colorArrowsTable { margin-left: 15px; border-collapse: collapse; }
  table#colorArrowsTable td, table#colorArrowsTable th { border: ${tableColor} 1px solid; width: 55px; padding: 3px; text-align: center; }
  table#colorArrowsTable input[type=color] { width: 44px; height: 22px; padding: 1px; margin: 0; }
</style>`;

  if ($('#branch').length) {
    $('#branch').append(html);
  } else {
    $('a[href="del"]').after(html);
  }

  $(document).on('change', '.bh-set', function () {
    setSettings(this.id, this.type === 'checkbox' ? this.checked : this.value);
  });

  $(document).ready(function () {
    $('.bh-set').each(function () {
      if (!(this.id in glob)) return;
      if (this.type === 'checkbox') this.checked = !!glob[this.id];
      else $(this).val(glob[this.id]);
    });
  });
}
