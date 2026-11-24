import { state, persistState, esc } from './store.js';

let fuelEdit = null;
let fuelPrevPrice = null;
let fuelMsg = '';
let fuelLogNote = '';
let clearArmTimer = null;

const $ = (id) => document.getElementById(id);

function baht(x) {
  return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท';
}

function p2(x) {
  return ('0' + x).slice(-2);
}

function fmtWhen(ts) {
  const n = new Date(ts);
  return `${p2(n.getDate())}/${p2(n.getMonth() + 1)} ${p2(n.getHours())}:${p2(n.getMinutes())}`;
}

function toLocalInput(ts) {
  const n = new Date(ts);
  return `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())}T${p2(n.getHours())}:${p2(n.getMinutes())}`;
}

function readNum(id, min, max) {
  const el = $(id);
  const t = el ? String(el.value).trim().replace(',', '.') : '';
  if (t === '') return { v: null, err: '' };
  const v = Number(t);
  if (!Number.isFinite(v)) return { v: null, err: 'ตัวเลขไม่ถูกต้อง' };
  if (v < min || v > max) return { v: null, err: `ต้องอยู่ระหว่าง ${min}–${max}` };
  return { v, err: '' };
}

function fuelAvg() {
  let k = 0, l = 0, c = 0, ck = 0, nq = 0;
  state.fuels.forEach((f) => {
    const fk = +f.km || 0;
    if (f.full && fk > 0) { k += fk; l += f.liters; nq++; }
    if (fk > 0) { c += f.cost; ck += fk; }
  });
  return { eco: l > 0 ? k / l : null, cpk: ck > 0 ? c / ck : null, nq };
}

function resetForm() {
  ['fuelKm', 'fuelLiters', 'fuelNoteIn', 'fuelWhen'].forEach((id) => {
    if ($(id)) $(id).value = '';
  });
  if ($('fuelFull')) $('fuelFull').checked = true;
}

function exitEdit() {
  fuelEdit = null;
  if (fuelPrevPrice !== null && $('fuelPrice')) {
    $('fuelPrice').value = fuelPrevPrice;
    fuelPrevPrice = null;
  }
}

export function renderFuel() {
  if (!$('fuelStats')) return;

  const isEdit = !!fuelEdit && state.fuels.includes(fuelEdit);
  if (!isEdit && fuelEdit) exitEdit();

  $('fuelEditBar').hidden = !isEdit;
  if (isEdit) $('fuelEditTxt').textContent = `กำลังแก้ไขรายการ ${fuelEdit.w}`;
  $('fuelSave').textContent = isEdit ? 'บันทึกการแก้ไข' : 'บันทึกการเติมน้ำมัน';

  const km = readNum('fuelKm', 0, 9999);
  const lit = readNum('fuelLiters', 0.1, 100);
  const pr = readNum('fuelPrice', 1, 200);
  const plan = readNum('fuelPlanKm', 1, 9999);

  const cost = lit.v != null && pr.v != null ? lit.v * pr.v : null;
  const eco = km.v > 0 && lit.v != null ? km.v / lit.v : null;

  ['fuelKm', 'fuelLiters', 'fuelPrice', 'fuelPlanKm'].forEach((id, i) => {
    const res = [km, lit, pr, plan][i];
    if ($(id)) $(id).setAttribute('aria-invalid', res.err ? 'true' : 'false');
  });

  const tile = ([label, val]) => `<div class="stat-tile"><small>${label}</small><b>${val}</b></div>`;
  $('fuelStats').innerHTML = [
    ['ค่าน้ำมัน', cost != null ? baht(cost) : '—'],
    ['กม. / ลิตร', eco ? eco.toFixed(1) : '—'],
    ['ลิตร / 100 กม.', eco ? (100 / eco).toFixed(1) : '—'],
    ['บาท / กม.', cost != null && km.v > 0 ? (cost / km.v).toFixed(2) : '—']
  ].map(tile).join('');

  const errs = [];
  [['ระยะทาง', km], ['ลิตร', lit], ['ราคา', pr]].forEach(([label, r]) => {
    if (r.err) errs.push(`${label}: ${r.err}`);
  });
  $('fuelNote').textContent = errs.length
    ? errs.join(' · ')
    : (fuelMsg || (cost != null ? `${lit.v.toFixed(1)} ลิตร × ${pr.v} บาท = ${baht(cost)}` : 'กรอกจำนวนลิตรและราคาต่อลิตรเพื่อคำนวณ'));

  const avg = fuelAvg();
  let useEco = null, src = '';
  if (avg.eco) { useEco = avg.eco; src = `(จากประวัติ ${avg.nq} ครั้ง)`; }
  else if (eco) { useEco = eco; src = '(จากค่าที่กรอกด้านบน)'; }

  const price = pr.v != null ? pr.v : (state.fuels.length ? state.fuels[0].price : null);
  $('fuelPlanNote').textContent = plan.err
    ? `ระยะทาง: ${plan.err}`
    : plan.v == null
      ? 'ใส่ระยะทางที่จะเดินทางเพื่อประมาณค่าน้ำมัน'
      : useEco == null
        ? 'ยังไม่มีอัตราสิ้นเปลือง: บันทึกการเติมเต็มถังพร้อมระยะทางก่อน'
        : `ใช้อัตรา ${useEco.toFixed(1)} กม./ลิตร ${src}`;

  $('fuelPlan').innerHTML = (plan.v != null && useEco != null)
    ? [
        ['น้ำมันที่ใช้', `${(plan.v / useEco).toFixed(1)} ลิตร`],
        ['ค่าน้ำมันประมาณ', price != null ? baht((plan.v / useEco) * price) : 'ใส่ราคาน้ำมัน']
      ].map(tile).join('')
    : '';

  $('fuelLog').innerHTML = state.fuels.length
    ? state.fuels.map((f, idx) => {
        const fk = +f.km || 0;
        const e = f.full && fk > 0 ? `${(fk / f.liters).toFixed(1)} กม./ลิตร` : '';
        return `<li class="list-item${f === fuelEdit ? ' editing' : ''}">
          <div class="nm">
            ${esc(f.w)}${fk > 0 ? ` · ${fk.toFixed(1)} กม.` : ''} · ${f.liters.toFixed(1)} ลิตร · ${baht(f.cost)}
            <small>ลิตรละ ${f.price.toFixed(2)} · ${f.full ? 'เต็มถัง' : 'บางส่วน'}${e ? ` · ${e}` : ''}${f.note ? ` · ${esc(f.note)}` : ''}</small>
          </div>
          <button class="icon-btn" data-fedit="${idx}" aria-label="แก้ไข">✎</button>
          <button class="icon-btn" data-fdel="${idx}" aria-label="ลบ">✕</button>
        </li>`;
      }).join('')
    : '<li class="list-item"><div class="nm"><small>ยังไม่มีรายการเติมน้ำมัน</small></div></li>';

  const totL = state.fuels.reduce((s, f) => s + f.liters, 0);
  const totC = state.fuels.reduce((s, f) => s + f.cost, 0);
  $('fuelLogSum').textContent = (state.fuels.length
    ? `รวม ${state.fuels.length} ครั้ง · ${totL.toFixed(1)} ลิตร · ${baht(totC)}${avg.eco ? ` · เฉลี่ย ${avg.eco.toFixed(1)} กม./ลิตร` : ''}${avg.cpk ? ` · ${avg.cpk.toFixed(2)} บาท/กม.` : ''}`
    : '') + (fuelLogNote ? (state.fuels.length ? ' — ' : '') + fuelLogNote : '');

  $('fuelCsv').disabled = !state.fuels.length;
  $('fuelClear').disabled = !state.fuels.length;
}

export function initFuel() {
  if ($('fuelPrice') && state.lastFuelPrice && !$('fuelPrice').value) {
    $('fuelPrice').value = state.lastFuelPrice;
  }

  ['fuelKm', 'fuelLiters', 'fuelPrice', 'fuelPlanKm'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.oninput = () => {
      fuelMsg = '';
      if (id === 'fuelPrice') {
        state.lastFuelPrice = el.value;
        persistState();
      }
      renderFuel();
    };
  });

  if ($('fuelUseTrip')) {
    $('fuelUseTrip').onclick = () => {
      const d = state.trip.distanceKm || 0;
      if (d <= 0) {
        fuelMsg = 'ทริปปัจจุบันยังไม่มีระยะทาง';
      } else {
        $('fuelKm').value = d.toFixed(1);
        fuelMsg = `ดึงระยะ ${d.toFixed(1)} กม. จากทริปแล้ว`;
      }
      renderFuel();
    };
  }

  if ($('fuelSave')) {
    $('fuelSave').onclick = () => {
      const km = readNum('fuelKm', 0, 9999);
      const lit = readNum('fuelLiters', 0.1, 100);
      const pr = readNum('fuelPrice', 1, 200);
      if (lit.v == null || pr.v == null || km.err) {
        fuelMsg = lit.err || pr.err || km.err || 'กรุณากรอกจำนวนลิตรและราคาให้ครบ';
        renderFuel();
        return;
      }

      const now = Date.now();
      let ts = fuelEdit ? (fuelEdit.ts || now) : now;
      const wv = $('fuelWhen').value;
      if (wv) {
        const parsed = new Date(wv).getTime();
        if (!Number.isFinite(parsed) || parsed > now + 300000) {
          fuelMsg = 'วันที่/เวลาไม่ถูกต้อง';
          renderFuel();
          return;
        }
        ts = parsed;
      }

      const entry = {
        ts,
        w: fmtWhen(ts),
        liters: lit.v,
        price: pr.v,
        cost: lit.v * pr.v,
        km: km.v || 0,
        full: $('fuelFull').checked,
        note: $('fuelNoteIn').value.trim().slice(0, 60)
      };

      if (fuelEdit) {
        Object.assign(fuelEdit, entry);
        fuelMsg = `แก้ไขรายการ ${entry.w} แล้ว`;
        exitEdit();
      } else {
        state.fuels.unshift(entry);
        fuelMsg = `บันทึกแล้ว · ${lit.v.toFixed(1)} ลิตร · ${baht(entry.cost)}`;
      }

      state.fuels.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      state.fuels = state.fuels.slice(0, 100);
      state.lastFuelPrice = String(pr.v);
      persistState();
      resetForm();
      fuelLogNote = '';
      renderFuel();
    };
  }

  if ($('fuelCancel')) {
    $('fuelCancel').onclick = () => {
      exitEdit();
      resetForm();
      fuelMsg = 'ยกเลิกการแก้ไขแล้ว';
      renderFuel();
    };
  }

  if ($('fuelLog')) {
    $('fuelLog').onclick = (e) => {
      const be = e.target.closest('[data-fedit]');
      const bd = e.target.closest('[data-fdel]');
      if (be) {
        const f = state.fuels[Number(be.dataset.fedit)];
        if (!f) return;
        if (!fuelEdit) fuelPrevPrice = $('fuelPrice').value;
        fuelEdit = f;
        $('fuelKm').value = f.km > 0 ? f.km : '';
        $('fuelLiters').value = f.liters;
        $('fuelPrice').value = f.price;
        $('fuelNoteIn').value = f.note || '';
        $('fuelFull').checked = !!f.full;
        $('fuelWhen').value = f.ts ? toLocalInput(f.ts) : '';
        fuelMsg = '';
        renderFuel();
        $('fuelEditBar').scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      if (bd) {
        const idx = Number(bd.dataset.fdel);
        if (idx >= 0 && idx < state.fuels.length) {
          if (state.fuels[idx] === fuelEdit) { exitEdit(); resetForm(); }
          state.fuels.splice(idx, 1);
          persistState();
          fuelLogNote = 'ลบรายการแล้ว';
          renderFuel();
        }
      }
    };
  }

  if ($('fuelClear')) {
    $('fuelClear').onclick = function () {
      if (!state.fuels.length) return;
      if (clearArmTimer) {
        clearTimeout(clearArmTimer);
        clearArmTimer = null;
        exitEdit();
        resetForm();
        state.fuels = [];
        persistState();
        this.textContent = 'ล้างทั้งหมด';
        fuelLogNote = 'ล้างประวัติทั้งหมดแล้ว';
        renderFuel();
        return;
      }
      this.textContent = 'แตะอีกครั้งเพื่อยืนยัน';
      clearArmTimer = setTimeout(() => {
        clearArmTimer = null;
        this.textContent = 'ล้างทั้งหมด';
      }, 3000);
    };
  }

  if ($('fuelCsv')) {
    $('fuelCsv').onclick = () => {
      const rows = ['วันที่,ระยะ_กม,ลิตร,บาท_ต่อลิตร,รวม_บาท,เติมเต็มถัง,หมายเหตุ'];
      state.fuels.slice().reverse().forEach((f) => {
        let nt = String(f.note || '');
        if (/^[=+\-@]/.test(nt)) nt = "'" + nt;
        rows.push([
          f.w,
          (+f.km || 0).toFixed(1),
          f.liters.toFixed(2),
          f.price.toFixed(2),
          f.cost.toFixed(2),
          f.full ? 'ใช่' : 'ไม่',
          `"${nt.replace(/"/g, '""')}"`
        ].join(','));
      });
      navigator.clipboard?.writeText(rows.join('\n'))
        .then(() => { fuelLogNote = `คัดลอก CSV ${state.fuels.length} แถวแล้ว`; renderFuel(); })
        .catch(() => { fuelLogNote = 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก'; renderFuel(); });
    };
  }

  renderFuel();
}
