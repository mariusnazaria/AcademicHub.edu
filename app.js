// ==========================================================
// Academic Hub — Teste grilă
// Site static (GitHub Pages). Panoul de profesor scrie direct
// pe GitHub folosind un token personal salvat local.
// ==========================================================

const app = document.getElementById('app');
const header = document.getElementById('site-header');
const breadcrumbEl = document.getElementById('breadcrumb');
const btnLogout = document.getElementById('btn-logout');

let manifest = null;

const state = {
  rol: null,            // 'elev' | 'profesor'
  clasa: null,
  materie: null,
  colectie: null,
  intrebari: [],
  index: 0,
  raspunse: 0,
  corecte: 0,
  gresite: 0,
  mod: 'testare',
  puncte: 0,
  istoric: [],
  selectate: new Set(),
  verificat: false,
  loginRolAles: null
};

// ---------------- Sesiune ----------------

function getRol() { return sessionStorage.getItem('ah_rol'); }
function setRol(rol) { sessionStorage.setItem('ah_rol', rol); state.rol = rol; }
function clearRol() { sessionStorage.removeItem('ah_rol'); state.rol = null; }

function getToken() { return localStorage.getItem('ah_gh_token'); }
function setToken(t) { localStorage.setItem('ah_gh_token', t); }
function clearToken() { localStorage.removeItem('ah_gh_token'); }

// ---------------- Pornire + routare ----------------

window.addEventListener('hashchange', ruleaza);
init();

async function init() {
  state.rol = getRol();
  try {
    const res = await fetch('data/manifest.json?t=' + Date.now());
    manifest = await res.json();
  } catch (err) {
    console.error(err);
  }
  ruleaza();
}

// Ruta e ținută în adresa paginii (#/...), ca butonul „înapoi"
// al telefonului să se întoarcă la ecranul anterior, nu la început.
function mergiLa(ruta) {
  if (location.hash === '#' + ruta) ruleaza();
  else location.hash = ruta;
}

function inlocuieste(ruta) {
  history.replaceState(null, '', '#' + ruta);
  ruleaza();
}

function ruleaza() {
  const ruta = location.hash.replace(/^#/, '') || '/';
  const p = ruta.split('/').filter(Boolean);

  if (!state.rol) {
    header.hidden = true;
    renderLogin();
    return;
  }

  header.hidden = false;
  btnLogout.hidden = false;

  if (!manifest) {
    app.innerHTML = '<p class="form-error">Nu am putut încărca lista de clase (data/manifest.json).</p>';
    return;
  }

  // Rute de profesor
  if (p[0] === 'profesor') {
    if (state.rol !== 'profesor') { inlocuieste('/'); return; }
    if (!getToken()) { renderToken(); return; }
    if (p[1] === 'colectie') { renderColectieNoua(); return; }
    if (p[1] === 'intrebare') { renderIntrebareNoua(); return; }
    if (p[1] === 'gestionare') { renderGestionare(); return; }
    if (p[1] === 'editare') { renderEditareIntrebari(); return; }
    renderPanou();
    return;
  }

  // Rute de navigare / quiz
  if (p[0] === 'clasa' && p[1]) {
    const clasa = manifest.clase.find(c => c.id === p[1]);
    if (!clasa) { inlocuieste('/'); return; }

    if (p[2]) {
      const materie = clasa.materii.find(m => m.id === p[2]);
      if (!materie) { inlocuieste('/clasa/' + clasa.id); return; }

      if (p[3]) {
        if (p[3] === 'testare') {
          if (materie.colectii.length === 0) { inlocuieste(`/clasa/${clasa.id}/${materie.id}`); return; }
          renderSetup(clasa, materie, colectieTestare(clasa, materie));
          return;
        }
        const colectie = materie.colectii.find(col => col.id === p[3]);
        if (!colectie) { inlocuieste('/clasa/' + clasa.id + '/' + materie.id); return; }
        renderSetup(clasa, materie, colectie);
        return;
      }
      renderColectii(clasa, materie);
      return;
    }
    renderMaterii(clasa);
    return;
  }

  renderClase();
}

btnLogout.addEventListener('click', () => {
  clearRol();
  location.hash = '';
  ruleaza();
});

document.getElementById('brand-home').addEventListener('click', () => mergiLa('/'));

// ---------------- Login ----------------

function renderLogin() {
  const tpl = document.getElementById('tpl-login').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);

  const form = document.getElementById('login-form');
  const roles = document.querySelector('.login-roles');
  const label = document.getElementById('login-role-label');
  const input = document.getElementById('login-parola');
  const errEl = document.getElementById('login-error');

  document.querySelectorAll('.role-card').forEach(btn => {
    btn.addEventListener('click', () => {
      state.loginRolAles = btn.dataset.rol;
      label.textContent = btn.dataset.rol === 'elev'
        ? 'Conectare ca elev'
        : 'Conectare ca profesor';
      roles.hidden = true;
      form.hidden = false;
      errEl.hidden = true;
      input.value = '';
      input.focus();
    });
  });

  document.getElementById('login-inapoi').addEventListener('click', () => {
    roles.hidden = false;
    form.hidden = true;
  });

  function incearca() {
    const parola = input.value;
    const asteptata = state.loginRolAles === 'elev' ? CONFIG.PAROLA_ELEV : CONFIG.PAROLA_PROFESOR;
    if (parola === asteptata) {
      setRol(state.loginRolAles);
      location.hash = '/';
      ruleaza();
    } else {
      errEl.textContent = 'Parolă greșită. Mai încearcă.';
      errEl.hidden = false;
      input.value = '';
      input.focus();
    }
  }

  document.getElementById('login-intra').addEventListener('click', incearca);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') incearca(); });
}

// ---------------- Progres local (greșeli) ----------------

function cheieGresite(colectieId) { return `ah_gresite_${colectieId}`; }

function getGresite(colectieId) {
  try { return JSON.parse(localStorage.getItem(cheieGresite(colectieId))) || []; }
  catch { return []; }
}

function setGresite(colectieId, lista) {
  localStorage.setItem(cheieGresite(colectieId), JSON.stringify(lista));
}

function marcheazaGresit(colectieId, intrebareId) {
  const lista = getGresite(colectieId);
  if (!lista.includes(intrebareId)) { lista.push(intrebareId); setGresite(colectieId, lista); }
}

function marcheazaCorect(colectieId, intrebareId) {
  setGresite(colectieId, getGresite(colectieId).filter(id => id !== intrebareId));
}

// ---------------- Breadcrumb ----------------

function renderBreadcrumb(parts) {
  breadcrumbEl.innerHTML = (parts || []).map((p, i) =>
    (i > 0 ? '<span class="sep">/</span>' : '') +
    (p.ruta ? `<button data-ruta="${p.ruta}">${p.text}</button>` : `<span>${p.text}</span>`)
  ).join('');
  breadcrumbEl.querySelectorAll('button[data-ruta]').forEach(btn => {
    btn.addEventListener('click', () => mergiLa(btn.dataset.ruta));
  });
}

// ---------------- Ecrane elev ----------------

function cardEl(titlu, meta, onClick) {
  const btn = document.createElement('button');
  btn.className = 'pick-card';
  btn.innerHTML = `<span class="pick-title">${titlu}</span><span class="pick-meta">${meta}</span>`;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderClase() {
  state.clasa = state.materie = state.colectie = null;
  const tpl = document.getElementById('tpl-clase').content.cloneNode(true);
  const grid = tpl.getElementById('clase-grid');
  manifest.clase.forEach(clasa => {
    const n = clasa.materii.length;
    grid.appendChild(cardEl(clasa.nume, `${n} materi${n === 1 ? 'e' : 'i'}`, () => mergiLa('/clasa/' + clasa.id)));
  });
  app.innerHTML = '';
  app.appendChild(tpl);

  const btnPanou = document.getElementById('btn-panou-profesor');
  if (state.rol === 'profesor') {
    btnPanou.hidden = false;
    btnPanou.addEventListener('click', () => mergiLa('/profesor'));
  }
  renderBreadcrumb([{ text: 'Clase' }]);
}

function renderMaterii(clasa) {
  state.clasa = clasa; state.materie = state.colectie = null;
  const tpl = document.getElementById('tpl-materii').content.cloneNode(true);
  tpl.querySelector('h1').textContent = clasa.nume;
  const grid = tpl.getElementById('materii-grid');
  clasa.materii.forEach(materie => {
    const n = materie.colectii.length;
    grid.appendChild(cardEl(materie.nume, `${n} test${n === 1 ? '' : 'e'}`, () => mergiLa(`/clasa/${clasa.id}/${materie.id}`)));
  });
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([{ text: 'Clase', ruta: '/' }, { text: clasa.nume }]);
}

function colectieTestare(clasa, materie) {
  // „Colecție" virtuală: adună întrebări din toate testele materiei.
  return {
    id: `testare-${clasa.id}-${materie.id}`,
    nume: `Testare — ${materie.nume}`,
    testareMaterie: true,
    surse: materie.colectii.map(c => c.fisier)
  };
}

const NR_INTREBARI_TESTARE = 50;

function renderColectii(clasa, materie) {
  state.clasa = clasa; state.materie = materie; state.colectie = null;
  const tpl = document.getElementById('tpl-colectii').content.cloneNode(true);
  tpl.querySelector('h1').textContent = materie.nume;
  const grid = tpl.getElementById('colectii-grid');
  if (materie.colectii.length === 0) {
    const p = document.createElement('p');
    p.className = 'screen-lead';
    p.textContent = 'Încă nu există teste la această materie.';
    tpl.querySelector('.screen').appendChild(p);
  } else {
    const nrT = getGresite(`testare-${clasa.id}-${materie.id}`).length;
    const cardTest = cardEl('Testare',
      `${NR_INTREBARI_TESTARE} întrebări la întâmplare din toate testele`,
      () => mergiLa(`/clasa/${clasa.id}/${materie.id}/testare`));
    cardTest.classList.add('pick-card-highlight');
    if (nrT > 0) cardTest.querySelector('.pick-meta').textContent += ` · ${nrT} de repetat`;
    grid.appendChild(cardTest);
  }
  materie.colectii.forEach(colectie => {
    const nr = getGresite(colectie.id).length;
    grid.appendChild(cardEl(colectie.nume, nr > 0 ? `${nr} de repetat` : 'la zi',
      () => mergiLa(`/clasa/${clasa.id}/${materie.id}/${colectie.id}`)));
  });
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([
    { text: 'Clase', ruta: '/' },
    { text: clasa.nume, ruta: '/clasa/' + clasa.id },
    { text: materie.nume }
  ]);
}

function renderSetup(clasa, materie, colectie) {
  state.clasa = clasa; state.materie = materie; state.colectie = colectie;
  const tpl = document.getElementById('tpl-setup').content.cloneNode(true);
  tpl.querySelector('h1').textContent = colectie.nume;

  const nr = getGresite(colectie.id).length;
  const check = tpl.getElementById('opt-doar-gresite');
  tpl.getElementById('count-gresite').textContent = nr > 0 ? `(${nr})` : '';
  if (nr === 0) check.disabled = true;

  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([
    { text: 'Clase', ruta: '/' },
    { text: clasa.nume, ruta: '/clasa/' + clasa.id },
    { text: materie.nume, ruta: `/clasa/${clasa.id}/${materie.id}` },
    { text: colectie.nume }
  ]);

  document.getElementById('start-quiz').addEventListener('click', async () => {
    const mod = document.querySelector('input[name="mod"]:checked').value;
    const doarGresite = document.getElementById('opt-doar-gresite').checked;
    await pornesteQuiz(colectie, { mod, doarGresite });
  });
}

// ---------------- Quiz ----------------

async function pornesteQuiz(colectie, opts) {
  let intrebari;

  if (colectie.testareMaterie) {
    // Adună întrebările din toate colecțiile materiei
    app.innerHTML = '<p class="screen-lead">Pregătesc testul...</p>';
    const rezultate = await Promise.all(colectie.surse.map(async fisier => {
      try {
        const res = await fetch(fisier + '?t=' + Date.now());
        const lista = await res.json();
        return Array.isArray(lista) ? lista : [];
      } catch (e) {
        console.warn('Nu am putut încărca ' + fisier, e);
        return [];
      }
    }));
    intrebari = rezultate.flat();
  } else {
    try {
      const res = await fetch(colectie.fisier + '?t=' + Date.now());
      intrebari = await res.json();
    } catch (err) {
      app.innerHTML = '<p class="form-error">Nu am putut încărca întrebările.</p>';
      return;
    }
  }

  if (opts.doarGresite) {
    const ids = getGresite(colectie.id);
    intrebari = intrebari.filter(q => ids.includes(q.id));
  }

  intrebari = intrebari.map(q => ({ ...q, variante: [...q.variante] }));
  intrebari = amestecaLista(intrebari).map(q => amestecaVariante(q));

  // La testarea pe materie, limităm la 50 de întrebări
  if (colectie.testareMaterie && !opts.doarGresite) {
    intrebari = intrebari.slice(0, NR_INTREBARI_TESTARE);
  }

  Object.assign(state, {
    intrebari, index: 0, raspunse: 0, corecte: 0, gresite: 0,
    puncte: 0, istoric: [],
    mod: opts.mod, selectate: new Set(), verificat: false
  });

  if (intrebari.length === 0) {
    app.innerHTML = `<section class="screen"><h1>Nimic de exersat</h1>
      <p class="screen-lead">Nu există întrebări de repetat pentru această colecție.</p>
      <button class="btn-secondary" id="btn-inapoi">Înapoi</button></section>`;
    document.getElementById('btn-inapoi').addEventListener('click', () => history.back());
    return;
  }

  renderIntrebare();
}

function amestecaLista(lista) {
  const c = [...lista];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function amestecaVariante(intrebare) {
  const indici = amestecaLista(intrebare.variante.map((_, i) => i));
  const varianteNoi = indici.map(i => intrebare.variante[i]);
  const corect = Array.isArray(intrebare.corect)
    ? intrebare.corect.map(v => indici.indexOf(v))
    : indici.indexOf(intrebare.corect);
  return { ...intrebare, variante: varianteNoi, corect };
}

function renderIntrebare() {
  const tpl = document.getElementById('tpl-quiz').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([{ text: 'Clase', ruta: '/' }, { text: state.colectie.nume }]);

  const q = state.intrebari[state.index];
  const tip = q.tip === 'multiplu' ? 'multiplu' : 'simplu';
  state.selectate = new Set();
  state.verificat = false;

  document.getElementById('question-number').textContent = `Întrebarea ${state.index + 1} din ${state.intrebari.length}`;
  document.getElementById('question-text').textContent = q.intrebare;
  document.getElementById('question-hint').textContent = tip === 'multiplu'
    ? 'Bifează toate variantele corecte, apoi apasă Verifică.'
    : 'Alege o variantă, apoi apasă Verifică.';
  document.getElementById('progress-fill').style.width = `${(state.index / state.intrebari.length) * 100}%`;

  if (q.imagine) {
    document.getElementById('question-image').src = q.imagine;
    document.getElementById('question-image-wrap').hidden = false;
  }

  actualizeazaStats();

  const list = document.getElementById('options-list');
  q.variante.forEach((varianta, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.tip = tip;
    btn.innerHTML = `<span class="opt-marker"></span><span>${varianta}</span>`;
    btn.addEventListener('click', () => alegeVarianta(i, tip));
    list.appendChild(btn);
  });

  const btnVerifica = document.getElementById('btn-verifica');
  btnVerifica.disabled = true;
  btnVerifica.addEventListener('click', () => verificaRaspuns(q, tip));

  document.getElementById('btn-exit').addEventListener('click', () => history.back());
  document.getElementById('btn-next').addEventListener('click', urmatoareaIntrebare);
}

function alegeVarianta(index, tip) {
  if (state.verificat) return;
  if (tip === 'multiplu') {
    if (state.selectate.has(index)) state.selectate.delete(index);
    else state.selectate.add(index);
  } else {
    state.selectate = new Set([index]);
  }
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('is-selected', state.selectate.has(i));
  });
  document.getElementById('btn-verifica').disabled = state.selectate.size === 0;
}

// Punctaj parțial: cât din variantele corecte a nimerit elevul,
// minus variantele greșite bifate (nu poate coborî sub 0).
function calculeazaPuncte(corectSet, sel) {
  const bifateCorecte = [...sel].filter(i => corectSet.has(i)).length;
  const bifateGresite = [...sel].filter(i => !corectSet.has(i)).length;
  const scor = (bifateCorecte - bifateGresite) / corectSet.size;
  return Math.max(0, Math.min(1, scor));
}

function verificaRaspuns(intrebare, tip) {
  const corectSet = new Set(tip === 'multiplu' ? intrebare.corect : [intrebare.corect]);
  const sel = state.selectate;
  const esteCorect = sel.size === corectSet.size && [...sel].every(i => corectSet.has(i));
  const puncte = calculeazaPuncte(corectSet, sel);

  if (!state.verificat) {
    state.raspunse++;
    state.puncte += puncte;
    if (esteCorect) { state.corecte++; marcheazaCorect(state.colectie.id, intrebare.id); }
    else { state.gresite++; marcheazaGresit(state.colectie.id, intrebare.id); }
    actualizeazaStats();
  }

  const btns = document.querySelectorAll('.option-btn');

  if (state.mod === 'invatare' && !esteCorect) {
    btns.forEach((btn, i) => { if (sel.has(i) && !corectSet.has(i)) btn.classList.add('is-wrong'); });
    state.verificat = 'incercare';
    document.getElementById('btn-verifica').disabled = true;
    setTimeout(() => {
      state.verificat = false;
      state.selectate = new Set();
      btns.forEach(btn => btn.classList.remove('is-wrong', 'is-selected'));
      document.getElementById('btn-verifica').disabled = true;
    }, 900);
    return;
  }

  state.verificat = true;

  // Reținem răspunsul pentru rezumatul de la final
  state.istoric.push({
    intrebare: intrebare.intrebare,
    variante: [...intrebare.variante],
    corecte: [...corectSet],
    selectate: [...sel],
    puncte: puncte,
    esteCorect: esteCorect,
    explicatie: intrebare.explicatie || null
  });

  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (corectSet.has(i) && sel.has(i)) btn.classList.add('is-correct');
    else if (corectSet.has(i) && !sel.has(i)) btn.classList.add('is-missed');
    else if (!corectSet.has(i) && sel.has(i)) btn.classList.add('is-wrong');
  });

  document.getElementById('btn-verifica').hidden = true;

  if (intrebare.explicatie) {
    const exp = document.getElementById('explanation');
    exp.textContent = intrebare.explicatie;
    exp.hidden = false;
  }
  document.getElementById('btn-next').disabled = false;
}

function actualizeazaStats() {
  document.getElementById('stat-raspunse').textContent = state.raspunse;
  document.getElementById('stat-corecte').textContent = state.corecte;
  document.getElementById('stat-gresite').textContent = state.gresite;
}

function urmatoareaIntrebare() {
  state.index++;
  if (state.index >= state.intrebari.length) renderRezultate();
  else renderIntrebare();
}

function renderRezultate() {
  const tpl = document.getElementById('tpl-rezultate').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([{ text: 'Clase', ruta: '/' }, { text: 'Rezultate' }]);

  const acuratete = state.raspunse > 0 ? Math.round((state.puncte / state.raspunse) * 100) : 0;
  document.getElementById('res-acuratete').textContent = `${acuratete}%`;
  document.getElementById('res-corecte').textContent = state.corecte;
  document.getElementById('res-total').textContent = state.intrebari.length;

  const nr = getGresite(state.colectie.id).length;
  const btnRepeta = document.getElementById('btn-repeta-gresite');
  if (nr === 0) {
    btnRepeta.disabled = true;
    btnRepeta.textContent = 'Nimic de repetat';
  } else {
    btnRepeta.addEventListener('click', () =>
      pornesteQuiz(state.colectie, { mod: state.mod, doarGresite: true }));
  }
  document.getElementById('btn-alta-colectie').addEventListener('click', () =>
    mergiLa(`/clasa/${state.clasa.id}/${state.materie.id}`));

  const btnRezumat = document.getElementById('btn-rezumat');
  if (state.istoric.length === 0) btnRezumat.disabled = true;
  else btnRezumat.addEventListener('click', renderRezumat);
}

// ---------------- Rezumatul răspunsurilor ----------------

function renderRezumat() {
  const tpl = document.getElementById('tpl-rezumat').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([{ text: 'Clase', ruta: '/' }, { text: 'Rezumat' }]);

  const acuratete = state.raspunse > 0 ? Math.round((state.puncte / state.raspunse) * 100) : 0;
  document.getElementById('rez-lead').textContent =
    `${state.corecte} din ${state.istoric.length} întrebări complet corecte · acuratețe ${acuratete}%`;

  const lista = document.getElementById('rez-lista');

  state.istoric.forEach((item, nr) => {
    const corecte = new Set(item.corecte);
    const alese = new Set(item.selectate);
    const procent = Math.round(item.puncte * 100);

    const card = document.createElement('div');
    card.className = 'rezumat-card';

    let stareEticheta, stareClasa;
    if (item.esteCorect) { stareEticheta = 'Corect'; stareClasa = 'stare-corect'; }
    else if (procent > 0) { stareEticheta = `Parțial · ${procent}%`; stareClasa = 'stare-partial'; }
    else { stareEticheta = 'Greșit'; stareClasa = 'stare-gresit'; }

    const varianteHtml = item.variante.map((v, i) => {
      const eCorect = corecte.has(i);
      const eAles = alese.has(i);
      let clasa = 'rez-varianta';
      let marcaj = '';
      if (eCorect && eAles) { clasa += ' rez-bun'; marcaj = 'ai bifat · corect'; }
      else if (eCorect && !eAles) { clasa += ' rez-ratat'; marcaj = 'corect · nebifat'; }
      else if (!eCorect && eAles) { clasa += ' rez-rau'; marcaj = 'ai bifat · greșit'; }
      return `<li class="${clasa}"><span>${v}</span>${marcaj ? `<em>${marcaj}</em>` : ''}</li>`;
    }).join('');

    card.innerHTML = `
      <div class="rezumat-head">
        <span class="rezumat-nr">Întrebarea ${nr + 1}</span>
        <span class="rezumat-stare ${stareClasa}">${stareEticheta}</span>
      </div>
      <p class="rezumat-intrebare"></p>
      <ul class="rez-variante">${varianteHtml}</ul>
      ${item.explicatie ? '<p class="rezumat-explicatie"></p>' : ''}`;

    // textul îl punem separat, ca să nu fie interpretat ca HTML
    card.querySelector('.rezumat-intrebare').textContent = item.intrebare;
    if (item.explicatie) card.querySelector('.rezumat-explicatie').textContent = item.explicatie;

    lista.appendChild(card);
  });

  document.getElementById('rez-inapoi').addEventListener('click', renderRezultate);
}

// ==========================================================
// GITHUB — citire/scriere fișiere
// ==========================================================

function ghUrl(cale) {
  return `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${cale}`;
}

function b64Encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}

function b64Decode(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function ghCiteste(cale) {
  const res = await fetch(ghUrl(cale) + '?ref=' + CONFIG.GITHUB_BRANCH, {
    headers: { Authorization: 'token ' + getToken(), Accept: 'application/vnd.github+json' }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Nu am putut citi ' + cale + ' (cod ' + res.status + ')');
  const data = await res.json();
  return { continut: b64Decode(data.content), sha: data.sha };
}

async function ghScrie(cale, continutB64, mesaj, sha) {
  const body = { message: mesaj, content: continutB64, branch: CONFIG.GITHUB_BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(ghUrl(cale), {
    method: 'PUT',
    headers: {
      Authorization: 'token ' + getToken(),
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Salvarea a eșuat (cod ' + res.status + '). ' + t.slice(0, 120));
  }
  return res.json();
}

async function ghSterge(cale, mesaj, sha) {
  const res = await fetch(ghUrl(cale), {
    method: 'DELETE',
    headers: {
      Authorization: 'token ' + getToken(),
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: mesaj, sha: sha, branch: CONFIG.GITHUB_BRANCH })
  });
  if (!res.ok) throw new Error('Ștergerea a eșuat (cod ' + res.status + ')');
  return res.json();
}

async function ghScrieText(cale, text, mesaj, sha) {
  return ghScrie(cale, b64Encode(text), mesaj, sha);
}

// ---------------- Token ----------------

function renderToken() {
  const tpl = document.getElementById('tpl-token').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([{ text: 'Clase', ruta: '/' }, { text: 'Cheie de acces' }]);

  const input = document.getElementById('token-input');
  const err = document.getElementById('token-error');
  const btn = document.getElementById('token-salveaza');

  document.getElementById('token-inapoi').addEventListener('click', () => mergiLa('/'));

  btn.addEventListener('click', async () => {
    const val = input.value.trim();
    if (!val) { err.textContent = 'Scrie cheia de acces.'; err.hidden = false; return; }
    btn.disabled = true;
    btn.textContent = 'Verific...';
    setToken(val);
    try {
      const test = await ghCiteste('data/manifest.json');
      if (!test) throw new Error('Nu am găsit data/manifest.json în repository.');
      mergiLa('/profesor');
    } catch (e) {
      clearToken();
      err.textContent = 'Cheie invalidă sau fără drepturi de scriere.';
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Continuă';
    }
  });
}

// ---------------- Panou ----------------

function renderPanou() {
  const tpl = document.getElementById('tpl-panou').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([{ text: 'Clase', ruta: '/' }, { text: 'Panou profesor' }]);

  document.getElementById('panou-intrebare').addEventListener('click', () => mergiLa('/profesor/intrebare'));
  document.getElementById('panou-colectie').addEventListener('click', () => mergiLa('/profesor/colectie'));
  document.getElementById('panou-materii').addEventListener('click', () => mergiLa('/profesor/gestionare'));
  document.getElementById('panou-editare').addEventListener('click', () => mergiLa('/profesor/editare'));
  document.getElementById('panou-vezi').addEventListener('click', () => mergiLa('/'));
  document.getElementById('btn-sterge-token').addEventListener('click', () => {
    clearToken();
    mergiLa('/profesor');
  });
}

// Reîncarcă manifestul din GitHub Pages (după o modificare)
async function reincarcaManifest() {
  const res = await fetch('data/manifest.json?t=' + Date.now());
  manifest = await res.json();
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[ăâ]/g, 'a').replace(/î/g, 'i').replace(/ș/g, 's').replace(/ț/g, 't')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'colectie';
}

function umpleClase(selectEl) {
  selectEl.innerHTML = manifest.clase
    .map(c => `<option value="${c.id}">${c.nume}</option>`).join('');
}

function umpleMaterii(selectClasa, selectMaterie) {
  const clasa = manifest.clase.find(c => c.id === selectClasa.value);
  selectMaterie.innerHTML = clasa.materii
    .map(m => `<option value="${m.id}">${m.nume}</option>`).join('');
}

// ---------------- Colecție nouă ----------------

function renderColectieNoua() {
  const tpl = document.getElementById('tpl-colectie-noua').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([
    { text: 'Clase', ruta: '/' },
    { text: 'Panou profesor', ruta: '/profesor' },
    { text: 'Colecție nouă' }
  ]);

  const selClasa = document.getElementById('cn-clasa');
  const selMaterie = document.getElementById('cn-materie');
  umpleClase(selClasa);
  umpleMaterii(selClasa, selMaterie);
  selClasa.addEventListener('change', () => umpleMaterii(selClasa, selMaterie));

  document.getElementById('cn-inapoi').addEventListener('click', () => mergiLa('/profesor'));

  const err = document.getElementById('cn-error');
  const ok = document.getElementById('cn-ok');
  const btn = document.getElementById('cn-salveaza');

  btn.addEventListener('click', async () => {
    err.hidden = true; ok.hidden = true;
    const nume = document.getElementById('cn-nume').value.trim();
    if (!nume) { err.textContent = 'Scrie numele colecției.'; err.hidden = false; return; }

    const clasaId = selClasa.value;
    const materieId = selMaterie.value;
    const colId = slugify(nume);
    const cale = `data/${clasaId}/${materieId}/${colId}.json`;

    btn.disabled = true; btn.textContent = 'Creez...';
    try {
      const existent = await ghCiteste(cale);
      if (existent) throw new Error('Există deja o colecție cu acest nume aici.');

      await ghScrieText(cale, '[]\n', `Colecție nouă: ${nume}`);

      const man = await ghCiteste('data/manifest.json');
      const date = JSON.parse(man.continut);
      const clasa = date.clase.find(c => c.id === clasaId);
      const materie = clasa.materii.find(m => m.id === materieId);
      if (materie.colectii.some(c => c.id === colId)) throw new Error('Colecția e deja în listă.');
      materie.colectii.push({ id: colId, nume: nume, fisier: cale });

      await ghScrieText('data/manifest.json', JSON.stringify(date, null, 2) + '\n',
        `Adaugă colecția ${nume}`, man.sha);

      await reincarcaManifest();
      ok.textContent = `Colecția „${nume}" a fost creată. Poate dura un minut până apare pe site.`;
      ok.hidden = false;
      document.getElementById('cn-nume').value = '';
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Creează colecția';
    }
  });
}

// ---------------- Întrebare nouă ----------------

let imagineSelectata = null; // { numeFisier, base64 }

function renderIntrebareNoua() {
  const tpl = document.getElementById('tpl-intrebare-noua').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([
    { text: 'Clase', ruta: '/' },
    { text: 'Panou profesor', ruta: '/profesor' },
    { text: 'Întrebare nouă' }
  ]);

  imagineSelectata = null;

  const selClasa = document.getElementById('in-clasa');
  const selMaterie = document.getElementById('in-materie');
  const selColectie = document.getElementById('in-colectie');

  function umpleColectii() {
    const clasa = manifest.clase.find(c => c.id === selClasa.value);
    const materie = clasa.materii.find(m => m.id === selMaterie.value);
    selColectie.innerHTML = materie.colectii.length
      ? materie.colectii.map(c => `<option value="${c.id}">${c.nume}</option>`).join('')
      : '<option value="">— nicio colecție —</option>';
  }

  umpleClase(selClasa);
  umpleMaterii(selClasa, selMaterie);
  umpleColectii();
  selClasa.addEventListener('change', () => { umpleMaterii(selClasa, selMaterie); umpleColectii(); });
  selMaterie.addEventListener('change', umpleColectii);

  // Variante
  const varianteWrap = document.getElementById('in-variante');
  function adaugaVarianta(text = '') {
    const rand = document.createElement('div');
    rand.className = 'varianta-row';
    rand.innerHTML = `
      <input type="checkbox" class="v-corect" title="Corect">
      <input type="text" class="text-input v-text" placeholder="Text variantă" value="${text}">
      <button class="btn-link v-sterge" title="Șterge">✕</button>`;
    rand.querySelector('.v-sterge').addEventListener('click', () => rand.remove());
    varianteWrap.appendChild(rand);
  }
  adaugaVarianta(); adaugaVarianta(); adaugaVarianta(); adaugaVarianta();
  document.getElementById('in-adauga-varianta').addEventListener('click', () => adaugaVarianta());

  // Imagine
  const inputImg = document.getElementById('in-imagine');
  const previewWrap = document.getElementById('in-preview-wrap');
  const preview = document.getElementById('in-preview');
  inputImg.addEventListener('change', () => {
    const file = inputImg.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      imagineSelectata = {
        numeFisier: file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-'),
        base64: dataUrl.split(',')[1]
      };
      preview.src = dataUrl;
      previewWrap.hidden = false;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('in-sterge-imagine').addEventListener('click', () => {
    imagineSelectata = null;
    inputImg.value = '';
    previewWrap.hidden = true;
  });

  document.getElementById('in-inapoi').addEventListener('click', () => mergiLa('/profesor'));

  const err = document.getElementById('in-error');
  const ok = document.getElementById('in-ok');
  const btn = document.getElementById('in-salveaza');

  btn.addEventListener('click', async () => {
    err.hidden = true; ok.hidden = true;

    const colId = selColectie.value;
    if (!colId) { err.textContent = 'Nu există nicio colecție aici. Creează întâi una.'; err.hidden = false; return; }

    const enunt = document.getElementById('in-enunt').value.trim();
    if (!enunt) { err.textContent = 'Scrie enunțul întrebării.'; err.hidden = false; return; }

    const randuri = [...varianteWrap.querySelectorAll('.varianta-row')];
    const variante = [];
    const corecte = [];
    randuri.forEach(r => {
      const txt = r.querySelector('.v-text').value.trim();
      if (!txt) return;
      if (r.querySelector('.v-corect').checked) corecte.push(variante.length);
      variante.push(txt);
    });

    if (variante.length < 2) { err.textContent = 'Ai nevoie de cel puțin 2 variante.'; err.hidden = false; return; }
    if (corecte.length === 0) { err.textContent = 'Bifează cel puțin o variantă corectă.'; err.hidden = false; return; }
    if (corecte.length === variante.length) { err.textContent = 'Nu pot fi corecte toate variantele.'; err.hidden = false; return; }

    const tip = document.querySelector('input[name="in-tip"]:checked').value;
    if (tip === 'simplu' && corecte.length > 1) {
      err.textContent = 'La „Un răspuns" poți bifa o singură variantă corectă.'; err.hidden = false; return;
    }

    const clasa = manifest.clase.find(c => c.id === selClasa.value);
    const materie = clasa.materii.find(m => m.id === selMaterie.value);
    const colectie = materie.colectii.find(c => c.id === colId);

    btn.disabled = true; btn.textContent = 'Salvez...';
    try {
      let caleImagine = null;
      if (imagineSelectata) {
        const ext = imagineSelectata.numeFisier.split('.').pop() || 'png';
        caleImagine = `data/imagini/${colId}-${Date.now()}.${ext}`;
        await ghScrie(caleImagine, imagineSelectata.base64, 'Imagine pentru întrebare');
      }

      const fisier = await ghCiteste(colectie.fisier);
      if (!fisier) throw new Error('Nu am găsit fișierul colecției.');
      const intrebari = JSON.parse(fisier.continut);

      const intrebareNoua = {
        id: `${colId}-${Date.now()}`,
        tip: tip,
        intrebare: enunt,
        variante: variante,
        corect: tip === 'multiplu' ? corecte : corecte[0]
      };
      if (caleImagine) intrebareNoua.imagine = caleImagine;
      const explicatie = document.getElementById('in-explicatie').value.trim();
      if (explicatie) intrebareNoua.explicatie = explicatie;

      intrebari.push(intrebareNoua);
      await ghScrieText(colectie.fisier, JSON.stringify(intrebari, null, 2) + '\n',
        `Întrebare nouă în ${colectie.nume}`, fisier.sha);

      ok.textContent = `Întrebarea a fost salvată (${intrebari.length} în colecție). Poate dura un minut până apare pe site.`;
      ok.hidden = false;

      // Golește formularul pentru următoarea întrebare
      document.getElementById('in-enunt').value = '';
      document.getElementById('in-explicatie').value = '';
      varianteWrap.innerHTML = '';
      adaugaVarianta(); adaugaVarianta(); adaugaVarianta(); adaugaVarianta();
      imagineSelectata = null;
      inputImg.value = '';
      previewWrap.hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Salvează întrebarea';
    }
  });
}

// ---------------- Gestionare materii și colecții ----------------

// Șterge fișierul unei colecții de pe GitHub (dacă există).
// Nu oprim procesul dacă fișierul lipsește deja.
async function stergeFisierColectie(cale) {
  try {
    const f = await ghCiteste(cale);
    if (f) await ghSterge(cale, 'Șterge ' + cale, f.sha);
  } catch (e) {
    console.warn('Nu am putut șterge fișierul ' + cale, e);
  }
}

function renderGestionare() {
  const tpl = document.getElementById('tpl-gestionare').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([
    { text: 'Clase', ruta: '/' },
    { text: 'Panou profesor', ruta: '/profesor' },
    { text: 'Gestionează' }
  ]);

  const selClasa = document.getElementById('ge-clasa');
  const selMaterie = document.getElementById('ge-materie-sel');
  const listaMaterii = document.getElementById('ge-materii-lista');
  const listaColectii = document.getElementById('ge-colectii-lista');
  const err = document.getElementById('ge-error');
  const ok = document.getElementById('ge-ok');

  function mesajEroare(text) { err.textContent = text; err.hidden = false; ok.hidden = true; }
  function mesajOk(text) { ok.textContent = text; ok.hidden = false; err.hidden = true; }

  umpleClase(selClasa);

  function deseneazaMaterii() {
    const clasa = manifest.clase.find(c => c.id === selClasa.value);
    listaMaterii.innerHTML = '';
    if (clasa.materii.length === 0) {
      listaMaterii.innerHTML = '<p class="field-hint">Nicio materie la această clasă.</p>';
    }
    clasa.materii.forEach(materie => {
      const nrTeste = materie.colectii.length;
      const rand = document.createElement('div');
      rand.className = 'manage-row';
      rand.innerHTML = `
        <div>
          <span class="manage-name">${materie.nume}</span>
          <span class="manage-meta">${nrTeste} test${nrTeste === 1 ? '' : 'e'}</span>
        </div>
        <button class="btn-danger">Șterge</button>`;
      rand.querySelector('button').addEventListener('click', () =>
        stergeMaterie(clasa, materie, rand.querySelector('button')));
      listaMaterii.appendChild(rand);
    });

    selMaterie.innerHTML = clasa.materii.length
      ? clasa.materii.map(m => `<option value="${m.id}">${m.nume}</option>`).join('')
      : '<option value="">— nicio materie —</option>';
    deseneazaColectii();
  }

  function deseneazaColectii() {
    const clasa = manifest.clase.find(c => c.id === selClasa.value);
    const materie = clasa.materii.find(m => m.id === selMaterie.value);
    listaColectii.innerHTML = '';
    if (!materie || materie.colectii.length === 0) {
      listaColectii.innerHTML = '<p class="field-hint">Nicio colecție la această materie.</p>';
      return;
    }
    materie.colectii.forEach(colectie => {
      const rand = document.createElement('div');
      rand.className = 'manage-row';
      rand.innerHTML = `
        <div><span class="manage-name">${colectie.nume}</span></div>
        <button class="btn-danger">Șterge</button>`;
      rand.querySelector('button').addEventListener('click', () =>
        stergeColectie(clasa, materie, colectie, rand.querySelector('button')));
      listaColectii.appendChild(rand);
    });
  }

  selClasa.addEventListener('change', deseneazaMaterii);
  selMaterie.addEventListener('change', deseneazaColectii);
  deseneazaMaterii();

  // ---- Adaugă materie ----
  document.getElementById('ge-adauga-materie').addEventListener('click', async () => {
    const input = document.getElementById('ge-materie-noua');
    const nume = input.value.trim();
    if (!nume) { mesajEroare('Scrie numele materiei.'); return; }

    const clasaId = selClasa.value;
    const materieId = slugify(nume);
    const btn = document.getElementById('ge-adauga-materie');
    btn.disabled = true; btn.textContent = 'Adaug...';
    try {
      const man = await ghCiteste('data/manifest.json');
      const date = JSON.parse(man.continut);
      const clasa = date.clase.find(c => c.id === clasaId);
      if (clasa.materii.some(m => m.id === materieId)) throw new Error('Există deja o materie cu acest nume la clasa asta.');

      clasa.materii.push({ id: materieId, nume: nume, colectii: [] });
      await ghScrieText('data/manifest.json', JSON.stringify(date, null, 2) + '\n',
        `Adaugă materia ${nume} la clasa ${clasaId}`, man.sha);

      manifest = date;
      input.value = '';
      deseneazaMaterii();
      mesajOk(`Materia „${nume}" a fost adăugată. Poate dura un minut până apare pe site.`);
    } catch (e) {
      mesajEroare(e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Adaugă';
    }
  });

  // ---- Șterge materie ----
  async function stergeMaterie(clasa, materie, btn) {
    const nrTeste = materie.colectii.length;
    const avertisment = nrTeste > 0
      ? `Ștergi materia „${materie.nume}" împreună cu ${nrTeste} test${nrTeste === 1 ? '' : 'e'} și toate întrebările din ${nrTeste === 1 ? 'el' : 'ele'}. Sigur continui?`
      : `Ștergi materia „${materie.nume}". Sigur continui?`;
    if (!confirm(avertisment)) return;

    btn.disabled = true; btn.textContent = 'Șterg...';
    try {
      for (const col of materie.colectii) {
        await stergeFisierColectie(col.fisier);
      }
      const man = await ghCiteste('data/manifest.json');
      const date = JSON.parse(man.continut);
      const c = date.clase.find(x => x.id === clasa.id);
      c.materii = c.materii.filter(m => m.id !== materie.id);
      await ghScrieText('data/manifest.json', JSON.stringify(date, null, 2) + '\n',
        `Șterge materia ${materie.nume} de la clasa ${clasa.id}`, man.sha);

      manifest = date;
      deseneazaMaterii();
      mesajOk(`Materia „${materie.nume}" a fost ștearsă.`);
    } catch (e) {
      mesajEroare(e.message);
      btn.disabled = false; btn.textContent = 'Șterge';
    }
  }

  // ---- Șterge colecție ----
  async function stergeColectie(clasa, materie, colectie, btn) {
    if (!confirm(`Ștergi colecția „${colectie.nume}" cu toate întrebările din ea. Sigur continui?`)) return;

    btn.disabled = true; btn.textContent = 'Șterg...';
    try {
      await stergeFisierColectie(colectie.fisier);

      const man = await ghCiteste('data/manifest.json');
      const date = JSON.parse(man.continut);
      const c = date.clase.find(x => x.id === clasa.id);
      const m = c.materii.find(x => x.id === materie.id);
      m.colectii = m.colectii.filter(col => col.id !== colectie.id);
      await ghScrieText('data/manifest.json', JSON.stringify(date, null, 2) + '\n',
        `Șterge colecția ${colectie.nume}`, man.sha);

      manifest = date;
      deseneazaMaterii();
      mesajOk(`Colecția „${colectie.nume}" a fost ștearsă.`);
    } catch (e) {
      mesajEroare(e.message);
      btn.disabled = false; btn.textContent = 'Șterge';
    }
  }

  document.getElementById('ge-inapoi').addEventListener('click', () => mergiLa('/profesor'));
}

// ---------------- Editare întrebări existente ----------------

function renderEditareIntrebari() {
  const tpl = document.getElementById('tpl-editare-intrebari').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb([
    { text: 'Clase', ruta: '/' },
    { text: 'Panou profesor', ruta: '/profesor' },
    { text: 'Editează întrebări' }
  ]);

  const selClasa = document.getElementById('ed-clasa');
  const selMaterie = document.getElementById('ed-materie');
  const selColectie = document.getElementById('ed-colectie');
  const lista = document.getElementById('ed-lista');
  const formWrap = document.getElementById('ed-form-wrap');
  const listaWrap = document.getElementById('ed-lista-wrap');
  const varianteWrap = document.getElementById('ed-variante');
  const err = document.getElementById('ed-error');
  const ok = document.getElementById('ed-ok');

  // Starea ecranului de editare
  let colectieCurenta = null;   // obiectul colecției din manifest
  let intrebariCurente = [];    // conținutul fișierului JSON
  let shaCurent = null;         // sha-ul fișierului, pentru salvare
  let indexEditat = -1;         // ce întrebare se editează
  let imagineNoua = null;       // { numeFisier, base64 } dacă s-a ales una nouă
  let imagineCurenta = null;    // calea imaginii deja salvate
  let imagineStearsa = false;

  function mesajEroare(t) { err.textContent = t; err.hidden = false; ok.hidden = true; }
  function mesajOk(t) { ok.textContent = t; ok.hidden = false; err.hidden = true; }

  function umpleColectii() {
    const clasa = manifest.clase.find(c => c.id === selClasa.value);
    const materie = clasa.materii.find(m => m.id === selMaterie.value);
    selColectie.innerHTML = materie && materie.colectii.length
      ? materie.colectii.map(c => `<option value="${c.id}">${c.nume}</option>`).join('')
      : '<option value="">— nicio colecție —</option>';
  }

  umpleClase(selClasa);
  umpleMaterii(selClasa, selMaterie);
  umpleColectii();

  selClasa.addEventListener('change', () => {
    umpleMaterii(selClasa, selMaterie); umpleColectii(); incarcaColectie();
  });
  selMaterie.addEventListener('change', () => { umpleColectii(); incarcaColectie(); });
  selColectie.addEventListener('change', incarcaColectie);

  async function incarcaColectie() {
    ascundeFormular();
    err.hidden = true; ok.hidden = true;
    lista.innerHTML = '<p class="field-hint">Se încarcă...</p>';

    const colId = selColectie.value;
    if (!colId) {
      lista.innerHTML = '<p class="field-hint">Nu există colecții aici.</p>';
      colectieCurenta = null;
      return;
    }

    const clasa = manifest.clase.find(c => c.id === selClasa.value);
    const materie = clasa.materii.find(m => m.id === selMaterie.value);
    colectieCurenta = materie.colectii.find(c => c.id === colId);

    try {
      const fisier = await ghCiteste(colectieCurenta.fisier);
      if (!fisier) throw new Error('Nu am găsit fișierul colecției.');
      intrebariCurente = JSON.parse(fisier.continut);
      shaCurent = fisier.sha;
      deseneazaLista();
    } catch (e) {
      lista.innerHTML = '';
      mesajEroare(e.message);
    }
  }

  function deseneazaLista() {
    lista.innerHTML = '';
    if (intrebariCurente.length === 0) {
      lista.innerHTML = '<p class="field-hint">Colecția nu are încă întrebări.</p>';
      return;
    }
    intrebariCurente.forEach((q, i) => {
      const rand = document.createElement('div');
      rand.className = 'manage-row';
      const tipEticheta = q.tip === 'multiplu' ? 'mai multe răspunsuri' : 'un răspuns';
      const text = (q.intrebare || '').length > 70
        ? q.intrebare.slice(0, 70) + '...'
        : q.intrebare;
      rand.innerHTML = `
        <div>
          <span class="manage-name">${i + 1}. ${text}</span>
          <span class="manage-meta">${tipEticheta}${q.imagine ? ' · cu imagine' : ''}</span>
        </div>
        <div class="row-actions">
          <button class="btn-secondary btn-mic">Editează</button>
          <button class="btn-danger">Șterge</button>
        </div>`;
      const [btnEdit, btnSterge] = rand.querySelectorAll('button');
      btnEdit.addEventListener('click', () => deschideFormular(i));
      btnSterge.addEventListener('click', () => stergeIntrebare(i, btnSterge));
      lista.appendChild(rand);
    });
  }

  function adaugaVariantaRand(text = '', bifat = false) {
    const rand = document.createElement('div');
    rand.className = 'varianta-row';
    rand.innerHTML = `
      <input type="checkbox" class="v-corect" title="Corect">
      <input type="text" class="text-input v-text" placeholder="Text variantă">
      <button class="btn-link v-sterge" title="Șterge">✕</button>`;
    rand.querySelector('.v-text').value = text;
    rand.querySelector('.v-corect').checked = bifat;
    rand.querySelector('.v-sterge').addEventListener('click', () => rand.remove());
    varianteWrap.appendChild(rand);
  }

  function deschideFormular(index) {
    indexEditat = index;
    const q = intrebariCurente[index];

    imagineNoua = null;
    imagineStearsa = false;
    imagineCurenta = q.imagine || null;

    const tip = q.tip === 'multiplu' ? 'multiplu' : 'simplu';
    document.querySelector(`input[name="ed-tip"][value="${tip}"]`).checked = true;
    document.getElementById('ed-enunt').value = q.intrebare || '';
    document.getElementById('ed-explicatie').value = q.explicatie || '';

    const corecte = new Set(Array.isArray(q.corect) ? q.corect : [q.corect]);
    varianteWrap.innerHTML = '';
    (q.variante || []).forEach((v, i) => adaugaVariantaRand(v, corecte.has(i)));

    const previewWrap = document.getElementById('ed-preview-wrap');
    const preview = document.getElementById('ed-preview');
    document.getElementById('ed-imagine').value = '';
    if (imagineCurenta) {
      preview.src = imagineCurenta + '?t=' + Date.now();
      previewWrap.hidden = false;
    } else {
      previewWrap.hidden = true;
    }

    listaWrap.hidden = true;
    formWrap.hidden = false;
    err.hidden = true; ok.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function ascundeFormular() {
    formWrap.hidden = true;
    listaWrap.hidden = false;
    indexEditat = -1;
  }

  document.getElementById('ed-adauga-varianta').addEventListener('click', () => adaugaVariantaRand());
  document.getElementById('ed-anuleaza').addEventListener('click', () => {
    ascundeFormular();
    err.hidden = true; ok.hidden = true;
  });
  document.getElementById('ed-inapoi').addEventListener('click', () => mergiLa('/profesor'));

  // Imagine
  const inputImg = document.getElementById('ed-imagine');
  inputImg.addEventListener('change', () => {
    const file = inputImg.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      imagineNoua = {
        numeFisier: file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-'),
        base64: reader.result.split(',')[1]
      };
      imagineStearsa = false;
      document.getElementById('ed-preview').src = reader.result;
      document.getElementById('ed-preview-wrap').hidden = false;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('ed-sterge-imagine').addEventListener('click', () => {
    imagineNoua = null;
    imagineStearsa = true;
    inputImg.value = '';
    document.getElementById('ed-preview-wrap').hidden = true;
  });

  // Salvare modificări
  document.getElementById('ed-salveaza').addEventListener('click', async () => {
    err.hidden = true; ok.hidden = true;
    if (indexEditat < 0) return;

    const enunt = document.getElementById('ed-enunt').value.trim();
    if (!enunt) { mesajEroare('Scrie enunțul întrebării.'); return; }

    const variante = [];
    const corecte = [];
    varianteWrap.querySelectorAll('.varianta-row').forEach(r => {
      const txt = r.querySelector('.v-text').value.trim();
      if (!txt) return;
      if (r.querySelector('.v-corect').checked) corecte.push(variante.length);
      variante.push(txt);
    });

    if (variante.length < 2) { mesajEroare('Ai nevoie de cel puțin 2 variante.'); return; }
    if (corecte.length === 0) { mesajEroare('Bifează cel puțin o variantă corectă.'); return; }
    if (corecte.length === variante.length) { mesajEroare('Nu pot fi corecte toate variantele.'); return; }

    const tip = document.querySelector('input[name="ed-tip"]:checked').value;
    if (tip === 'simplu' && corecte.length > 1) {
      mesajEroare('La „Un răspuns" poți bifa o singură variantă corectă.'); return;
    }

    const btn = document.getElementById('ed-salveaza');
    btn.disabled = true; btn.textContent = 'Salvez...';
    try {
      // Imagine nouă, dacă s-a ales una
      let caleImagine = imagineStearsa ? null : imagineCurenta;
      if (imagineNoua) {
        const ext = imagineNoua.numeFisier.split('.').pop() || 'png';
        caleImagine = `data/imagini/${colectieCurenta.id}-${Date.now()}.${ext}`;
        await ghScrie(caleImagine, imagineNoua.base64, 'Imagine actualizată');
      }

      // Recitim fișierul, ca să nu suprascriem modificări făcute între timp
      const fisier = await ghCiteste(colectieCurenta.fisier);
      if (!fisier) throw new Error('Nu am găsit fișierul colecției.');
      const lista2 = JSON.parse(fisier.continut);

      const veche = lista2[indexEditat];
      if (!veche) throw new Error('Întrebarea nu mai există în fișier. Reîncarcă lista.');

      const actualizata = {
        id: veche.id,
        tip: tip,
        intrebare: enunt,
        variante: variante,
        corect: tip === 'multiplu' ? corecte : corecte[0]
      };
      if (caleImagine) actualizata.imagine = caleImagine;
      const explicatie = document.getElementById('ed-explicatie').value.trim();
      if (explicatie) actualizata.explicatie = explicatie;

      lista2[indexEditat] = actualizata;

      await ghScrieText(colectieCurenta.fisier, JSON.stringify(lista2, null, 2) + '\n',
        `Modifică întrebare în ${colectieCurenta.nume}`, fisier.sha);

      intrebariCurente = lista2;
      shaCurent = null;
      ascundeFormular();
      deseneazaLista();
      mesajOk('Întrebarea a fost modificată. Poate dura un minut până apare pe site.');
    } catch (e) {
      mesajEroare(e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Salvează modificările';
    }
  });

  // Ștergere întrebare
  async function stergeIntrebare(index, btn) {
    const q = intrebariCurente[index];
    const scurt = (q.intrebare || '').slice(0, 60);
    if (!confirm(`Ștergi întrebarea „${scurt}..."? Această acțiune nu poate fi anulată.`)) return;

    btn.disabled = true; btn.textContent = 'Șterg...';
    try {
      const fisier = await ghCiteste(colectieCurenta.fisier);
      if (!fisier) throw new Error('Nu am găsit fișierul colecției.');
      const lista2 = JSON.parse(fisier.continut);
      lista2.splice(index, 1);

      await ghScrieText(colectieCurenta.fisier, JSON.stringify(lista2, null, 2) + '\n',
        `Șterge întrebare din ${colectieCurenta.nume}`, fisier.sha);

      intrebariCurente = lista2;
      deseneazaLista();
      mesajOk('Întrebarea a fost ștearsă.');
    } catch (e) {
      mesajEroare(e.message);
      btn.disabled = false; btn.textContent = 'Șterge';
    }
  }

  incarcaColectie();
}
