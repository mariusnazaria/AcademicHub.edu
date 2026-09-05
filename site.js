// Academic Hub — scripturi comune pentru paginile de prezentare

// ---- Meniu mobil ----
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const deschis = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', deschis ? 'true' : 'false');
    });
  }

  // Marchează linkul paginii curente
  const cale = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === cale) a.classList.add('is-active');
  });

  initFormularContact();
});

// ---- Formular de contact ----
// Trimite datele către endpointul botului, care le pune pe Telegram.
function initFormularContact() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const btn = document.getElementById('cf-trimite');
  const err = document.getElementById('cf-error');
  const ok = document.getElementById('cf-ok');

  btn.addEventListener('click', async () => {
    err.hidden = true;
    ok.hidden = true;

    const date = {
      nume: document.getElementById('cf-nume').value.trim(),
      telefon: document.getElementById('cf-telefon').value.trim(),
      email: document.getElementById('cf-email').value.trim(),
      clasa: document.getElementById('cf-clasa').value,
      mesaj: document.getElementById('cf-mesaj').value.trim()
    };

    if (!date.nume) { arataEroare('Scrie numele.'); return; }
    if (!date.telefon) { arataEroare('Scrie numărul de telefon.'); return; }

    btn.disabled = true;
    btn.textContent = 'Se trimite...';

    try {
      const res = await fetch(SITE_CONFIG.FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(date)
      });
      if (!res.ok) throw new Error('cod ' + res.status);

      ok.textContent = 'Mesajul a fost trimis. Te contactăm în curând!';
      ok.hidden = false;
      form.querySelectorAll('input, textarea').forEach(el => el.value = '');
    } catch (e) {
      arataEroare('Nu am putut trimite mesajul. Sună-ne la +373 61 221 666 sau scrie-ne pe Viber.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Trimite mesajul';
    }
  });

  function arataEroare(text) {
    err.textContent = text;
    err.hidden = false;
    ok.hidden = true;
  }
}
