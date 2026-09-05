// Academic Hub — Teste grilă
// Motor simplu, fără build step, gândit pentru GitHub Pages.

const app = document.getElementById('app');
const breadcrumbEl = document.getElementById('breadcrumb');

let manifest = null;

// Starea curentă de navigare
const state = {
  clasa: null,
  materie: null,
  colectie: null,
  intrebari: [],       // setul curent de întrebări (posibil amestecat/filtrat)
  index: 0,
  raspunse: 0,
  corecte: 0,
  gresite: 0,
  mod: 'testare',
  rezolvateCurent: null // pentru mod "invatare": urmărește dacă întrebarea curentă a fost deja rezolvată corect
};

init();

async function init() {
  try {
    const res = await fetch('data/manifest.json');
    manifest = await res.json();
    renderClase();
  } catch (err) {
    app.innerHTML = `<p style="color:#D6483F">Nu am putut încărca lista de clase (data/manifest.json). Verifică fișierul.</p>`;
    console.error(err);
  }
}

document.getElementById('brand-home').addEventListener('click', () => {
  state.clasa = null;
  state.materie = null;
  state.colectie = null;
  renderClase();
});

// ---------- Localstorage: întrebări greșite per colecție ----------

function cheieGresite(colectieId) {
  return `ah_gresite_${colectieId}`;
}

function getGresite(colectieId) {
  try {
    return JSON.parse(localStorage.getItem(cheieGresite(colectieId))) || [];
  } catch {
    return [];
  }
}

function setGresite(colectieId, listaIds) {
  localStorage.setItem(cheieGresite(colectieId), JSON.stringify(listaIds));
}

function marcheazaGresit(colectieId, intrebareId) {
  const lista = getGresite(colectieId);
  if (!lista.includes(intrebareId)) {
    lista.push(intrebareId);
    setGresite(colectieId, lista);
  }
}

function marcheazaCorect(colectieId, intrebareId) {
  const lista = getGresite(colectieId).filter(id => id !== intrebareId);
  setGresite(colectieId, lista);
}

// ---------- Breadcrumb ----------

function renderBreadcrumb() {
  const parts = [];
  parts.push(`<button data-nav="clase">Clase</button>`);
  if (state.clasa) parts.push(`<span class="sep">/</span><button data-nav="materii">${state.clasa.nume}</button>`);
  if (state.materie) parts.push(`<span class="sep">/</span><button data-nav="colectii">${state.materie.nume}</button>`);
  if (state.colectie) parts.push(`<span class="sep">/</span><span>${state.colectie.nume}</span>`);
  breadcrumbEl.innerHTML = parts.join('');
  breadcrumbEl.querySelectorAll('button[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      if (nav === 'clase') renderClase();
      if (nav === 'materii') renderMaterii(state.clasa);
      if (nav === 'colectii') renderColectii(state.clasa, state.materie);
    });
  });
}

// ---------- Ecran: alegere clasă ----------

function renderClase() {
  state.clasa = null;
  state.materie = null;
  state.colectie = null;
  const tpl = document.getElementById('tpl-clase').content.cloneNode(true);
  const grid = tpl.getElementById('clase-grid');
  manifest.clase.forEach(clasa => {
    const nrMaterii = clasa.materii.length;
    grid.appendChild(cardEl(clasa.nume, `${nrMaterii} materi${nrMaterii === 1 ? 'e' : 'i'}`, () => renderMaterii(clasa)));
  });
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb();
}

// ---------- Ecran: alegere materie ----------

function renderMaterii(clasa) {
  state.clasa = clasa;
  state.materie = null;
  state.colectie = null;
  const tpl = document.getElementById('tpl-materii').content.cloneNode(true);
  tpl.querySelector('h1').textContent = clasa.nume;
  const grid = tpl.getElementById('materii-grid');
  clasa.materii.forEach(materie => {
    const nrColectii = materie.colectii.length;
    grid.appendChild(cardEl(materie.nume, `${nrColectii} test${nrColectii === 1 ? '' : 'e'}`, () => renderColectii(clasa, materie)));
  });
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb();
}

// ---------- Ecran: alegere colecție ----------

function renderColectii(clasa, materie) {
  state.clasa = clasa;
  state.materie = materie;
  state.colectie = null;
  const tpl = document.getElementById('tpl-colectii').content.cloneNode(true);
  tpl.querySelector('h1').textContent = materie.nume;
  const grid = tpl.getElementById('colectii-grid');
  materie.colectii.forEach(colectie => {
    const nrGresite = getGresite(colectie.id).length;
    const meta = nrGresite > 0 ? `${nrGresite} de repetat` : 'la zi';
    grid.appendChild(cardEl(colectie.nume, meta, () => renderSetup(colectie)));
  });
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb();
}

function cardEl(titlu, meta, onClick) {
  const btn = document.createElement('button');
  btn.className = 'pick-card';
  btn.innerHTML = `<span class="pick-title">${titlu}</span><span class="pick-meta">${meta}</span>`;
  btn.addEventListener('click', onClick);
  return btn;
}

// ---------- Ecran: setup test ----------

async function renderSetup(colectie) {
  state.colectie = colectie;
  const tpl = document.getElementById('tpl-setup').content.cloneNode(true);
  tpl.querySelector('h1').textContent = colectie.nume;

  const nrGresite = getGresite(colectie.id).length;
  const checkGresite = tpl.getElementById('opt-doar-gresite');
  const countBadge = tpl.getElementById('count-gresite');
  countBadge.textContent = nrGresite > 0 ? `(${nrGresite})` : '';
  if (nrGresite === 0) checkGresite.disabled = true;

  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb();

  document.getElementById('start-quiz').addEventListener('click', async () => {
    const mod = document.querySelector('input[name="mod"]:checked').value;
    const amesteca = document.getElementById('opt-amesteca').checked;
    const doarGresite = document.getElementById('opt-doar-gresite').checked;
    await pornesteQuiz(colectie, { mod, amesteca, doarGresite });
  });
}

// ---------- Quiz ----------

async function pornesteQuiz(colectie, opts) {
  const res = await fetch(colectie.fisier);
  let intrebari = await res.json();

  if (opts.doarGresite) {
    const idsGresite = getGresite(colectie.id);
    intrebari = intrebari.filter(q => idsGresite.includes(q.id));
  }

  intrebari = intrebari.map(q => ({ ...q, variante: [...q.variante] }));

  if (opts.amesteca) {
    intrebari = amestecaLista(intrebari).map(q => amestecaVariante(q));
  }

  state.intrebari = intrebari;
  state.index = 0;
  state.raspunse = 0;
  state.corecte = 0;
  state.gresite = 0;
  state.mod = opts.mod;
  state.rezolvateCurent = false;

  if (intrebari.length === 0) {
    app.innerHTML = `<section class="screen"><h1>Nimic de exersat</h1><p class="screen-lead">Nu există întrebări greșite salvate pentru această colecție.</p><button class="btn-secondary" id="btn-inapoi">Înapoi</button></section>`;
    document.getElementById('btn-inapoi').addEventListener('click', () => renderColectii(state.clasa, state.materie));
    return;
  }

  renderIntrebare();
}

function amestecaLista(lista) {
  const copie = [...lista];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

function amestecaVariante(intrebare) {
  const indici = intrebare.variante.map((_, i) => i);
  const indiciAmestecati = amestecaLista(indici);
  const varianteNoi = indiciAmestecati.map(i => intrebare.variante[i]);
  if (Array.isArray(intrebare.corect)) {
    const corectNou = intrebare.corect.map(vechi => indiciAmestecati.indexOf(vechi));
    return { ...intrebare, variante: varianteNoi, corect: corectNou };
  }
  const corectNou = indiciAmestecati.indexOf(intrebare.corect);
  return { ...intrebare, variante: varianteNoi, corect: corectNou };
}

function renderIntrebare() {
  const tpl = document.getElementById('tpl-quiz').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb();

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

  actualizeazaStats();

  const optionsList = document.getElementById('options-list');
  q.variante.forEach((varianta, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.tip = tip;
    btn.innerHTML = `<span class="opt-marker"></span><span>${varianta}</span>`;
    btn.addEventListener('click', () => alegeVarianta(i, tip));
    optionsList.appendChild(btn);
  });

  const btnVerifica = document.getElementById('btn-verifica');
  btnVerifica.disabled = true;
  btnVerifica.addEventListener('click', () => verificaRaspuns(q, tip));

  document.getElementById('btn-exit').addEventListener('click', () => renderColectii(state.clasa, state.materie));
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

  const optionButtons = document.querySelectorAll('.option-btn');
  optionButtons.forEach((btn, i) => {
    btn.classList.toggle('is-selected', state.selectate.has(i));
  });

  document.getElementById('btn-verifica').disabled = state.selectate.size === 0;
}

function verificaRaspuns(intrebare, tip) {
  const corectSet = new Set(tip === 'multiplu' ? intrebare.corect : [intrebare.corect]);
  const selectate = state.selectate;
  const esteCorect = selectate.size === corectSet.size && [...selectate].every(i => corectSet.has(i));

  if (!state.verificat) {
    state.raspunse++;
    if (esteCorect) {
      state.corecte++;
      marcheazaCorect(state.colectie.id, intrebare.id);
    } else {
      state.gresite++;
      marcheazaGresit(state.colectie.id, intrebare.id);
    }
    actualizeazaStats();
  }

  const optionButtons = document.querySelectorAll('.option-btn');

  if (state.mod === 'invatare' && !esteCorect) {
    // Modul învățare: arată scurt ce a bifat greșit, apoi lasă elevul să încerce din nou
    optionButtons.forEach((btn, i) => {
      if (selectate.has(i) && !corectSet.has(i)) btn.classList.add('is-wrong');
    });
    state.verificat = 'incercare';
    document.getElementById('btn-verifica').disabled = true;
    setTimeout(() => {
      state.verificat = false;
      state.selectate = new Set();
      optionButtons.forEach(btn => {
        btn.classList.remove('is-wrong', 'is-selected');
      });
      document.getElementById('btn-verifica').disabled = true;
    }, 900);
    return;
  }

  // Testare, sau modul învățare cu răspuns corect: blochează și arată totul
  state.verificat = true;
  optionButtons.forEach((btn, i) => {
    btn.disabled = true;
    if (corectSet.has(i) && selectate.has(i)) btn.classList.add('is-correct');
    else if (corectSet.has(i) && !selectate.has(i)) btn.classList.add('is-missed');
    else if (!corectSet.has(i) && selectate.has(i)) btn.classList.add('is-wrong');
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
  if (state.index >= state.intrebari.length) {
    renderRezultate();
  } else {
    renderIntrebare();
  }
}

function renderRezultate() {
  const tpl = document.getElementById('tpl-rezultate').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  renderBreadcrumb();

  const acuratete = state.raspunse > 0 ? Math.round((state.corecte / state.raspunse) * 100) : 0;
  document.getElementById('res-acuratete').textContent = `${acuratete}%`;
  document.getElementById('res-corecte').textContent = state.corecte;
  document.getElementById('res-total').textContent = state.intrebari.length;

  const nrGresite = getGresite(state.colectie.id).length;
  const btnRepeta = document.getElementById('btn-repeta-gresite');
  if (nrGresite === 0) {
    btnRepeta.disabled = true;
    btnRepeta.textContent = 'Nimic de repetat 🎉';
  } else {
    btnRepeta.addEventListener('click', () => {
      pornesteQuiz(state.colectie, { mod: state.mod, amesteca: true, doarGresite: true });
    });
  }

  document.getElementById('btn-alta-colectie').addEventListener('click', () => renderColectii(state.clasa, state.materie));
}
