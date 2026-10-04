/**
 * Inscripción Liga El Garito: servidor en Google Apps Script.
 *
 * Guarda las inscripciones en una planilla de Google y responde a la página
 * publicada en GitHub Pages. Pasos de instalación en README.md del repositorio.
 *
 *   1. Cambia PIN_ORGANIZADOR (abajo) por un PIN que solo conozcas tú.
 *      No lo subas a GitHub: cámbialo solo aquí, en el editor de Apps Script.
 *   2. Ejecuta la función setup() una vez (crea la planilla y carga la Fecha 10).
 *   3. Implementar > Nueva implementación > Aplicación web
 *      Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 *   4. Copia la URL que termina en /exec y pégala en config.js.
 */

const PIN_ORGANIZADOR = 'CAMBIA-ESTE-PIN';
const HORA_APERTURA = 9; // hora (0 a 23) en que abre la inscripción cada miércoles
// Los campeones de cada fecha se toman del resultado publicado en el Ranking.
const RANKING_URL = 'https://nnavarroo-sys.github.io/liga-el-garito/';

const TZ = 'America/Santiago';
const LIGA = { name: 'Liga El Garito', season: 'Temporada Clausura 2026' };
const DEFAULTS = {
  cupos: 12, hora: '20:30', horaNota: 'Horario Prime', lugar: 'Club Refugio Chicureo',
  nivel: '4ta Firme y 3era', pago: 'Cancha + pelotas + 3er Tiempo', extra: '2,5 horas de juego + pelotas nuevas'
};
const SETTINGS = ['cupos', 'hora', 'horaNota', 'lugar', 'nivel', 'pago', 'extra'];

/* Columnas de cada hoja: [clave interna, título visible en la planilla] */
const F_COLS = [
  ['n', 'Fecha'], ['date', 'Día (aaaa-mm-dd)'], ['calCat', 'Categoría calendario'], ['cat', 'Categoría (si cambia)'],
  ['cupos', 'Cupos titulares'], ['hora', 'Hora'], ['horaNota', 'Nota horario'], ['lugar', 'Lugar'], ['nivel', 'CAT'],
  ['pago', 'Pago'], ['extra', 'Línea extra'], ['ch1', 'Campeón 1'], ['ch2', 'Campeón 2'],
  ['hold', 'Reservar cupo campeones (SI/NO)'], ['champOk', 'Campeones confirmados (ms)'], ['champCode', 'Código campeones'],
  ['susp', 'Suspendidos (separar con /)'], ['chSrc', 'Campeones: origen']
];
const I_COLS = [
  ['id', 'ID'], ['n', 'Fecha'], ['a', 'Jugador 1'], ['b', 'Jugador 2'], ['when', 'Inscrito'], ['t', 'Inscrito (ms)'],
  ['s', 'Orden'], ['p0', 'Se anotó con Partner'], ['pt', 'Partner confirmado (ms)'], ['ok', 'Partner a tiempo (organizador)'],
  ['estado', 'Estado'], ['origen', 'Origen'], ['code', 'Código']
];

const CALENDARIO = [
  [10, '2026-10-06', 'Challenger'], [11, '2026-10-13', 'Open'], [12, '2026-10-20', 'Master'], [13, '2026-10-27', 'Open'],
  [14, '2026-11-03', 'Challenger'], [15, '2026-11-10', 'Open'], [16, '2026-11-17', 'Master'], [17, '2026-11-24', 'Open'],
  [18, '2026-12-01', 'Challenger'], [19, '2026-12-08', 'Open'], [20, '2026-12-15', 'Master'], [21, '2026-12-22', 'Master Finals']
];

/* ---------------- instalación ---------------- */

/** Ejecútala una vez desde el editor. Crea la planilla de datos y carga la Fecha 10. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (ss) { Logger.log('La planilla ya existe: ' + ss.getUrl()); return ss.getUrl(); }

  ss = SpreadsheetApp.create('Inscripción El Garito · Datos');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  const fs = prepSheet(ss, 'Fechas', F_COLS, 200);
  const is = prepSheet(ss, 'Inscripciones', I_COLS, 5000);
  const rs = prepSheet(ss, 'Registro', [['when', 'Cuándo'], ['action', 'Acción'], ['n', 'Fecha'], ['detail', 'Detalle']], 5000);
  ss.getSheets().forEach(function (sh) {
    if (['Fechas', 'Inscripciones', 'Registro'].indexOf(sh.getName()) < 0) ss.deleteSheet(sh);
  });

  const seedT = 1790737201000; // mié 30 sep 2026, 00:00 en Santiago
  CALENDARIO.forEach(function (c) {
    const row = { n: c[0], date: c[1], calCat: c[2], hold: 'SI' };
    if (c[0] === 10) Object.assign(row, {
      cupos: 12, hora: '20:30', horaNota: 'Horario Prime', lugar: 'Club Refugio Chicureo', nivel: '4ta Firme y 3era',
      pago: 'Cancha + pelotas + 3er Tiempo · Carnes Nico Moreno', extra: '2,5 horas de juego + pelotas nuevas',
      ch1: 'Súper Jona', ch2: 'Diego Rosales', champOk: seedT - 1001, champCode: newCode(),
      susp: 'René Tobar (Coto) / Daniel Retuert', chSrc: 'organizador'
    });
    if (c[0] === 11) row.pago = 'Se paga solo cancha + pelotas';
    addRow(fs, F_COLS, row);
  });
  [['Coke Castro', 'Danilo'], ['Nico Moreno', 'Nico Fernández'], ['Boris Morales', 'Tomy Latorre'], ['Juan Javia', 'Lucas'],
   ['Luis Reyes', 'Gonzalo Avila'], ['Tomas Polloni', 'Camilo'], ['Rodolfo Guajardo', 'Daniel Belmar'],
   ['Carlos Amaro', 'Esteban Ayala'], ['Byron', 'Diego LP'], ['Matías E', 'Seba Yañez'], ['Iván Neira', 'David Neira'],
   ['Jaca', 'Pablo Muñoz'], ['Ale M', 'Carlos Villar'], ['Rosas', 'Yayo']].forEach(function (p, i) {
    const t = seedT + (i + 1) * 1000;
    addRow(is, I_COLS, { id: newId(), n: 10, a: p[0], b: p[1], when: fmtWhen(t), t: t, s: i + 1, p0: 'NO', pt: '', ok: '',
      estado: 'activa', origen: 'importada', code: newCode() });
  });
  log(ss, 'setup', '', 'Planilla creada con la Fecha 10 cargada');
  Logger.log('Planilla creada: ' + ss.getUrl());
  return ss.getUrl();
}

function prepSheet(ss, name, cols, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, rows, cols.length).setNumberFormat('@');
  sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[1]; })]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

/* ---------------- web ---------------- */

function doGet(e) {
  try {
    let all = loadAll();
    if (needsChamps(all)) {
      const lock = LockService.getScriptLock();
      if (lock.tryLock(5000)) { try { all = loadAll(); fillChampsFromRanking(all); } finally { lock.releaseLock(); } }
    }
    return json(publicState(all));
  } catch (err) {
    return json({ ok: false, msg: friendly(err) });
  }
}

function doPost(e) {
  let p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json({ ok: false, msg: 'Solicitud no válida.' }); }
  const fn = ACTIONS[p.action];
  if (!fn) return json({ ok: false, msg: 'Acción desconocida.' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ ok: false, msg: 'Hay mucha gente inscribiéndose al mismo tiempo. Intenta de nuevo en unos segundos.' });
  }
  try {
    const all = loadAll();
    const res = fn(p, all) || {};
    return json(Object.assign({ ok: true }, res, { state: publicState(loadAll()) }));
  } catch (err) {
    const out = Object.assign({ ok: false, msg: friendly(err) }, err.extra || {});
    try { out.state = publicState(loadAll()); } catch (e2) { /* sin estado */ }
    return json(out);
  } finally {
    lock.releaseLock();
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function fail(msg, extra) { const e = new Error(msg); e.user = true; e.extra = extra; throw e; }
function friendly(err) { return err && err.user ? err.message : 'Error del servidor: ' + (err && err.message ? err.message : err); }

/* ---------------- acciones ---------------- */

const ACTIONS = {
  /* Inscripción pública: el orden lo da la hora del servidor. */
  signup: function (p, all) {
    const c = ctx(all, p.n);
    windowOpen(c);
    return addPair(all, c, p.a, p.b, !!p.force, 'web', null);
  },

  /* Un clic: los campeones confirman su cupo 1. */
  champConfirm: function (p, all) {
    const c = ctx(all, p.n);
    if (!isAdmin(p.pin)) windowOpen(c);
    if (!c.f.hold || !c.f.ch1 || !c.f.ch2) fail('Esta fecha no tiene cupo reservado para campeones.');
    if (c.f.champOk) fail('Los campeones ya están confirmados.');
    c.f.champOk = nowMs();
    c.f.champCode = c.f.champCode || newCode();
    saveF(all, c.f);
    log(all.ss, 'campeones confirmados', c.n, c.f.ch1 + ' / ' + c.f.ch2 + (isAdmin(p.pin) ? ' (organizador)' : ''));
    return { id: 'champ', code: isAdmin(p.pin) ? null : c.f.champCode };
  },

  /* Completar el Partner con el código de la pareja. */
  partner: function (p, all) {
    const c = ctx(all, p.n), e = entry(c, p.id);
    auth(p, e.code);
    if (!isPartner(e.b) && !isAdmin(p.pin)) fail('Para cambiar de pareja, habla con el organizador.');
    const b = cleanInput(p.b);
    if (isPartner(b)) fail('Escribe el nombre de tu pareja.');
    checkNames(c, e.a, b, !!p.force, e.id);
    const was = isPartner(e.b);
    e.b = b;
    if (was && e.p0 === 'SI') e.pt = nowMs();
    saveI(all, e);
    log(all.ss, 'partner', c.n, e.a + ' / ' + e.b);
    return { id: e.id };
  },

  /* Bajarse de la lista (pareja con su código, o campeones con el suyo). */
  cancel: function (p, all) {
    const c = ctx(all, p.n);
    if (p.id === 'champ') {
      auth(p, c.f.champCode);
      c.f.hold = false; c.f.champOk = null;
      saveF(all, c.f);
      log(all.ss, 'campeones se bajan', c.n, c.f.ch1 + ' / ' + c.f.ch2);
      return {};
    }
    const e = entry(c, p.id);
    auth(p, e.code);
    e.estado = 'baja';
    saveI(all, e);
    log(all.ss, 'baja', c.n, e.a + ' / ' + e.b);
    return {};
  },

  /* Recuperar una inscripción hecha en otro teléfono con su código. */
  claim: function (p, all) {
    const c = ctx(all, p.n), code = String(p.code || '').trim();
    throttle();
    if (code && c.f.champOk && String(c.f.champCode) === code) return { id: 'champ', code: code };
    const e = c.entries.filter(function (x) { return String(x.code) === code; })[0];
    if (!code || !e) { addFail(); fail('No hay una inscripción con ese código en la Fecha ' + c.n + '.'); }
    return { id: e.id, code: code };
  },

  adminCheck: function (p) { needAdmin(p); return {}; },

  adminSave: function (p, all) {
    needAdmin(p);
    const c = ctx(all, p.n), s = p.settings || {};
    const f = c.f;
    f.cat = s.cat && s.cat !== f.calCat ? String(s.cat) : '';
    const cup = Math.round(Number(s.cupos));
    if (!(cup >= 1 && cup <= 40)) fail('Los cupos titulares deben ser un número entre 1 y 40.');
    f.cupos = cup;
    ['hora', 'horaNota', 'lugar', 'nivel', 'pago', 'extra'].forEach(function (k) { f[k] = String(s[k] == null ? '' : s[k]).trim().slice(0, 140); });
    if (!/^\d{1,2}[:.]\d{2}/.test(f.hora)) fail('Escribe la hora como 20:30.');
    const ch1 = cleanName(s.ch1 || ''), ch2 = cleanName(s.ch2 || '');
    if (norm(ch1) !== norm(f.ch1) || norm(ch2) !== norm(f.ch2)) { f.champOk = null; f.champCode = ''; }
    if (norm(ch1) !== norm(f.ch1) || norm(ch2) !== norm(f.ch2)) f.chSrc = 'organizador';
    f.ch1 = ch1; f.ch2 = ch2;
    f.hold = s.hold !== false;
    if (!f.hold) f.champOk = null;
    f.susp = splitNames(Array.isArray(s.susp) ? s.susp.join(' / ') : s.susp || '');
    saveF(all, f);
    log(all.ss, 'datos de la fecha', c.n, JSON.stringify(s));
    return {};
  },

  adminAdd: function (p, all) {
    needAdmin(p);
    const c = ctx(all, p.n);
    return addPair(all, c, p.a, p.b, !!p.force, 'organizador', p.t ? Number(p.t) : null);
  },

  adminEdit: function (p, all) {
    needAdmin(p);
    const c = ctx(all, p.n), e = entry(c, p.id);
    let a = cleanInput(p.a), b = cleanInput(p.b);
    if (isPartner(a) && !isPartner(b)) { a = b; b = 'Partner'; }
    if (isPartner(a)) fail('Falta el nombre del jugador 1.');
    if (isPartner(b)) b = 'Partner';
    checkNames(c, a, b, true, e.id);
    const wasP = isPartner(e.a) || isPartner(e.b), isP = isPartner(b);
    if (isP && !wasP) { e.p0 = 'SI'; e.pt = ''; e.ok = ''; }
    else if (!isP && wasP && e.p0 === 'SI') e.pt = nowMs();
    e.a = a; e.b = b;
    if (p.t && Number(p.t) !== Number(e.t)) { e.t = Number(p.t); e.when = fmtWhen(e.t); if (e.origen === 'importada') e.origen = 'organizador'; }
    e.ok = p.ok ? 'SI' : '';
    saveI(all, e);
    log(all.ss, 'editar', c.n, e.a + ' / ' + e.b);
    return { id: e.id };
  },

  adminDelete: function (p, all) {
    needAdmin(p);
    const c = ctx(all, p.n), e = entry(c, p.id);
    e.estado = 'baja';
    saveI(all, e);
    log(all.ss, 'quitar (organizador)', c.n, e.a + ' / ' + e.b);
    return {};
  },

  /* Reemplaza la lista de la fecha con un mensaje pegado del grupo. */
  adminImport: function (p, all) {
    needAdmin(p);
    const c = ctx(all, p.n), now = nowMs(), skipped = [];
    if (Array.isArray(p.susp)) c.f.susp = splitNames(p.susp.join(' / '));
    if (p.champ && p.champ.a && p.champ.b) {
      const same = c.f.ch1 && c.f.ch2 && isChampPair(p.champ.a, p.champ.b, [c.f.ch1, c.f.ch2]);
      c.f.ch1 = cleanName(p.champ.a); c.f.ch2 = cleanName(p.champ.b); c.f.hold = true; c.f.chSrc = 'organizador';
      c.f.champOk = p.champ.ok ? (same && c.f.champOk ? c.f.champOk : now) : null;
      c.f.champCode = (same && c.f.champCode) || newCode();
    }
    c.entries.forEach(function (e) { e.estado = 'reemplazada'; saveI(all, e); });
    let s = maxS(all, c.n);
    (p.rows || []).slice(0, 80).forEach(function (r, i) {
      let a = cleanInput(r.a), b = cleanInput(r.b);
      if (isPartner(a) && !isPartner(b)) { a = b; b = 'Partner'; }
      if (isPartner(a)) return;
      if (isPartner(b)) b = 'Partner';
      if (!p.champ && c.f.hold && c.f.ch1 && c.f.ch2 && isChampPair(a, b, [c.f.ch1, c.f.ch2])) {
        if (!c.f.champOk) { c.f.champOk = now; c.f.champCode = c.f.champCode || newCode(); }
        return;
      }
      const hit = suspHit(c.f.susp, [a, b]);
      if (hit.lvl === 2) { skipped.push(hit.sus); return; }
      const t = now + i;
      addRow(all.is, I_COLS, { id: newId(), n: c.n, a: a, b: b, when: fmtWhen(t), t: t, s: ++s, p0: isPartner(b) ? 'SI' : 'NO',
        pt: '', ok: '', estado: 'activa', origen: 'importada', code: newCode() });
    });
    saveF(all, c.f);
    log(all.ss, 'pegar lista', c.n, (p.rows || []).length + ' parejas');
    return { skipped: skipped };
  },

  adminChamp: function (p, all) {
    needAdmin(p);
    const c = ctx(all, p.n), f = c.f;
    if (p.op === 'confirm') { f.hold = true; f.champOk = f.champOk || nowMs(); f.champCode = f.champCode || newCode(); }
    else if (p.op === 'undo') f.champOk = null;
    else if (p.op === 'free') { f.hold = false; f.champOk = null; }
    else if (p.op === 'hold') f.hold = true;
    else fail('Acción desconocida.');
    saveF(all, f);
    log(all.ss, 'campeones: ' + p.op, c.n, f.ch1 + ' / ' + f.ch2);
    return {};
  }
};

function addPair(all, c, rawA, rawB, force, origen, t0) {
  let a = cleanInput(rawA), b = cleanInput(rawB);
  if (isPartner(a) && !isPartner(b)) { a = b; b = 'Partner'; }
  if (isPartner(a)) fail('Escribe tu nombre.');
  if (isPartner(b)) b = 'Partner';
  const f = c.f;
  if (f.hold && f.ch1 && f.ch2 && isChampPair(a, b, [f.ch1, f.ch2])) {
    if (f.champOk) fail('Los campeones ya están confirmados en el cupo 1.');
    f.champOk = nowMs(); f.champCode = f.champCode || newCode();
    saveF(all, f);
    log(all.ss, 'campeones confirmados', c.n, a + ' / ' + b + ' (' + origen + ')');
    return { id: 'champ', code: origen === 'web' ? f.champCode : null, champ: true };
  }
  checkNames(c, a, b, force, null);
  const t = t0 || nowMs(), code = newCode();
  const e = { id: newId(), n: c.n, a: a, b: b, when: fmtWhen(t), t: t, s: maxS(all, c.n) + 1, p0: isPartner(b) ? 'SI' : 'NO',
    pt: '', ok: '', estado: 'activa', origen: origen, code: code };
  addRow(all.is, I_COLS, e);
  log(all.ss, 'inscripción (' + origen + ')', c.n, a + ' / ' + b);
  return { id: e.id, code: origen === 'web' ? code : null };
}

function checkNames(c, a, b, force, skipId) {
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(a)) fail('Escribe un nombre válido.');
  if (!isPartner(b) && norm(a) === norm(b)) fail('Escribiste el mismo nombre dos veces.');
  const hit = suspHit(c.f.susp, [a, b]);
  if (hit.lvl === 2) fail(hit.sus + ' está suspendido esta jornada y no puede inscribirse con ninguna pareja.', { kind: 'susp', sus: hit.sus });
  if (hit.lvl === 1 && !force) fail('"' + hit.inp + '" coincide con ' + hit.sus + ', que está suspendido esta jornada.', { kind: 'susp_weak', inp: hit.inp, sus: hit.sus });
  const taken = [];
  if (c.f.hold && c.f.champOk) taken.push(c.f.ch1, c.f.ch2);
  c.entries.forEach(function (e) { if (e.id !== skipId) taken.push(e.a, e.b); });
  [a, b].forEach(function (x) {
    if (isPartner(x)) return;
    const dup = taken.filter(function (y) { return !isPartner(y) && norm(y) === norm(x); })[0];
    if (dup) fail(dup + ' ya está inscrito en la Fecha ' + c.n + '.');
  });
}

function windowOpen(c) {
  const T = times(c.f, c.L), now = nowMs();
  if (now < T.open) fail('La inscripción de la Fecha ' + c.n + ' abre el ' + whenLong(T.open) + '.');
  if (now >= T.game) fail('La inscripción de la Fecha ' + c.n + ' ya cerró.');
}

function auth(p, real) {
  if (isAdmin(p.pin)) return;
  throttle();
  if (!p.code || String(p.code).trim() !== String(real)) { addFail(); fail('El código no corresponde a esta inscripción.'); }
}
function isAdmin(pin) { return !!pin && PIN_ORGANIZADOR !== 'CAMBIA-ESTE-PIN' && String(pin) === PIN_ORGANIZADOR; }
function needAdmin(p) {
  if (PIN_ORGANIZADOR === 'CAMBIA-ESTE-PIN') fail('Falta definir el PIN del organizador en el código de Apps Script.');
  throttle();
  if (!isAdmin(p.pin)) { addFail(); fail('PIN incorrecto.', { kind: 'pin' }); }
}
function throttle() {
  const n = Number(CacheService.getScriptCache().get('fails') || 0);
  if (n >= 40) fail('Demasiados intentos con códigos incorrectos. Espera 10 minutos.');
}
function addFail() {
  const cache = CacheService.getScriptCache();
  cache.put('fails', String(Number(cache.get('fails') || 0) + 1), 600);
}

/* ---------------- datos ---------------- */

function loadAll() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) fail('El servidor aún no está instalado: falta ejecutar setup().');
  const ss = SpreadsheetApp.openById(id);
  const fs = ss.getSheetByName('Fechas'), is = ss.getSheetByName('Inscripciones');
  if (str(fs.getRange(1, F_COLS.length).getValue()) === '') fs.getRange(1, 1, 1, F_COLS.length).setValues([F_COLS.map(function (c) { return c[1]; })]).setFontWeight('bold');
  const fechas = readTable(fs, F_COLS).map(normF).sort(function (a, b) { return a.n - b.n; });
  const ins = readTable(is, I_COLS).map(normI);
  return { ss: ss, fs: fs, is: is, fechas: fechas, ins: ins, res: resolveSettings(fechas) };
}

function readTable(sh, cols) {
  const v = sh.getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === '') continue;
    const o = { _row: i + 1 };
    cols.forEach(function (c, j) { o[c[0]] = v[i][j] === undefined ? '' : v[i][j]; });
    out.push(o);
  }
  return out;
}
function cellOut(v) { return v === null || v === undefined ? '' : v === true ? 'SI' : v === false ? 'NO' : Array.isArray(v) ? v.join(' / ') : String(v); }
function addRow(sh, cols, o) {
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, cols.length).setNumberFormat('@').setValues([cols.map(function (c) { return cellOut(o[c[0]]); })]);
  o._row = r;
}
function saveRow(sh, cols, o) { sh.getRange(o._row, 1, 1, cols.length).setValues([cols.map(function (c) { return cellOut(o[c[0]]); })]); }
function saveF(all, f) {
  const o = Object.assign({}, f, { champOk: f.champOk ? String(f.champOk) : '', hold: f.hold ? 'SI' : 'NO', susp: (f.susp || []).join(' / ') });
  saveRow(all.fs, F_COLS, o);
}
function saveI(all, e) { saveRow(all.is, I_COLS, e); }

function str(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v == null ? '' : v).trim(); }
function num(v) { const n = Number(v); return v === '' || v == null || isNaN(n) ? null : n; }
function normF(o) {
  o.n = Number(o.n); o.date = str(o.date); o.calCat = str(o.calCat); o.cat = str(o.cat);
  SETTINGS.forEach(function (k) { o[k] = str(o[k]); });
  o.ch1 = str(o.ch1); o.ch2 = str(o.ch2);
  o.hold = !/^(no|false|0)$/i.test(str(o.hold));
  o.champOk = num(o.champOk); o.champCode = str(o.champCode);
  o.susp = splitNames(str(o.susp));
  o.chSrc = str(o.chSrc);
  return o;
}
function normI(o) {
  o.id = str(o.id); o.n = Number(o.n); o.a = str(o.a); o.b = str(o.b); o.t = num(o.t) || 0; o.s = num(o.s) || 0;
  o.p0 = /^(si|sí|true)$/i.test(str(o.p0)) ? 'SI' : 'NO'; o.pt = num(o.pt) || ''; o.ok = /^(si|sí|true)$/i.test(str(o.ok)) ? 'SI' : '';
  o.estado = str(o.estado) || 'activa'; o.origen = str(o.origen); o.code = str(o.code); o.when = str(o.when);
  return o;
}
function resolveSettings(fechas) {
  const out = {};
  let prev = DEFAULTS;
  fechas.forEach(function (f) {
    const L = {};
    SETTINGS.forEach(function (k) {
      const v = f[k];
      L[k] = v !== '' ? (k === 'cupos' ? (Math.round(Number(v)) || DEFAULTS.cupos) : v) : prev[k];
    });
    out[f.n] = L; prev = L;
  });
  return out;
}
function ctx(all, n) {
  n = Number(n);
  const f = all.fechas.filter(function (x) { return x.n === n; })[0];
  if (!f) fail('No existe la Fecha ' + n + '.');
  return { n: n, f: f, L: all.res[n], entries: all.ins.filter(function (e) { return e.n === n && e.estado === 'activa'; }) };
}
function entry(c, id) {
  const e = c.entries.filter(function (x) { return x.id === String(id); })[0];
  if (!e) fail('Esa inscripción ya no está en la lista.');
  return e;
}
function maxS(all, n) { return all.ins.filter(function (e) { return e.n === n; }).reduce(function (m, e) { return Math.max(m, e.s || 0); }, 0); }

/* Lo que ve la página: nunca incluye códigos. */
function publicState(all) {
  const lists = {};
  all.fechas.forEach(function (f) {
    const L = Object.assign({}, all.res[f.n]);
    L.cat = f.cat; L.champs = [f.ch1, f.ch2]; L.hold = f.hold; L.champOk = f.champOk ? { t: f.champOk } : null; L.susp = f.susp;
    L.entries = all.ins.filter(function (e) { return e.n === f.n && e.estado === 'activa'; }).map(function (e) {
      const o = { id: e.id, a: e.a, b: e.b, t: e.t, s: e.s };
      if (e.p0 === 'SI') o.p0 = true;
      if (e.pt) o.pt = e.pt;
      if (e.ok === 'SI') o.ok = true;
      if (e.origen === 'importada') o.imp = true;
      return o;
    });
    lists[f.n] = L;
  });
  return {
    ok: true, now: nowMs(), league: LIGA, defaults: DEFAULTS,
    calendar: all.fechas.map(function (f) { return { n: f.n, date: f.date, cat: f.calCat }; }),
    lists: lists, apertura: HORA_APERTURA, ranking: RANKING_URL, adminReady: PIN_ORGANIZADOR !== 'CAMBIA-ESTE-PIN'
  };
}

/* ---------------- campeones desde el Ranking ---------------- */

/** Ganadores de cada fecha cerrada en el Ranking publicado: { '9': ['Super Jona', 'Diego Rosales'], … }. Se guarda 10 minutos. */
function rankingWinners() {
  const cache = CacheService.getScriptCache(), hit = cache.get('ranking-winners');
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* se vuelve a leer */ } }
  const out = {};
  try {
    const res = UrlFetchApp.fetch(RANKING_URL + '?v=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    const m = res.getResponseCode() === 200 ? /<script type="application\/json" id="liga-data">([\s\S]*?)<\/script>/.exec(res.getContentText()) : null;
    if (m) {
      const d = JSON.parse(m[1]), names = {};
      (d.players || []).forEach(function (p) { names[p.id] = p.name; });
      (d.fechas || []).forEach(function (f) {
        if (f.status !== 'cerrada') return;
        const w = (f.results || []).filter(function (r) { return r.pl === 1; }).map(function (r) { return names[r.p]; }).filter(Boolean);
        if (w.length === 2) out[f.n] = w;
      });
    }
  } catch (e) { /* sin Ranking: los campeones se ingresan a mano */ }
  cache.put('ranking-winners', JSON.stringify(out), 600);
  return out;
}
function needsChamps(all) {
  return all.fechas.some(function (f) { return f.hold && !f.ch1 && !f.ch2 && !f.chSrc; });
}
/** Completa los campeones de las fechas que aún no los tienen, con la pareja ganadora de la fecha anterior en el Ranking. */
function fillChampsFromRanking(all) {
  const todo = all.fechas.filter(function (f) { return f.hold && !f.ch1 && !f.ch2 && !f.chSrc; });
  if (!todo.length) return;
  const w = rankingWinners();
  todo.forEach(function (f) {
    const pair = w[f.n - 1];
    if (!pair) return;
    f.ch1 = cleanName(pair[0]); f.ch2 = cleanName(pair[1]); f.chSrc = 'ranking'; f.champOk = null; f.champCode = newCode();
    saveF(all, f);
    log(all.ss, 'campeones desde el ranking', f.n, f.ch1 + ' / ' + f.ch2);
  });
}
/** Para probar desde el editor: muestra en el registro los ganadores que lee del Ranking. */
function probarRanking() {
  CacheService.getScriptCache().remove('ranking-winners');
  const w = rankingWinners();
  Object.keys(w).forEach(function (n) { Logger.log('Fecha ' + n + ': ' + w[n].join(' / ')); });
  if (!Object.keys(w).length) Logger.log('No se pudo leer el Ranking en ' + RANKING_URL);
}

function log(ss, action, n, detail) {
  try { ss.getSheetByName('Registro').appendRow([fmtWhen(nowMs()), action, String(n), String(detail).slice(0, 500)]); } catch (e) { /* registro opcional */ }
}

/* ---------------- utilidades ---------------- */

function nowMs() { return Date.now(); }
function newCode() { return String(100000 + Math.floor(Math.random() * 900000)); }
function newId() { return 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function fmtWhen(ms) { return Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd HH:mm:ss'); }

/* Fechas y horas en Santiago */
function wall(ms) {
  const s = Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd-HH-mm-ss').split('-').map(Number);
  return { y: s[0], m: s[1], d: s[2], h: s[3] % 24, mi: s[4], s: s[5] };
}
function offsetAt(ms) { const b = ms - (((ms % 1000) + 1000) % 1000), w = wall(b); return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - b; }
function zoned(y, m, d, h, mi) { const g = Date.UTC(y, m - 1, d, h || 0, mi || 0); return g - offsetAt(g - offsetAt(g)); }
function dayAt(date, k, h, mi) {
  const p = String(date).split('-').map(Number), u = new Date(Date.UTC(p[0], p[1] - 1, p[2] + k));
  return zoned(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate(), h, mi);
}
function hm(s) { const m = /^(\d{1,2})[:.](\d{2})/.exec(String(s || '').trim()); return m ? [Math.min(23, +m[1]), Math.min(59, +m[2])] : [20, 30]; }
function times(f, L) { const h = hm(L.hora); return { open: dayAt(f.date, -6, HORA_APERTURA, 0), deadline: dayAt(f.date, -4, 12, 0), game: dayAt(f.date, 0, h[0], h[1]) }; }
function whenLong(ms) {
  const w = wall(ms), wd = new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
  const D = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return D[wd] + ' ' + w.d + ' de ' + M[w.m - 1] + ' a las ' + ('0' + w.h).slice(-2) + ':' + ('0' + w.mi).slice(-2);
}

/* Nombres: misma lógica que la página */
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function isPartner(s) { const n = norm(s); return !n || n === 'partner'; }
function toks(s) { return norm(s).split(' ').filter(Boolean); }
function within(A, B) { return A.every(function (w) { return B.indexOf(w) >= 0; }); }
function nameMatch(x, c) { const X = toks(x), C = toks(c); return !!X.length && !!C.length && (within(X, C) || within(C, X)); }
function isChampPair(a, b, ch) {
  if (!ch || !ch[0] || !ch[1] || isPartner(a) || isPartner(b)) return false;
  return (nameMatch(a, ch[0]) && nameMatch(b, ch[1])) || (nameMatch(a, ch[1]) && nameMatch(b, ch[0]));
}
function suspLevel(x, s) {
  if (isPartner(x) || isPartner(s)) return 0;
  const X = toks(x), S = toks(s), base = toks(String(s).replace(/\([^)]*\)/g, ' ')), al = /\(([^)]+)\)/.exec(String(s)), A = al ? toks(al[1]) : [];
  if (!X.length || !S.length) return 0;
  if (within(S, X) || (base.length && within(base, X)) || (A.length && X.join(' ') === A.join(' '))) return 2;
  if (within(X, S)) return X.length >= 2 ? 2 : 1;
  return 0;
}
function suspHit(susp, names) {
  let best = { lvl: 0 };
  (susp || []).forEach(function (s) { names.forEach(function (x) { const l = suspLevel(x, s); if (l > best.lvl) best = { lvl: l, inp: String(x).trim(), sus: s }; }); });
  return best;
}
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
function cleanName(s) { return String(s || '').replace(EMOJI, '').replace(/\(\s*cupo campeones\s*\)/ig, '').replace(/\(?\s*por confirmar\s*\)?/ig, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim(); }
function cleanInput(s) { const v = cleanName(s); if (v.length > 40) fail('Cada nombre puede tener hasta 40 letras.'); return v; }
function splitNames(s) { return String(s || '').split(/\s*[\/,;]\s*|\s+y\s+/).map(cleanName).filter(Boolean); }
