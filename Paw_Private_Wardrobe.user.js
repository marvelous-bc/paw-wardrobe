// ==UserScript==
// @name         Paw Private Wardrobe (Two-Person)
// @namespace    https://bondageprojects.com/
// @version      0.2.2-beta
// @description  Private two-person appearances with explicit read-only viewing and full wardrobe studio.
// @match        https://*.bondageprojects.elementfx.com/R*
// @match        https://*.bondageprojects.com/R*
// @match        https://*.bondage-europe.com/R*
// @match        https://*.bondageeurope.com/R*
// @match        https://*.bondage-asia.com/club/*
// @require      https://jomshir98.github.io/bondage-club-mod-sdk/bcmodsdk.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Paw Private Wardrobe, beta 0.2.2
 * Both participants install this userscript. Both must be in the same chatroom.
 * Default state is VIEWING. Editing requires deliberately opening the studio.
 * A studio draft NEVER shadows incoming saved partner looks in the chatroom.
 * It changes only local character drawings; NEVER calls appearance sync/update.
 * Not a secrecy system: BC's server and other client mods may inspect game packets.
 * Does not change rules, permissions, restraints, or official game appearance.
 */
(() => {
  'use strict';
  const VERSION = '0.2.2-beta';
  const MARKER = 'PWRD1:';
  const MAX_ITEMS = 160;
  const MAX_PACKET_BYTES = 120000;
  const CHUNK_SIZE = 480;
  const RETRY_MS = 60000;
  const SAFE_COLOR = /^(?:#[\da-fA-F]{3,8}|[\w ,.#()-]{1,80})$/;
  const style = `
/* Paw Private Wardrobe – Moonlit Atelier */
#pwr-launcher{position:fixed;z-index:2147483000;right:18px;bottom:112px;padding:12px 17px;border-radius:999px;border:1px solid #d4a5f0;background:linear-gradient(120deg,#513071,#9251a4);color:#fff;font:700 13px/1.3 system-ui,-apple-system,sans-serif;box-shadow:0 9px 24px #11071bc0, inset 0 1px #ffffff38;cursor:pointer;transition:transform .16s,box-shadow .16s}
#pwr-launcher:hover{transform:translateY(-2px);box-shadow:0 13px 29px #100716dc, inset 0 1px #ffffff50}
#pwr-window,#pwr-studio{box-sizing:border-box;color:#f8f3ff;font:14px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.01em}
#pwr-window *,#pwr-studio *{box-sizing:border-box}
#pwr-window{position:fixed;z-index:2147483001;right:16px;bottom:165px;width:min(435px,calc(100vw - 22px));max-height:min(80vh,780px);overflow:auto;background:linear-gradient(160deg,#2e223d,#181220);border:1px solid #895eac;border-radius:18px;box-shadow:0 25px 70px #09030dd9;padding:18px}
#pwr-window .pwr-head,#pwr-studio .pwr-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
#pwr-window h2,#pwr-studio h2{font:750 19px/1.25 system-ui;margin:0;letter-spacing:-.025em}
#pwr-window h3,#pwr-studio h3{font:700 14px/1.3 system-ui;margin:0}
#pwr-window p,#pwr-studio p{margin:7px 0;color:#cabcd8}
#pwr-window .pwr-row,#pwr-studio .pwr-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:8px 0}
#pwr-window label,#pwr-studio label{display:block;margin:6px 0 5px;color:#dfcee9;font-weight:550}
#pwr-window select,#pwr-window input[type=text],#pwr-studio select,#pwr-studio input[type=text],#pwr-studio input[type=search]{width:100%;min-height:39px;padding:9px 11px;border-radius:11px;background:#1d1529;color:#f7efff;border:1px solid #614b76;font:inherit;outline:none;transition:border-color .16s,box-shadow .16s}
#pwr-window select:focus,#pwr-window input:focus,#pwr-studio select:focus,#pwr-studio input:focus{border-color:#c59aec;box-shadow:0 0 0 3px #ad72e033}
#pwr-window button,#pwr-studio button{padding:9px 13px;min-height:37px;border-radius:10px;border:1px solid #9265ae;background:linear-gradient(180deg,#8957a1,#633b7d);color:#fff;cursor:pointer;font:600 13px/1.25 system-ui,-apple-system,sans-serif;box-shadow:inset 0 1px #ffffff19;transition:background .15s,transform .15s,border-color .15s}
#pwr-window button:hover,#pwr-studio button:hover{background:linear-gradient(180deg,#a575ba,#795093);border-color:#dfb9f1;transform:translateY(-1px)}
#pwr-window button:focus-visible,#pwr-studio button:focus-visible{outline:2px solid #edcaff;outline-offset:2px}
#pwr-window button:disabled,#pwr-studio button:disabled{opacity:.4;cursor:default;transform:none}
#pwr-window .pwr-secondary,#pwr-studio .pwr-secondary{background:#312440;border-color:#665079}
#pwr-window .pwr-secondary:hover,#pwr-studio .pwr-secondary:hover{background:#493356}
#pwr-window .pwr-danger,#pwr-studio .pwr-danger{background:#492734;border-color:#aa596c;color:#ffd9df}
#pwr-window .pwr-danger:hover,#pwr-studio .pwr-danger:hover{background:#673342}
#pwr-window .pwr-badge,#pwr-studio .pwr-badge{background:#382947;padding:9px 11px;border-radius:10px;color:#e1cee9;border:1px solid #614777}
#pwr-window .pwr-line,#pwr-studio .pwr-line{border-top:1px solid #493758;margin:12px 0}
#pwr-window .pwr-help,#pwr-studio .pwr-help{font-size:12px;color:#bdaeca;line-height:1.5}
#pwr-studio{position:fixed;inset:0;z-index:2147483100;background:#090411e8;display:flex;align-items:center;justify-content:center;padding:12px}
#pwr-studio .pwr-shell{width:min(1480px,100%);height:min(920px,96dvh);display:flex;flex-direction:column;overflow:hidden;background:#14101e;border:1px solid #8a64a9;border-radius:21px;box-shadow:0 25px 85px #040207eb,0 0 0 1px #e3baff20}
#pwr-studio .pwr-toolbar{flex:0 0 auto;padding:14px 20px 12px;background:linear-gradient(100deg,#30203f,#241a32 62%,#312344);border-bottom:1px solid #684e80;box-shadow:0 4px 18px #0002}
#pwr-studio .pwr-brand{display:flex;align-items:center;gap:12px;min-width:0}
#pwr-studio .pwr-brand-icon{display:grid;place-items:center;flex:0 0 45px;height:45px;border-radius:14px;background:linear-gradient(145deg,#9f66bb,#593974);font-size:24px;border:1px solid #d8aee4a8;box-shadow:inset 0 1px #ffffff44,0 5px 15px #0904116b}
#pwr-studio .pwr-eyebrow{font-size:10px;color:#d9abf5;font-weight:800;letter-spacing:.17em;text-transform:uppercase}
#pwr-studio .pwr-subhead{color:#cbb8dd;font-size:12px;margin-top:4px}
#pwr-studio .pwr-top-actions{margin:0;gap:8px}
#pwr-studio .pwr-top-actions button{min-height:40px;padding:9px 16px}
#pwr-studio .pwr-save{background:linear-gradient(130deg,#ad6ac4,#8553a9);border-color:#d39bea;box-shadow:0 4px 14px #9a57ad34}
#pwr-studio .pwr-state{display:inline-flex;align-items:center;gap:6px;background:#2f3e37;border:1px solid #527d6a;border-radius:99px;color:#bff2d0;font-size:11px;font-weight:700;letter-spacing:.05em;padding:6px 10px;white-space:nowrap}
#pwr-studio .pwr-main{display:grid;grid-template-columns:minmax(320px,42%) minmax(0,58%);min-height:0;flex:1}
#pwr-studio .pwr-stage{display:flex;flex-direction:column;min-width:0;min-height:0;padding:16px;gap:11px;background:linear-gradient(170deg,#292037,#1e182b);border-right:1px solid #463453}
#pwr-studio .pwr-stage-title{display:flex;align-items:center;justify-content:space-between;gap:8px}
#pwr-studio .pwr-label-upper{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#d5b8e6;font-weight:800}
#pwr-studio .pwr-mini-tag{border:1px solid #ffffff50;background:#1a132396;border-radius:999px;padding:5px 10px;color:#f4deff;font-size:10px;font-weight:700;letter-spacing:.06em}
#pwr-studio .pwr-scene{position:relative;flex:1;min-height:180px;min-width:0;overflow:auto;overscroll-behavior:contain;border:1px solid #9364b5;border-radius:16px;background:linear-gradient(140deg,#392d51,#76518c 45%,#261e38);box-shadow:inset 0 0 0 1px #ffffff1b,0 12px 30px #0c061d77;scrollbar-color:#a37cb9 #21182d;scrollbar-width:thin}
#pwr-studio .pwr-scene-inner{display:grid;place-items:center;width:max-content;height:max-content;min-width:100%;min-height:100%;margin:auto}
#pwr-studio .pwr-scene canvas{display:block;position:relative;flex:none;pointer-events:none;max-width:none;max-height:none;filter:drop-shadow(0 8px 9px #170a26a0)}
#pwr-studio .pwr-backdrop-card{flex:0 0 auto;border:1px solid #574064;border-radius:14px;padding:12px;background:#231b30;box-shadow:inset 0 1px #ffffff0b}
#pwr-studio .pwr-backdrop-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:8px 0 0}
#pwr-studio .pwr-backdrop-row select{width:auto;flex:1;min-width:140px;max-width:255px}
#pwr-studio .pwr-size-select{max-width:110px!important;flex:0 0 110px!important}
#pwr-studio .pwr-backdrop-card .pwr-help{margin:8px 1px 0}
#pwr-studio .pwr-backdrop-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
#pwr-studio .pwr-custom-toggle{padding:5px 9px!important;min-height:26px!important;font-size:11px!important}
#pwr-studio .pwr-background[hidden]{display:none!important}
#pwr-studio .pwr-background{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 0}
#pwr-studio .pwr-background input[type=text]{flex:1;min-width:150px}
#pwr-studio .pwr-background input[type=file]{max-width:155px;color:#dccae5;font-size:11px}
#pwr-studio .pwr-side{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:auto;gap:11px;padding:16px 17px;background:linear-gradient(165deg,#191422,#17111f);scrollbar-color:#704d81 #201528;scrollbar-width:thin}
#pwr-studio .pwr-tabs{display:flex;gap:6px;flex:0 0 auto;flex-wrap:wrap;background:#251a30;border:1px solid #584268;padding:5px;border-radius:13px}
#pwr-studio .pwr-tab{flex:1;min-width:66px;background:transparent!important;border:1px solid transparent!important;color:#c8b4d6;border-radius:9px;box-shadow:none}
#pwr-studio .pwr-tab:hover{background:#44314f!important;color:#fff}
#pwr-studio .pwr-tab.pwr-active{background:linear-gradient(145deg,#9a63b4,#663e83)!important;border-color:#d5a4ed!important;color:#fff;box-shadow:0 3px 10px #09041180,inset 0 1px #ffffff22}
#pwr-studio .pwr-section{background:#251c30;border:1px solid #543f63;border-radius:14px;padding:12px 13px;box-shadow:inset 0 1px #ffffff10;min-width:0}
#pwr-studio .pwr-section-top{display:flex;align-items:center;gap:9px;margin-bottom:10px}
#pwr-studio .pwr-step{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;border-radius:8px;background:#513562;color:#edc5ff;font-size:11px;font-weight:800;border:1px solid #8f6a9f}
#pwr-studio .pwr-section .pwr-head{margin-bottom:10px}
#pwr-studio .pwr-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;max-height:138px;overflow:auto;padding:2px;scrollbar-color:#755384 #231931;scrollbar-width:thin}
#pwr-studio .pwr-group{min-height:42px;padding:9px 5px!important;font-size:11px!important;text-align:center;overflow-wrap:anywhere;background:#322640!important;border-color:#634a76!important;color:#dbcee8}
#pwr-studio .pwr-group:hover{background:#533b66!important}
#pwr-studio .pwr-group.pwr-active{background:linear-gradient(145deg,#8554a1,#684582)!important;border-color:#d6a9ea!important;box-shadow:0 0 0 1px #d6a9ea22,inset 0 1px #ffffff3b}
#pwr-studio .pwr-assets-section{display:flex;flex-direction:column;flex:1 1 220px;min-height:210px;overflow:hidden}
#pwr-studio .pwr-assets-section input[type=search]{margin-bottom:9px}
#pwr-studio .pwr-asset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:minmax(72px,auto);gap:8px;overflow:auto;min-height:85px;align-content:start;flex:1;padding:2px 3px;scrollbar-color:#755384 #231931;scrollbar-width:thin}
#pwr-studio .pwr-asset{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:0;font-size:11px!important;background:#30253b!important;border-color:#614c73!important;overflow-wrap:anywhere;text-align:center;position:relative}
#pwr-studio .pwr-asset:hover{background:#493355!important}
#pwr-studio .pwr-asset.pwr-active{background:linear-gradient(145deg,#74478a,#523568)!important;border-color:#e8b7f6!important;box-shadow:inset 0 0 0 1px #deb1e733,0 0 12px #a765c322}
#pwr-studio .pwr-asset.pwr-active:after{content:'✓';position:absolute;top:5px;right:7px;font-size:12px;color:#fad7ff}
#pwr-studio .pwr-asset-icon{font-size:18px;opacity:.8}
#pwr-studio .pwr-asset-preview{display:block;width:auto;max-width:100%;height:100px;object-fit:contain;pointer-events:none}
#pwr-studio .pwr-pager{margin:9px 0 0!important;justify-content:center;gap:12px!important;color:#cab9d7;font-size:12px}
#pwr-studio .pwr-pager button{min-width:38px;min-height:33px}
#pwr-studio .pwr-colors-section{flex:0 0 auto}
#pwr-studio .pwr-colorbar{display:flex;gap:9px;align-items:end;flex-wrap:wrap}
#pwr-studio .pwr-colorbar .pwr-grow{flex:1;min-width:140px}
#pwr-studio .pwr-colorbar input[type=color]{height:40px;width:43px;padding:2px;border:1px solid #a37db9;background:#32243f;border-radius:10px;cursor:pointer}
#pwr-studio .pwr-bottom{flex:0 0 auto;border-top:1px solid #5e466f;padding:11px 17px;background:#22192c}
#pwr-studio .pwr-bottom-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
#pwr-studio .pwr-bottom .pwr-row{margin:0}
#pwr-studio .pwr-bottom .pwr-help{margin:5px 0 0}
#pwr-studio .pwr-pale{color:#ffdac9;background:linear-gradient(125deg,#50343d,#442737);border:1px solid #a85d75;border-radius:12px;padding:11px;margin:11px 0 0}
#pwr-studio .pwr-pale .pwr-row{margin:7px 0 0}
#pwr-studio .pwr-pale button{font-size:12px}
@media (max-width:920px){#pwr-studio .pwr-main{grid-template-columns:minmax(265px,40%) minmax(0,60%)}#pwr-studio .pwr-side{padding:12px}#pwr-studio .pwr-stage{padding:12px}}
@media (max-width:700px){#pwr-studio{padding:4px}#pwr-studio .pwr-shell{height:99dvh;border-radius:13px}#pwr-studio .pwr-toolbar{padding:9px 11px}#pwr-studio .pwr-brand-icon{width:35px;height:35px;flex-basis:35px;font-size:20px}#pwr-studio h2{font-size:16px}#pwr-studio .pwr-main{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(220px,43%) minmax(300px,57%)}#pwr-studio .pwr-stage{padding:9px;gap:6px;overflow-y:auto;scrollbar-width:thin}#pwr-studio .pwr-scene{flex:0 0 190px;min-height:190px}#pwr-studio .pwr-stage-title{display:none}#pwr-studio .pwr-backdrop-card{padding:8px}#pwr-studio .pwr-backdrop-row{gap:6px}#pwr-studio .pwr-backdrop-row select{max-width:200px;min-width:100px}#pwr-studio .pwr-background input[type=file]{max-width:120px}#pwr-studio .pwr-side{padding:9px;gap:7px}#pwr-studio .pwr-section{padding:8px}#pwr-studio .pwr-groups{max-height:90px}#pwr-studio .pwr-asset-grid{grid-auto-rows:minmax(54px,auto)}#pwr-studio .pwr-bottom{padding:8px 11px}#pwr-studio .pwr-top-actions button{min-height:32px;padding:7px 9px;font-size:11px}}
@media (prefers-reduced-motion:reduce){#pwr-studio button,#pwr-studio input,#pwr-launcher{transition:none!important;transform:none!important}}
`;
  const app = {
    ready: false, mod: null, enabled: true, allowPartnerEdits: true,
    selected: 0, panel: null, launcher: null, status: 'Starting...',
    profiles: {}, remote: {}, studio: null, studioPanel: null, studioClones: new WeakMap(), studioResizeObserver: null, studioFit: null, previewSize: 380, showBackgroundTools: false, background: 'violet', customBackground: '', sessionBackground: '', showThumbnails: false, lastSent: new Map(), peers: new Map(),
    packets: new Map(), clones: new WeakMap(), generation: 1,
    editorSubject: 0, editorGroup: '', editorAsset: '', editorTab: 'Clothing', editorPage: 0, editorSearch: '', lastAccount: 0,
    diagnostics: {dropped:[], lastEditSkipped:[], render:'not yet attempted', lastError:'', sync:{stateSent:0,stateReceived:0,ackReceived:0,ackRejected:0,lastSend:null,lastReceive:null,lastAck:null,lastProblem:''}},
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
  // Normalize a *whole look* without letting stale/out-of-family addon records
  // prevent the user from editing an otherwise valid single appearance group.
  // Unknown public appearance records are preserved by appearanceFor() when rendering.
  const normalizeLook = (c, look) => {
    if (!c || !Array.isArray(look) || look.length > MAX_ITEMS) return {look:null, dropped:['Invalid or oversized wardrobe']};
    const seen=new Set(), result=[], dropped=[];
    for (const raw of look) {
      if (!raw || typeof raw.group !== 'string' || typeof raw.asset !== 'string') {
        dropped.push('Malformed appearance entry'); continue;
      }
      if (seen.has(raw.group)) { dropped.push(`${raw.group}: duplicate entry`); continue; }
      seen.add(raw.group);
      const group=groupByName(c,raw.group);
      const asset=assetByName(c,group,raw.asset);
      if (!group || !asset || !group.Name || !asset.Name) {
        dropped.push(`${raw.group}/${raw.asset}: unavailable in this client`);
        continue;
      }
      result.push({group:group.Name,asset:asset.Name,color:colorString(raw.color)});
    }
    // Mandatory body groups are restored even if a stale saved profile omitted them.
    for (const g of assetGroups(c)) if (!g.AllowNone && !result.some(it=>it.group===g.Name)) {
      const publicItem=(c.Appearance||[]).find(x=>x?.Asset?.Group?.Name===g.Name);
      const existing=publicItem && assetByName(c,g,publicItem.Asset.Name);
      // Public appearance may use a newer/addon-only mandatory body asset.
      // Leave it untouched rather than replacing it with a random body shape.
      if (publicItem && !existing) {
        dropped.push(`${g.Name}/${publicItem.Asset.Name}: retaining unregistered public body asset`);
        continue;
      }
      const fallback=existing || (Array.isArray(g.Asset)?g.Asset.find(x=>x?.Name):null);
      if (fallback)result.push({group:g.Name,asset:fallback.Name,color:colorString(existing?publicItem.Color:g.ColorSchema?.[0])});
      else dropped.push(`${g.Name}: missing mandatory base asset`);
    }
    return {look:result,dropped};
  };
  const validateLook = (c, look) => {
    const checked=normalizeLook(c,look);
    app.diagnostics.dropped=checked.dropped;
    return checked.look;
  };
  const appearanceItem = (asset, color, previous) => {
    // An appearance-only color edit must preserve extended properties and crafts;
    // do not share/mutate the public Item object on the private clone.
    if (previous && previous.Asset === asset) {
      return {...previous, Color:color};
    }
    try {
      if (typeof AppearanceItem !== 'undefined' && typeof AppearanceItem.fromAsset === 'function')
        return AppearanceItem.fromAsset(asset, { color });
    } catch (_) {}
    return {Asset: asset, Color: color, Difficulty: 0};
  };
  const appearanceFor = (c, look) => {
    const records=validateLook(c,look);
    if (!records) return null;
    const recordGroups=new Set(records.map(r=>r.group));
    const supportedGroups=new Set(assetGroups(c).map(g=>g.Name));
    // Keep item/restraint groups untouched. Also retain public appearance items
    // with unknown addon groups/assets, so they do not silently disappear.
    const modified=(Array.isArray(c.Appearance)?c.Appearance:[]).filter(x=>{
      if (!x?.Asset?.Group || x.Asset.Group.Category!=='Appearance')return true;
      const g=x.Asset.Group.Name;
      if (!supportedGroups.has(g))return true;
      return !assetByName(c,groupByName(c,g),x.Asset.Name) && !recordGroups.has(g);
    });
    const oldByGroup=new Map((c.Appearance||[]).filter(x=>x?.Asset?.Group?.Category==='Appearance').map(x=>[x.Asset.Group.Name,x]));
    for (const record of records) {
      const group=groupByName(c,record.group),asset=assetByName(c,group,record.asset);
      if (!asset)continue;
      modified.push(appearanceItem(asset,record.color,oldByGroup.get(record.group)));
    }
    return modified;
  };
  const configKey = () => `pawPrivateWardrobe:v1:${member(me())}`;
  function loadSettings() {
    const id = member(me()); if (!id || id === app.lastAccount) return;
    app.lastAccount = id;
    app.profiles = {}; app.remote = {}; app.peers.clear(); app.clones = new WeakMap();
    app.diagnostics={dropped:[],lastEditSkipped:[],render:'not yet attempted',lastError:'',sync:{stateSent:0,stateReceived:0,ackReceived:0,ackRejected:0,lastSend:null,lastReceive:null,lastAck:null,lastProblem:''}};
    app.lastSent.clear(); app.packets.clear(); app.studio=null; app.studioClones=new WeakMap();
    try {
      const saved = JSON.parse(localStorage.getItem(configKey()) || '{}');
      if (saved && typeof saved === 'object') {
        app.enabled = saved.enabled !== false;
        app.allowPartnerEdits = saved.allowPartnerEdits !== false && saved.allowOwnerEdits !== false;
        app.selected = Number.isInteger(saved.selected) ? saved.selected : 0;
        app.profiles = saved.profiles && typeof saved.profiles === 'object' ? saved.profiles : {};
        app.background = typeof saved.background === 'string' ? saved.background : 'violet';
        app.previewSize = [320,380,460,540,640].includes(saved.previewSize) ? saved.previewSize : 380;
        app.showThumbnails = saved.showThumbnails === true;
        app.customBackground = typeof saved.customBackground === 'string' && /^https:\/\//.test(saved.customBackground) ? saved.customBackground : '';
      }
    } catch (err) { console.warn('[Paw Private Wardrobe] Could not load settings:', err); }
  }
  function saveSettings() {
    if (!me()) return;
    try { localStorage.setItem(configKey(), JSON.stringify({enabled:app.enabled,allowPartnerEdits:app.allowPartnerEdits,selected:app.selected,profiles:app.profiles,background:app.background,previewSize:app.previewSize,customBackground:app.customBackground,showThumbnails:app.showThumbnails})); }
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
    // A studio draft NEVER overrides the room appearance. The saved partner
    // state remains visible even while an editor is open on either client.
    const k = key(pid, subject);
    if (subject === mine && !app.allowPartnerEdits) return app.profiles[k]?.look || null;
    return (app.remote[k] && app.remote[k].look) || (app.profiles[k] && app.profiles[k].look) || null;
  }
  function invalidate() { app.generation++; app.clones = new WeakMap(); }
  function refreshView() {
    invalidate();
    // DrawCharacter renders private clones on demand. Never sync actual BC appearance.
  }
  const syncSend = (target, payload) => {
    const sync=app.diagnostics.sync;
    if (!eligible(target) || typeof ServerSend !== 'function') {
      sync.lastProblem='Partner is not in the room or ServerSend is unavailable.'; return false;
    }
    const raw = JSON.stringify({v:1,from:member(me()),to:target,...payload});
    if (raw.length > MAX_PACKET_BYTES) {
      sync.lastProblem='Private wardrobe message is too large.'; return false;
    }
    let packed;
    try { packed = btoa(unescape(encodeURIComponent(raw))); }
    catch(err) {sync.lastProblem='Could not encode private wardrobe message: '+String(err);return false;}
    const total = Math.ceil(packed.length / CHUNK_SIZE);
    if (total < 1 || total > 128) {
      sync.lastProblem=`The appearance requires ${total} message parts; maximum is 128.`; return false;
    }
    const tx = `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
    try {
      for (let i=0;i<total;i++) {
        // These are targeted Hidden room messages; they do not update BC appearance.
        ServerSend('ChatRoomChat', {Type:'Hidden', Target:target, Content:`${MARKER}${tx}:${i+1}/${total}:${packed.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE)}`});
      }
    } catch(err) {sync.lastProblem='Could not send message: '+String(err);return false;}
    return true; // Queued for BC; not proof the partner has received it.
  };
  function sendState(partner, subject, look, changed=Date.now()) {
    if (!eligible(partner)) return false;
    const peer = app.peers.get(partner);
    if (!peer || !peer.enabled) return false;
    if (subject === partner && !peer.accept) return false;
    const c = findChar(subject);
    const validated = validateLook(c, look);
    if (!validated) return false;
    if (subject !== member(me()) && subject !== partner) return false;
    const sent=syncSend(partner, {type:'STATE',subject,look:validated,ts:changed});
    if (sent) {app.diagnostics.sync.stateSent++;app.diagnostics.sync.lastSend={subject,to:partner,ts:changed,at:Date.now(),items:validated.length};}
    return sent;
  }
  function sendReset(partner,subject,changed) {
    return syncSend(partner,{type:'RESET',subject,ts:changed});
  }
  function sendSavedLooks(id) {
    if (!app.enabled || !eligible(id)) return;
    for (const subject of [member(me()), id]) {
      const saved = app.profiles[key(id,subject)];
      if (!saved) continue;
      if (saved.removed) sendReset(id,subject,saved.changed||0);
      else if (Array.isArray(saved.look)) sendState(id,subject,saved.look,saved.changed||0);
    }
  }
  function sendHello(id, force=false) {
    const last = app.lastSent.get(id) || 0;
    if (!force && Date.now() - last < RETRY_MS) return;
    app.lastSent.set(id, Date.now());
    syncSend(id,{type:'HELLO',enabled:app.enabled,accept:app.allowPartnerEdits,script:VERSION});
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
      app.peers.set(sender,{at:Date.now(),enabled:payload.enabled!==false,accept:payload.accept!==false,version:typeof payload.script==='string'?payload.script:'older beta'});
      // Respond only to an unknown peer, avoiding HELLO loops.
      if (app.enabled) {
        sendHello(sender,!wasKnown);
        if (payload.enabled !== false) sendSavedLooks(sender);
      }
      if (app.panel && app.panel.style.display!=='none') renderPanel();
      return;
    }
    if (payload.type==='DISABLED') {
      delete app.remote[key(sender,member(me()))];
      delete app.remote[key(sender,sender)];
      app.peers.set(sender,{at:Date.now(),enabled:false,accept:false});
      refreshView(); if(app.panel && app.panel.style.display!=='none')renderPanel();return;
    }
    if (payload.type==='STATE_ACK') {
      const sync=app.diagnostics.sync;
      sync.lastAck={from:sender,subject:payload.subject,ts:payload.ts,result:payload.result||'unknown',reason:payload.reason||'',at:Date.now()};
      if (['applied','up-to-date','staged'].includes(payload.result)) {
        sync.ackReceived++;
        setStatus('Partner confirmed the private appearance ('+payload.result+').');
      } else {
        sync.ackRejected++;
        sync.lastProblem='Partner did not apply private appearance: '+(payload.reason||payload.result||'unknown reason');
        setStatus(sync.lastProblem);
      }
      return;
    }
    if (!['STATE','RESET'].includes(payload.type)) return;
    const subject=Number(payload.subject),mine=member(me()),sync=app.diagnostics.sync;
    const stamp=Number.isSafeInteger(payload.ts) && payload.ts>=0 ? payload.ts : 0;
    const ack=(result,reason='')=>syncSend(sender,{type:'STATE_ACK',subject,ts:stamp,result,reason});
    if (!app.enabled) {ack('rejected','Private appearances are disabled on this client.');return;}
    if (subject!==mine && subject!==sender) {ack('rejected','Subject is not a member of this pair.');return;}
    if (subject===mine && !app.allowPartnerEdits && payload.type==='STATE') {
      ack('rejected','Partner edits are disabled for my character.');return;
    }
    // Do not let older profiles replayed during reconnect overwrite newer edits.
    const k=key(sender,subject),saved=app.profiles[k];
    if (saved && Number(saved.changed||0)>stamp) {ack('up-to-date','A newer wardrobe is already saved.');return;}
    if (payload.type==='RESET') {
      delete app.remote[k];
      app.profiles[k]={removed:true,changed:stamp};
      if(app.studio?.partner===sender && app.studio.subject===subject)app.studio.remoteChanged=true;
    } else {
      if (!Array.isArray(payload.look)) {ack('rejected','Invalid appearance data.');return;}
      const look=validateLook(findChar(subject),payload.look);
      if (!look) {ack('rejected','Assets could not be read.');return;}
      app.remote[k]={look,received:Date.now()};
      // Keep synchronized private looks available after a refresh/rejoin.
      app.profiles[k]={look,changed:stamp};
      if(app.studio?.partner===sender && app.studio.subject===subject)app.studio.remoteChanged=true;
    }
    sync.stateReceived++;
    sync.lastReceive={from:sender,subject,ts:stamp,at:Date.now(),type:payload.type};
    const oldPeer=app.peers.get(sender)||{enabled:true,accept:true};
    app.peers.set(sender,{...oldPeer,at:Date.now()}); // Don't silently override permission settings.
    saveSettings();refreshView();
    setStatus('Private appearance received and applied to the room view.');
    ack('applied'); // The editor cannot hide incoming saved looks anymore.
    if (app.studio?.remoteChanged) renderStudio();
    if(app.panel && app.panel.style.display!=='none')renderPanel();
  }
  function addHooks() {
    if (!globalThis.bcModSdk || typeof globalThis.bcModSdk.registerMod !== 'function') return false;
    try {
      app.mod = globalThis.bcModSdk.registerMod({name:'PawPrivateWardrobe',fullName:'Paw Private Wardrobe',version:'0.2.2'});
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
  function getRenderClone(c,look,cache=app.clones,onReady=null) {
    const cached=cache.get(c);
    // Stable array reference is a cheap draw-frame cache key. Edits always replace the array.
    if (cached && cached.lookRef===look && cached.generation===app.generation)
      return cached.pending ? null : cached.clone;
    const appearance=appearanceFor(c,look);
    if (!appearance) {app.diagnostics.render='appearance data could not be normalized';return null;}
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
    if (typeof CharacterLoadCanvas!=='function') {app.diagnostics.render='CharacterLoadCanvas is unavailable';return null;}
    const record={lookRef:look,generation:app.generation,pending:true,clone:null};
    cache.set(c,record);
    try {
      const result=CharacterLoadCanvas(replica);
      if (result && typeof result.then==='function') {
        Promise.resolve(result).then(()=>{
          if(cache.get(c)===record){record.clone=replica;record.pending=false;app.diagnostics.render='private replica prepared (async); live BC drawing not verified';if(onReady)onReady();}
        }).catch(e=>{
          record.pending=false;
          app.diagnostics.render='asynchronous canvas failed: '+String(e);
          console.warn('[Paw Private Wardrobe] Async canvas failed:',e);
        });
        return null;
      }
      record.clone=replica;
      record.pending=false;
      app.diagnostics.render='private replica prepared; live BC drawing not verified';
      return replica;
    } catch (err) {
      record.pending=false;
      app.diagnostics.render='private canvas exception: '+String(err);
      console.warn('[Paw Private Wardrobe] Could not create safe private render:',err);
      return null;
    }
  }
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
  function setStatus(text) {app.status=text;const el=document.getElementById('pwr-status');if(el)el.textContent=text;}
  const displayName = value => String(value||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ');
  const isClothes = g => !!g.Clothing;
  const groupClass = g => g.Clothing ? 'Clothing' : /hair|eye|body|skin|mouth|nose|face|brow|breast|pupil|iris/i.test(g.Name) ? 'Body' : 'Accessories';
  const backgrounds={
    violet:'linear-gradient(145deg,#45325f 0%,#77558e 55%,#1a1728 100%)',
    rose:'linear-gradient(140deg,#a96686 0%,#edb4bd 45%,#714969 100%)',
    midnight:'radial-gradient(ellipse at 45% 35%,#40577b,#111d36 75%)',
    garden:'linear-gradient(140deg,#355b50 0%,#83a48c 52%,#263e41 100%)',
    neutral:'linear-gradient(135deg,#a2a0ae,#dddddf 46%,#777c8b)'
  };
  function applyBackground(scene) {
    if (!scene) return;
    scene.style.backgroundImage='';
    scene.style.background=backgrounds[app.background]||backgrounds.violet;
    const img=app.background==='local'?app.sessionBackground:app.background==='custom'?app.customBackground:'';
    // Only load explicitly configured images; never inject arbitrary CSS.
    if (img && (img.startsWith('blob:') || /^https:\/\//i.test(img))) {
      scene.style.backgroundImage=`linear-gradient(#140e20bb,#140e2033),url("${img.replace(/["'()\\]/g, '')}")`;
      scene.style.backgroundSize='cover'; scene.style.backgroundPosition='center';
    }
  }
  function closePanel() {
    if (!app.panel) return;
    app.panel.style.display='none';
    // Viewing panel has no draft; closing it has no impact on synchronization.
  }
  function closeStudio() {
    if(app.studioResizeObserver){app.studioResizeObserver.disconnect();app.studioResizeObserver=null;}
    app.studio=null;app.studioClones=new WeakMap();app.studioFit=null;
    if(app.studioPanel)app.studioPanel.style.display='none';
    refreshView(); if(app.panel?.style.display!=='none')renderPanel();
  }
  function beginStudio(subject) {
    const partner=currentPartner(),c=findChar(subject);if(!partner||!c||!app.enabled)return;
    const pid=member(partner), stored=app.profiles[key(pid,subject)];
    if(subject===pid && app.peers.get(pid)?.accept===false){setStatus('Your partner disabled remote styling.');return;}
    const current=(!stored?.removed && Array.isArray(stored?.look))?stored.look:app.remote[key(pid,subject)]?.look;
    app.studio={partner:pid,subject,look:cloneJson(current||snapshot(c)),dirty:false,remoteChanged:false,overwriteConfirmed:false};
    app.studioClones=new WeakMap();app.editorSubject=subject;app.editorTab='Clothing';app.editorSearch='';app.editorPage=0;
    const groups=assetGroups(c).filter(g=>groupClass(g)==='Clothing');
    app.editorGroup=groups[0]?.Name||assetGroups(c)[0]?.Name||'';
    if(app.panel)app.panel.style.display='none';
    if(app.studioPanel)app.studioPanel.style.display='flex';
    renderStudio();
  }
  function modifyStudio(callback) {
    const st=app.studio;if(!st)return;
    const c=findChar(st.subject);if(!c)return;
    const updated=cloneJson(st.look);callback(updated,c);
    const checked=validateLook(c,updated);if(!checked){setStatus('Invalid appearance edit.');return;}
    st.look=checked;st.dirty=true;st.overwriteConfirmed=false;
    app.studioClones=new WeakMap();app.diagnostics.lastEditSkipped=app.diagnostics.dropped.slice();renderStudio();
  }
  function clearPrivateLook() {
    const st=app.studio;if(!st)return;
    const changed=Date.now(),pid=st.partner,subject=st.subject;
    app.profiles[key(pid,subject)]={removed:true,changed};delete app.remote[key(pid,subject)];
    saveSettings();refreshView();closeStudio();
    const sent=app.peers.get(pid)?.enabled && sendReset(pid,subject,changed);
    setStatus(sent?'Reset sent to partner.':'Local private look reset; partner not connected.');
  }
  function saveStudio() {
    const st=app.studio;if(!st)return;
    if(st.remoteChanged && !st.overwriteConfirmed){st.overwriteConfirmed=true;renderStudio();return;}
    if(st.subject===st.partner && app.peers.get(st.partner)?.accept===false){setStatus('Your partner disabled remote styling.');return;}
    const c=findChar(st.subject),look=validateLook(c,st.look);if(!look)return;
    const pid=st.partner,subject=st.subject,changed=Date.now();
    app.profiles[key(pid,subject)]={look,changed};delete app.remote[key(pid,subject)];
    saveSettings();refreshView();closeStudio();
    const sent=sendState(pid,subject,look,changed);
    setStatus(sent?'Private look saved and sent; awaiting acknowledgment.':'Saved locally but partner delivery is unavailable.');
  }
  function renderPanel() {
    const panel=app.panel;if(!panel||panel.style.display==='none')return;
    panel.replaceChildren();
    append(panel,append(node('div',undefined,'pwr-head'),node('h2','🐾 Paw Private Wardrobe'),button('×',closePanel,'pwr-secondary')));
    append(panel,node('p','VIEWING is always the default. Editing requires the wardrobe studio. Incoming partner looks show immediately, even while a studio is open.'));
    if(!me()||!inRoom()){append(panel,node('div','Join a BC chatroom to use private outfits.','pwr-badge'));return;}
    const available=partners();
    if(!available.length){append(panel,node('div','No owner/submissive partner in this room.','pwr-badge'));return;}
    currentPartner();
    label(panel,'Private partner');
    makeSelect(panel,available.map(c=>[member(c),`${c.Name||member(c)} (#${member(c)})`]),app.selected,v=>{
      app.selected=Number(v);app.editorSubject=0;saveSettings();refreshView();sendHello(app.selected,true);renderPanel();
    });
    const partner=currentPartner(),pid=member(partner),peer=app.peers.get(pid);
    append(panel,node('div',peer?.enabled?('● Partner addon detected · '+(peer.version==='0.2.2-beta'?'Both on 0.2.2 · Viewing':'Partner version '+(peer.version||'unknown')+' (update both accounts)')):peer?'Partner disabled sharing':'Waiting for partner addon','pwr-badge'));
    checkbox(panel,'View private appearances (on my screen)',app.enabled,v=>{
      app.enabled=v;saveSettings();refreshView();syncSend(pid,{type:v?'HELLO':'DISABLED',enabled:v,accept:app.allowPartnerEdits,script:VERSION});renderPanel();
    });
    checkbox(panel,'Allow partner to change my private appearance',app.allowPartnerEdits,v=>{
      app.allowPartnerEdits=v;saveSettings();refreshView();sendHello(pid,true);renderPanel();
    });
    append(panel,node('div',`Mode: VIEWING · no active edits${app.studio?' (studio open separately)':''}`,'pwr-badge'));
    append(panel,node('h3','Open wardrobe studio'));
    const targets=node('div',undefined,'pwr-row');
    const stylePartner=button(`Style ${partner.Name||'partner'}`,()=>beginStudio(pid),'');
    stylePartner.disabled=!!peer && !peer.accept;
    append(targets,button('Style myself',()=>beginStudio(member(me())),''),stylePartner);
    append(panel,targets);
    append(panel,node('p','The private wardrobe uses its own preview and background. Only Save & share updates the look your partner sees.','pwr-help'));
    append(panel,node('div',app.status,'pwr-help'));panel.lastElementChild.id='pwr-status';
    append(panel,node('p','Private packets are not end-to-end encrypted. No public BC appearance or actual restraints are changed.','pwr-help'));
  }
  // Work with the VISIBLE bounds of the BC character image, not the large
  // transparent margins of its off-screen drawing canvas. The result is cached
  // per source canvas: a new wardrobe edit gets a freshly loaded replica.
  const studioBoundsCache=new WeakMap();
  function visibleStudioBounds(source) {
    const width=Math.max(1,Number(source?.width)||500);
    const height=Math.max(1,Number(source?.height)||1000);
    const full={x:0,y:0,width,height,measured:false};
    if (!source || typeof source!=='object') return full;
    const cached=studioBoundsCache.get(source);
    if (cached && cached.width===width && cached.height===height) return cached.box;
    let box=full;
    try {
      // A small alpha-only probe avoids scanning a full character canvas on
      // each window resize. Padding protects thin outlines, ears and tails.
      const probe=document.createElement('canvas');
      const pw=Math.max(1,Math.min(250,width)),ph=Math.max(1,Math.min(500,height));
      probe.width=pw;probe.height=ph;
      const pctx=probe.getContext('2d',{willReadFrequently:true});
      if (!pctx || typeof pctx.getImageData!=='function') throw new Error('No readable canvas');
      pctx.clearRect(0,0,pw,ph);
      pctx.drawImage(source,0,0,pw,ph);
      const data=pctx.getImageData(0,0,pw,ph).data;
      let minX=pw,minY=ph,maxX=-1,maxY=-1;
      for (let y=0;y<ph;y++) {
        for (let x=0;x<pw;x++) {
          if(data[(y*pw+x)*4+3]<2)continue;
          if(x<minX)minX=x;if(x>maxX)maxX=x;
          if(y<minY)minY=y;if(y>maxY)maxY=y;
        }
      }
      if(maxX>=minX && maxY>=minY){
        const bx=minX*width/pw, by=minY*height/ph;
        const bw=(maxX-minX+1)*width/pw, bh=(maxY-minY+1)*height/ph;
        const mx=Math.max(width/pw*2,bw*.045),my=Math.max(height/ph*2,bh*.045);
        const left=Math.max(0,Math.floor(bx-mx)),top=Math.max(0,Math.floor(by-my));
        const right=Math.min(width,Math.ceil(bx+bw+mx)),bottom=Math.min(height,Math.ceil(by+bh+my));
        box={x:left,y:top,width:Math.max(1,right-left),height:Math.max(1,bottom-top),measured:true};
      }
    } catch (_) {
      // Tainted/WebGL/non-readable canvases fall back safely to the whole
      // image; the character is still drawn without altering the public look.
    }
    studioBoundsCache.set(source,{width,height,box});
    return box;
  }
  function drawStudioCanvas() {
    const st=app.studio;if(!st||!app.studioPanel||app.studioPanel.style.display==='none')return;
    const scene=app.studioPanel.querySelector('.pwr-scene');
    const canvas=app.studioPanel.querySelector('.pwr-character-canvas');
    if(!scene||!canvas||typeof canvas.getContext!=='function')return;
    const c=findChar(st.subject);if(!c)return;
    try {
      const clone=getRenderClone(c,st.look,app.studioClones,()=>{
        if(app.studio===st)drawStudioCanvas();
      });
      const source=clone?.Canvas||c.Canvas;
      if(!source)return;
      // FIXED character silhouette size in CSS pixels, independent of the
      // editor size. A smaller preview is scrollable instead of cropping.
      const b=visibleStudioBounds(source);
      const visibleHeight=[320,380,460,540,640].includes(app.previewSize)?app.previewSize:380;
      const padding=12;
      const destW=visibleHeight*(b.width/b.height);
      const cssW=Math.max(1,Math.ceil(destW+padding*2));
      const cssH=visibleHeight+padding*2;
      const dpr=Math.min(2,Math.max(1,Number(globalThis.devicePixelRatio)||1));
      const cw=Math.max(1,Math.min(4096,Math.round(cssW*dpr)));
      const ch=Math.max(1,Math.min(4096,Math.round(cssH*dpr)));
      canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';
      if(canvas.width!==cw)canvas.width=cw;
      if(canvas.height!==ch)canvas.height=ch;
      const context=canvas.getContext('2d');if(!context)return;
      context.clearRect(0,0,cw,ch);
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      const dx=padding*dpr,dy=padding*dpr,dw=destW*dpr,dh=visibleHeight*dpr;
      context.drawImage(source,b.x,b.y,b.width,b.height,dx,dy,dw,dh);
      app.studioFit={scene:[Number(scene.clientWidth)||0,Number(scene.clientHeight)||0],source:[source.width,source.height],visible:[b.x,b.y,b.width,b.height],canvas:[cssW,cssH],destination:[Math.round(dx/dpr),Math.round(dy/dpr),Math.round(dw/dpr),visibleHeight],fixedHeight:visibleHeight,measured:b.measured};
    }catch(err){app.diagnostics.render='Studio canvas failed: '+String(err);}
  }
  function renderStudio() {
    const root=app.studioPanel,st=app.studio;if(!root||!st||root.style.display==='none')return;
    if(app.studioResizeObserver){app.studioResizeObserver.disconnect();app.studioResizeObserver=null;}
    root.replaceChildren();
    const c=findChar(st.subject),partner=findChar(st.partner);
    if(!c||!partner){closeStudio();return;}
    const shell=node('div',undefined,'pwr-shell');root.appendChild(shell);
    const toolbar=node('div',undefined,'pwr-toolbar');shell.appendChild(toolbar);
    const h=node('div',undefined,'pwr-head');
    const brand=node('div',undefined,'pwr-brand');
    append(brand,node('div','🐾','pwr-brand-icon'));
    const brandText=node('div');
    append(brandText,node('div','PAW PRIVATE WARDROBE','pwr-eyebrow'));
    append(brandText,node('h2',`${c.Name||st.subject}'s atelier`));
    append(brandText,node('div','Your private styling space · public appearance unchanged','pwr-subhead'));
    append(brand,brandText);append(h,brand);
    const topButtons=node('div',undefined,'pwr-row pwr-top-actions');
    append(topButtons,node('span','● EDITING DRAFT','pwr-state'));
    append(topButtons,button('Discard & close',closeStudio,'pwr-secondary'),button(st.remoteChanged&&st.overwriteConfirmed?'Overwrite & share':'Save & share',saveStudio,'pwr-save'));
    append(h,topButtons);append(toolbar,h);
    if(st.remoteChanged) {
      const alert=node('div',undefined,'pwr-pale');
      append(alert,node('span','Your partner sent a newer look while you were editing. It already appears in the room. Your draft is unchanged.'));
      const actions=node('div',undefined,'pwr-row');
      append(actions,button('Load newer look',()=>{
        const saved=app.profiles[key(st.partner,st.subject)];
        st.look=cloneJson(saved&&!saved.removed&&saved.look?saved.look:snapshot(c));
        st.remoteChanged=false;st.overwriteConfirmed=false;st.dirty=false;
        app.studioClones=new WeakMap();renderStudio();
      }));
      append(alert,actions);append(toolbar,alert);
    }
    const main=node('div',undefined,'pwr-main');shell.appendChild(main);
    const stage=node('div',undefined,'pwr-stage');main.appendChild(stage);
    const stageTitle=node('div',undefined,'pwr-stage-title');
    append(stageTitle,node('span','Character preview','pwr-label-upper'),node('span','PRIVATE · LOCAL ONLY','pwr-mini-tag'));
    append(stage,stageTitle);
    const scene=node('div',undefined,'pwr-scene');applyBackground(scene);stage.appendChild(scene);
    const sceneInner=node('div',undefined,'pwr-scene-inner');append(scene,sceneInner);
    const canvas=node('canvas');canvas.className='pwr-character-canvas';canvas.width=500;canvas.height=1000;
    append(sceneInner,canvas);
    const backdropCard=node('div',undefined,'pwr-backdrop-card');append(stage,backdropCard);
    const backdropHeader=node('div',undefined,'pwr-backdrop-header');
    append(backdropHeader,node('div','Studio appearance','pwr-label-upper'));
    const toggleCustom=button('Custom image ▾',()=>{
      app.showBackgroundTools=!app.showBackgroundTools;
      urlRow.hidden=!app.showBackgroundTools;
      toggleCustom.textContent=app.showBackgroundTools?'Hide custom image ▴':'Custom image ▾';
    },'pwr-secondary pwr-custom-toggle');
    append(backdropHeader,toggleCustom);append(backdropCard,backdropHeader);
    const controls=node('div',undefined,'pwr-backdrop-row');
    append(controls,node('span','Backdrop'));
    makeSelect(controls,[['violet','Violet wardrobe'],['rose','Rose suite'],['midnight','Midnight'],['garden','Garden'],['neutral','Neutral studio'],['custom','Image URL'],['local','Local image (this session)']],app.background,v=>{
      app.background=v;saveSettings();applyBackground(scene);
      if(v==='custom'||v==='local'){app.showBackgroundTools=true;urlRow.hidden=false;toggleCustom.textContent='Hide custom image ▴';}
    });
    append(controls,node('span','Size'));
    const sizeControl=node('select');sizeControl.className='pwr-size-select';sizeControl.title='Fixed character height in pixels — window resizing does not change the size';
    for(const size of [320,380,460,540,640]){const option=node('option',`${size}px`);option.value=String(size);append(sizeControl,option);}
    sizeControl.value=String(app.previewSize);
    sizeControl.addEventListener('change',()=>{const size=Number(sizeControl.value);if(![320,380,460,540,640].includes(size))return;app.previewSize=size;saveSettings();drawStudioCanvas();});
    append(controls,sizeControl);append(backdropCard,controls);
    const urlRow=node('div',undefined,'pwr-background');
    const url=node('input');url.type='text';url.placeholder='Custom HTTPS image URL';url.value=app.customBackground||'';
    url.title='An external background image is downloaded directly by your browser.';
    append(urlRow,url,button('Use URL',()=>{
      const next=url.value.trim();
      if(!/^https:\/\/[a-z0-9.-]+(?:\:\d+)?(?:\/[^\s]*)?$/i.test(next)||next.length>1024){setStatus('Please use a valid HTTPS image URL.');return;}
      app.customBackground=next;app.background='custom';saveSettings();renderStudio();
    },'pwr-secondary'));
    const imagePick=node('input');imagePick.type='file';imagePick.accept='image/*';imagePick.title='Use a local image for this editing session';imagePick.style.maxWidth='160px';
    imagePick.addEventListener('change',()=>{
      const f=imagePick.files?.[0];if(!f||!f.type.startsWith('image/')||f.size>8*1024*1024){setStatus('Choose an image smaller than 8 MB.');return;}
      if(app.sessionBackground&&app.sessionBackground.startsWith('blob:'))URL.revokeObjectURL(app.sessionBackground);
      app.sessionBackground=URL.createObjectURL(f);app.background='local';saveSettings();renderStudio();
    });
    append(urlRow,imagePick);append(backdropCard,urlRow);
    if(app.background==='custom'||app.background==='local')app.showBackgroundTools=true;
    urlRow.hidden=!app.showBackgroundTools;
    toggleCustom.textContent=app.showBackgroundTools?'Hide custom image ▴':'Custom image ▾';
    append(backdropCard,node('div','Fixed character size · preview scrolls instead of shrinking','pwr-help'));
    const side=node('div',undefined,'pwr-side');main.appendChild(side);
    const tabs=node('div',undefined,'pwr-tabs');
    for(const tab of ['Clothing','Body','Accessories','All'])append(tabs,button(tab,()=>{app.editorTab=tab;app.editorPage=0;app.editorSearch='';app.editorGroup='';renderStudio();},'pwr-tab'+(app.editorTab===tab?' pwr-active':'')));
    append(side,tabs);
    let groups=assetGroups(c).filter(g=>app.editorTab==='All'||groupClass(g)===app.editorTab);
    if(!groups.length)groups=assetGroups(c);
    if(!groups.some(g=>g.Name===app.editorGroup))app.editorGroup=groups[0]?.Name||'';
    const slotSection=node('div',undefined,'pwr-section');
    const slotHeading=node('div',undefined,'pwr-section-top');
    append(slotHeading,node('span','01','pwr-step'),node('h3','Choose an appearance slot'));
    append(slotSection,slotHeading);append(side,slotSection);
    const groupGrid=node('div',undefined,'pwr-groups');
    for(const g of groups){
      const current=st.look.find(x=>x.group===g.Name);
      append(groupGrid,button(`${displayName(g.Description||g.Name)}${current?' ●':''}`,()=>{app.editorGroup=g.Name;app.editorPage=0;app.editorSearch='';renderStudio();},'pwr-group'+(app.editorGroup===g.Name?' pwr-active':'')));
    }
    append(slotSection,groupGrid);
    const group=groupByName(c,app.editorGroup);
    if(!group)return;
    const assetSection=node('div',undefined,'pwr-section pwr-assets-section');append(side,assetSection);
    const chooseHeader=node('div',undefined,'pwr-head');
    const chooseTitle=node('div',undefined,'pwr-section-top');
    append(chooseTitle,node('span','02','pwr-step'),node('h3',`Choose ${displayName(group.Description||group.Name)}`));
    append(chooseHeader,chooseTitle);
    append(chooseHeader,button(app.showThumbnails?'Previews ON':'Previews OFF',()=>{app.showThumbnails=!app.showThumbnails;saveSettings();renderStudio();},'pwr-secondary'));
    append(assetSection,chooseHeader);
    const search=node('input');search.type='search';search.placeholder='Search styles in this slot…';search.value=app.editorSearch;
    search.addEventListener('input',()=>{app.editorSearch=search.value;app.editorPage=0;renderAssetGrid();});
    append(assetSection,search);
    const grid=node('div',undefined,'pwr-asset-grid');append(assetSection,grid);
    const pager=node('div',undefined,'pwr-row pwr-pager');append(assetSection,pager);
    const current=st.look.find(r=>r.group===group.Name);
    function addTilePreview(tile,asset) {
      if(!app.showThumbnails||!asset)return;
      const look=cloneJson(st.look),i=look.findIndex(item=>item.group===group.Name);
      if(i>=0)look.splice(i,1);
      look.push({group:group.Name,asset:asset.Name,color:current?.color||'Default'});
      const mini=node('canvas');mini.width=100;mini.height=200;mini.className='pwr-asset-preview';
      const cache=new WeakMap();
      const draw=()=>{
        if(!app.studio||app.studio!==st||!mini.parent)return;
        try{
          const clone=getRenderClone(c,look,cache,draw),ctx=mini.getContext?.('2d');
          if(ctx&&clone?.Canvas){ctx.clearRect(0,0,100,200);ctx.drawImage(clone.Canvas,0,0,100,200);}
        }catch(err){/* keep asset text usable if an individual preview cannot render */}
      };
      append(tile,mini);draw();
    }
    function renderAssetGrid() {
      const all=(Array.isArray(group.Asset)?group.Asset:[]).filter(a=>a?.Name);
      const filtered=all.filter(a=>`${a.Name} ${a.Description||''}`.toLowerCase().includes(app.editorSearch.toLowerCase()));
      const assets=group.AllowNone?[null,...filtered]:filtered;
      const perPage=app.showThumbnails?6:12,total=Math.max(1,Math.ceil(assets.length/perPage));
      app.editorPage=Math.min(app.editorPage,total-1);
      grid.replaceChildren();
      for(const asset of assets.slice(app.editorPage*perPage,(app.editorPage+1)*perPage)) {
        const isChosen=asset?current?.asset===asset.Name:!current;
        const tile=button('',()=>modifyStudio(list=>{
          const i=list.findIndex(r=>r.group===group.Name);if(i>=0)list.splice(i,1);
          if(asset)list.push({group:group.Name,asset:asset.Name,color:current?.color||'Default'});
        }),'pwr-asset'+(isChosen?' pwr-active':''));
        tile.title=asset?.Name||'Remove this item';
        if(!app.showThumbnails||!asset)append(tile,node('span',asset?'◇':'✕','pwr-asset-icon'));
        addTilePreview(tile,asset);
        append(tile,node('span',asset?displayName(asset.Description||asset.Name):'(None / Remove)'));
        append(grid,tile);
      }
      pager.replaceChildren();
      append(pager,button('◀',()=>{app.editorPage=Math.max(0,app.editorPage-1);renderAssetGrid();},'pwr-secondary'));
      pager.lastElementChild.disabled=app.editorPage===0;
      append(pager,node('span',`Page ${app.editorPage+1} / ${total} · ${assets.length} choices`));
      append(pager,button('▶',()=>{app.editorPage=Math.min(total-1,app.editorPage+1);renderAssetGrid();},'pwr-secondary'));
      pager.lastElementChild.disabled=app.editorPage>=total-1;
    }
    renderAssetGrid();
    const colorSection=node('div',undefined,'pwr-section pwr-colors-section');append(side,colorSection);
    const colorTitle=node('div',undefined,'pwr-section-top');
    append(colorTitle,node('span','03','pwr-step'),node('h3','Customize colors'));
    append(colorSection,colorTitle);
    const colors=node('div',undefined,'pwr-colorbar');
    const colorInput=node('input');colorInput.type='text';colorInput.value=Array.isArray(current?.color)?current.color.join(', '):current?.color||'Default';
    colorInput.placeholder='Default or #AABBCC, #112233';
    const colorWrap=node('div',undefined,'pwr-grow');append(colorWrap,node('label','Item color / layers'),colorInput);append(colors,colorWrap);
    const picker=node('input');picker.type='color';picker.value=/^#[0-9a-f]{6}$/i.test(colorInput.value)?colorInput.value:'#e0bbf4';
    picker.addEventListener('input',()=>{colorInput.value=picker.value;});append(colors,picker);
    append(colors,button('Apply color',()=>modifyStudio(list=>{
      const item=list.find(r=>r.group===group.Name);if(!item)return;
      const raw=colorInput.value.trim();item.color=raw.includes(',')?raw.split(',').map(x=>x.trim()).slice(0,20):raw||'Default';
    })));
    append(colorSection,colors);
    const bottom=node('div',undefined,'pwr-bottom');shell.appendChild(bottom);
    const quick=node('div',undefined,'pwr-row');
    append(quick,button('Remove all clothing',()=>modifyStudio((list,character)=>{
      const remove=new Set(assetGroups(character).filter(g=>isClothes(g)&&g.AllowNone).map(g=>g.Name));
      for(let i=list.length-1;i>=0;i--)if(remove.has(list[i].group))list.splice(i,1);
    })),button('Copy public look',()=>modifyStudio((list,character)=>list.splice(0,list.length,...snapshot(character))),'pwr-secondary'),
    button('Reset private look',clearPrivateLook,'pwr-danger'));
    const bottomTop=node('div',undefined,'pwr-bottom-top');append(bottomTop,node('span','QUICK ACTIONS','pwr-label-upper'));append(bottomTop,quick);append(bottom,bottomTop);
    append(bottom,node('div','Save & share commits the private style. The live room NEVER displays an unfinished editor draft. This does not alter real BC clothes.','pwr-help'));
    drawStudioCanvas();
    if(typeof ResizeObserver==='function'){
      const observer=new ResizeObserver(()=>{
        if(app.studio===st && app.studioPanel?.querySelector('.pwr-scene')===scene)drawStudioCanvas();
      });
      observer.observe(scene);app.studioResizeObserver=observer;
    }
  }
  function installUI() {
    if(!document.body || app.launcher)return;
    const s=node('style');s.textContent=style;document.head.appendChild(s);
    app.launcher=button('🐾 Private Wardrobe',()=>{if(app.panel.style.display==='none'){app.panel.style.display='block';renderPanel();}else closePanel();});
    app.launcher.id='pwr-launcher';document.body.appendChild(app.launcher);
    app.panel=node('div');app.panel.id='pwr-window';app.panel.style.display='none';document.body.appendChild(app.panel);
    app.studioPanel=node('div');app.studioPanel.id='pwr-studio';app.studioPanel.style.display='none';document.body.appendChild(app.studioPanel);
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
      if(indicator){const peer=app.peers.get(member(chosen));indicator.textContent=peer?.enabled?('Partner addon detected · '+(peer.version==='0.2.2-beta'?'Both on 0.2.2 · Viewing':'Partner '+(peer.version||'older beta')+' · update both accounts')):peer?'Partner has disabled private sharing':'Partner addon not yet detected';}
    }
    if(!ps.length && (app.peers.size||Object.keys(app.remote).length||app.studio)) {app.peers.clear();app.remote={};if(app.studio)closeStudio();refreshView();}
  }
  function init() {
    if(app.ready)return;
    if(!me())return;
    loadSettings();
    if(!addHooks()) {app.status='Requires BC ModSDK / bcModSdk to be loaded first.';return;}
    app.ready=true;app.status='Ready (beta)';installUI();heartbeat();
    if(typeof ResizeObserver!=='function' && typeof window!=='undefined')window.addEventListener('resize',()=>{if(app.studio)drawStudioCanvas();});
    globalThis.PawPrivateWardrobe = Object.freeze({
      version:VERSION,
      open(){app.panel.style.display='block';renderPanel();},
      studio(subject=member(me())){beginStudio(Number(subject));},
      closeStudio(){closeStudio();},
      status(){return {version:VERSION,ready:app.ready,selected:app.selected,enabled:app.enabled,mode:app.studio?'EDITING':'VIEWING',partnerDetected:!!app.peers.get(app.selected),partnerCount:partners().length,partnerVersion:app.peers.get(app.selected)?.version||null,render:app.diagnostics.render,skippedAssets:app.diagnostics.lastEditSkipped.length,lastAck:app.diagnostics.sync.lastAck};},
      diagnostics(){
        const p=currentPartner(),sub=app.studio?.subject||member(me()),c=findChar(sub);
        const look=app.studio?.look || snapshot(c);
        const checked=normalizeLook(c,look);
        return {version:VERSION,subject:sub,publicItems:c?.Appearance?.length||0,appearanceGroups:assetGroups(c).length,draftItems:look.length,validItems:checked.look?.length||0,skipped:checked.dropped,lastEditSkipped:app.diagnostics.lastEditSkipped,render:app.diagnostics.render,partnerDetected:!!p&&!!app.peers.get(member(p)),partnerVersion:app.peers.get(member(p))?.version||null,partnerAllowsEdits:app.peers.get(member(p))?.accept,hasCanvas:!!c?.Canvas,editing:!!app.studio,dirtyPreview:!!app.studio?.dirty,studioOverridesRoom:false,remoteChangedInStudio:!!app.studio?.remoteChanged,storedProfiles:Object.keys(app.profiles).filter(k=>k.startsWith(member(p)+':')).map(k=>({key:k,changed:app.profiles[k]?.changed,removed:!!app.profiles[k]?.removed,items:app.profiles[k]?.look?.length||0})),sync:cloneJson(app.diagnostics.sync),pendingPackets:app.packets.size,studioFit:app.studioFit?cloneJson(app.studioFit):null,previewSize:app.previewSize};
      },
      refresh(){refreshView();},
      // Emergency local-only switch, never changes public appearance.
      disable(){const partner=currentPartner();app.enabled=false;closeStudio();saveSettings();refreshView();if(partner)syncSend(member(partner),{type:'DISABLED'});if(app.panel)renderPanel();},
    });
    console.log(`[Paw Private Wardrobe] ${VERSION} initialized`);
  }
  if (globalThis.PawPrivateWardrobe) {console.warn('[Paw Private Wardrobe] Already loaded. Disable older versions of the userscript and refresh.');return;}
  const timer=setInterval(()=>{if(!app.ready)init();else heartbeat();},4000);
  init();
})();
