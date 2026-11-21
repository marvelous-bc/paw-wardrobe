// ==UserScript==
// @name         Paw Private Wardrobe (Two-Person)
// @namespace    https://bondageprojects.com/
// @version      0.1.0-beta
// @description  Relationship-gated, local-only private appearance views for two Bondage Club players.
// @match        https://www.bondageprojects.com/*
// @match        https://bondageprojects.com/*
// @match        https://www.bondage-europe.com/*
// @match        https://bondage-europe.com/*
// @match        https://www.bondage-asia.com/*
// @match        https://bondage-asia.com/*
// @match        https://www.bondageeurope.com/*
// @match        https://bondageeurope.com/*
// @require      https://jomshir98.github.io/bondage-club-mod-sdk/bcmodsdk.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Paw Private Wardrobe, beta 0.1.0
 * Both participants install this userscript. Both must be in the same chatroom.
 * It changes only local character drawings; NEVER calls appearance sync/update.
 * Not a secrecy system: BC's server and other client mods may inspect game packets.
 * Does not change rules, permissions, restraints, or official game appearance.
 */
(() => {
  'use strict';
  const VERSION = '0.1.0-beta';
  const MARKER = 'PWRD1:';
  const MAX_ITEMS = 160;
  const MAX_PACKET_BYTES = 120000;
  const CHUNK_SIZE = 480;
  const RETRY_MS = 60000;
  const SAFE_COLOR = /^(?:#[\da-fA-F]{3,8}|[\w ,.#()-]{1,80})$/;
  const style = `
#pwr-launcher { position:fixed;z-index:2147483000;right:18px;bottom:112px;background:#582e69;color:#fff;border:1px solid #d3a7df;border-radius:100px;padding:11px 14px;box-shadow:0 5px 18px #0008;cursor:pointer;font:600 13px sans-serif }
#pwr-window {position:fixed;z-index:2147483001;right:16px;bottom:165px;width:min(440px,calc(100vw - 22px));max-height:min(78vh,720px);overflow:auto;background:#211a2b;color:#f6eafa;border:1px solid #aa79c9;border-radius:14px;box-shadow:0 15px 45px #000b;font:13px/1.45 sans-serif;padding:15px;box-sizing:border-box}
#pwr-window *{box-sizing:border-box} #pwr-window .pwr-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px}
#pwr-window h2 {font:700 17px sans-serif;margin:0} #pwr-window h3{font-size:13px;margin:12px 0 6px}
#pwr-window p {margin:6px 0;color:#d6c5dd} #pwr-window .pwr-row{display:flex;gap:7px;align-items:center;margin:7px 0;flex-wrap:wrap}
#pwr-window label{display:block;margin:8px 0 4px;color:#ebd7f3} #pwr-window select,#pwr-window input[type=text]{width:100%;padding:7px;border-radius:7px;background:#34263f;color:white;border:1px solid #755588}
#pwr-window button{padding:7px 10px;border-radius:7px;border:1px solid #9268b1;background:#55336a;color:#fff;cursor:pointer}
#pwr-window button:hover{background:#6a4181} #pwr-window button:disabled{opacity:.45;cursor:default}
#pwr-window .pwr-secondary{background:#34263f} #pwr-window .pwr-danger{background:#643039;border-color:#a45d6a}
#pwr-window .pwr-badge{background:#362b43;padding:7px 9px;border-radius:8px;color:#dbc4e4}
#pwr-window .pwr-line{border-top:1px solid #4c3659;margin:12px 0} #pwr-window .pwr-help{font-size:11px;color:#b9a8c7}
#pwr-window .pwr-flex{flex:1} #pwr-window .pwr-shrink{flex:0 0 auto}
`;
  const app = {
    ready: false, mod: null, enabled: true, allowPartnerEdits: true,
    selected: 0, panel: null, launcher: null, status: 'Starting...',
    profiles: {}, remote: {}, draft: null, lastSent: new Map(), peers: new Map(),
    packets: new Map(), clones: new WeakMap(), generation: 1,
    editorSubject: 0, editorGroup: '', editorAsset: '', lastAccount: 0,
  };
  const me = () => (typeof Player !== 'undefined' && Player && Number.isInteger(Player.MemberNumber) ? Player : null);
  const member = c => (c && Number.isInteger(c.MemberNumber) ? c.MemberNumber : 0);
  const inRoom = () => typeof ChatRoomCharacter !== 'undefined' && Array.isArray(ChatRoomCharacter) && !!me() && (typeof CurrentScreen === 'undefined' || CurrentScreen === 'ChatRoom');
  const occupants = () => inRoom() ? ChatRoomCharacter : [];
  const findChar = id => (id === member(me()) ? me() : occupants().find(c => member(c) === id));
  const cloneJson = v => JSON.parse(JSON.stringify(v));
  const key = (partner, subject) => `${partner}:${subject}`;
  const isOwnerOf = (owner, sub) => {
    if (!owner || !sub || owner === sub) return false;
    try { if (typeof sub.IsOwnedByCharacter === 'function' && sub.IsOwnedByCharacter(owner)) return true; } catch (_) {}
    try { if (owner === me() && typeof sub.IsOwnedByPlayer === 'function' && sub.IsOwnedByPlayer()) return true; } catch (_) {}
    const id = member(owner), sid = member(sub);
    if (sub.Ownership && Number(sub.Ownership.MemberNumber) === id && id > 0) return true;
    if (owner === me() && owner.SubmissivesList && typeof owner.SubmissivesList.has === 'function' && owner.SubmissivesList.has(sid)) return true;
    return false;
  };
  const related = (a, b) => !!(a && b && member(a) && member(b) && (isOwnerOf(a, b) || isOwnerOf(b, a)));
  const partners = () => occupants().filter(c => member(c) !== member(me()) && related(me(), c));
  const eligible = (id) => {
    const c = findChar(id); return !!(c && related(me(), c) && inRoom());
  };
  const assetGroups = (character) => {
    if (!character || typeof AssetGroup === 'undefined' || !Array.isArray(AssetGroup)) return [];
    const fam = character.AssetFamily || 'Female3DCG';
    return AssetGroup.filter(g => g && g.Category === 'Appearance' && (!g.Family || g.Family === fam))
      .sort((a,b) => a.Name.localeCompare(b.Name));
  };
  const groupByName = (c, groupName) => assetGroups(c).find(g => g.Name === groupName);
  const assetByName = (c, g, assetName) => {
    if (!g || !assetName) return null;
    const list = Array.isArray(g.Asset) ? g.Asset : [];
    let a = list.find(a => a && a.Name === assetName);
    if (!a && typeof AssetGet === 'function') {
      try { a = AssetGet(c.AssetFamily || 'Female3DCG', g.Name, assetName); } catch (_) {}
    }
    return a || null;
  };
  const colorString = value => {
    if (Array.isArray(value)) return value.slice(0, 20).map(v => (typeof v === 'string' && SAFE_COLOR.test(v) ? v : 'Default'));
    return (typeof value === 'string' && SAFE_COLOR.test(value)) ? value : 'Default';
  };
  const snapshot = c => {
    if (!c || !Array.isArray(c.Appearance)) return [];
    return c.Appearance.filter(it => it && it.Asset && it.Asset.Group && it.Asset.Group.Category === 'Appearance')
      .slice(0, MAX_ITEMS).map(it => ({group: it.Asset.Group.Name, asset: it.Asset.Name, color: colorString(it.Color)}));
  };
  const validateLook = (c, look) => {
    if (!c || !Array.isArray(look) || look.length > MAX_ITEMS) return null;
    const seen = new Set(), result = [];
    for (const raw of look) {
      if (!raw || typeof raw.group !== 'string' || typeof raw.asset !== 'string') return null;
      if (seen.has(raw.group)) return null;
      const group = groupByName(c, raw.group), a = assetByName(c, group, raw.asset);
      if (!group || !a || !group.Name || !a.Name) return null;
      seen.add(raw.group);
      result.push({group: group.Name, asset: a.Name, color: colorString(raw.color)});
    }
    for (const g of assetGroups(c)) if (!g.AllowNone && !seen.has(g.Name)) {
      const old = snapshot(c).find(it => it.group === g.Name);
      const a = old && assetByName(c, g, old.asset) ? old : (g.Asset && g.Asset[0] ? {group:g.Name,asset:g.Asset[0].Name,color:colorString(g.ColorSchema && g.ColorSchema[0])} : null);
      if (a) result.push(a);
    }
    return result;
  };
  const appearanceItem = (asset, color, previous) => {
    if (previous && previous.Asset === asset && JSON.stringify(previous.Color) === JSON.stringify(color)) return previous;
    try {
      if (typeof AppearanceItem !== 'undefined' && typeof AppearanceItem.fromAsset === 'function')
        return AppearanceItem.fromAsset(asset, { color });
    } catch (_) {}
    return {Asset: asset, Color: color, Difficulty: 0};
  };
  const appearanceFor = (c, look) => {
    const records = validateLook(c, look);
    if (!records) return null;
    const modified = (Array.isArray(c.Appearance) ? c.Appearance : []).filter(x => !x?.Asset?.Group || x.Asset.Group.Category !== 'Appearance');
    const oldByGroup = new Map((c.Appearance || []).filter(x => x?.Asset?.Group?.Category === 'Appearance').map(x => [x.Asset.Group.Name, x]));
    for (const record of records) {
      const group = groupByName(c, record.group), asset = assetByName(c, group, record.asset);
      if (!asset) continue;
      modified.push(appearanceItem(asset, record.color, oldByGroup.get(record.group)));
    }
    return modified;
  };
  const configKey = () => `pawPrivateWardrobe:v1:${member(me())}`;
  function loadSettings() {
    const id = member(me()); if (!id || id === app.lastAccount) return;
    app.lastAccount = id;
    app.profiles = {}; app.remote = {}; app.peers.clear(); app.clones = new WeakMap();
    try {
      const saved = JSON.parse(localStorage.getItem(configKey()) || '{}');
      if (saved && typeof saved === 'object') {
        app.enabled = saved.enabled !== false;
        app.allowPartnerEdits = saved.allowPartnerEdits !== false && saved.allowOwnerEdits !== false;
        app.selected = Number.isInteger(saved.selected) ? saved.selected : 0;
        app.profiles = saved.profiles && typeof saved.profiles === 'object' ? saved.profiles : {};
      }
    } catch (err) { console.warn('[Paw Private Wardrobe] Could not load settings:', err); }
  }
  function saveSettings() {
    if (!me()) return;
    try { localStorage.setItem(configKey(), JSON.stringify({enabled:app.enabled,allowPartnerEdits:app.allowPartnerEdits,selected:app.selected,profiles:app.profiles})); }
    catch(err) { console.warn('[Paw Private Wardrobe] Local save failed:',err); }
  }
  const currentPartner = () => {
    const ps = partners();
    if (ps.length === 1 && !ps.some(c => member(c) === app.selected)) app.selected = member(ps[0]);
    return ps.find(c => member(c) === app.selected) || null;
  };
  function effectiveLook(c) {
    if (!app.enabled || !c || !inRoom()) return null;
    const partner = currentPartner(); if (!partner) return null;
    const subject = member(c), mine = member(me()), pid = member(partner);
    if (subject !== mine && subject !== pid) return null;
    const peer = app.peers.get(pid);
    if (peer && !peer.enabled) return null;
    if (subject === pid && peer && !peer.accept) return null;
    if (app.draft && app.draft.subject === subject && app.draft.partner === pid) return app.draft.look;
    const k = key(pid, subject);
    if (subject === mine && !app.allowPartnerEdits) return app.profiles[k]?.look || null;
    return (app.remote[k] && app.remote[k].look) || (app.profiles[k] && app.profiles[k].look) || null;
  }
  function invalidate() { app.generation++; app.clones = new WeakMap(); }
  function refreshView() {
    invalidate();
    // DrawCharacter renders private clones on demand. No call to ChatRoomCharacterUpdate or ServerPlayerAppearanceSync.
  }
  const syncSend = (target, payload) => {
    if (!eligible(target) || typeof ServerSend !== 'function') return false;
    const raw = JSON.stringify({v:1,from:member(me()),to:target,...payload});
    if (raw.length > MAX_PACKET_BYTES) return false;
    let packed;
    try { packed = btoa(unescape(encodeURIComponent(raw))); } catch(_) { return false; }
    const total = Math.ceil(packed.length / CHUNK_SIZE);
    if (total > 128) return false;
    const tx = `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
    for (let i=0;i<total;i++) {
      // BC's targeted Hidden channel is intended for addon communication within a room.
      ServerSend('ChatRoomChat', {Type:'Hidden', Target:target, Content:`${MARKER}${tx}:${i+1}/${total}:${packed.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE)}`});
    }
    return true;
  };
  function sendState(partner, subject, look) {
    if (!eligible(partner)) return false;
    const peer = app.peers.get(partner);
    if (!peer || !peer.enabled) return false;
    if (subject === partner && !peer.accept) return false;
    const c = findChar(subject);
    const validated = validateLook(c, look);
    if (!validated) return false;
    // Either partner may style themselves or the other, provided the recipient enables it.
    if (subject !== member(me()) && subject !== partner) return false;
    return syncSend(partner, {type:'STATE',subject,look:validated});
  }
  function sendSavedLooks(id) {
    if (!app.enabled || !eligible(id)) return;
    for (const subject of [member(me()), id]) {
      const saved = app.profiles[key(id,subject)];
      if (!saved) continue;
      if (saved.removed) syncSend(id,{type:'RESET',subject});
      else if (Array.isArray(saved.look)) sendState(id,subject,saved.look);
    }
  }
  function sendHello(id, force=false) {
    const last = app.lastSent.get(id) || 0;
    if (!force && Date.now() - last < RETRY_MS) return;
    app.lastSent.set(id, Date.now());
    syncSend(id,{type:'HELLO',enabled:app.enabled,accept:app.allowPartnerEdits});
  }
  function parseChunk(data) {
    if (!data || typeof data.Content !== 'string' || !data.Content.startsWith(MARKER)) return false;
    const match = /^PWRD1:([\da-z]+):(\d+)\/(\d+):([\w+/=]+)$/i.exec(data.Content);
    if (!match) return true;
    const sender = Number(data.Sender || data.MemberNumber);
    if (!Number.isInteger(sender) || !eligible(sender)) return true;
    const i=Number(match[2]), n=Number(match[3]);
    if (n<1 || n>128 || i<1 || i>n || match[4].length > CHUNK_SIZE) return true;
    // Never trust the sender field included in a message body; use the game packet Sender.
    const packetKey = `${sender}:${match[1]}`;
    for (const [k,p] of app.packets) if (Date.now()-p.when > 30000) app.packets.delete(k);
    let p=app.packets.get(packetKey);
    if (!p) {
      if (app.packets.size > 24) app.packets.delete(app.packets.keys().next().value);
      p={n,when:Date.now(),parts:new Array(n)};app.packets.set(packetKey,p);
    }
    if (p.n!==n) {app.packets.delete(packetKey);return true;}
    p.parts[i-1]=match[4];
    if (p.parts.filter(Boolean).length === n) {
      app.packets.delete(packetKey);
      try {
        const encoded=p.parts.join('');
        if (encoded.length>MAX_PACKET_BYTES*2) return true;
        const payload=JSON.parse(decodeURIComponent(escape(atob(encoded))));
        handleMessage(sender,payload);
      } catch(e) {console.warn('[Paw Private Wardrobe] Ignored malformed packet:',e);}
    }
    return true;
  }
  function handleMessage(sender,payload) {
    if (!payload || payload.v!==1 || payload.from!==sender || payload.to!==member(me()) || !eligible(sender)) return;
    if (payload.type==='HELLO') {
      const wasKnown = app.peers.has(sender);
      app.peers.set(sender,{at:Date.now(),enabled:payload.enabled!==false,accept:payload.accept!==false});
      // Throttled response avoids an infinite HELLO/HELLO loop.
      if (app.enabled) {
        sendHello(sender,!wasKnown);
        if (payload.enabled !== false) sendSavedLooks(sender);
      }
      if (app.panel && app.panel.style.display!=='none') renderPanel();
      return;
    }
    if (payload.type==='DISABLED') {
      app.remote[key(sender,member(me()))] = null;
      app.remote[key(sender,sender)] = null;
      app.peers.set(sender,{at:Date.now(),enabled:false,accept:false});
      refreshView(); if(app.panel)renderPanel();return;
    }
    if (!['STATE','RESET'].includes(payload.type) || !app.enabled) return;
    const subject = Number(payload.subject), mine=member(me());
    if (subject!==mine && subject!==sender) return;
    if (subject===mine && !app.allowPartnerEdits && payload.type!=='RESET') return;
    // Sender may style their own character or the paired recipient, after opt-in.
    if (subject!==sender && subject!==mine) return;
    if (payload.type==='RESET') {
      delete app.remote[key(sender,subject)];
      refreshView(); if (app.panel && app.panel.style.display!=='none') renderPanel();
      return;
    }
    if (!Array.isArray(payload.look)) return;
    const look=validateLook(findChar(subject),payload.look);
    if (!look) return;
    app.remote[key(sender,subject)]={look,received:Date.now()};
    app.peers.set(sender,{at:Date.now(),enabled:true,accept:true});
    refreshView(); if (app.panel && app.panel.style.display!=='none') renderPanel();
  }
  function addHooks() {
    if (!globalThis.bcModSdk || typeof globalThis.bcModSdk.registerMod !== 'function') return false;
    try {
      app.mod = globalThis.bcModSdk.registerMod({name:'PawPrivateWardrobe',fullName:'Paw Private Wardrobe',version:'0.1.0'});
      app.mod.hookFunction('ChatRoomMessage', 15, (args,next) => {
        try { if (parseChunk(args[0])) return; } catch(err) {console.error('[Paw Private Wardrobe] Message error:',err);}
        return next(args);
      });
      // Rebuild private canvases after any ordinary BC appearance/pose refresh.
      app.mod.hookFunction('CharacterLoadCanvas', 10, (args,next) => {
        const result=next(args);
        const c=args[0];
        if (c && !c.__PawPrivateReplica) app.clones.delete(c);
        return result;
      });
      // A detached character clone is drawn instead of changing the live Appearance or Canvas.
      app.mod.hookFunction('DrawCharacter', 15, (args,next) => {
        const C=args[0];
        try {
          if (app.enabled && C && member(C) && eligiblePartnerForCharacter(C)) {
            const look=effectiveLook(C);
            if (look) {
              const clone=getRenderClone(C,look);
              if (clone && clone.Canvas) return next([clone,...args.slice(1)]);
            }
          }
        } catch(err) {console.warn('[Paw Private Wardrobe] Render fallback to public:',err);}
        return next(args);
      });
      return true;
    } catch(err) {console.error('[Paw Private Wardrobe] Hook registration failed',err);return false;}
  }
  function eligiblePartnerForCharacter(c) {
    const p=currentPartner();
    return !!p && (member(c)===member(me()) || member(c)===member(p));
  }
  function getRenderClone(c,look) {
    const cached=app.clones.get(c);
    // Stable array reference is a cheap draw-frame cache key. Edits always replace the array.
    if (cached && cached.lookRef===look && cached.generation===app.generation)
      return cached.pending ? null : cached.clone;
    const appearance=appearanceFor(c,look);
    if (!appearance) return null;
    // Never assign the modified appearance to the real Player or room character.
    const replica=Object.assign(Object.create(Object.getPrototypeOf(c)),c);
    replica.Appearance=appearance;
    replica.Canvas=document.createElement('canvas');
    replica.Canvas.width=c.Canvas?.width || 500;
    replica.Canvas.height=c.Canvas?.height || 1000;
    replica.CanvasBlink=document.createElement('canvas');
    replica.CanvasBlink.width=replica.Canvas.width;
    replica.CanvasBlink.height=replica.Canvas.height;
    replica.DrawAppearance=appearance;
    replica.__PawPrivateReplica=true;
    if (typeof CharacterLoadCanvas!=='function') return null;
    const record={lookRef:look,generation:app.generation,pending:true,clone:null};
    app.clones.set(c,record);
    try {
      const result=CharacterLoadCanvas(replica);
      if (result && typeof result.then==='function') {
        Promise.resolve(result).then(()=>{
          if(app.clones.get(c)===record){record.clone=replica;record.pending=false;}
        }).catch(e=>{
          record.pending=false;
          console.warn('[Paw Private Wardrobe] Async canvas failed:',e);
        });
        return null;
      }
      record.clone=replica;
      record.pending=false;
      return replica;
    } catch (err) {
      record.pending=false;
      console.warn('[Paw Private Wardrobe] Could not create safe private render:',err);
      return null;
    }
  }
  function beginDraft(subject) {
    const partner=currentPartner(), c=findChar(subject); if (!partner||!c) return;
    const pid=member(partner);
    const saved=app.profiles[key(pid,subject)]?.look || app.remote[key(pid,subject)]?.look;
    app.draft={partner:pid,subject,look:cloneJson(saved || snapshot(c))};
    app.editorSubject=subject;
    app.editorGroup=assetGroups(c)[0]?.Name || '';
    refreshView();renderPanel();
  }
  function modifyDraft(callback) {
    if (!app.draft) return;
    const c=findChar(app.draft.subject);
    const modified=cloneJson(app.draft.look);
    callback(modified,c);
    const checked=validateLook(c,modified);
    if (!checked){setStatus('This combination is not supported by the local BC assets.');return;}
    app.draft.look=checked;
    refreshView();renderPanel();
  }
  function setStatus(text) {app.status=text;const el=document.getElementById('pwr-status');if(el)el.textContent=text;}
  const node=(tag,text,cls) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const append=(parent,...children)=>{children.forEach(c=>parent.appendChild(c));return parent;};
  const button=(text,fn,cls='')=>{const b=node('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
  const label=(parent,text)=>append(parent,node('label',text));
  const option=(value,text)=>{const o=node('option',text);o.value=String(value);return o;};
  function makeSelect(parent,values,value,fn) {
    const el=node('select');for(const [v,t] of values)el.appendChild(option(v,t));el.value=String(value);
    el.addEventListener('change',()=>fn(el.value));parent.appendChild(el);return el;
  }
  function checkbox(parent,text,checked,fn) {
    const wrap=node('label');wrap.style.display='flex';wrap.style.alignItems='center';wrap.style.gap='8px';
    const input=document.createElement('input');input.type='checkbox';input.checked=checked;
    input.addEventListener('change',()=>fn(input.checked));append(wrap,input,node('span',text));parent.appendChild(wrap);
  }
  function renderPanel() {
    const panel=app.panel;if(!panel||panel.style.display==='none')return;
    panel.replaceChildren();
    const head=node('div',undefined,'pwr-head');append(head,node('h2','🐾 Paw Private Wardrobe'),button('×',()=>{panel.style.display='none'},'pwr-secondary'));append(panel,head);
    append(panel,node('p','Only you and your linked partner can render the private look when both run the addon. Public BC clothes and body remain unchanged.'));
    if(!me()||!inRoom()) {append(panel,node('div','Enter a BC chatroom to use the two-person wardrobe.','pwr-badge'));return;}
    const available=partners();
    if(!available.length){append(panel,node('div','No BC owner/submissive relationship found among players in this room.','pwr-badge'));return;}
    currentPartner();
    label(panel,'Private partner');
    makeSelect(panel,available.map(c=>[member(c),`${c.Name || member(c)} (#${member(c)})`]),app.selected,v=>{
      app.selected=Number(v);app.draft=null;app.editorGroup='';saveSettings();refreshView();sendHello(app.selected,true);renderPanel();
    });
    const partner=currentPartner(), pid=member(partner), connected=app.peers.get(pid);
    const state=!connected?'Partner addon not yet detected':connected.enabled?'Partner addon detected':'Partner has disabled private sharing';
    append(panel,node('div',state,'pwr-badge'));
    const toggles=node('div');
    checkbox(toggles,'Enable private appearances on my screen',app.enabled,v=>{
      app.enabled=v;saveSettings();refreshView();syncSend(pid,{type:v?'HELLO':'DISABLED',enabled:v});renderPanel();
    });
    checkbox(toggles,'Allow my linked partner to style my private appearance',app.allowPartnerEdits,v=>{
      app.allowPartnerEdits=v;saveSettings();app.remote[key(pid,member(me()))]=null;refreshView();sendHello(pid,true);renderPanel();
    });append(panel,toggles);
    const allowedTargets=[[member(me()),'My appearance (shown to partner)']];
    allowedTargets.push([pid,`${partner.Name}'s private appearance`]);
    label(panel,'Who to style');
    makeSelect(panel,allowedTargets,allowedTargets.some(x=>x[0]===app.editorSubject)?app.editorSubject:allowedTargets[0][0],v=>beginDraft(Number(v)));
    if (!app.draft || app.draft.partner!==pid || !allowedTargets.some(x=>x[0]===app.draft.subject)) {
      app.editorSubject=allowedTargets.some(x=>x[0]===app.editorSubject)?app.editorSubject:allowedTargets[0][0];
      const c=findChar(app.editorSubject),saved=app.profiles[key(pid,app.editorSubject)]?.look || app.remote[key(pid,app.editorSubject)]?.look;
      app.draft={partner:pid,subject:app.editorSubject,look:cloneJson(saved || snapshot(c))};
    }
    const c=findChar(app.draft.subject),groups=assetGroups(c);
    if(!c||!groups.length){append(panel,node('p','This BC version does not expose appearance asset groups.'));return;}
    if(!groups.some(g=>g.Name===app.editorGroup))app.editorGroup=groups[0].Name;
    const group=groupByName(c,app.editorGroup);
    const current=app.draft.look.find(r=>r.group===group.Name);
    label(panel,'Appearance group (includes body, hair, eyes, and clothes)');
    makeSelect(panel,groups.map(g=>[g.Name,`${g.Name}${g.Clothing?' · clothing':' · body / cosmetic'}`]),app.editorGroup,v=>{app.editorGroup=v;renderPanel();});
    label(panel,'Asset');
    const assetOptions=(group.Asset||[]).filter(a=>a&&a.Name).map(a=>[a.Name,a.Name]);
    if(group.AllowNone)assetOptions.unshift(['','(nothing / remove)']);
    const selectedAsset=current?.asset||'';
    makeSelect(panel,assetOptions,selectedAsset,v=>modifyDraft((list)=>{
      const i=list.findIndex(r=>r.group===group.Name);
      if(i>=0)list.splice(i,1);
      if(v)list.push({group:group.Name,asset:v,color:current?.color||'Default'});
    }));
    label(panel,'Color (BC color or hex; comma-separated for multiple layers)');
    const color=node('input');color.type='text';color.value=Array.isArray(current?.color)?current.color.join(', '):current?.color||'Default';
    color.placeholder='Default or #E8B5ED';append(panel,color);
    append(panel,button('Apply color to preview',()=>modifyDraft((list)=>{
      const r=list.find(r=>r.group===group.Name);if(!r)return;
      const raw=color.value.trim();r.color=raw.includes(',')?raw.split(',').map(x=>x.trim()).slice(0,20):raw;
    })));
    const line=node('div',undefined,'pwr-line');append(panel,line);
    const quick=node('div',undefined,'pwr-row');
    append(quick,button('Remove all clothing',()=>modifyDraft((list,character)=>{
      const toRemove=new Set(assetGroups(character).filter(g=>g.Clothing&&g.AllowNone).map(g=>g.Name));
      for(let i=list.length-1;i>=0;i--)if(toRemove.has(list[i].group))list.splice(i,1);
    })),button('Copy public look',()=>{app.draft.look=snapshot(c);refreshView();renderPanel();},'pwr-secondary'));
    append(panel,quick);
    append(panel,node('p','Changes preview locally while you edit. Press Save & share to send them to your partner.','pwr-help'));
    const actions=node('div',undefined,'pwr-row');
    append(actions,button('Save & share',()=>{
      const look=validateLook(c,app.draft.look);if(!look){setStatus('Invalid appearance.');return;}
      app.profiles[key(pid,app.draft.subject)]={look,changed:Date.now()};
      // Discard remote override if this client saved a newer look.
      delete app.remote[key(pid,app.draft.subject)];
      saveSettings();refreshView();
      setStatus(sendState(pid,app.draft.subject,look)?'Saved locally and sent to your partner.':'Saved locally. Partner must be present and eligible for sync.');
    }),button('Cancel preview',()=>{app.draft=null;refreshView();renderPanel();},'pwr-secondary'));
    append(panel,actions);
    append(panel,button('Remove private look for selected person',()=>{
      app.profiles[key(pid,app.draft.subject)]={removed:true,changed:Date.now()};delete app.remote[key(pid,app.draft.subject)];
      app.draft={partner:pid,subject:app.draft.subject,look:snapshot(c)};
      saveSettings();refreshView();if(app.peers.get(pid)?.enabled)syncSend(pid,{type:'RESET',subject:app.draft.subject});setStatus('Private look reset locally and queued for partner synchronization.');renderPanel();
    },'pwr-danger'));
    append(panel,node('div',app.status,'pwr-help'));const stat=panel.lastElementChild;stat.id='pwr-status';
    append(panel,node('p','Beta: view-only. Does not alter actual BC outfits, permission checks, interactions, restraints, or server records. Private packets are not end-to-end encrypted.','pwr-help'));
  }
  function installUI() {
    if(!document.body || app.launcher)return;
    const s=node('style');s.textContent=style;document.head.appendChild(s);
    app.launcher=button('🐾 Private Wardrobe',()=>{app.panel.style.display=app.panel.style.display==='none'?'block':'none';renderPanel();});
    app.launcher.id='pwr-launcher';document.body.appendChild(app.launcher);
    app.panel=node('div');app.panel.id='pwr-window';app.panel.style.display='none';document.body.appendChild(app.panel);
  }
  function heartbeat() {
    if(!app.ready)return;
    loadSettings();
    const ps=partners();
    const chosen=currentPartner();
    for(const c of ps) if(app.enabled)sendHello(member(c));
    if(chosen && app.panel && app.panel.style.display!=='none') {
      // Avoid forcibly re-rendering text inputs while user is editing.
      const indicator=app.panel.querySelector('.pwr-badge');
      if(indicator){const peer=app.peers.get(member(chosen));indicator.textContent=peer?.enabled?'Partner addon detected':peer?'Partner has disabled private sharing':'Partner addon not yet detected';}
    }
    if(!ps.length) {app.peers.clear();app.remote={};if(app.draft)app.draft=null;refreshView();}
  }
  function init() {
    if(app.ready)return;
    if(!me())return;
    loadSettings();
    if(!addHooks()) {app.status='Requires BC ModSDK / bcModSdk to be loaded first.';return;}
    app.ready=true;app.status='Ready (beta)';installUI();heartbeat();
    globalThis.PawPrivateWardrobe = Object.freeze({
      version:VERSION,
      open(){app.panel.style.display='block';renderPanel();},
      status(){return {ready:app.ready,selected:app.selected,enabled:app.enabled,partnerDetected:!!app.peers.get(app.selected),partnerCount:partners().length};},
      refresh(){refreshView();},
      // Emergency local-only switch, never changes public appearance.
      disable(){const partner=currentPartner();app.enabled=false;app.draft=null;saveSettings();refreshView();if(partner)syncSend(member(partner),{type:'DISABLED'});if(app.panel)renderPanel();},
    });
    console.log(`[Paw Private Wardrobe] ${VERSION} initialized`);
  }
  if (globalThis.PawPrivateWardrobe) return;
  const timer=setInterval(()=>{if(!app.ready)init();else heartbeat();},4000);
  init();
})();
