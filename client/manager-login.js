// client/manager-login.js
// Manager-Login gegen /api/manager/login (email + password), danach Redirect zu /studio.html

(() => {
  const API_BASE = (window.API_BASE || '/api').replace(/\/+$/, '');

  const h = (tag, props = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class' || k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  function buildUI() {
    const $root = $('#app') || document.body;

    const $title = h('h1', { class: 'title' }, 'Manager Login');
    const $msg = h('div', { id: 'login-msg', class: 'msg' });

    const $labelEmail = h('label', { for: 'login-email' }, 'E‑Mail');
    const $email = h('input', {
      id: 'login-email',
      type: 'email',
      placeholder: 'z. B. admin@demo.app',
      autocomplete: 'username',
      required: 'required'
    });

    const $labelPass = h('label', { for: 'login-pass' }, 'Passwort');
    const $pass = h('input', {
      id: 'login-pass',
      type: 'password',
      placeholder: '••••••',
      autocomplete: 'current-password',
      required: 'required'
    });

    const $btn = h('button', { id: 'login-btn', type: 'button' }, 'Einloggen');

    const $form = h(
      'div',
      { class: 'card login-card' },
      $title,
      $msg,
      h('div', { class: 'field' }, $labelEmail, $email),
      h('div', { class: 'field' }, $labelPass, $pass),
      h('div', { class: 'actions' }, $btn),
      h('p', { class: 'hint' }, 'Demo: ', h('code', {}, 'admin@demo.app / demo'))
    );

    // Fallback-Styles, falls CSS mal nicht lädt
    const ensureBaseStyles = () => {
      const hasLink = [...document.styleSheets].some(s => (s.href || '').includes('style.css'));
      if (!hasLink) {
        $form.style.maxWidth = '420px';
        $form.style.margin = '10vh auto';
        $form.style.padding = '24px';
        $form.style.borderRadius = '14px';
        $form.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
        $form.style.background = '#fff';
        $form.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        [...$form.querySelectorAll('.field')].forEach(div => (div.style.margin = '12px 0'));
        [$email, $pass].forEach(inp => {
          inp.style.width = '100%';
          inp.style.padding = '10px 12px';
          inp.style.border = '1px solid #ddd';
          inp.style.borderRadius = '10px';
        });
        $btn.style.padding = '10px 14px';
        $btn.style.borderRadius = '10px';
        $btn.style.border = '0';
        $btn.style.cursor = 'pointer';
        $btn.style.fontWeight = '600';
      }
    };
    ensureBaseStyles();

    $root.innerHTML = '';
    $root.appendChild($form);

    const setMsg = (text, ok = false) => {
      $msg.textContent = text || '';
      $msg.style.color = ok ? '#0a7' : '#c00';
      $msg.style.margin = text ? '8px 0 4px' : '0';
    };

    $btn.addEventListener('click', async () => {
      const email = $email.value.trim();
      const password = $pass.value;

      if (!email || !password) {
        setMsg('Bitte E‑Mail und Passwort eingeben.');
        return;
      }

      try {
        setMsg('Anmeldung läuft …', true);
        const res = await fetch(`${API_BASE}/manager/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `Login fehlgeschlagen (HTTP ${res.status})`);
        }

        const data = await res.json();
        try {
          if (data?.token) localStorage.setItem('auth_token', data.token);
          if (data?.manager) localStorage.setItem('manager', JSON.stringify(data.manager));
        } catch (_) {}

        setMsg('Erfolgreich angemeldet. Weiterleitung …', true);
        // Redirect ins Manager/Studio Dashboard:
        window.location.href = '/studio.html';
      } catch (e) {
        setMsg(e.message || 'Login fehlgeschlagen.');
      }
    });

    [$email, $pass].forEach(inp =>
      inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') $btn.click();
      })
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
