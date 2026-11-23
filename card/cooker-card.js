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
const PK = { // 食譜封包（id → [名稱, 176 位元組十六進位]），來源見 cooker/docs/cookcode-format.md
  '01': ['精煮飯', '02010000000001e101000000000000800100000000000000002091827d7800050091822d781c080091823c781c280091ff857820ffff91828578000700ffff8578ffffff91828578000d00ff828778ff000091827d7800000091827d7800ffff91826078ff01114b02667d0801086b0078090301f75602667d09010a6d00780a02025a5701667d0e010a71007a0c02ffff5701667d10010a72007d0c03200502030a0000000000000000000000000c43'],
  '02': ['快煮飯', '02010100000002e10028000000000080010000000000000000209182827800000091823c7820000091823c781c280091ff857820ffff91828578000600ffff8578ffffff91828578000d00ff828778ff000082827d7800000091827d7800ffff91826078ff015f4b03667d08010a6b0074070302465602667d09010a6d0076080302915701667d0f010a7100780803ffff5701667d11010a72007b0803200502030a00000000000000000000000001bb'],
  '03': ['煮粥', '02010200000003e2011e0400002800800100000000000000002091827d7800000091827d7800000091827d78001e0091ff877820ffff91827d78001e0091ff8278ffffff91828278001e0091828278060f0091827d7804000091827d7800000091827d780001914e02552c1802062a04820300025a4e02552a1802062b0482030003234e0252271802062f04820501ffff4e015224180206310482050120000000000000000000000000000000003629'],
  '04': ['保溫', '020103000000040c18001800000100800100000000000000002091827d7800000091827d7800000091827d78000000915a7d7820000091827d7800000091826e78ff000091827d7800000091826e7810000091826e7810000091827d7800000091827d780000a082007882140010871478030000eb820078821400108714780300012d8200788214001087147a0501ffff8200788214001087147d05012000000000000000000000000000000000f2d7'],
  '05': ['燉煮', '02010500000005e701000400001e00800100000000000000002091827d7800000091827d7800000091827d78001e0091547d7820000091827d7800000091826e78ff000091827d7800000091826e7800ffff91827d7818000091827d7800000091827d780000a082007882140010871478030000eb820078821400108714780300012d8200788214001087147a0501ffff8200788214001087147d0501200e780000000000000000000000000000d211'],
  '06': ['優格', '020105000000068908000c00060000000100000000000000002091827d78001e009182297803000091827d78000000913c7d7814000091827d7800000091826e7800000091827d780000009182557810ffff9182287802000091827d780000009182557810000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000001f50'],
  '07': ['嬰兒粥', '02010500000007e203000400021e00800100000000000000002091827d7800000091827d7800000091827d78001e0091ff877820ffff91827d78001e0091ff8278ffffff91828278001e0091828278060f0091827d7804000091827d7800000091827d780001914e02552c1802062a04820300025a4e02552a1802062c0482030003234e0252271802062e04820501ffff4e01522418020632048205012000000000000000000000000000000000ea69'],
  '08': ['泡麵', '020105000000088d00140014001400000100000000000000002091827d7800000091827d7800000091827d78001e00915a7d7820000091827d7800000091826e7800000091827d7800000091826e7810ffff91827d7818000091827d7800000091827d7800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020183c0000000000000000000000000000c3cd'],
  '09': ['蛋糕', '020105000000098801000100003700000100000000000000002091827d7800000091827d7800000091827d78001e0066787d7816000091827d7800000091826e7800000091827d7800000091826e7810ffff918266780a000091827d7800000091827d78000000000078821400108714780300000000007882140010871478030000000000788214001087147a050100000000788214001087147d05012000000000000000000000000000000000f188'],
  '0a': ['煲湯', '0201050000000ae502000400011e00800100000000000000002091827d7800000091827d7800000091827d78001e0091ff877820ffff91827d78001e0091ff8278ffffff91828278001e0091828278070f0091827d7805000091827d7800000091827d780001914e0255251801062804820300025a4e025522180106280482030003234e0155211801062a04820501ffff4e0155241801062c0482050120000000000000000000000000000000002c85'],
  '0b': ['再加熱', '0201050000000ba4001e0023001900800100000000000000002091827d7800000091827d7800000091827d78000f00912b7d7810000091827d7800000091826e78ff000091827d780000009182557810ffff9182507814000091827d780000009182557810000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000005085'],
  '0c': ['關東煮', '0201050000000cee011e011e011e00000100000000000000002091827d7800000091827d7800000091827d78001e00915882782000009182827800000091826e7800000091827d780000009182827818ffff9182827816000091827d7800000091827d78000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200f780000000000000000000000000000f8a9'],
  '0d': ['熱米飯', '0201050000000da4001e0023001900800100000000000000002091827d7800000091827d7800000091827d78000f00912b7d7810000091827d7800000091826e78ff000091827d780000009182557810ffff9182507814000091827d780000009182557810000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000a5b'],
  '0e': ['香甜煮', '0201050000000ee1010a0000000000800100000000000000002091827d7800060091822d781c0a0091823c781c280091ff857820ffff91828578000700ffff8578ffffff91828578001400ff828778ff000091827d7800000091827d7800ffff91826078ff01114b02667d0801056e00780c0301f75202667d0901056f00780c04025a5402667d0e010571007a0f04ffff5701667d10010672007d0f042005020305000000000000000000000000fc5e'],
  '0f': ['極速煮', '0201050000000fe1001e000000000080010000000000000000209182827800000091823c7820000091823c781c280091ff857820ffff91828578000300ffff8578ffffff91828578000a00ff828778ff000082827d7800000091827d7800ffff91826078ff015f48015d7d0802086e00740403024650015e7d0902096f0076040302915201667d0e010d7000780503ffff5201667d10010d72007b050320000102130000000000000000000000004652'],
};
const crc16 = (b) => { let c = 0; for (let i = 0; i < b.length; i++) { c ^= b[i] << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c; };
const hex2b = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const b2hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
// 依 App 的 CMCookProfile 改表頭：時長、預約、自動保溫，重算 CRC
function buildPacket(id, min, order, akw, temp) {
  const b = hex2b(PK[id][1]);
  if (id === '06' && temp) { b[84] = temp; b[35] = temp + 1; } // 優格：階段 8 目標 40 °C、階段 1 目標 41 °C（b2＝目標溫度，實驗功能）
  if (((b[3] << 24) | (b[4] << 16) | (b[5] << 8) | b[6]) > 4) b[2] = 0x05;
  b[8] = Math.floor(min / 60) & 0xFF; b[9] = min % 60;
  if (order > 0) { b[14] = 0x80 | (Math.floor(order / 60) & 0x7F); b[15] = (b[15] & 0x80) | (order % 60); } else { b[14] = 0; b[15] &= 0x80; }
  b[15] = akw ? (b[15] | 0x80) : (b[15] & 0x7F);
  const c = crc16(b.subarray(0, 174)); b[174] = c >> 8; b[175] = c & 0xFF;
  return b2hex(b);
}
function recipeInfo(id) {
  const b = hex2b(PK[id][1]);
  return { name: PK[id][0], def: b[8] * 60 + b[9], max: b[10] * 60 + b[11], min: b[12] * 60 + b[13], canOrder: !!(b[7] & 0x40), canAkw: !!(b[7] & 0x20), akw: !!(b[15] & 0x80), temp: id === '06' ? b[84] : 0 };
}
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
  setConfig() { this._tab = null; this._ask = null; this._sig = ''; this._rc = null; }
  getCardSize() { return 9; }
  connectedCallback() { if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); } }
  set hass(h) {
    this._h = h;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const s = (e) => (h.states[e] ? h.states[e].state : 'na');
    const sig = Object.values(E).map(s).join('|') + '|' + this._tab + '|' + JSON.stringify(this._rc) + '|' + this._ask + '|' + Math.floor(Date.now() / 60000);
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
    else if (a === 'rcsel') { const i = recipeInfo(v); this._rc = { id: v, min: i.def, order: 0, akw: i.akw, temp: i.temp }; }
    else if (a === 'rcmin') { const i = recipeInfo(this._rc.id); if (i.max > i.min) this._rc.min = Math.min(i.max, Math.max(i.min, this._rc.min + +v)); }
    else if (a === 'rcord') { this._rc.order = Math.min(23 * 60 + 30, Math.max(0, this._rc.order + +v)); }
    else if (a === 'rcakw') this._rc.akw = !this._rc.akw;
    else if (a === 'rctemp') { this._rc.temp = Math.min(50, Math.max(30, (this._rc.temp || 40) + +v)); }
    else if (a === 'rcgo') { const r = this._rc; if (r && this._confirm('rcgo')) { this._call('xiaomi_miot', 'call_action', { entity_id: E.cooker, siid: 4, aiid: 1, params: [buildPacket(r.id, r.min, r.order, r.akw, r.temp)] }); } return; }
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
      <div class="note">開始前請確認內鍋已放好食材</div>`;
    const rc = this._rc || (this._rc = { id: '06', min: recipeInfo('06').def, order: 0, akw: recipeInfo('06').akw, temp: recipeInfo('06').temp }), ri = recipeInfo(rc.id), adj = ri.max > ri.min;
    const panelRc = `
      <div class="chips">${Object.keys(PK).filter((k) => parseInt(k, 16) > 4).map((k) => `<button data-a="rcsel" data-v="${k}" class="${rc.id === k ? 'on' : ''}">${PK[k][0]}</button>`).join('')}</div>
      <div class="row"><span class="l">時間${adj ? `（${this._dur(ri.min)}～${this._dur(ri.max)}）` : '（固定）'}</span><button class="step" data-a="rcmin" data-v="-10" ${adj && rc.min > ri.min ? '' : 'disabled'}>−</button><span class="v" style="font-size:18px">${this._dur(rc.min)}</span><button class="step" data-a="rcmin" data-v="10" ${adj && rc.min < ri.max ? '' : 'disabled'}>＋</button></div>
      ${ri.canOrder ? `<div class="row"><span class="l">預約</span><button class="step" data-a="rcord" data-v="-30" ${rc.order > 0 ? '' : 'disabled'}>−</button><span class="v" style="font-size:18px">${rc.order ? this._dur(rc.order) + '後開始' : '立即開始'}</span><button class="step" data-a="rcord" data-v="30">＋</button></div>` : ''}
      ${rc.id === '06' ? `<div class="row"><span class="l">發酵溫度（實驗）</span><button class="step" data-a="rctemp" data-v="-1" ${rc.temp > 30 ? '' : 'disabled'}>−</button><span class="v" style="font-size:18px">${rc.temp} °C</span><button class="step" data-a="rctemp" data-v="1" ${rc.temp < 50 ? '' : 'disabled'}>＋</button></div>` : ''}
      ${ri.canAkw ? `<div class="tog"><div>煮好自動保溫<small>完成後保溫 24 小時</small></div><button class="sw ${rc.akw ? 'on' : ''}" data-a="rcakw"></button></div>` : ''}
      <button class="go ${ask === 'rcgo' ? 'ask' : ''}" data-a="rcgo" ${idle ? '' : 'disabled'}>${!idle ? '電鍋使用中' : ask === 'rcgo' ? '再按一次：確認內鍋已放好食材' : (rc.order ? '預約 ' : '開始 ') + ri.name}</button>
      <div class="note">本地直接送出食譜封包，不經過米家雲端</div>`;
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
      <div class="seg"><button data-a="tab" data-v="cook" class="${tab === 'cook' ? 'on' : ''}">烹飪</button><button data-a="tab" data-v="rc" class="${tab === 'rc' ? 'on' : ''}">食譜</button><button data-a="tab" data-v="sv" class="${tab === 'sv' ? 'on' : ''}">舒肥</button></div>
      ${tab === 'cook' ? panelCook : tab === 'rc' ? panelRc : panelSv}
    </ha-card>`;
    this.shadowRoot.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => this._act(b.dataset.a, b.dataset.v)));
  }
}
customElements.define('cooker-card', CookerCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'cooker-card', name: '米家電子鍋', description: '電子鍋：原廠模式、全部食譜（含優格）、預約、舒肥外部控溫' });
