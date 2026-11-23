/* 米家電子鍋 mini 專用卡片（含舒肥外部控溫）。無外部相依，純 Web Component。
 * 實體寫死為這台電鍋；詳見 cooker/README.md */
const E = {
  cooker: 'sensor.chunmi_tw1_c3d7_cooker', temp: 'sensor.chunmi_tw1_c3d7_temp',
  left: 'sensor.chunmi_tw1_c3d7_t_left', cook: 'sensor.chunmi_tw1_c3d7_t_cook',
  akw: 'switch.chunmi_tw1_c3d7_auto_keep_warm', sel: 'select.chunmi_tw1_c3d7_start_cook',
  cancel: 'button.chunmi_tw1_c3d7_cancel_cooking',
  target: 'input_number.sousvide_target', mins: 'input_number.sousvide_minutes',
  menu: 'sensor.chunmi_tw1_c3d7_menu', slot: 'input_text.cooker_slot5', pending: 'input_boolean.cooker_slot5_pending',
  quiet: 'input_boolean.sousvide_quiet', chain: 'input_boolean.sousvide_then_porridge', run: 'input_boolean.sousvide_run', end: 'input_datetime.sousvide_end',
};
const MODES = [ // [start-cook 參數, 名稱, 圖示]；7–15 電鍋會拒絕
  [1, '精煮飯', 'mdi:creation'], [2, '快煮飯', 'mdi:lightning-bolt'],
  [3, '煮粥', 'mdi:bowl-mix'], [4, '保溫', 'mdi:water'],
  [5, '自選', 'mdi:star-circle-outline'], [6, '再加熱', 'mdi:rice'],
];
const RECIPES = { '06': '優格', '07': '嬰兒粥', '08': '泡麵', '09': '蛋糕', '0a': '煲湯', '0b': '再加熱', '0c': '關東煮', '0d': '熱米飯', '0e': '香甜煮', '0f': '極速煮' };
// 舒肥食譜：[名稱, 溫度°C, 分鐘, 結束後接原廠煮粥?]（一般經驗值，可再用下方微調）
const SV_RECIPES = [['嬰兒粥（吸水＋煮粥）', 55, 30, true], ['優格', 42, 480], ['低溫優格', 38, 480], ['溫泉蛋', 65, 60], ['鮭魚', 50, 40], ['牛排', 55, 90], ['雞胸', 62, 90], ['豬里肌', 62, 120], ['軟嫩雞腿', 68, 120]];
// App 食譜（HA 無法啟動，只列出原廠時間）：[名稱, 分鐘]
const APP_ONLY = [['優格', 360], ['嬰兒粥', 180], ['泡麵', 20], ['蛋糕', 60], ['煲湯', 120], ['關東煮', 90], ['熱米飯', 30], ['香甜煮', 70], ['極速煮', 30]];
const TEMP_PRESETS = [50, 55, 60, 65, 70, 75];
const TIME_PRESETS = [[30, '30 分'], [60, '1 時'], [120, '2 時'], [240, '4 時'], [480, '8 時'], [720, '12 時']];
const STATE_TEXT = { idle: '待機', busy: '烹飪中', 'keep warm': '保溫中', delay: '預約中' };

const css = `
:host { display:block; }
ha-card { padding:16px; --acc: var(--primary-color); overflow:hidden; }
.mut { color: var(--secondary-text-color); }
.top { display:flex; align-items:center; gap:10px; }
.top .t { font-size:18px; font-weight:600; flex:1; }
.chip { padding:4px 12px; border-radius:999px; font-size:13px; font-weight:600;
  background: color-mix(in srgb, var(--acc) 18%, transparent); color: var(--acc); }
.ring { position:relative; width:230px; max-width:72%; margin:6px auto 2px; aspect-ratio:1; }
.ring svg { width:100%; height:100%; transform: rotate(135deg); }
.ring .c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
.ring .big { font-size:48px; font-weight:700; line-height:1; color: var(--primary-text-color); }
.ring .big small { font-size:20px; font-weight:500; margin-left:2px; }
.ring .sub { margin-top:8px; font-size:13px; color: var(--secondary-text-color); padding:0 18px; }
.bar { height:6px; border-radius:3px; background: color-mix(in srgb, var(--primary-text-color) 10%, transparent); overflow:hidden; margin:4px 4px 12px; }
.bar i { display:block; height:100%; background: var(--acc); border-radius:3px; }
.seg { display:flex; padding:4px; border-radius:12px; gap:4px; margin:6px 0 14px;
  background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
.seg button { flex:1; border:0; border-radius:9px; padding:9px 0; font-size:15px; font-weight:600; cursor:pointer;
  background:transparent; color: var(--secondary-text-color); }
.seg button.on { background: var(--card-background-color, #fff); color: var(--primary-text-color); box-shadow: 0 1px 4px rgba(0,0,0,.18); }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.mode { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 6px; border-radius:14px; border:0; cursor:pointer;
  font-size:15px; font-weight:600; color: var(--primary-text-color);
  background: color-mix(in srgb, var(--primary-text-color) 7%, transparent); }
.mode ha-icon { --mdc-icon-size:28px; color: var(--primary-color); }
.mode.ask { background: var(--primary-color); color:#fff; } .mode.ask ha-icon { color:#fff; }
.row { display:flex; align-items:center; gap:10px; margin:12px 0 6px; }
.row .l { font-size:14px; color: var(--secondary-text-color); flex:1; }
.row .v { font-size:22px; font-weight:700; color: var(--primary-text-color); min-width:96px; text-align:center; }
.step { width:42px; height:42px; border-radius:50%; border:0; cursor:pointer; font-size:22px; font-weight:600;
  background: color-mix(in srgb, var(--primary-text-color) 9%, transparent); color: var(--primary-text-color); }
.step:disabled { opacity:.35; cursor:default; }
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chips button { border:0; border-radius:999px; padding:6px 12px; font-size:13px; cursor:pointer; color: var(--primary-text-color);
  background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
.chips button.on { background: var(--acc); color:#fff; }
.chips button:disabled { opacity:.35; cursor:default; }
.tog { display:flex; align-items:center; justify-content:space-between; padding:12px 2px 4px; font-size:15px; color: var(--primary-text-color); }
.tog small { display:block; color: var(--secondary-text-color); font-size:12px; margin-top:2px; }
.sw { position:relative; width:46px; height:26px; border-radius:13px; border:0; cursor:pointer; flex:none;
  background: color-mix(in srgb, var(--primary-text-color) 22%, transparent); }
.sw::after { content:''; position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; transition:left .15s; }
.sw.on { background: var(--acc); } .sw.on::after { left:23px; }
.go { width:100%; margin-top:14px; padding:15px; border:0; border-radius:14px; font-size:17px; font-weight:700; cursor:pointer; color:#fff; background: var(--acc); }
.go.stop { background: var(--error-color, #db4437); }
.go.ask { background: var(--warning-color, #f4a100); }
.go:disabled { opacity:.45; cursor:default; }
.note { text-align:center; font-size:12px; margin-top:8px; color: var(--secondary-text-color); }
`;

class CookerCard extends HTMLElement {
  setConfig() { this._tab = null; this._ask = null; this._sig = ''; }
  getCardSize() { return 9; }
  connectedCallback() { if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); } }
  set hass(h) {
    this._h = h;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const s = (e) => (h.states[e] ? h.states[e].state : 'na');
    const sig = Object.values(E).map(s).join('|') + '|' + this._tab + '|' + this._ask + '|' + Math.floor(Date.now() / 60000);
    if (sig === this._sig) return;
    this._sig = sig; this._render();
  }
  _s(e) { const x = this._h.states[e]; return x ? x.state : 'unavailable'; }
  _n(e, d = 0) { const v = parseFloat(this._s(e)); return isNaN(v) ? d : v; }
  _call(d, sv, data) { this._h.callService(d, sv, data); }
  _fmt(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; }
  _dur(min) { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h} 時 ${m} 分` : `${h} 小時`) : `${m} 分鐘`; }
  _confirm(key) { // 兩段式確認：再按一次才執行
    if (this._ask === key) { this._ask = null; clearTimeout(this._t); return true; }
    this._ask = key; clearTimeout(this._t); this._t = setTimeout(() => { this._ask = null; this._sig = ''; this._render(); }, 4000);
    this._sig = ''; this._render(); return false;
  }
  _act(a, v) {
    const tgt = this._n(E.target, 60), mins = this._n(E.mins, 120);
    if (a === 'tab') { this._tab = v; }
    else if (a === 'mode') { if (this._confirm('mode' + v)) { if (+v === 5) this._call('input_boolean', 'turn_on', { entity_id: E.pending }); this._call('xiaomi_miot', 'call_action', { entity_id: E.cooker, siid: 2, aiid: 1, params: [+v] }); } return; }
    else if (a === 'cancel') { if (this._confirm('cancel')) this._call('button', 'press', { entity_id: E.cancel }); return; }
    else if (a === 'akw') this._call('switch', 'toggle', { entity_id: E.akw });
    else if (a === 'chain') this._call('input_boolean', 'toggle', { entity_id: E.chain });
    else if (a === 'quiet') this._call('input_boolean', 'toggle', { entity_id: E.quiet });
    else if (a === 'tset') this._call('input_number', 'set_value', { entity_id: E.target, value: Math.min(90, Math.max(30, +v)) });
    else if (a === 'tstep') this._call('input_number', 'set_value', { entity_id: E.target, value: Math.min(90, Math.max(30, tgt + +v)) });
    else if (a === 'recipe') { const r = SV_RECIPES[+v]; if (r) { this._call('input_boolean', r[3] ? 'turn_on' : 'turn_off', { entity_id: E.chain }); this._call('input_number', 'set_value', { entity_id: E.target, value: r[1] }); this._call('input_number', 'set_value', { entity_id: E.mins, value: r[2] }); } }
    else if (a === 'mset') this._call('input_number', 'set_value', { entity_id: E.mins, value: +v });
    else if (a === 'mstep') this._call('input_number', 'set_value', { entity_id: E.mins, value: Math.min(1440, Math.max(10, mins + +v)) });
    else if (a === 'run') { if (this._s(E.run) === 'on') { this._call('input_boolean', 'turn_off', { entity_id: E.run }); }
      else if (this._confirm('run')) this._call('input_boolean', 'turn_on', { entity_id: E.run }); return; }
    this._sig = ''; this._render();
  }
  _render() {
    const st = this._s(E.cooker), sv = this._s(E.run) === 'on', idle = st === 'idle';
    const temp = this._n(E.temp), tgt = this._n(E.target, 60), mins = this._n(E.mins, 120), quiet = this._s(E.quiet) === 'on', chain = this._s(E.chain) === 'on';
    const tab = this._tab || (sv ? 'sv' : 'cook');
    const left = this._n(E.left), total = this._n(E.cook) * 60;
    let remain = null, pct = 0;
    if (sv) { const e = new Date(this._s(E.end).replace(' ', 'T')); if (!isNaN(e)) { remain = (e - new Date()) / 1000; pct = Math.min(100, Math.max(0, 100 * (1 - remain / (mins * 60)))); } }
    else if (st === 'busy' && total) { remain = left; pct = 100 * (1 - left / total); }
    const hdr = this._s(E.menu).replace(/"/g, ''), rname = RECIPES[hdr.slice(-2)] || (hdr.startsWith('0303') && hdr.slice(-2) === '04' ? '保溫' : '');
    const label = sv ? '舒肥中' : (STATE_TEXT[st] || (st === 'unavailable' ? '離線' : st)) + (st === 'busy' && rname ? ' · ' + rname : '');
    const slotName = this._s(E.slot); const slotTxt = slotName && !['unknown', 'unavailable', ''].includes(slotName) ? '自選：' + slotName : '自選';
    const acc = st === 'unavailable' ? '#9e9e9e' : sv ? '#16a085' : st === 'busy' ? '#ef6c00' : st === 'keep warm' ? '#f4a100' : st === 'delay' ? '#7e57c2' : 'var(--primary-color)';
    // 溫度環：270° 弧，0–100°C
    const R = 90, C = 2 * Math.PI * R, arc = C * 0.75, frac = Math.min(1, Math.max(0, temp / 100));
    const ang = (270 * (tgt / 100)) * Math.PI / 180, tx = 100 + R * Math.cos(ang), ty = 100 + R * Math.sin(ang);
    const sub = sv ? `目標 ${tgt}°C · 剩 ${remain != null ? this._fmt(remain) : '--'}` : remain != null && st === 'busy' ? `剩 ${this._fmt(remain)}` : st === 'keep warm' ? `已保溫 ${this._fmt(left)}` : '內鍋溫度';
    const ask = this._ask;
    const panelCook = `
      <div class="grid">${MODES.map(([o, n, i]) => `<button class="mode ${ask === 'mode' + o ? 'ask' : ''}" data-a="mode" data-v="${o}" ${idle ? '' : 'disabled style="opacity:.4"'}><ha-icon icon="${i}"></ha-icon>${ask === 'mode' + o ? '再按一次確認' : (o === 5 ? slotTxt : n)}</button>`).join('')}</div>
      ${!idle && !sv ? `<button class="go ${ask === 'cancel' ? 'ask' : 'stop'}" data-a="cancel">${ask === 'cancel' ? '再按一次確認停止' : '停止烹飪'}</button>` : ''}
      <div class="tog"><div>煮好自動保溫<small>煮飯完成後自動進入保溫</small></div><button class="sw ${this._s(E.akw) === 'on' ? 'on' : ''}" data-a="akw"></button></div>
      <div class="row"><span class="l">App 食譜（需用 App 啟動）</span></div>
      <div class="chips">${APP_ONLY.map(([n, m]) => `<button disabled>${n} ${m}分</button>`).join('')}</div>
      <div class="note">開始前請確認內鍋已放好食材</div>`;
    const panelSv = `
      <div class="row"><span class="l">食譜</span></div>
      <div class="chips">${SV_RECIPES.map(([n, t, m, ch], i) => `<button data-a="recipe" data-v="${i}" class="${tgt === t && mins === m && !!ch === chain ? 'on' : ''}" ${sv ? 'disabled' : ''}>${n}</button>`).join('')}</div>
      <div class="row"><span class="l">目標溫度</span><button class="step" data-a="tstep" data-v="-0.5" ${tgt <= 30 ? 'disabled' : ''}>−</button><span class="v">${tgt}°C</span><button class="step" data-a="tstep" data-v="0.5" ${tgt >= 90 ? 'disabled' : ''}>＋</button></div>
      <div class="chips">${TEMP_PRESETS.map((t) => `<button data-a="tset" data-v="${t}" class="${tgt === t ? 'on' : ''}">${t}°</button>`).join('')}</div>
      <div class="row"><span class="l">時間</span><button class="step" data-a="mstep" data-v="-15" ${sv ? 'disabled' : ''}>−</button><span class="v" style="font-size:18px">${this._dur(mins)}</span><button class="step" data-a="mstep" data-v="15" ${sv ? 'disabled' : ''}>＋</button></div>
      <div class="chips">${TIME_PRESETS.map(([m, n]) => `<button data-a="mset" data-v="${m}" class="${mins === m ? 'on' : ''}" ${sv ? 'disabled' : ''}>${n}</button>`).join('')}</div>
      <div class="tog"><div>結束後接原廠煮粥<small>舒肥時間到，自動啟動原廠「煮粥」模式（煮滾、微滾、保溫交給它）</small></div><button class="sw ${chain ? 'on' : ''}" data-a="chain" ${sv ? 'disabled' : ''}></button></div>
      <div class="tog"><div>安靜模式<small>提示音少約 3/4，溫度較不準（約 ±2.5°C）</small></div><button class="sw ${quiet ? 'on' : ''}" data-a="quiet"></button></div>
      <button class="go ${sv ? 'stop' : ask === 'run' ? 'ask' : ''}" data-a="run" ${!sv && !idle ? 'disabled' : ''}>${sv ? '停止舒肥' : ask === 'run' ? '再按一次：確認內鍋已放水／食材' : !idle ? '電鍋使用中' : '開始舒肥'}</button>
      <div class="note">${sv ? '預計 ' + this._s(E.end).slice(5, 16) + ' 結束；結束後自動停止加熱' : '用保溫模式反覆開關控溫，每次開關電鍋會響'}</div>`;
    this.shadowRoot.innerHTML = `<style>${css}</style>
    <ha-card style="--acc:${acc}">
      <div class="top"><ha-icon icon="mdi:pot-steam-outline" style="color:var(--acc)"></ha-icon><div class="t">米家電子鍋</div><div class="chip">${label}</div></div>
      <div class="ring"><svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="${R}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="14" stroke-linecap="round" stroke-dasharray="${arc} ${C}"/>
        <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--acc)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${arc * frac} ${C}"/>
        ${sv ? `<circle cx="${tx}" cy="${ty}" r="8" fill="#fff" stroke="var(--acc)" stroke-width="4"/>` : ''}
      </svg><div class="c"><div class="big">${st === 'unavailable' ? '--' : temp}<small>°C</small></div><div class="sub">${sub}</div></div></div>
      ${remain != null ? `<div class="bar"><i style="width:${pct}%"></i></div>` : '<div style="height:12px"></div>'}
      <div class="seg"><button data-a="tab" data-v="cook" class="${tab === 'cook' ? 'on' : ''}">烹飪</button><button data-a="tab" data-v="sv" class="${tab === 'sv' ? 'on' : ''}">舒肥</button></div>
      ${tab === 'cook' ? panelCook : panelSv}
    </ha-card>`;
    this.shadowRoot.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => this._act(b.dataset.a, b.dataset.v)));
  }
}
customElements.define('cooker-card', CookerCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'cooker-card', name: '米家電子鍋', description: '電子鍋與舒肥外部控溫' });
