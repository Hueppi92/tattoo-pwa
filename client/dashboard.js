(() => {
  const API = (window.API_BASE || '/api').replace(/\/+$/, '');
  const role = localStorage.getItem('role') || 'guest';

  // kleine Helpers
  const $ = (s, r=document) => r.querySelector(s);
  const el = (t, p={}, ...ch) => {
    const E = document.createElement(t);
    Object.entries(p).forEach(([k,v])=>{
      if (k==='class') E.className=v;
      else if (k==='style' && typeof v==='object') Object.assign(E.style,v);
      else if (k.startsWith('on') && typeof v==='function') E.addEventListener(k.slice(2), v);
      else E.setAttribute(k,v);
    });
    ch.flat().forEach(c=>E.append(c?.nodeType?c:document.createTextNode(c??'')));
    return E;
  };
  const msg = (t, ok=false)=> el('div',{class:`msg ${ok?'ok':''}`},t);

  // Tabs je Rolle
  const TABS_BY_ROLE = {
    manager: ['overview','artists','customers'],
    artist:  ['overview','ideas','templates','messages'],
    customer:['overview','ideas','templates','aftercare']
  };

  // Tab-Build
  function buildTabs() {
    const tabs = TABS_BY_ROLE[role] || ['overview'];
    const $tabs = $('#tabs'); $tabs.innerHTML = '';
    tabs.forEach(name => {
      const btn = el('button',{class:'tab', onClick:()=>show(name)}, label(name));
      btn.id = `tab-${name}`;
      $tabs.append(btn);
    });
    show(tabs[0]);
  }

  function label(k){
    return ({
      overview:'Übersicht',
      artists:'Artists',
      customers:'Kunden',
      ideas:'Ideen',
      templates:'Vorlagen',
      messages:'Nachrichten',
      aftercare:'Pflegehinweise'
    }[k] || k);
  }

  // Views -------------------------------------------------------------

  async function show(name){
    const $v = $('#view'); $v.innerHTML = '';
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    const $btn = $(`#tab-${name}`); if ($btn) $btn.classList.add('active');

    if (name==='overview') {
      const u = currentUser();
      $v.append(el('h2',{},`Willkommen, ${u?.name || u?.email || 'Gast'}!`));
      $v.append(msg(`Rolle: ${role}`, true));
      return;
    }

    if (name==='ideas') {
      // Customer: Upload + Liste | Artist: nur Liste
      if (role==='customer') {
        $v.append(el('h3',{},'Idee hochladen'));
        const $title = el('input',{type:'text',placeholder:'Titel'});
        const $file  = el('input',{type:'file',accept:'image/*'});
        const $send  = el('button',{onClick:()=>uploadIdea($title,$file)},'Hochladen');
        $v.append(el('div',{},$title,$file,$send));
      } else {
        $v.append(el('p',{},'Als Artist können hier Kunden-Ideen eingesehen werden.'));
      }
      $v.append(el('h3',{},'Ideen'));
      $v.append(await ideasList());
      return;
    }

    if (name==='templates') {
      // Artist: Upload + Liste | Customer: nur Liste
      if (role==='artist') {
        $v.append(el('h3',{},'Vorlage hochladen'));
        const $title = el('input',{type:'text',placeholder:'Titel'});
        const $file  = el('input',{type:'file',accept:'image/*'});
        const $send  = el('button',{onClick:()=>uploadTemplate($title,$file)},'Hochladen');
        $v.append(el('div',{},$title,$file,$send));
      } else {
        $v.append(el('p',{},'Hier siehst du Vorlagen deines Artists.'));
      }
      $v.append(el('h3',{},'Vorlagen'));
      $v.append(await templatesList());
      return;
    }

    if (name==='aftercare') {
      $v.append(el('h3',{},'Pflegehinweise'));
      $v.append(el('p',{},'Nach dem Stechen: waschen, dünn eincremen, Sonne meiden …'));
      return;
    }

    if (name==='artists' || name==='customers') {
      $v.append(el('p',{},'Manager-Ansicht (Stub).'));
      return;
    }

    $v.append(msg('Noch nicht implementiert'));
  }

  function currentUser(){
    try {
      if (role==='artist') return JSON.parse(localStorage.getItem('artist')||'null');
      if (role==='customer') return JSON.parse(localStorage.getItem('customer')||'null');
      if (role==='manager') return JSON.parse(localStorage.getItem('manager')||'null');
    } catch {}
    return null;
  }

  // API: Ideen --------------------------------------------------------
  async function ideasList(){
    const box = el('div',{class:'grid'});
    try {
      const u = currentUser();
      const artistId = role==='artist' ? u?.id : null;
      const url = artistId ? `${API}/ideas?artistId=${encodeURIComponent(artistId)}` : `${API}/ideas`;
      const res = await fetch(url);
      const data = await res.json();
      (data||[]).forEach(i=>{
        box.append(card(i.title,i.imageUrl));
      });
    } catch(e){ box.append(msg('Konnte Ideen nicht laden.')); }
    return box;
  }

  async function uploadIdea($title,$file){
    const u = currentUser();
    if (!$file.files[0]) return alert('Bitte ein Bild wählen.');
    const fd = new FormData();
    fd.append('title',$title.value||'');
    fd.append('file',$file.files[0]);
    fd.append('customerId', u?.id || '');
    // optional: artistId, wenn dein Endpoint das erwartet:
    // fd.append('artistId', u?.artistId || '');
    const res = await fetch(`${API}/ideas`,{ method:'POST', body: fd });
    if (!res.ok) return alert('Upload fehlgeschlagen');
    alert('Idee hochgeladen');
    show('ideas');
  }

  // API: Templates ----------------------------------------------------
  async function templatesList(){
    const box = el('div',{class:'grid'});
    try {
      const res = await fetch(`${API}/templates`);
      const data = await res.json();
      (data||[]).forEach(t=>{
        box.append(card(t.title,t.imageUrl));
      });
    } catch(e){ box.append(msg('Konnte Vorlagen nicht laden.')); }
    return box;
  }

  async function uploadTemplate($title,$file){
    const u = currentUser();
    if (!$file.files[0]) return alert('Bitte ein Bild wählen.');
    const fd = new FormData();
    fd.append('title',$title.value||'');
    fd.append('file',$file.files[0]);
    fd.append('artistId', u?.id || '');
    const res = await fetch(`${API}/templates`,{ method:'POST', body: fd });
    if (!res.ok) return alert('Upload fehlgeschlagen');
    alert('Vorlage hochgeladen');
    show('templates');
  }

  // UI helpers --------------------------------------------------------
  function card(title, img){
    const box = el('div',{class:'card'});
    if (img) box.append(el('img',{src:img, alt:title||''}));
    box.append(el('div',{class:'card-title'}, title||'Ohne Titel'));
    return box;
  }

  // Header userbox
  function fillUser(){
    const u = currentUser();
    const $u = $('#userbox');
    $u.innerHTML = '';
    if (!u) {
      $u.append(el('a',{href:'/artist-login.html'},'Login'));
      return;
    }
    $u.append(el('span',{},`${u.name || u.email} (${role}) `));
    $u.append(el('button',{onClick:()=>{ localStorage.clear(); location.href='/'; }},'Logout'));
  }

  // Start
  fillUser();
  buildTabs();
})();
