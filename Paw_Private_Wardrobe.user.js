// ==UserScript==
// @name         Paw Private Wardrobe (Two-Person)
// @namespace    https://bondageprojects.com/
// @version      0.3.0-beta
// @description  Private visual-only wardrobe: catalog clothing, body styles and gear, without inventory or gender gates.
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
 * Paw Private Wardrobe, beta 0.3.0
 * Both participants install this userscript. Both must be in the same chatroom.
 * Default state is VIEWING. Editing requires deliberately opening the studio.
 * A studio draft NEVER shadows incoming saved partner looks in the chatroom.
 * It changes only local character drawings; NEVER calls appearance sync/update.
 * Private body-fit selections are saved and shared within the owner/sub pair.
 * All detected bras default to the smallest available female BodyUpper artwork.
 * The private styling panel supports basic item-level canvas transformations.
 * Not a secrecy system: BC's server and other client mods may inspect game packets.
 * Does not change rules, permissions, restraints, or official game appearance.
 */
(() => {
  'use strict';
  const VERSION = '0.3.0-beta';
  const MARKER = 'PWRD1:';
  const MAX_ITEMS = 240;
  const HIDE_ITEM = '@private-remove';
  const MAX_PACKET_BYTES = 120000;
  const CHUNK_SIZE = 480;
  const RETRY_MS = 60000;
  const MAX_SAVED_OUTFITS = 30;
  const SAFE_COLOR = /^(?:#[\da-fA-F]{3,8}|[\w ,.#()-]{1,80})$/;
  const style = `
/* Paw Private Wardrobe v0.3.0 – BC-inspired, single-canvas interface */
#pwr-launcher {position:fixed;z-index:2147483000;right:18px;bottom:112px;user-select:none;touch-action:none;cursor:grab;border:2px solid #5e008a;border-radius:13px;background:#25102dcc;color:#f7e7ff;padding:10px 15px;font:700 13px Arial,sans-serif;box-shadow:0 4px 16px #000a}
#pwr-launcher.pwr-dragging{cursor:grabbing}
#pwr-window,#pwr-studio {font:15px Arial,sans-serif;color:#eee;box-sizing:border-box}
#pwr-window *,#pwr-studio *{box-sizing:border-box}
#pwr-window {position:fixed;z-index:2147483001;right:18px;bottom:175px;max-height:78vh;overflow:auto;width:min(450px,calc(100vw - 20px));background:#0d0d11f7;border:2px solid #64008b;padding:16px;box-shadow:0 10px 38px #000d}
#pwr-window h2{margin:0;font-size:19px}
#pwr-window h3{margin:11px 0 7px}
#pwr-window p{font-size:13px;color:#cbb5d6;line-height:1.4}
#pwr-window label{display:block;margin:7px 0 4px}
#pwr-window select,#pwr-window input[type=text]{width:100%;padding:9px;background:#19131c;color:white;border:1px solid #7e3c9c}
#pwr-window button,#pwr-studio button {font:600 14px Arial,sans-serif;color:#f7edff;background:#27242b;border:2px solid #64008b;padding:9px;cursor:pointer;min-height:38px;border-radius:0;white-space:normal}
#pwr-window button:hover,#pwr-studio button:hover{background:#563069}
#pwr-window button:disabled,#pwr-studio button:disabled{opacity:.35;cursor:default}
#pwr-window .pwr-head,#pwr-studio .pwr-head,#pwr-studio .pwr-row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
#pwr-window .pwr-row,#pwr-studio .pwr-row{justify-content:flex-start;margin:8px 0}
#pwr-window .pwr-badge{margin:8px 0;background:#32203e;padding:8px;color:#efdcff}
#pwr-window .pwr-help{font-size:12px;color:#bba6c9}
#pwr-studio{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:6px;background:#08040ce8;overflow:hidden}
#pwr-studio .pwr-shell{display:flex;flex-direction:column;width:min(1920px,100%);height:min(1000px,99dvh);border:2px solid #580079;overflow:hidden;background:#0f0c13f5}
#pwr-studio .pwr-toolbar{flex:none;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 13px;min-height:55px;border-bottom:2px solid #65008e;background:#1e1325}
#pwr-studio .pwr-heading{font-size:21px;font-weight:600;letter-spacing:.01em;white-space:normal}
#pwr-studio .pwr-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#pwr-studio .pwr-actions button{font-size:13px;min-height:38px}
#pwr-studio .pwr-accept{background:#165d22!important;border-color:#42ad44!important}
#pwr-studio .pwr-cancel{background:#6b111a!important;border-color:#c13c4e!important}
#pwr-studio .pwr-toolbar .pwr-save-state{font-size:11px;color:#d5b5e1}
#pwr-studio .pwr-alert{flex:none;background:#532e35;padding:8px 12px;font-size:12px;border-bottom:1px solid #c77e8f}
#pwr-studio .pwr-main{display:grid;grid-template-columns:minmax(200px,43%) minmax(310px,57%);flex:1;min-height:0}
#pwr-studio .pwr-left{display:flex;flex-direction:column;min-height:0;min-width:0;position:relative;background:linear-gradient(90deg,#141016dd,#201325ee)}
#pwr-studio .pwr-preview-bar{flex:none;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #6a267f;font-size:12px}
#pwr-studio .pwr-scene{position:relative;flex:1;min-height:0;overflow:auto;border:0;background:linear-gradient(110deg,#160f19b0,#28202bb5)}
#pwr-studio .pwr-scene-inner{width:max-content;height:max-content;min-height:100%;min-width:100%;display:grid;place-items:center}
#pwr-studio .pwr-scene canvas.pwr-character-canvas{display:block;position:relative;max-height:none;max-width:none;pointer-events:none;filter:drop-shadow(0 4px 10px #000b)}
#pwr-studio .pwr-drag-catcher{position:absolute;inset:0;z-index:5;touch-action:none;cursor:move}
#pwr-studio .pwr-preview-tools{flex:none;display:flex;gap:8px;padding:7px 10px;align-items:center;border-top:1px solid #501273;font-size:12px;flex-wrap:wrap}
#pwr-studio .pwr-preview-tools select{max-width:145px}
#pwr-studio .pwr-right{position:relative;display:flex;flex-direction:column;min-height:0;min-width:0;background:#121018;border-left:2px solid #4d146a}
#pwr-studio .pwr-filter{display:flex;gap:5px;flex-wrap:wrap;align-items:center;padding:8px 9px;background:#1e1427;border-bottom:1px solid #65118e;flex:none}
#pwr-studio .pwr-filter button{min-width:44px}
#pwr-studio button.pwr-selected{background:#7100a0;border-color:#aa44d7;color:white}
#pwr-studio .pwr-search{width:100%;min-height:36px;padding:7px 10px;background:#17121c;border:1px solid #7800a3;color:white;font:14px Arial}
#pwr-studio .pwr-right-head{flex:none;display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:#19121f;border-bottom:1px solid #58116e;gap:8px}
#pwr-studio .pwr-right-head strong{font-size:16px}
#pwr-studio .pwr-list-scroll{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#8100b0 #1e1324}
#pwr-studio .pwr-slot{display:grid;grid-template-columns:minmax(0,1fr) 32px 35px;gap:5px;align-items:center;margin:5px 9px;padding:0}
#pwr-studio .pwr-slot .pwr-slot-main{display:flex;align-items:center;gap:5px;min-width:0;padding:0!important;min-height:47px;background:#25242a!important}
#pwr-studio .pwr-slot .pwr-slot-main span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:clamp(11px,1vw,14px)}
#pwr-studio .pwr-slot .pwr-slot-arrow{background:#211a27;border:0;padding:4px 7px;min-height:40px;font-size:16px}
#pwr-studio .pwr-slot .pwr-swatch{width:32px;height:36px;border:2px solid #6800a0;border-radius:50%;padding:0;box-shadow:inset 0 0 0 3px #ffffff30}
#pwr-studio .pwr-slot-main.pwr-active{border-color:#b870e0;background:#5b296b!important}
#pwr-studio .pwr-catalog{padding:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-content:start}
#pwr-studio .pwr-catalog-tile{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:0;padding:5px!important;overflow:hidden;min-height:158px;background:#262229!important}
#pwr-studio .pwr-catalog-tile.pwr-selected{background:#2d5687!important}
#pwr-studio .pwr-tile-art{height:111px;min-height:111px;display:grid;place-items:center;overflow:hidden;background:#1f1f24;position:relative}
#pwr-studio .pwr-tile-art img{width:100%;height:100%;object-fit:contain}
#pwr-studio .pwr-tile-art canvas{width:100%;height:100%;display:block;object-fit:contain}
#pwr-studio .pwr-tile-placeholder{font-size:25px;color:#9765b2;line-height:1;text-align:center}
#pwr-studio .pwr-tile-label{font-size:12px;line-height:1.15;text-align:center;word-break:break-word}
#pwr-studio .pwr-tile-sub{font-size:10px;color:#c9b4d9;text-align:center;overflow-wrap:anywhere}
#pwr-studio .pwr-pages{flex:none;display:flex;gap:8px;padding:7px;justify-content:center;align-items:center;background:#201425;border-top:1px solid #7d11a6}
#pwr-studio .pwr-setting-body{padding:12px;display:flex;flex-direction:column;gap:12px}
#pwr-studio .pwr-setting-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-height:35px}
#pwr-studio .pwr-setting-row label{flex:0 0 140px;font-size:13px}
#pwr-studio .pwr-setting-row input[type=color]{height:35px;width:54px}
#pwr-studio .pwr-setting-row input[type=text],#pwr-studio .pwr-setting-row input[type=number]{flex:1;min-width:100px}
#pwr-studio input[type=text],#pwr-studio input[type=number],#pwr-studio select,#pwr-studio input[type=range]{background:#211b27;border:1px solid #7300aa;color:white;padding:7px;min-height:33px;font:13px Arial;max-width:100%}
#pwr-studio .pwr-color-surface{height:116px;border:1px solid #ad5bd2;position:relative;background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,var(--pwr-hue,#f0f));cursor:crosshair;touch-action:none}
#pwr-studio .pwr-hue{width:100%;height:17px;background:linear-gradient(90deg,red,yellow,lime,cyan,blue,magenta,red);appearance:none;padding:0!important;border:0!important}
#pwr-studio .pwr-hue::-webkit-slider-thumb{appearance:none;width:13px;height:22px;background:#fff;border:2px solid #555}
#pwr-studio .pwr-note{padding:6px;font-size:11px;color:#c5b1d0;line-height:1.3}
#pwr-studio .pwr-bottom{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 11px;border-top:2px solid #580077;background:#1d1423;flex-wrap:wrap}
#pwr-studio .pwr-bottom button{font-size:12px;min-height:33px}
#pwr-studio .pwr-pill{font-size:11px;background:#3c194e;padding:6px;color:#e2c1ef}
#pwr-studio .pwr-save-row{display:flex;gap:5px;align-items:center}
#pwr-studio .pwr-save-row input{flex:1}
#pwr-studio .pwr-preset{display:flex;gap:5px;align-items:center;padding:6px;border:1px solid #54286d}
#pwr-studio .pwr-preset span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:850px){#pwr-studio .pwr-main{grid-template-columns:42% 58%}#pwr-studio .pwr-toolbar{padding:5px}#pwr-studio .pwr-heading{font-size:15px}#pwr-studio .pwr-catalog{grid-template-columns:repeat(2,minmax(0,1fr))}#pwr-studio .pwr-tile-art{height:90px;min-height:90px}#pwr-studio .pwr-catalog-tile{min-height:133px}}
@media(max-width:560px){#pwr-studio .pwr-main{display:flex;flex-direction:column}#pwr-studio .pwr-left{min-height:32%;height:32%;flex:0 0 32%}#pwr-studio .pwr-right{flex:1;min-height:0;border-left:0;border-top:2px solid #580077}#pwr-studio .pwr-preview-tools{display:none}#pwr-studio .pwr-heading{font-size:14px}#pwr-studio .pwr-actions button{font-size:11px;min-height:32px;padding:5px}#pwr-studio .pwr-catalog{grid-template-columns:repeat(3,minmax(0,1fr))}#pwr-studio .pwr-tile-art{height:75px;min-height:75px}#pwr-studio .pwr-catalog-tile{min-height:117px}#pwr-studio .pwr-setting-row label{flex-basis:80px}}

`;
  const app = {
    ready: false, mod: null, enabled: true, allowPartnerEdits: true,
    selected: 0, panel: null, launcher: null, status: 'Starting...',
    profiles: {}, outfits: {}, launcherPosition: null, favorites: {}, favoritesOnly: false, sections: {slots:true,styles:true,tuning:false,use:false,colors:false,outfits:false}, activeColorLayer: 0, studioDrawTicket: 0, remote: {}, studio: null, studioPanel: null, studioClones: new WeakMap(), studioResizeObserver: null, studioFit: null, studioLayout: 'bc', previewSize: 380, showBackgroundTools: false, background: 'violet', customBackground: '', sessionBackground: '', showThumbnails: true, thumbnailFocus: 'item', lastSent: new Map(), peers: new Map(),
    packets: new Map(), clones: new WeakMap(), generation: 1,
    drawScope: 0, nativeDrawScope: 0, roomDrawHookAvailable: false, roomDrawHookSeen: false, roomDrawCalls: 0, privateDrawCalls: 0, nativeDrawSkips: 0, canvasHookCalls: 0, privateCanvasCalls: 0, canvasHookNames: [], nativeHookNames: [], renderReadyChecks: 0,
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
  // A private outfit can use the female clothing silhouettes without changing
  // the user's real gender, body parts or server appearance.
  const normalizeFit = value => value === 'flat' || value === 'original' ? value : 'auto';
  // Some BC clients represent gender differently (or omit it from room
  // snapshots). Automatic fit must therefore also inspect the ACTUAL body
  // silhouette, not just a single account flag. The appearance argument can
  // be a validated private clone OR the character's original appearance.
  const flatChestName = name => /(?:flat|no.?breast|no.?chest|tiny|extra.?small|very.?small)/i.test(String(name||''));
  const appearanceChest = appearance => Array.isArray(appearance) ?
    appearance.find(item=>item?.Asset?.Group?.Name==='BodyUpper')?.Asset?.Name || '' : '';
  const shouldUseFlatFeminine = (character, mode, appearance=null) => {
    mode = normalizeFit(mode);
    if (mode === 'flat') return true;
    if (mode === 'original') return false;
    const gender=String(character?.Gender||'').trim().toLowerCase();
    if (['m','male','man','masculine','boy','nb','nonbinary','non-binary','non binary'].includes(gender)) return true;
    // A visibly flat chest is a better signal for the requested flat feminine
    // clothing fit than an absent/inconsistent gender flag. In particular,
    // FlatSmall + Bra previously returned femaleArtwork:false on Ale.
    // A saved wardrobe may still contain a nonflat chest even when the
    // subject's public body is FlatSmall. Inspect BOTH independently.
    if (flatChestName(appearanceChest(appearance)) || flatChestName(appearanceChest(character?.Appearance))) return true;
    return false;
  };
  function privateFit(character) {
    const partner=currentPartner();
    if(!partner||!character)return 'auto';
    const k=key(member(partner),member(character));
    const selected=(member(character)===member(me()) && !app.allowPartnerEdits)
      ?app.profiles[k]:(app.remote[k]&&app.remote[k].look?app.remote[k]:app.profiles[k]);
    return normalizeFit(selected?.fit);
  }
  // The override is a PRIVATE BodyUpper drawing choice, never a real BC body edit.
  // Validated against the loaded character family to prevent stale/forged names.
  function normalizeBraChest(c, requested) {
    const name=String(requested||'auto');
    if(name==='auto')return 'auto';
    if(name.length>70)return 'auto';
    return groupAssets(groupByName(c,'BodyUpper')).find(a=>a.Name===name)?.Name || 'auto';
  }
  function privateBraChest(character) {
    const partner=currentPartner();
    if(!partner||!character)return 'auto';
    const k=key(member(partner),member(character));
    const selected=(member(character)===member(me())&&!app.allowPartnerEdits)
      ?app.profiles[k]:(app.remote[k]?.look?app.remote[k]:app.profiles[k]);
    return normalizeBraChest(character,selected?.braChest);
  }
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
  // The catalog is independent of inventory ownership, shop Value, gender and
  // regular item permission checks. This editor only paints detached replicas.
  // Item groups are included as *visual-only gear*, not real equipped restraints.
  const assetGroups = (character) => {
    if (!character || typeof AssetGroup === 'undefined' || !Array.isArray(AssetGroup)) return [];
    const fam = character.AssetFamily || 'Female3DCG';
    return AssetGroup.filter(g => g && (g.Category === 'Appearance' || g.Category === 'Item') &&
      (!g.Family || g.Family === fam))
      .sort((a,b) => a.Name.localeCompare(b.Name));
  };
  const groupByName = (c, groupName) => assetGroups(c).find(g => g.Name === groupName);
  const catalogCache = new WeakMap();
  const groupAssets = group => {
    if (!group) return [];
    const gList = Array.isArray(group.Asset) ? group.Asset : [];
    const globals = typeof Asset !== 'undefined' && Array.isArray(Asset) ? Asset : [];
    const cached = catalogCache.get(group);
    if (cached && cached.globalSize === globals.length && cached.groupSize === gList.length) return cached.assets;
    const result = [...gList];
    // Some addons register in the global registry before linking their group.
    const known = new Set(result.map(a => a?.Name));
    for (const a of globals) if (a?.Group?.Name === group.Name &&
      (!a.Group.Family || !group.Family || a.Group.Family === group.Family) &&
      a.Name && !known.has(a.Name)) {result.push(a);known.add(a.Name);}
    const assets = result.filter(a => a && typeof a.Name === 'string');
    catalogCache.set(group,{globalSize:globals.length,groupSize:gList.length,assets});
    return assets;
  };
  const assetByName = (c, g, assetName) => {
    if (!g || !assetName || assetName === HIDE_ITEM) return null;
    let a = groupAssets(g).find(a => a && a.Name === assetName);
    if (!a && typeof AssetGet === 'function') {
      try { a = AssetGet(c.AssetFamily || 'Female3DCG', g.Name, assetName); } catch (_) {}
    }
    return a || null;
  };
  // BC layers share a ColorIndex when they are colored together. Present
  // those indices, not every painted sprite/image, as independent choices.
  function colorLayerDefinitions(asset,group,currentColor) {
    const raw=Array.isArray(asset?.Layer)?asset.Layer:[];
    const declared=Number(asset?.ColorableLayerCount);
    const indices=raw.map(layer=>Number(layer?.ColorIndex)).filter(n=>Number.isInteger(n)&&n>=0&&n<20);
    // Never infer colorability from an uncolorable object's sprite count.
    const count=Number.isInteger(declared)&&declared>=0
      ?Math.min(20,Math.max(declared,declared>0&&indices.length?Math.max(...indices)+1:0))
      :Math.min(20,Math.max(1,indices.length?Math.max(...indices)+1:0,Array.isArray(currentColor)?currentColor.length:0));
    const list=[];
    for(let i=0;i<count;i++){
      const matched=raw.filter(layer=>Number(layer?.ColorIndex)===i);
      const seen=new Set();const names=[];
      for(const layer of matched){
        const name=String(layer?.ColorGroup||layer?.Name||layer?.Description||'').trim();
        if(name&&!seen.has(name)){names.push(displayName(name));seen.add(name);}
      }
      list.push({index:i,title:names.length?names.slice(0,2).join(' / '):'Layer '+(i+1),name:names.length?names.join(', '):'',count:matched.length});
    }
    return list;
  }
  function colorLayersForRecord(record,count) {
    const current=record?.color;
    const normalized=Array.isArray(current)?current.slice(0,count):Array(count).fill(current||'Default');
    while(normalized.length<count)normalized.push('Default');
    return normalized.map(value=>colorString(value));
  }
  function recolorSingleLayer(record,count,index,hex) {
    const values=colorLayersForRecord(record,count);
    if(index<0||index>=count)return;
    values[index]=hex;
    record.color=count===1?values[0]:values;
  }
  const colorString = value => {
    if (Array.isArray(value)) return value.slice(0, 20).map(v => (typeof v === 'string' && SAFE_COLOR.test(v) ? v : 'Default'));
    return (typeof value === 'string' && SAFE_COLOR.test(value)) ? value : 'Default';
  };
  // Native BC "Use" often means extended Typed/Modular item options. Only
  // variants with explicit Type/TypeRecord data can be copied safely onto a
  // detached, visual-only item. Never invoke native click/Use/Publish handlers.
  function itemVisualOptions(asset) {
    if(!asset || typeof asset!=='object')return [];
    let data=null;
    try {
      if(typeof ExtendedItemGetData==='function' && asset.Archetype)
        data=ExtendedItemGetData(asset,asset.Archetype);
    }catch(_){/* Some addon assets have no extended-data entry. */}
    const pool=[data,data?.config,data?.Config,data?.data,data?.Data];
    const defs=pool.find(v=>Array.isArray(v?.options)||Array.isArray(v?.Options));
    let raw=defs?.options||defs?.Options;
    if(!raw && Array.isArray(asset.AllowType))raw=asset.AllowType.map(t=>({Name:String(t),Property:{Type:String(t)}}));
    if(!Array.isArray(raw))return [];
    const found=[],seen=new Set();
    for(const option of raw.slice(0,128)) {
      if(!option || typeof option!=='object')continue;
      const prop=option.Property||option.property||{};
      const type=prop.Type??option.Type??option.type??option.Name??option.name;
      if(typeof type!=='string'||type.length>120)continue;
      let record=prop.TypeRecord??option.TypeRecord??null;
      if(record && (typeof record!=='object'||Array.isArray(record)))record=null;
      if(record) {
        try {record=JSON.parse(JSON.stringify(record));if(JSON.stringify(record).length>1024)record=null;}
        catch(_){record=null;}
      }
      const label=String(option.Description||option.description||option.Name||option.name||type).slice(0,85);
      const id=type+'|'+(record?JSON.stringify(record):'');
      if(seen.has(id))continue;
      seen.add(id);found.push({type,typeRecord:record,name:label});
    }
    return found.slice(0,100);
  }
  function normalizeItemUse(asset,raw) {
    if(!raw||typeof raw!=='object')return null;
    const choices=itemVisualOptions(asset);
    const type=typeof raw.type==='string'?raw.type:typeof raw.Type==='string'?raw.Type:null;
    if(type===null)return null;
    const chosen=choices.find(x=>x.type===type && (
      !raw.typeRecord || JSON.stringify(raw.typeRecord)===JSON.stringify(x.typeRecord)));
    return chosen?{type:chosen.type,...(chosen.typeRecord?{typeRecord:chosen.typeRecord}:{})}:null;
  }
  function applyItemUse(item,asset,use) {
    const selected=normalizeItemUse(asset,use);
    if(!selected)return item;
    // Property is a NEW object: the original character's Item is not touched.
    const property={...(item.Property&&typeof item.Property==='object'?item.Property:{})};
    property.Type=selected.type;
    if(selected.typeRecord)property.TypeRecord=JSON.parse(JSON.stringify(selected.typeRecord));
    return {...item,Property:property};
  }
  const DEFAULT_TUNE=Object.freeze({opacity:100,x:0,y:0,angle:0,scaleX:100,scaleY:100,mirrorX:false,mirrorY:false,priority:0});
  const tuneLimits={opacity:[0,100],x:[-180,180],y:[-250,250],angle:[-180,180],scaleX:[40,180],scaleY:[40,180],priority:[-5,5]};
  const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
  function normalizeTune(raw) {
    if(!raw || typeof raw!=='object' || Array.isArray(raw))return null;
    const tune={};
    for(const field of Object.keys(tuneLimits)) {
      const [min,max]=tuneLimits[field];
      const n=Number(raw[field]);
      tune[field]=Number.isFinite(n)?Math.round(clamp(n,min,max)):DEFAULT_TUNE[field];
    }
    tune.mirrorX=raw.mirrorX===true;
    tune.mirrorY=raw.mirrorY===true;
    return Object.keys(DEFAULT_TUNE).some(k=>tune[k]!==DEFAULT_TUNE[k])?tune:null;
  }
  function adjustableRecord(c,record) {
    if(!record || record.asset===HIDE_ITEM)return false;
    const g=groupByName(c,record.group);
    // Essential body groups are not safe for isolated per-item compositing.
    return !!(g && g.Category==='Appearance' && g.AllowNone);
  }
  const withTune=(record,tune)=>tune?{...record,tune}:record;
  const snapshot = c => {
    if (!c || !Array.isArray(c.Appearance)) return [];
    return c.Appearance.filter(it => it?.Asset?.Group &&
      (it.Asset.Group.Category === 'Appearance' || it.Asset.Group.Category === 'Item'))
      .slice(0, MAX_ITEMS).map(it => {
        const variant=normalizeItemUse(it.Asset,{type:it.Property?.Type,typeRecord:it.Property?.TypeRecord});
        return {group:it.Asset.Group.Name,asset:it.Asset.Name,color:colorString(it.Color),...(variant?{use:variant}:{})};
      });
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
      if (group?.Category === 'Item' && raw.asset === HIDE_ITEM) {
        // A visual-only removal marker hides real equipment from the private
        // drawing without modifying the character's actual item state.
        result.push({group:group.Name,asset:HIDE_ITEM,color:'Default'});
        continue;
      }
      const asset=assetByName(c,group,raw.asset);
      if (!group || !asset || !group.Name || !asset.Name) {
        dropped.push(`${raw.group}/${raw.asset}: missing catalog asset on this client`);
        continue;
      }
      const normalized={group:group.Name,asset:asset.Name,color:colorString(raw.color)};
      const tune=adjustableRecord(c,normalized)?normalizeTune(raw.tune):null;
      const use=normalizeItemUse(asset,raw.use);
      if(use)normalized.use=use;
      result.push(withTune(normalized,tune));
    }
    // Mandatory body groups are restored even if a stale saved profile omitted them.
    for (const g of assetGroups(c)) if (g.Category === 'Appearance' && !g.AllowNone && !result.some(it=>it.group===g.Name)) {
      const publicItem=(c.Appearance||[]).find(x=>x?.Asset?.Group?.Name===g.Name);
      const existing=publicItem && assetByName(c,g,publicItem.Asset.Name);
      // Public appearance may use a newer/addon-only mandatory body asset.
      // Leave it untouched rather than replacing it with a random body shape.
      if (publicItem && !existing) {
        dropped.push(`${g.Name}/${publicItem.Asset.Name}: retaining unregistered public body asset`);
        continue;
      }
      const fallback=existing || groupAssets(g)[0];
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
  const appearanceItem = (asset, color, previous, use=null) => {
    // Do not share Property objects with the real BC character. Only the
    // detached private appearance receives the selected visual Type.
    let item=null;
    if (previous && previous.Asset === asset) {
      item={...previous,Color:color,Property:previous.Property?(()=>{try{return JSON.parse(JSON.stringify(previous.Property));}catch(_){return {...previous.Property};}})():undefined};
    } else {
      try {
        if(typeof AppearanceItem !== 'undefined' && typeof AppearanceItem.fromAsset==='function')
          item=AppearanceItem.fromAsset(asset,{color});
      }catch(_){}
    }
    if(!item)item={Asset:asset,Color:color,Difficulty:0};
    return applyItemUse(item,asset,use);
  };
  // Private garment compatibility. These catalog lookups are not inventory,
  // gender, or permission checks: they only choose artwork for detached clones.
  function hasBraInAppearance(appearance) {
    return Array.isArray(appearance) && appearance.some(item=>{
      const group=String(item?.Asset?.Group?.Name||'');
      const name=String(item?.Asset?.Name||'');
      // All standard Bra variants (Bra, Bra2, etc.) and chest restraints with
      // "bra" in their asset name. Never treat an arbitrary shirt as a bra.
      return /^Bra\d*$/i.test(group) ||
        (group==='ItemBreast' && /bra/i.test(name));
    });
  }
  function smallestUpperBodyAsset(c,bra=false) {
    const group=groupByName(c,'BodyUpper');
    if(!group || group.Category!=='Appearance')return null;
    const list=groupAssets(group);
    const find=(names)=>{
      for(const wanted of names) {
        const found=list.find(a=>a.Name.toLowerCase()===wanted.toLowerCase());
        if(found)return found;
      }
      return null;
    };
    // A FlatSmall silhouette does not automatically supply the *female Small*
    // sprite family. Select real female Small before all flat male presets.
    // Use Normal if Small does not exist, instead of silently choosing FlatSmall.
    const feminineSmall=['Small','SmallBreasts','SmallChest','BreastsSmall',
      'VerySmall','ExtraSmall','XSmall','XXSmall','Tiny','AA','AAA','A'];
    const flat=['Flat','FlatChest','FlatSmall','NoBreasts','NoBreast','NoChest'];
    if (bra) {
      return find(feminineSmall) ||
        list.find(a=>/small|tiny/i.test(a.Name) && !/flat|no.?breast|no.?chest/i.test(a.Name)) ||
        find(['Normal','Medium','Default']) || find(flat) || list[0] || null;
    }
    return find(flat) || find(feminineSmall) ||
      list.find(a=>/flat|no.?breast|no.?chest|small|tiny/i.test(a.Name)) || null;
  }
  function shouldRenderFeminine(c,fit,appearance) {
    // "Original" is the explicit opt-out. Otherwise every bra, even on
    // characters whose gender is unavailable in a room snapshot, requests
    // feminine art and the smallest bra-compatible female chest.
    if(normalizeFit(fit)==='original') return false;
    return hasBraInAppearance(appearance) || shouldUseFlatFeminine(c,fit,appearance);
  }
  function compatibleOriginalBodyStyle(c) {
    const group=groupByName(c,'BodyStyle');
    if(!group||group.Category!=='Appearance')return null;
    const list=groupAssets(group);
    const originals=['Original','Classic','Default'];
    for(const name of originals) {
      const match=list.find(a=>a.Name.toLowerCase()===name.toLowerCase());
      if(match)return match;
    }
    return null; // Never pick an arbitrary alternative body style.
  }
  function applyFeminineFlat(c, appearance, fit, braChest='auto') {
    if(!shouldRenderFeminine(c,fit,appearance))return appearance;
    const bra=hasBraInAppearance(appearance);
    // Auto is always the smallest *female* chest for bras. A manual choice
    // from the comparison gallery is a deliberate per-outfit exception.
    const explicit=(bra && normalizeBraChest(c,braChest)!=='auto')
      ?groupAssets(groupByName(c,'BodyUpper')).find(a=>a.Name===normalizeBraChest(c,braChest))
      :null;
    const chest=explicit || smallestUpperBodyAsset(c,bra);
    const originalStyle=bra ? compatibleOriginalBodyStyle(c) : null;
    const updated=appearance.slice();
    if(chest) {
      const index=updated.findIndex(item=>item?.Asset?.Group?.Name==='BodyUpper');
      const upper=index>=0?updated[index]:null;
      const color=upper?.Color || c.Appearance?.find(item=>item?.Asset?.Group?.Name==='BodyUpper')?.Color || 'Default';
      // Replace in-place: body items shouldn't be reordered after clothing.
      const replacement=appearanceItem(chest,color,upper);
      if(index>=0)updated[index]=replacement;
      else updated.unshift(replacement);
    }
    if(originalStyle) {
      const index=updated.findIndex(item=>item?.Asset?.Group?.Name==='BodyStyle');
      const prior=index>=0?updated[index]:null;
      // Original body artwork is the safest base for female-only bra sprites
      // when a modded/Echo body style has no corresponding bra image.
      const replacement=appearanceItem(originalStyle,prior?.Color||'Default',prior);
      if(index>=0)updated[index]=replacement;
      else updated.unshift(replacement);
    }
    return updated;
  }
  function braFitInfo(c,look,fit,braChest='auto') {
    if(!c)return null;
    const appearance=appearanceFor(c,look,fit,braChest);
    if(!appearance)return null;
    return {mode:normalizeFit(fit),braChest:normalizeBraChest(c,braChest),femaleArtwork:shouldRenderFeminine(c,fit,appearance),autoSmallFemale:smallestUpperBodyAsset(c,true)?.Name||null,braDetected:hasBraInAppearance(appearance),
      detectedGender:String(c.Gender??''),sourceChest:appearanceChest(c.Appearance),fitReason:normalizeFit(fit)==='original'?'original / no override':normalizeFit(fit)==='flat'?'forced flat':flatChestName(appearanceChest(c.Appearance))?'flat source body':'gender / body detection',
      bra:appearance.filter(it=>it?.Asset?.Group?.Name==='Bra'||(it?.Asset?.Group?.Name==='ItemBreast'&&/bra/i.test(it.Asset?.Name||''))).map(it=>it.Asset.Name),
      chest:appearance.find(it=>it?.Asset?.Group?.Name==='BodyUpper')?.Asset?.Name||null,
      bodyStyle:appearance.find(it=>it?.Asset?.Group?.Name==='BodyStyle')?.Asset?.Name||null,
      availableChestSizes:groupAssets(groupByName(c,'BodyUpper')).map(a=>a.Name),
      availableBodyStyles:groupAssets(groupByName(c,'BodyStyle')).map(a=>a.Name),braAssetsInCatalog:groupAssets(groupByName(c,'Bra')).length
    };
  }
  const appearanceFor = (c, look, fit='auto', braChest='auto') => {
    const records=validateLook(c,look);
    if (!records) return null;
    const recordGroups=new Set(records.map(r=>r.group));
    const supportedGroups=new Set(assetGroups(c).map(g=>g.Name));
    // Preserve real equipment unless the private look explicitly replaces or
    // hides that group's drawing. No live character/inventory state is edited.
    const modified=(Array.isArray(c.Appearance)?c.Appearance:[]).filter(x=>{
      const g=x?.Asset?.Group?.Name,category=x?.Asset?.Group?.Category;
      if (!g || !supportedGroups.has(g))return true;
      if (category === 'Item') return !recordGroups.has(g);
      if (category !== 'Appearance') return true;
      return !assetByName(c,groupByName(c,g),x.Asset.Name) && !recordGroups.has(g);
    });
    const oldByGroup=new Map((c.Appearance||[]).filter(x=>x?.Asset?.Group).map(x=>[x.Asset.Group.Name,x]));
    for (const record of records) {
      if (record.asset === HIDE_ITEM) continue;
      const group=groupByName(c,record.group),asset=assetByName(c,group,record.asset);
      if (!asset)continue;
      modified.push(appearanceItem(asset,record.color,oldByGroup.get(record.group),record.use));
    }
    return applyFeminineFlat(c,modified,fit,braChest);
  };
  const configKey = () => `pawPrivateWardrobe:v1:${member(me())}`;
  function loadSettings() {
    const id = member(me()); if (!id || id === app.lastAccount) return;
    app.lastAccount = id;
    app.profiles = {}; app.outfits = {}; app.favorites = {}; app.remote = {}; app.peers.clear(); app.clones = new WeakMap();
    app.diagnostics={dropped:[],lastEditSkipped:[],render:'not yet attempted',lastError:'',sync:{stateSent:0,stateReceived:0,ackReceived:0,ackRejected:0,lastSend:null,lastReceive:null,lastAck:null,lastProblem:''}};
    app.lastSent.clear(); app.packets.clear(); app.studio=null; app.studioClones=new WeakMap();
    try {
      const saved = JSON.parse(localStorage.getItem(configKey()) || '{}');
      if (saved && typeof saved === 'object') {
        app.enabled = saved.enabled !== false;
        app.allowPartnerEdits = saved.allowPartnerEdits !== false && saved.allowOwnerEdits !== false;
        app.selected = Number.isInteger(saved.selected) ? saved.selected : 0;
        app.profiles = saved.profiles && typeof saved.profiles === 'object' ? saved.profiles : {};
        app.outfits = saved.outfits && typeof saved.outfits === 'object' && !Array.isArray(saved.outfits) ? saved.outfits : {};
        app.favorites = saved.favorites && typeof saved.favorites==='object' && !Array.isArray(saved.favorites) ? Object.fromEntries(Object.entries(saved.favorites).filter(([k,v])=>k.length<=180&&v===true).slice(0,1500)) : {};
        // One-time migration: old hand-picked bra sizes can silently defeat
        // the new automatic female-Small compatibility. Reset them for bras
        // in Automatic/Flat mode. Users can deliberately reselect a manual
        // size afterwards; existing public characters are never altered.
        if (!saved.braAutoSmallMigrated215) {
          const hasSavedBra = entry => Array.isArray(entry?.look) && entry.look.some(item =>
            /^Bra\d*$/i.test(item.group || '') ||
            (item.group === 'ItemBreast' && /bra/i.test(item.asset || '')));
          for (const entry of Object.values(app.profiles)) {
            if (hasSavedBra(entry) && normalizeFit(entry.fit) !== 'original') entry.braChest='auto';
          }
          for (const list of Object.values(app.outfits)) if (Array.isArray(list)) {
            for (const entry of list) if (hasSavedBra(entry) && normalizeFit(entry.fit) !== 'original') entry.braChest='auto';
          }
          try { localStorage.setItem(configKey(), JSON.stringify({...saved,profiles:app.profiles,outfits:app.outfits,braAutoSmallMigrated215:true})); }
          catch (_) {}
        }
        app.launcherPosition = saved.launcherPosition && Number.isFinite(saved.launcherPosition.x) && Number.isFinite(saved.launcherPosition.y) ? saved.launcherPosition : null;
        app.background = typeof saved.background === 'string' ? saved.background : 'violet';
        app.previewSize = [320,380,460,540,640].includes(saved.previewSize) ? saved.previewSize : 380;
        app.studioLayout = saved.studioLayout==='atelier'?'atelier':'bc';
        app.showThumbnails = saved.previewModeV3 ? saved.showThumbnails !== false : true;
        app.thumbnailFocus = saved.thumbnailFocus === 'full' ? 'full' : 'item';
        app.customBackground = typeof saved.customBackground === 'string' && /^https:\/\//.test(saved.customBackground) ? saved.customBackground : '';
      }
    } catch (err) { console.warn('[Paw Private Wardrobe] Could not load settings:', err); }
  }
  function saveSettings() {
    if (!me()) return;
    try { localStorage.setItem(configKey(), JSON.stringify({enabled:app.enabled,allowPartnerEdits:app.allowPartnerEdits,selected:app.selected,profiles:app.profiles,outfits:app.outfits,favorites:app.favorites,launcherPosition:app.launcherPosition,previewModeV3:true,braAutoSmallMigrated215:true,studioLayout:app.studioLayout,background:app.background,previewSize:app.previewSize,customBackground:app.customBackground,showThumbnails:app.showThumbnails,thumbnailFocus:app.thumbnailFocus})); }
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
    requestRoomRedraw();
  }
  function requestRoomRedraw() {
    try { if (typeof AnimationRequestRefreshRate === 'function') AnimationRequestRefreshRate(30); } catch (_) {}
    try { if (typeof AnimationRequestDraw === 'function') AnimationRequestDraw(); } catch (_) {}
    try { if (typeof DrawProcess === 'function') DrawProcess(0); } catch (_) {}
    try { if (typeof ChatRoomCharacterViewUpdate === 'function') ChatRoomCharacterViewUpdate(); } catch (_) {}
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
  function sendState(partner, subject, look, changed=Date.now(), fit='auto', braChest='auto') {
    if (!eligible(partner)) return false;
    const peer = app.peers.get(partner);
    if (!peer || !peer.enabled) return false;
    if (subject === partner && !peer.accept) return false;
    const c = findChar(subject);
    const validated = validateLook(c, look);
    if (!validated) return false;
    if (subject !== member(me()) && subject !== partner) return false;
    const sent=syncSend(partner, {type:'STATE',subject,look:validated,fit:normalizeFit(fit),braChest:normalizeBraChest(c,braChest),ts:changed});
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
      else if (Array.isArray(saved.look)) sendState(id,subject,saved.look,saved.changed||0,saved.fit,saved.braChest);
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
        setStatus(payload.result==='staged'?'Partner received the look; live-room rendering not yet verified.':'Partner acknowledged the private look ('+payload.result+').');
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
      const fit=normalizeFit(payload.fit),braChest=normalizeBraChest(findChar(subject),payload.braChest);
      app.remote[k]={look,fit,braChest,received:Date.now()};
      // Keep synchronized private looks available after a refresh/rejoin.
      app.profiles[k]={look,fit,braChest,changed:stamp};
      if(app.studio?.partner===sender && app.studio.subject===subject)app.studio.remoteChanged=true;
    }
    sync.stateReceived++;
    sync.lastReceive={from:sender,subject,ts:stamp,at:Date.now(),type:payload.type};
    const oldPeer=app.peers.get(sender)||{enabled:true,accept:true};
    app.peers.set(sender,{...oldPeer,at:Date.now()}); // Don't silently override permission settings.
    saveSettings();refreshView();
    setStatus('Private appearance received and stored; checking room renderer.');
    ack('staged'); // Transfer succeeded; a real room draw is verified separately.
    if (app.studio?.remoteChanged) renderStudio();
    if(app.panel && app.panel.style.display!=='none')renderPanel();
  }
  function addHooks() {
    if (!globalThis.bcModSdk || typeof globalThis.bcModSdk.registerMod !== 'function') return false;
    if(app.mod || app.registrationAttempted) {app.initFatal=true;return false;}
    try {
      const listed=typeof globalThis.bcModSdk.getMods==='function'?globalThis.bcModSdk.getMods():null;
      if(Array.isArray(listed)&&listed.some(m=>(m?.name||m?.info?.name||m?.meta?.name)==='PawPrivateWardrobe')) {
        console.warn('[Paw Private Wardrobe] Existing ModSDK registration found. Disable the older script and refresh.');
        app.initFatal=true;return false;
      }
    } catch(_) { /* ModSDK builds differ: skip optional inspection. */ }
    // Set before registerMod: even a partial startup must never register twice.
    app.registrationAttempted=true;
    try {
      app.mod = globalThis.bcModSdk.registerMod({name:'PawPrivateWardrobe',fullName:'Paw Private Wardrobe',version:'0.3.0'});
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
      // BC can leave DialogCharacter populated after closing a character menu.
      // Scope room drawing to ChatRoomDrawCharacter when the current game build exposes it.
      // The native interaction renderer is never given a private replica on unscoped focused item draws.
      try {
        app.mod.hookFunction('ChatRoomDrawCharacter', 10, (args,next) => {
          app.roomDrawHookSeen = true;
          app.roomDrawCalls++;
          app.drawScope++;
          try { return next(args); }
          finally { app.drawScope--; }
        });
        app.roomDrawHookAvailable = true;
      } catch(err) {
        // Some BC versions expose character draws through a different function.
        console.warn('[Paw Private Wardrobe] Room-scoped draw hook unavailable; using focused-item guard.',err);
      }
      // R133+ room views may render Character.Canvas directly, bypassing
      // DrawCharacter. Intercept a known source canvas at the final draw call.
      // Keep native dialog/item-zone rendering entirely separate.
      for (const name of ['DialogDraw','DialogDrawCharacter','InventoryItemDraw']) {
        try {
          app.mod.hookFunction(name, 2, withNativeDrawScope);
          app.nativeHookNames.push(name);
        } catch(_) { /* Function absent in this BC build. */ }
      }
      for (const name of ['DrawCanvas','DrawImageCanvas','DrawImageEx']) {
        try {
          app.mod.hookFunction(name, 25, (args,next)=>{
            app.canvasHookCalls++;
            let prepared;
            try {prepared=candidateCanvasReplacement(args);} catch(err) {
              app.diagnostics.lastError='Canvas fallback: '+String(err);
            }
            return next(prepared||args);
          });
          app.canvasHookNames.push(name);
        } catch(_) { /* Function absent in this BC build. */ }
      }
      // A detached character clone is drawn instead of changing the live Appearance or Canvas.
      app.mod.hookFunction('DrawCharacter', 15, (args,next) => {
        const C=args[0];
        try {
          const subjectId=member(C);
          // Fast-path: the room draws many unrelated characters each frame.
          // Only the current account and selected partner can have a private look.
          if (app.enabled && C && subjectId &&
              (subjectId===member(me()) || subjectId===app.selected) &&
              eligiblePartnerForCharacter(C)) {
            const inRoomDraw = app.drawScope > 0;
            if (!inRoomDraw && isNativeInteractionOpen()) {
              app.nativeDrawSkips++;
              return next(args); // Native item/zone UI needs the real character.
            }
            const look=effectiveLook(C);
            if (look) {
              const clone=getRenderClone(C,look,app.clones,requestRoomRedraw,privateFit(C),privateBraChest(C));
              if (clone && clone.Canvas) {
                app.privateDrawCalls++;
                app.diagnostics.render='private replica used in DrawCharacter';
                return next([clone,...args.slice(1)]);
              }
            }
          }
        } catch(err) {console.warn('[Paw Private Wardrobe] Render fallback to public:',err);}
        return next(args);
      });
      return true;
    } catch(err) {app.initFatal=true;app.diagnostics.lastError=String(err);console.error('[Paw Private Wardrobe] Hook registration failed (no retry)',err);return false;}
  }
  // Only a focused item/slot is evidence of an active native interaction.
  // DialogCharacter by itself is NOT evidence: BC can retain it while viewing the room.
  // Checking DialogCharacter alone was the v0.2.3 regression that hid every saved look.
  function isNativeInteractionOpen() {
    // DialogFocusItem/Group can persist after the dialog closes. Their mere
    // presence must NOT disable room appearances. Only the active native
    // drawing stack or a screen other than ChatRoom can suppress replacements.
    if (typeof CurrentScreen !== 'undefined' && CurrentScreen !== 'ChatRoom') return true;
    return app.nativeDrawScope > 0 && app.drawScope === 0;
  }
  function withNativeDrawScope(args,next) {
    app.nativeDrawScope++;
    try { return next(args); }
    finally { app.nativeDrawScope--; }
  }
  function candidateCanvasReplacement(args) {
    if (!app.enabled || !inRoom() || isNativeInteractionOpen()) return null;
    // Some BC views draw the stored character canvases directly, without
    // calling DrawCharacter. Never rewrite canvas data or actual Appearance;
    // replace only the source-canvas argument for this single draw call.
    // This function is called for *every* room canvas operation. Most calls
    // draw backgrounds/UI/other players, not one of our two characters. Check
    // canvas identity first; don't scan relationships until we find a match.
    const own=me();
    const partner=app.selected ? findChar(app.selected) : null;
    if(!own && !partner)return null;
    for(let i=0;i<Math.min(args.length,10);i++) {
      const source=args[i];
      if (!source || (typeof source!=='object' && typeof source!=='function')) continue;
      for(const c of [own,partner]){
        if(!c || !c.Canvas || (source!==c.Canvas && source!==c.CanvasBlink))continue;
        const look=effectiveLook(c);
        if(!look)continue;
        const clone=getRenderClone(c,look,app.clones,requestRoomRedraw,privateFit(c),privateBraChest(c));
        if(!clone || !clone.Canvas)continue;
        const replacement=source===c.CanvasBlink ? (clone.CanvasBlink||clone.Canvas) : clone.Canvas;
        if(!replacement || replacement===source)continue;
        const updated=args.slice();
        updated[i]=replacement;
        app.privateCanvasCalls++;
        app.diagnostics.render='private character canvas substituted for room draw';
        return updated;
      }
    }
    return null;
  }
  function eligiblePartnerForCharacter(c) {
    const p=currentPartner();
    return !!p && (member(c)===member(me()) || member(c)===member(p));
  }
  function getRenderClone(c,look,cache=app.clones,onReady=null,fit='auto',braChest='auto') {
    fit=normalizeFit(fit);
    braChest=normalizeBraChest(c,braChest);
    const cached=cache.get(c);
    // Stable array reference is a cheap draw-frame cache key. Edits always replace the array.
    if (cached && cached.lookRef===look && cached.fit===fit && cached.braChest===braChest && cached.generation===app.generation)
      return cached.pending ? null : cached.clone;
    const appearance=appearanceFor(c,look,fit,braChest);
    if (!appearance) {app.diagnostics.render='appearance data could not be normalized';return null;}
    // Never assign the modified appearance to the real Player or room character.
    const replica=Object.assign(Object.create(Object.getPrototypeOf(c)),c);
    replica.Appearance=appearance;
    // Only the detached clone receives a feminine gender flag. BC's asset
    // loader may use this flag when picking female-only clothing layers.
    if(shouldRenderFeminine(c,fit,appearance))replica.Gender='F';
    replica.Canvas=document.createElement('canvas');
    replica.Canvas.width=c.Canvas?.width || 500;
    replica.Canvas.height=c.Canvas?.height || 1000;
    replica.CanvasBlink=document.createElement('canvas');
    replica.CanvasBlink.width=replica.Canvas.width;
    replica.CanvasBlink.height=replica.Canvas.height;
    replica.DrawAppearance=appearance;
    replica.__PawPrivateReplica=true;
    if (typeof CharacterLoadCanvas!=='function') {app.diagnostics.render='CharacterLoadCanvas is unavailable';return null;}
    const record={lookRef:look,fit,braChest,generation:app.generation,pending:true,clone:null};
    cache.set(c,record);
    const tuned=look.filter(r=>adjustableRecord(c,r) && normalizeTune(r.tune)).slice(0,5);
    const finish=()=>{
      if(cache.get(c)!==record)return;
      record.pending=false;record.clone=replica;
      app.diagnostics.render=tuned.length?'private item adjustments composited':'private replica prepared; waiting for room draw';
      if(onReady)onReady();
    };
    const afterLoad=()=>{
      if(cache.get(c)!==record)return;
      if(!tuned.length) {finish();return;}
      let tries=0;
      const awaitSource=()=>{
        if(cache.get(c)!==record)return;
        if(thumbnailCanvasReady(replica.Canvas)){
          applyPrivateItemTuning(c,replica,look,tuned,fit,braChest,()=>{
            if(cache.get(c)===record)finish();
          });
          return;
        }
        if(++tries<12)setTimeout(awaitSource,140+tries*70);
        else {app.diagnostics.lastError='Item tuning: source drawing unavailable';finish();}
      };
      setTimeout(awaitSource,90);
    };
    try {
      const result=CharacterLoadCanvas(replica);
      if (result && typeof result.then==='function') {
        Promise.resolve(result).then(afterLoad).catch(e=>{
          app.diagnostics.lastError='Asynchronous canvas failed: '+String(e);
          if(cache.get(c)===record)finish();
        });
      } else afterLoad();
      return tuned.length?null:replica;
    } catch (err) {
      record.pending=false;
      app.diagnostics.render='private canvas exception: '+String(err);
      console.warn('[Paw Private Wardrobe] Could not create safe private render:',err);
      return null;
    }
  }
  // Self-contained private compositor (not Liko-AEE's source code). It renders
  // each tuned clothing/accessory group once with the item omitted, then
  // uses the changed pixels as a movable visual layer on the detached canvas.
  // BC's native layer-order/alpha APIs differ by build, so this intentionally
  // does not write AEE properties to public Items or claim native layer parity.
  function applyPrivateItemTuning(c,replica,look,tuned,fit,braChest,onDone) {
    const width=replica.Canvas.width,height=replica.Canvas.height;
    if(!width||!height||width>2048||height>2048){onDone();return;}
    const raw=document.createElement('canvas');raw.width=width;raw.height=height;
    const rawCtx=raw.getContext('2d',{willReadFrequently:true});
    if(!rawCtx){onDone();return;}
    try {rawCtx.drawImage(replica.Canvas,0,0);}catch(_){onDone();return;}
    const originals=rawCtx.getImageData(0,0,width,height);
    const overlays=[];
    const work=tuned.slice().sort((a,b)=>normalizeTune(a.tune).priority-normalizeTune(b.tune).priority);
    let nextIndex=0;
    const next=()=>{
      if(nextIndex>=work.length){
        try {
          const ctx=replica.Canvas.getContext('2d');
          if(ctx){
            ctx.clearRect(0,0,width,height);
            ctx.drawImage(raw,0,0);
            for(const entry of overlays){
              const t=entry.tune,b=entry.bounds;
              ctx.save();
              ctx.globalAlpha=t.opacity/100;
              ctx.translate(b.x+b.w/2+t.x,b.y+b.h/2+t.y);
              ctx.rotate(t.angle*Math.PI/180);
              ctx.scale((t.scaleX/100)*(t.mirrorX?-1:1),(t.scaleY/100)*(t.mirrorY?-1:1));
              ctx.drawImage(entry.canvas,-b.w/2,-b.h/2);
              ctx.restore();
            }
          }
        }catch(e){app.diagnostics.lastError='Item compositor: '+String(e);}
        onDone();return;
      }
      const item=work[nextIndex++],t=normalizeTune(item.tune);
      if(!t){next();return;}
      const group=groupByName(c,item.group);
      const removed=look.filter(x=>x.group!==item.group);
      // Render a compatible reference without this wardrobe item. We do not
      // mutate the Player or partner's actual Appearance.
      if(group?.Category==='Item')removed.push({group:item.group,asset:HIDE_ITEM,color:'Default'});
      const plain=removed.map(x=>({group:x.group,asset:x.asset,color:x.color}));
      const cache=new WeakMap();let attempts=0;
      const ready=()=>{
        const base=getRenderClone(c,plain,cache,ready,fit,braChest);
        if(base?.Canvas && thumbnailCanvasReady(base.Canvas)) {
          try{
            const baseCanvas=base.Canvas;
            const baseCtx=baseCanvas.getContext('2d',{willReadFrequently:true});
            if(!baseCtx){next();return;}
            const reference=baseCtx.getImageData(0,0,width,height).data;
            const src=originals.data;
            const target=rawCtx.getImageData(0,0,width,height);
            const px=target.data;
            const layer=document.createElement('canvas');layer.width=width;layer.height=height;
            const lctx=layer.getContext('2d',{willReadFrequently:true});
            const layerData=lctx.createImageData(width,height);const out=layerData.data;
            let minX=width,minY=height,maxX=-1,maxY=-1;
            // Diff tolerance avoids spreading negligible antialiasing noise.
            for(let n=0;n<src.length;n+=4){
              const delta=Math.abs(src[n]-reference[n])+Math.abs(src[n+1]-reference[n+1])+Math.abs(src[n+2]-reference[n+2]);
              const ad=Math.abs(src[n+3]-reference[n+3]);
              if(delta<48 && ad<15)continue;
              const id=n/4,x=id%width,y=Math.floor(id/width);
              minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
              for(let k=0;k<4;k++){out[n+k]=src[n+k];px[n+k]=reference[n+k];}
            }
            if(maxX<minX||maxY<minY){next();return;}
            // Keep the unedited base for subsequent groups; write the final
            // replacement onto the raw reference after extracting this layer.
            rawCtx.putImageData(target,0,0);
            lctx.putImageData(layerData,0,0);
            const bounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
            const cropped=document.createElement('canvas');cropped.width=bounds.w;cropped.height=bounds.h;
            cropped.getContext('2d').drawImage(layer,bounds.x,bounds.y,bounds.w,bounds.h,0,0,bounds.w,bounds.h);
            overlays.push({canvas:cropped,bounds,tune:t});
          } catch(e) {app.diagnostics.lastError='Item diff: '+String(e);}
          next();return;
        }
        if(++attempts<12)setTimeout(ready,110+attempts*75);
        else next();
      };
      ready();
    };
    next();
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
  const isClothes = g => g.Category === 'Appearance' && !!g.Clothing;
  const groupClass = g => g.Category === 'Item' ? 'Gear' : g.Clothing ? 'Clothing' : /hair|eye|body|skin|mouth|nose|face|brow|breast|pupil|iris/i.test(g.Name) ? 'Body' : 'Accessories';
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
    app.nativeThumbToken=(app.nativeThumbToken||0)+1;
    if(app.studio){app.studio.dragTempLook=null;app.studio.dragTempClones=null;}
    app.studio=null;app.studioClones=new WeakMap();app.studioFit=null;app.studioDrawTicket++;
    if(app.studioPanel)app.studioPanel.style.display='none';
    refreshView(); if(app.panel?.style.display!=='none')renderPanel();
  }
  const HISTORY_LIMIT=35;
  function studioSnapshot(st) {
    return {look:cloneJson(st.look),fit:normalizeFit(st.fit),braChest:st.braChest};
  }
  function recordStudioChange(st) {
    if(!st)return;
    if(!Array.isArray(st.undo))st.undo=[];
    if(!Array.isArray(st.redo))st.redo=[];
    st.undo.push(studioSnapshot(st));
    if(st.undo.length>HISTORY_LIMIT)st.undo.shift();
    st.redo.length=0;
  }
  function restoreStudioState(st,previous) {
    if(!st||!previous)return;
    const c=findChar(st.subject);
    if(!c)return;
    st.look=validateLook(c,previous.look||[]);
    st.fit=normalizeFit(previous.fit);
    st.braChest=normalizeBraChest(c,previous.braChest);
    st.dirty=true;st.overwriteConfirmed=false;st.comparePublic=false;
    app.studioClones=new WeakMap();app.diagnostics.lastEditSkipped=app.diagnostics.dropped.slice();
    renderStudio();
  }
  function undoStudio() {
    const st=app.studio;if(!st||!st.undo?.length)return;
    if(!Array.isArray(st.redo))st.redo=[];
    st.redo.push(studioSnapshot(st));
    restoreStudioState(st,st.undo.pop());
  }
  function redoStudio() {
    const st=app.studio;if(!st||!st.redo?.length)return;
    if(!Array.isArray(st.undo))st.undo=[];
    st.undo.push(studioSnapshot(st));
    restoreStudioState(st,st.redo.pop());
  }
  function changeStudioFit(nextFit,nextBra) {
    const st=app.studio;if(!st)return;
    const c=findChar(st.subject);if(!c)return;
    const normalizedFit=normalizeFit(nextFit),normalizedBra=normalizeBraChest(c,nextBra);
    if(st.fit===normalizedFit&&st.braChest===normalizedBra)return;
    recordStudioChange(st);
    st.fit=normalizedFit;st.braChest=normalizedBra;
    st.dirty=true;st.overwriteConfirmed=false;st.comparePublic=false;
    app.studioClones=new WeakMap();renderStudio();
  }
  const favoriteKey=(group,asset)=>String(group)+'::'+String(asset);
  function isFavorite(group,asset){return app.favorites[favoriteKey(group,asset)]===true;}
  function toggleFavorite(group,asset) {
    const k=favoriteKey(group,asset);
    if(isFavorite(group,asset))delete app.favorites[k];
    else if(Object.keys(app.favorites).length<1500)app.favorites[k]=true;
    saveSettings();
  }
  function beginStudio(subject) {
    const partner=currentPartner(),c=findChar(subject);if(!partner||!c||!app.enabled)return;
    const pid=member(partner), stored=app.profiles[key(pid,subject)];
    if(subject===pid && app.peers.get(pid)?.accept===false){setStatus('Your partner disabled remote styling.');return;}
    const current=(!stored?.removed && Array.isArray(stored?.look))?stored.look:app.remote[key(pid,subject)]?.look;
    const source=(!stored?.removed&&Array.isArray(stored?.look))?stored:app.remote[key(pid,subject)];
    app.studio={partner:pid,subject,look:cloneJson(current||snapshot(c)),fit:normalizeFit(source?.fit),braChest:normalizeBraChest(c,source?.braChest),dirty:false,remoteChanged:false,overwriteConfirmed:false,undo:[],redo:[],comparePublic:false,dragEnabled:false,dragGroup:null,dragTempLook:null,dragTempClones:null};
    app.nativeMode='slots';app.nativeTab='Clothing';app.nativePage=0;app.nativeSearch='';app.nativeSearchAsset='';app.nativeGroup='';
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
    if(JSON.stringify(checked)===JSON.stringify(st.look))return;
    recordStudioChange(st);
    st.look=checked;st.dirty=true;st.overwriteConfirmed=false;st.comparePublic=false;
    app.studioClones=new WeakMap();app.diagnostics.lastEditSkipped=app.diagnostics.dropped.slice();renderStudio();
  }
  // A fine-tune slider changes the image of ONE existing item, not the
  // gallery selection. Avoid rebuilding 6 complete thumbnail characters and
  // every wardrobe control just to resize/move/fade the chosen accessory.
  function modifyStudioTuneFast(callback) {
    const st=app.studio;if(!st)return;
    const c=findChar(st.subject);if(!c)return;
    const updated=cloneJson(st.look);callback(updated,c);
    const checked=validateLook(c,updated);
    if(!checked){setStatus('Invalid appearance edit.');return;}
    if(JSON.stringify(checked)===JSON.stringify(st.look))return;
    recordStudioChange(st);
    st.look=checked;st.dirty=true;st.overwriteConfirmed=false;st.comparePublic=false;
    app.studioClones=new WeakMap();app.diagnostics.lastEditSkipped=app.diagnostics.dropped.slice();
    // Keep the existing controls and thumbnails mounted. Only the character
    // render, which is now using the modified draft, needs recomposition.
    const history=app.studioPanel?.querySelectorAll('.pwr-history-btn');
    if(history?.length>1){history[0].disabled=!st.undo.length;history[1].disabled=!st.redo.length;}
    drawStudioCanvas();
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
    app.profiles[key(pid,subject)]={look,fit:normalizeFit(st.fit),braChest:normalizeBraChest(c,st.braChest),changed};delete app.remote[key(pid,subject)];
    saveSettings();refreshView();closeStudio();
    const sent=sendState(pid,subject,look,changed,st.fit,st.braChest);
    setStatus(sent?'Private look saved and sent; awaiting acknowledgment.':'Saved locally but partner delivery is unavailable.');
  }
  function savedOutfitsFor(st) {
    const k=key(st.partner,st.subject);
    return Array.isArray(app.outfits[k]) ? app.outfits[k] : [];
  }
  function saveOutfitPreset(name) {
    const st=app.studio;if(!st)return false;
    const c=findChar(st.subject),valid=validateLook(c,st.look);
    if(!valid)return false;
    const k=key(st.partner,st.subject),list=savedOutfitsFor(st).slice();
    if(list.length>=MAX_SAVED_OUTFITS){setStatus('Maximum '+MAX_SAVED_OUTFITS+' saved outfits for this person. Remove one first.');return false;}
    const raw=String(name||'').trim().slice(0,60);
    const title=raw||'Outfit '+new Date().toLocaleString();
    list.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:title,look:cloneJson(valid),fit:normalizeFit(st.fit),braChest:normalizeBraChest(c,st.braChest),savedAt:Date.now()});
    app.outfits[k]=list;saveSettings();setStatus('Saved private outfit preset: '+title);renderStudio();return true;
  }
  function loadOutfitPreset(id) {
    const st=app.studio;if(!st)return;
    const entry=savedOutfitsFor(st).find(x=>x?.id===id);
    if(!entry||!Array.isArray(entry.look))return;
    const c=findChar(st.subject);if(!c)return;
    const look=validateLook(c,cloneJson(entry.look));
    if(!look)return;
    recordStudioChange(st);
    app.nativeThumbCache=new Map();st.look=look;st.fit=normalizeFit(entry.fit);st.braChest=normalizeBraChest(c,entry.braChest);
    st.dirty=true;st.overwriteConfirmed=false;st.comparePublic=false;
    app.studioClones=new WeakMap();renderStudio();
    setStatus('Loaded preset and body fit into your draft. Undo is available. Press Save & share when ready.');
  }
  function renameOutfitPreset(id,name) {
    const st=app.studio;if(!st)return;
    const entry=savedOutfitsFor(st).find(x=>x?.id===id);
    const title=String(name||'').trim().slice(0,60);
    if(!entry||!title)return;
    entry.name=title;saveSettings();setStatus('Renamed outfit preset.');renderStudio();
  }
  function deleteOutfitPreset(id) {
    const st=app.studio;if(!st)return;
    const k=key(st.partner,st.subject),list=savedOutfitsFor(st);
    const entry=list.find(x=>x?.id===id);if(!entry)return;
    if(!confirm('Delete private outfit preset "'+String(entry.name||'').replace(/["\\]/g,'')+'"?'))return;
    app.outfits[k]=list.filter(x=>x?.id!==id);saveSettings();setStatus('Outfit preset deleted.');renderStudio();
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
    append(panel,node('div',peer?.enabled?('● Partner addon detected · '+(peer.version===VERSION?'Both on '+VERSION.replace('-beta','')+' · Viewing':'Partner version '+(peer.version||'unknown')+' (update both accounts)')):peer?'Partner disabled sharing':'Waiting for partner addon','pwr-badge'));
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
    append(panel,button('Reset floating button position',()=>{app.launcherPosition=null;saveSettings();applyLauncherPosition();},'pwr-secondary'));
    append(panel,node('div',app.status,'pwr-help'));panel.lastElementChild.id='pwr-status';
    append(panel,node('p','Catalog items are visual-only; owning items or gender restrictions do not filter this studio. The private body-fit setting can use female flat-chest layers when supplied by BC. Missing sprites cannot be drawn. Private packets are not end-to-end encrypted. No public BC appearance or actual restraints are changed.','pwr-help'));
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
  // Body, hair and accessories need different viewing windows. Using the
  // difference versus a REMOVED mandatory Body slot gave invalid/blank renders;
  // long hair could also extend a small head crop over the entire character.
  function thumbnailMode(group) {
    const name=String(group?.Name||'').toLowerCase().replace(/[^a-z]/g,'');
    if (/^hair/.test(name)) return 'hair';
    if (/^(body|bodytype|bodyshape|bodysize|bodyfull|skin|skincolor|height)$/.test(name)) return 'body';
    if (/^(bodyupper|upperbody|breast|breasts|chest)$/.test(name)) return 'upper-body';
    if (/^(bodylower|lowerbody|hips|pelvis)$/.test(name)) return 'lower-body';
    return 'item';
  }
  function thumbnailBox(box,W,H,ratio=250/198) {
    // Frame a chosen body region at the actual aspect ratio of its preview.
    // Clamp only after fitting and keep the center of the subject in the view.
    const bw=Math.max(1,Number(box.width)||1),bh=Math.max(1,Number(box.height)||1);
    let width=Math.max(70,bw),height=Math.max(70,bh);
    if (width/height<ratio)width=height*ratio;else height=width/ratio;
    const shrink=Math.min(1,W/width,H/height);
    width*=shrink;height*=shrink;
    const cx=(Number(box.x)||0)+bw/2,cy=(Number(box.y)||0)+bh/2;
    return {x:Math.max(0,Math.min(W-width,cx-width/2)),y:Math.max(0,Math.min(H-height,cy-height/2)),width,height};
  }
  function thumbnailFocusBounds(source,reference,group,ratio=250/198) {
    const full=visibleStudioBounds(source);
    const W=Number(source.width)||500,H=Number(source.height)||1000;
    const name=String(group?.Name||'').toLowerCase();
    const mode=thumbnailMode(group);
    const frame=(x,y,w,h)=>thumbnailBox({x:full.x+full.width*x,y:full.y+full.height*y,
      width:full.width*w,height:full.height*h},W,H,ratio);
    // Intentional subject composition, not an auto-diff. Long hair often runs
    // to the hips, but users need the style's bangs and silhouette at eye level.
    if(mode==='hair')return /back|extension|long|rear/.test(name)
      ?frame(.04,.005,.92,.67) : frame(.04,.005,.92,.46);
    if(mode==='body')return thumbnailBox(full,W,H,ratio);
    if(mode==='upper-body')return frame(.04,.16,.92,.53);
    if(mode==='lower-body')return frame(.04,.47,.92,.5);
    function fallback(){
      if(/glass|eye|head|mouth|face|brow|mask|nose|gag|hat|ear/.test(name))return frame(.04,.025,.92,.36);
      if(/shoe|boot|sock|foot|ankle/.test(name))return frame(.06,.74,.88,.25);
      if(/pant|skirt|leg|kne(e|es)|thigh|lower/.test(name))return frame(.06,.47,.88,.48);
      if(/bra|breast|neck|collar|arm|glove|upper|shirt|cloth|top/.test(name))return frame(.05,.23,.9,.44);
      if(/hand|hold|item/.test(name))return frame(.05,.35,.9,.46);
      return frame(.05,.25,.9,.49);
    }
    if(!reference || source===reference)return fallback();
    try {
      const tw=Math.min(240,W),th=Math.min(480,H);
      const probe=document.createElement('canvas');probe.width=tw;probe.height=th;
      const ctx=probe.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('no context');
      ctx.drawImage(source,0,0,tw,th);const a=ctx.getImageData(0,0,tw,th).data;
      ctx.clearRect(0,0,tw,th);ctx.drawImage(reference,0,0,tw,th);const b=ctx.getImageData(0,0,tw,th).data;
      let x0=tw,y0=th,x1=-1,y1=-1,changed=0;
      for(let y=0;y<th;y+=2)for(let x=0;x<tw;x+=2){
        const n=(y*tw+x)*4,da=Math.abs(a[n+3]-b[n+3]);
        const delta=Math.abs(a[n]-b[n])+Math.abs(a[n+1]-b[n+1])+Math.abs(a[n+2]-b[n+2]);
        if(da<28 && delta<82)continue;
        if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;changed++;
      }
      if(changed<4||x1<x0||y1<y0)return fallback();
      const box={x:x0*W/tw,y:y0*H/th,width:Math.max(1,(x1-x0+2)*W/tw),height:Math.max(1,(y1-y0+2)*H/th)};
      const dx=Math.max(20,box.width*.34),dy=Math.max(22,box.height*.31);
      return thumbnailBox({x:box.x-dx,y:box.y-dy,width:box.width+2*dx,height:box.height+2*dy},W,H,ratio);
    }catch(_){return fallback();}
  }
  function thumbnailCanvasReady(source) {
    // BC can populate the Canvas asynchronously even when CharacterLoadCanvas
    // itself returns void. Don't mark a transparent frame as successfully drawn.
    try {
      const probe=document.createElement('canvas');probe.width=36;probe.height=72;
      const ctx=probe.getContext('2d',{willReadFrequently:true});
      if(!ctx||!ctx.getImageData)return true; // non-readable contexts: best effort
      ctx.drawImage(source,0,0,36,72);
      const pixels=ctx.getImageData(0,0,36,72).data;
      for(let i=3;i<pixels.length;i+=4)if(pixels[i]>4)return true;
      return false;
    }catch(_){return true;}
  }
  function drawStudioCanvas() {
    const st=app.studio;if(!st||!app.studioPanel||app.studioPanel.style.display==='none')return;
    const scene=app.studioPanel.querySelector('.pwr-scene');
    const canvas=app.studioPanel.querySelector('.pwr-character-canvas');
    if(!scene||!canvas||typeof canvas.getContext!=='function')return;
    const c=findChar(st.subject);if(!c)return;
    try {
      let source=null;
      if(st.comparePublic)source=c.Canvas;
      else {
        const look=st.dragTempLook||st.look;
        const clones=st.dragTempLook?(st.dragTempClones||app.studioClones):app.studioClones;
        const clone=getRenderClone(c,look,clones,()=>{
          if(app.studio===st && !st.comparePublic)drawStudioCanvas();
        },st.fit,st.braChest);
        source=clone?.Canvas;
      }
      if(!source)return; // Avoid displaying a stale drawing while private artwork loads.
      // FIXED character silhouette size in CSS pixels, independent of the
      // editor size. A smaller preview is scrollable instead of cropping.
      const b=visibleStudioBounds(source);
      const visibleHeight=[320,380,460,540,640].includes(app.previewSize)?app.previewSize:380;
      const padding=12;
      const destW=visibleHeight*(b.width/b.height);
      const cssW=Math.max(1,Math.ceil(destW+padding*2));
      const cssH=visibleHeight+padding*2;
      const dpr=Math.min(1.5,Math.max(1,Number(globalThis.devicePixelRatio)||1));
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
  // v0.3.0: Separate BC-inspired editor. One main character clone and one catalog page
  // are active at a time; no redraws are performed when the browser is resized.
  function renderStudio() {
    const root=app.studioPanel, st=app.studio;
    if(!root || !st || root.style.display==='none')return;
    const c=findChar(st.subject),partner=findChar(st.partner);
    if(!c || !partner){closeStudio();return;}
    app.nativeMode=app.nativeMode||'slots';
    app.nativeTab=app.nativeTab||'Clothing';
    app.nativePage=Math.max(0,app.nativePage||0);
    app.nativeThumbCache=app.nativeThumbCache||new Map();
    const thumbToken=app.nativeThumbToken=(app.nativeThumbToken||0)+1;
    app.studioDrawTicket++;
    root.replaceChildren();
    const shell=node('div',undefined,'pwr-shell'); root.appendChild(shell);
    const toolbar=node('div',undefined,'pwr-toolbar');shell.appendChild(toolbar);
    append(toolbar,node('strong','Select your appearance · '+(c.Name||st.subject),'pwr-heading'));
    const actionBar=node('div',undefined,'pwr-actions');toolbar.appendChild(actionBar);
    append(actionBar,node('span','PRIVATE ONLY','pwr-save-state'));
    append(actionBar,button('↶',undoStudio,'pwr-history-btn'),button('↷',redoStudio,'pwr-history-btn'));
    actionBar.children[1].disabled=!st.undo?.length;
    actionBar.children[2].disabled=!st.redo?.length;
    append(actionBar,button('✕ Discard',closeStudio,'pwr-cancel'),button(st.remoteChanged&&st.overwriteConfirmed?'Confirm overwrite ✓':'✓ Save & share',saveStudio,'pwr-accept'));
    if(st.remoteChanged) {
      const notice=node('div',undefined,'pwr-alert');
      append(notice,node('span','Your partner sent a newer outfit while you were editing. Your unsaved draft remains separate. '));
      append(notice,button('Load partner look',()=>{
        const saved=app.profiles[key(st.partner,st.subject)];
        if(saved&&!saved.removed&&Array.isArray(saved.look)){
          st.look=cloneJson(saved.look);st.fit=normalizeFit(saved.fit);st.braChest=normalizeBraChest(c,saved.braChest);
          st.remoteChanged=false;st.overwriteConfirmed=false;st.dirty=false;st.undo=[];st.redo=[];
          app.studioClones=new WeakMap();renderStudio();
        }
      }));
      shell.appendChild(notice);
    }
    const main=node('div',undefined,'pwr-main');shell.appendChild(main);
    const left=node('div',undefined,'pwr-left');main.appendChild(left);
    const previewBar=node('div',undefined,'pwr-preview-bar');
    append(previewBar,node('strong','CHARACTER PREVIEW'),button(st.comparePublic?'View private':'Compare public',()=>{st.comparePublic=!st.comparePublic;drawStudioCanvas();},''));
    left.appendChild(previewBar);
    const scene=node('div',undefined,'pwr-scene');applyBackground(scene);left.appendChild(scene);
    const sceneInner=node('div',undefined,'pwr-scene-inner');scene.appendChild(sceneInner);
    const canvas=node('canvas');canvas.className='pwr-character-canvas';canvas.width=500;canvas.height=1000;sceneInner.appendChild(canvas);
    if(st.dragEnabled && app.nativeMode==='adjust') {
      const catcher=node('div',undefined,'pwr-drag-catcher');scene.appendChild(catcher);
      let start=null;
      catcher.addEventListener('pointerdown',event=>{
        if(event.button!==0 && event.pointerType==='mouse')return;
        const item=st.look.find(x=>x.group===app.nativeGroup);
        if(!item||!adjustableRecord(c,item))return;
        start={pointer:event.pointerId,x:event.clientX,y:event.clientY,group:app.nativeGroup};
        try{catcher.setPointerCapture(event.pointerId);}catch(_){ }
      });
      catcher.addEventListener('pointerup',event=>{
        if(!start || start.pointer!==event.pointerId)return;
        const dx=event.clientX-start.x,dy=event.clientY-start.y;
        const fit=app.studioFit;
        const ratio=fit?.visible?.[3] && fit?.fixedHeight ?fit.visible[3]/fit.fixedHeight:2;
        const target=start.group;start=null;
        if(Math.abs(dx)+Math.abs(dy)<2)return;
        modifyStudioTuneFast(list=>{
          const item=list.find(r=>r.group===target);if(!item)return;
          const previous={...DEFAULT_TUNE,...(item.tune||{})};
          const updated=normalizeTune({...previous,x:previous.x+Math.round(dx*ratio),y:previous.y+Math.round(dy*ratio)});
          if(updated)item.tune=updated;else delete item.tune;
        });
      });
      catcher.addEventListener('pointercancel',()=>{start=null;});
    }
    const previewTools=node('div',undefined,'pwr-preview-tools');left.appendChild(previewTools);
    append(previewTools,node('span','Backdrop'));
    makeSelect(previewTools,[['violet','Violet'],['rose','Rose'],['midnight','Midnight'],['garden','Garden'],['neutral','Neutral'],['custom','Custom URL'],['local','Local image']],app.background,value=>{
      app.background=value;saveSettings();applyBackground(scene);renderStudio();
    });
    append(previewTools,node('span','Size'));
    makeSelect(previewTools,[320,380,460,540,640].map(n=>[n,n+'px']),app.previewSize,value=>{
      app.previewSize=Number(value);saveSettings();drawStudioCanvas();
    });
    const right=node('div',undefined,'pwr-right');main.appendChild(right);
    const filter=node('div',undefined,'pwr-filter');right.appendChild(filter);
    const categories=[['Clothing','👗'],['Body','♟'],['Accessories','✦'],['Gear','⛓'],['All','☷']];
    for(const [value,symbol] of categories){
      const b=button(symbol+' '+value,()=>{
        app.nativeTab=value;app.nativeMode='slots';app.nativePage=0;app.nativeSearch='';renderStudio();
      },value===app.nativeTab?'pwr-selected':''); b.title=value;filter.appendChild(b);
    }
    append(filter,button('▣ Outfits',()=>{app.nativeMode='presets';renderStudio();},app.nativeMode==='presets'?'pwr-selected':''));
    const groupList=assetGroups(c).filter(g=>app.nativeTab==='All'||groupClass(g)===app.nativeTab);
    // Show the common BC clothing groups in wardrobe order.
    const order=['Cloth','ClothLower','ClothAccessory','Bra','Panties','Socks','Shoes','Hat','Gloves','Necklace','Bracelet','HairAccessory1','HairAccessory2'];
    groupList.sort((a,b)=>{
      const ai=order.indexOf(a.Name),bi=order.indexOf(b.Name);
      return (ai<0?999:ai)-(bi<0?999:bi) || String(a.Description||a.Name).localeCompare(String(b.Description||b.Name));
    });
    if(!groupList.some(g=>g.Name===app.nativeGroup))app.nativeGroup=groupList[0]?.Name||'';
    const currentGroup=groupByName(c,app.nativeGroup);
    const head=node('div',undefined,'pwr-right-head');right.appendChild(head);
    const heading=node('strong','');head.appendChild(heading);
    const headActions=node('div',undefined,'pwr-actions');head.appendChild(headActions);
    const area=node('div',undefined,'pwr-list-scroll');right.appendChild(area);
    const pages=node('div',undefined,'pwr-pages');right.appendChild(pages);
    const showMode=(name)=>{app.nativeMode=name;app.nativePage=0;renderStudio();};
    const recFor=g=>st.look.find(x=>x.group===g.Name);
    const sortedChoices=g=>{
      const record=recFor(g),all=groupAssets(g).slice();
      all.sort((a,b)=>String(a.Description||a.Name).localeCompare(String(b.Description||b.Name)));
      const equipped=record?all.find(a=>a.Name===record.asset):null;
      const choices=equipped?[equipped,...(g.AllowNone?[null]:[]),...all.filter(a=>a!==equipped)]:[...(g.AllowNone?[null]:[]),...all];
      return choices;
    };
    const selectAsset=(group,asset)=>{
      modifyStudio(list=>{
        const previous=list.find(r=>r.group===group.Name);
        const index=list.findIndex(r=>r.group===group.Name);
        if(index>=0)list.splice(index,1);
        if(asset)list.push({group:group.Name,asset:asset.Name,color:previous?.color||'Default'});
      });
    };
    const openGroup=(g)=>{app.nativeGroup=g.Name;showMode('catalog');};
    const openColor=(g)=>{app.nativeGroup=g.Name;app.activeColorLayer=0;showMode('colors');};
    function addPager(total,perPage){
      pages.replaceChildren();
      append(pages,button('◀',()=>{app.nativePage=Math.max(0,app.nativePage-1);renderStudio();}));
      pages.lastElementChild.disabled=app.nativePage<=0;
      append(pages,node('span',(app.nativePage+1)+' / '+Math.max(1,Math.ceil(total/perPage))));
      append(pages,button('▶',()=>{app.nativePage=Math.min(Math.ceil(total/perPage)-1,app.nativePage+1);renderStudio();}));
      pages.lastElementChild.disabled=app.nativePage>=Math.ceil(total/perPage)-1;
    }
    if(app.nativeMode==='slots'){
      heading.textContent='Appearance · '+app.nativeTab;
      const search=node('input');search.type='search';search.className='pwr-search';search.placeholder='Search appearance slots';
      search.value=app.nativeSearch||'';
      headActions.appendChild(search);
      search.addEventListener('input',()=>{
        app.nativeSearch=search.value;
        const caret=search.selectionStart;
        clearTimeout(app.nativeSearchTimer);
        app.nativeSearchTimer=setTimeout(()=>{
          if(app.studio!==st||app.nativeMode!=='slots')return;
          app.nativePage=0;renderStudio();
          const fresh=root.querySelector('.pwr-right-head .pwr-search');
          if(fresh){fresh.focus();try{fresh.setSelectionRange(caret,caret);}catch(_){} }
        },150);
      });
      const term=(app.nativeSearch||'').toLowerCase();
      const groups=groupList.filter(g=>(g.Name+' '+(g.Description||'')).toLowerCase().includes(term));
      const per=10,maxPage=Math.max(0,Math.ceil(groups.length/per)-1);
      app.nativePage=Math.min(app.nativePage,maxPage);
      for(const g of groups.slice(app.nativePage*per,app.nativePage*per+per)){
        const row=node('div',undefined,'pwr-slot');area.appendChild(row);
        const active=recFor(g),text=displayName(g.Description||g.Name)+': '+(active?displayName(assetByName(c,g,active.asset)?.Description||active.asset):'None');
        const mainBtn=button(text,()=>openGroup(g),'pwr-slot-main'+(g.Name===app.nativeGroup?' pwr-active':''));
        const cycle=(delta)=>{
          // The gallery is equipped-first; arrows instead use a stable catalog
          // order so each arrow press reaches a genuinely different item.
          const all=groupAssets(g).slice().sort((a,b)=>String(a.Description||a.Name).localeCompare(String(b.Description||b.Name)));
          const list=[...(g.AllowNone?[null]:[]),...all];
          if(!list.length)return;
          const i=list.findIndex(a=>(a?.Name||null)===(active?.asset||null));
          selectAsset(g,list[((i<0?0:i)+delta+list.length)%list.length]);
        };
        const prev=button('‹',()=>cycle(-1),'pwr-slot-arrow');
        const next=button('›',()=>cycle(1),'pwr-slot-arrow');
        append(row,mainBtn);
        const tools=node('div',undefined,'pwr-actions');
        append(tools,button('⚙',()=>{app.nativeGroup=g.Name;showMode('use');}));
        append(row,tools);
        const sw=button('',()=>openColor(g),'pwr-swatch');
        const color=Array.isArray(active?.color)?active.color[0]:active?.color;
        sw.style.background=/^#[0-9a-f]{6}$/i.test(String(color||''))?String(color):'#6c3489';
        sw.title='Color '+displayName(g.Name);row.appendChild(sw);
        // Clicking the two halves cycles; slot name opens the item grid.
        row.insertBefore(prev,mainBtn);
        row.insertBefore(next,tools);
        row.style.gridTemplateColumns='27px minmax(0,1fr) 27px 35px 32px';
      }
      addPager(groups.length,per);
    } else if(app.nativeMode==='catalog') {
      if(!currentGroup){showMode('slots');return;}
      heading.textContent='Select '+displayName(currentGroup.Description||currentGroup.Name);
      append(headActions,button('◀ Back',()=>showMode('slots')));
      append(headActions,button('🎨',()=>showMode('colors')));
      append(headActions,button('⚙',()=>showMode('use')));
      const search=node('input');search.type='search';search.className='pwr-search';search.placeholder='Search items...';search.value=app.nativeSearchAsset||'';
      area.appendChild(search);
      search.addEventListener('input',()=>{
        app.nativeSearchAsset=search.value;
        const caret=search.selectionStart;
        clearTimeout(app.nativeSearchTimer);
        app.nativeSearchTimer=setTimeout(()=>{
          if(app.studio!==st||app.nativeMode!=='catalog')return;
          app.nativePage=0;renderStudio();
          const fresh=root.querySelector('.pwr-list-scroll .pwr-search');
          if(fresh){fresh.focus();try{fresh.setSelectionRange(caret,caret);}catch(_){} }
        },150);
      });
      const term=(app.nativeSearchAsset||'').toLowerCase();
      const items=sortedChoices(currentGroup).filter(a=>!a||(`${a.Name} ${a.Description||''}`).toLowerCase().includes(term));
      const per=6;app.nativePage=Math.min(app.nativePage,Math.max(0,Math.ceil(items.length/per)-1));
      const grid=node('div',undefined,'pwr-catalog');area.appendChild(grid);
      for(const [idx,asset] of items.slice(app.nativePage*per,app.nativePage*per+per).entries()){
        const active=recFor(currentGroup),chosen=asset?active?.asset===asset.Name:!active;
        const tile=button('',()=>selectAsset(currentGroup,asset),'pwr-catalog-tile'+(chosen?' pwr-selected':''));
        const art=node('div',undefined,'pwr-tile-art');tile.appendChild(art);
        const title=asset?displayName(asset.Description||asset.Name):'(None / Remove)';
        append(tile,node('div',title,'pwr-tile-label'));
        append(tile,node('div',asset?.Name||'Remove','pwr-tile-sub'));
        grid.appendChild(tile);
        if(!asset){append(art,node('div','✕','pwr-tile-placeholder'));continue;}
        // Prefer BC-provided inventory artwork. Only fall back to one idle
        // character render per visible item when BC exposes no preview image.
        const a=asset;let path='';
        for(const name of ['InventoryGetItemPath','AssetGetInventoryPath']) {
          try {
            const fn=globalThis[name];
            if(typeof fn!=='function')continue;
            const found=fn(a);
            if(typeof found==='string'&&/\.(?:png|jpe?g|webp)(?:\?|$)/i.test(found)) {path=found;break;}
          }catch(_){ }
        }
        if(!path && typeof a.PreviewImage==='string' && /\.(?:png|jpe?g|webp)/i.test(a.PreviewImage))path=a.PreviewImage;
        const image=node('img');image.alt=title;image.loading='lazy';art.appendChild(image);
        const cacheKey=`${member(c)}:${currentGroup.Name}:${a.Name}:${st.fit}`;
        const applyCached=()=>{if(app.nativeThumbCache.has(cacheKey))image.src=app.nativeThumbCache.get(cacheKey);};
        const fallback=()=>{
          if(thumbToken!==app.nativeThumbToken||!image.isConnected)return;
          if(app.nativeThumbCache.has(cacheKey)){applyCached();return;}
          const look=cloneJson(st.look).filter(r=>r.group!==currentGroup.Name);
          look.push({group:currentGroup.Name,asset:a.Name,color:'Default'});
          const cache=new WeakMap();
          const render=()=>{
            if(thumbToken!==app.nativeThumbToken||!image.isConnected)return;
            const replica=getRenderClone(c,look,cache,render,st.fit,st.braChest);
            if(!replica?.Canvas)return;
            try{
              const source=replica.Canvas;
              const small=document.createElement('canvas');small.width=160;small.height=105;
              const ctx=small.getContext('2d');if(!ctx)return;
              const bounds=thumbnailFocusBounds(source,null,currentGroup,160/105);
              const size=Math.min(160/bounds.width,105/bounds.height);
              const w=bounds.width*size,h=bounds.height*size;
              ctx.drawImage(source,bounds.x,bounds.y,bounds.width,bounds.height,(160-w)/2,(105-h)/2,w,h);
              const data=small.toDataURL('image/png');
              if(app.nativeThumbCache.size>=42)app.nativeThumbCache.delete(app.nativeThumbCache.keys().next().value);
              app.nativeThumbCache.set(cacheKey,data);image.src=data;
            }catch(_){image.remove();append(art,node('div','✧','pwr-tile-placeholder'));}
          };
          setTimeout(render,250+idx*280); // one small preview task at a time, never on resize
        };
        if(path){image.onerror=fallback;image.src=path;}
        else fallback();
      }
      addPager(items.length,per);
    } else if(app.nativeMode==='colors'){
      heading.textContent='Select '+displayName(currentGroup?.Description||currentGroup?.Name||'item')+' colors';
      append(headActions,button('◀ Back',()=>showMode('catalog')));
      const rec=currentGroup?recFor(currentGroup):null;
      const asset=rec&&currentGroup?assetByName(c,currentGroup,rec.asset):null;
      const definitions=colorLayerDefinitions(asset,currentGroup,rec?.color);
      const controls=node('div',undefined,'pwr-setting-body');area.appendChild(controls);
      if(!rec||!definitions.length){append(controls,node('p','Choose a colorable item first.','pwr-note'));}
      else{
        const colors=colorLayersForRecord(rec,definitions.length);
        for(const layer of definitions){
          const row=node('div',undefined,'pwr-setting-row');controls.appendChild(row);
          append(row,node('label',layer.title));
          const val=colors[layer.index];
          const color=node('input');color.type='color';color.value=/^#[\da-f]{6}$/i.test(val)?val:'#a46cb5';
          const hex=node('input');hex.type='text';hex.value=val;hex.maxLength=9;hex.placeholder='#RRGGBB';
          color.addEventListener('input',()=>{hex.value=color.value.toUpperCase();});
          const apply=()=>{
            const raw=hex.value.trim().toUpperCase();
            if(!/^#[0-9A-F]{6}$/.test(raw) && raw!=='DEFAULT')return;
            modifyStudio(list=>{
              const item=list.find(x=>x.group===currentGroup.Name);if(item)recolorSingleLayer(item,definitions.length,layer.index,raw==='DEFAULT'?'Default':raw);
            });
          };
          hex.addEventListener('keydown',event=>{if(event.key==='Enter')apply();});
          append(row,color,hex,button('✓',apply),button('↺',()=>{
            modifyStudio(list=>{const item=list.find(x=>x.group===currentGroup.Name);if(item)recolorSingleLayer(item,definitions.length,layer.index,'Default');});
          }));
        }
      }
      append(controls,node('div','Each color index is saved separately. Editing stays private until Save & share.','pwr-note'));
      pages.style.display='none';
    } else if(app.nativeMode==='use') {
      heading.textContent='Use / configure item';append(headActions,button('◀ Back',()=>showMode('slots')));
      const controls=node('div',undefined,'pwr-setting-body');area.appendChild(controls);
      const rec=currentGroup?recFor(currentGroup):null;
      const asset=rec?assetByName(c,currentGroup,rec.asset):null;
      const options=itemVisualOptions(asset);
      append(controls,node('strong',rec?displayName(asset?.Description||rec.asset):'No equipped item'));
      if(!options.length)append(controls,node('p','No supported private visual Use options for this item. Live device actions are intentionally excluded.','pwr-note'));
      else for(const choice of options.slice(0,30)){
        append(controls,button(choice.name,()=>{
          modifyStudio(list=>{const item=list.find(x=>x.group===currentGroup.Name);if(item)item.use={type:choice.type,...(choice.typeRecord?{typeRecord:choice.typeRecord}:{})};});
        }));
      }
      append(controls,button('Fine-tune position / size',()=>showMode('adjust')));
      pages.style.display='none';
    } else if(app.nativeMode==='adjust') {
      heading.textContent='Adjust selected item';append(headActions,button('◀ Back',()=>showMode('slots')));
      const controls=node('div',undefined,'pwr-setting-body');area.appendChild(controls);
      const rec=currentGroup?recFor(currentGroup):null;
      if(!rec||!adjustableRecord(c,rec))append(controls,node('p','Select adjustable clothing or an accessory first.','pwr-note'));
      else{
        append(controls,node('strong',displayName(rec.asset)));
        const enable=node('label');enable.style.cssText='display:flex;gap:8px;align-items:center';
        const cb=node('input');cb.type='checkbox';cb.checked=!!st.dragEnabled;
        cb.addEventListener('change',()=>{st.dragEnabled=cb.checked;renderStudio();});
        append(enable,cb,node('span','Drag item on character preview'));
        controls.appendChild(enable);
        const fields=[['x','X position',-180,180],['y','Y position',-250,250],['scaleX','Width',40,180],['scaleY','Height',40,180],['angle','Rotation',-180,180],['opacity','Opacity',0,100],['priority','Layer order',-5,5]];
        for(const [field,title,min,max] of fields){
          const row=node('div',undefined,'pwr-setting-row');controls.appendChild(row);
          append(row,node('label',title));
          const input=node('input');input.type='number';input.min=String(min);input.max=String(max);
          input.value=String(rec.tune?.[field]??DEFAULT_TUNE[field]);
          const save=()=>{
            modifyStudioTuneFast(list=>{
              const item=list.find(x=>x.group===currentGroup.Name);if(!item)return;
              const t=normalizeTune({...DEFAULT_TUNE,...(item.tune||{}),[field]:Number(input.value)});
              if(t)item.tune=t;else delete item.tune;
            });
          };
          input.addEventListener('change',save);append(row,input,button('✓',save));
        }
        append(controls,button('Reset all adjustments',()=>modifyStudio(list=>{const item=list.find(x=>x.group===currentGroup.Name);if(item)delete item.tune;})));
      }
      pages.style.display='none';
    } else if(app.nativeMode==='presets') {
      heading.textContent='Private saved outfits';append(headActions,button('◀ Back',()=>showMode('slots')));
      const controls=node('div',undefined,'pwr-setting-body');area.appendChild(controls);
      const saveRow=node('div',undefined,'pwr-save-row');
      const name=node('input');name.type='text';name.placeholder='Outfit name';name.maxLength=60;
      append(saveRow,name,button('Save draft',()=>saveOutfitPreset(name.value)));
      controls.appendChild(saveRow);
      for(const preset of savedOutfitsFor(st)) {
        const row=node('div',undefined,'pwr-preset');
        append(row,node('span',preset.name||'Untitled'),button('Load',()=>loadOutfitPreset(preset.id)),button('Delete',()=>deleteOutfitPreset(preset.id)));
        controls.appendChild(row);
      }
      pages.style.display='none';
    }
    const bottom=node('div',undefined,'pwr-bottom');shell.appendChild(bottom);
    const leftActions=node('div',undefined,'pwr-actions');bottom.appendChild(leftActions);
    append(leftActions,button('Remove clothing',()=>modifyStudio((look,char)=>{
      const removable=new Set(assetGroups(char).filter(g=>isClothes(g)&&g.AllowNone).map(g=>g.Name));
      for(let i=look.length-1;i>=0;i--)if(removable.has(look[i].group))look.splice(i,1);
    })),button('Copy public',()=>modifyStudio((look,char)=>look.splice(0,look.length,...snapshot(char)))));
    const rightActions=node('div',undefined,'pwr-actions');bottom.appendChild(rightActions);
    append(rightActions,button('Private fit: '+(st.fit||'auto'),()=>changeStudioFit(st.fit==='auto'?'flat':st.fit==='flat'?'original':'auto',st.braChest)),
      button('Reset private look',clearPrivateLook,'pwr-cancel'));
    drawStudioCanvas();
    // One delayed retry for late BC images, never a loop tied to resizing.
    const ticket=app.studioDrawTicket;
    setTimeout(()=>{
      if(app.studio===st && app.studioDrawTicket===ticket && canvas.isConnected)drawStudioCanvas();
    },400);
  }

  function applyLauncherPosition() {
    const b=app.launcher;if(!b)return;
    if(!app.launcherPosition){b.style.left='';b.style.top='';b.style.right='18px';b.style.bottom='112px';return;}
    const x=Math.max(0,Math.min(Math.max(0,window.innerWidth-b.offsetWidth),app.launcherPosition.x));
    const y=Math.max(0,Math.min(Math.max(0,window.innerHeight-b.offsetHeight),app.launcherPosition.y));
    b.style.left=Math.round(x)+'px';b.style.top=Math.round(y)+'px';b.style.right='auto';b.style.bottom='auto';
  }
  function makeLauncherDraggable(b) {
    let dragging=null,suppressClick=false;
    b.addEventListener('pointerdown',e=>{
      if(e.button!==0 && e.pointerType==='mouse')return;
      const r=b.getBoundingClientRect();
      dragging={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:r.left,top:r.top,moved:false};
      try{b.setPointerCapture(e.pointerId);}catch(_){}
    });
    b.addEventListener('pointermove',e=>{
      if(!dragging||dragging.id!==e.pointerId)return;
      const dx=e.clientX-dragging.startX,dy=e.clientY-dragging.startY;
      if(!dragging.moved && Math.hypot(dx,dy)<6)return;
      dragging.moved=true;b.classList.add('pwr-dragging');
      const x=Math.max(0,Math.min(window.innerWidth-b.offsetWidth,dragging.left+dx));
      const y=Math.max(0,Math.min(window.innerHeight-b.offsetHeight,dragging.top+dy));
      app.launcherPosition={x:Math.round(x),y:Math.round(y)};applyLauncherPosition();
      e.preventDefault();
    });
    const finish=e=>{
      if(!dragging||dragging.id!==e.pointerId)return;
      if(dragging.moved){suppressClick=true;saveSettings();}
      dragging=null;b.classList.remove('pwr-dragging');
    };
    b.addEventListener('pointerup',finish);b.addEventListener('pointercancel',finish);
    b.addEventListener('click',e=>{
      if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}
    },true);
    window.addEventListener('resize',applyLauncherPosition);
  }
  function installUI() {
    if(!document.body || app.launcher)return;
    const s=node('style');s.textContent=style;document.head.appendChild(s);
    app.launcher=button('🐾 Private Wardrobe',()=>{if(app.panel.style.display==='none'){app.panel.style.display='block';renderPanel();}else closePanel();});
    app.launcher.id='pwr-launcher';document.body.appendChild(app.launcher);makeLauncherDraggable(app.launcher);applyLauncherPosition();
    app.panel=node('div');app.panel.id='pwr-window';app.panel.style.display='none';document.body.appendChild(app.panel);
    app.studioPanel=node('div');app.studioPanel.id='pwr-studio';app.studioPanel.style.display='none';document.body.appendChild(app.studioPanel);
  }
  function heartbeat() {
    if(!app.ready)return;
    // Do not deserialize the full wardrobe every heartbeat; it can undo draft UI state.
    const ps=partners();
    const chosen=currentPartner();
    for(const c of ps) if(app.enabled)sendHello(member(c));
    if(chosen && app.panel && app.panel.style.display!=='none') {
      // Avoid forcibly re-rendering text inputs while user is editing.
      const indicator=app.panel.querySelector('.pwr-badge');
      if(indicator){const peer=app.peers.get(member(chosen));indicator.textContent=peer?.enabled?('Partner addon detected · '+(peer.version===VERSION?'Both on '+VERSION.replace('-beta','')+' · Viewing':'Partner '+(peer.version||'older beta')+' · update both accounts')):peer?'Partner has disabled private sharing':'Partner addon not yet detected';}
    }
    if(!ps.length && (app.peers.size||Object.keys(app.remote).length||app.studio)) {app.peers.clear();app.remote={};if(app.studio)closeStudio();refreshView();}
  }
  function init() {
    if(app.ready || app.initFatal)return;
    if(!me())return;
    loadSettings();
    if(!addHooks()) {app.status=app.initFatal?'Startup aborted: previous ModSDK registration or hook failure. Disable other versions and refresh.':'Waiting for BC ModSDK';return;}
    app.ready=true;app.status='Ready (beta)';installUI();heartbeat();
    document.addEventListener('keydown',event=>{
      if(!app.studio || app.studioPanel?.style.display==='none')return;
      if(!(event.ctrlKey||event.metaKey) || event.altKey)return;
      const element=event.target;
      if(element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName||''))return;
      const key=String(event.key||'').toLowerCase();
      if(key==='z') {event.preventDefault();if(event.shiftKey)redoStudio();else undoStudio();}
      else if(key==='y') {event.preventDefault();redoStudio();}
    });
    // Window resize only changes CSS layout; fixed-size character pixels remain cached.
    globalThis.PawPrivateWardrobe = Object.freeze({
      version:VERSION,
      open(){app.panel.style.display='block';renderPanel();},
      studio(subject=member(me())){beginStudio(Number(subject));},
      closeStudio(){closeStudio();},
      status(){return {version:VERSION,ready:app.ready,selected:app.selected,enabled:app.enabled,mode:app.studio?'EDITING':'VIEWING',partnerDetected:!!app.peers.get(app.selected),partnerCount:partners().length,partnerVersion:app.peers.get(app.selected)?.version||null,render:app.diagnostics.render,skippedAssets:app.diagnostics.lastEditSkipped.length,lastAck:app.diagnostics.sync.lastAck};},
      braCatalogStatus(subject=member(me())) {
        const c=findChar(Number(subject)); if(!c)return null;
        const small=smallestUpperBodyAsset(c,true);
        const bras=assetGroups(c).filter(g=>/^Bra\d*$/i.test(g.Name))
          .flatMap(g=>groupAssets(g).map(a=>({group:g.Name,asset:a.Name})));
        const breast=groupByName(c,'ItemBreast');
        if(breast)for(const a of groupAssets(breast))if(/bra/i.test(a.Name))bras.push({group:'ItemBreast',asset:a.Name});
        return {subject:member(c),catalogBras:bras.length,automaticFemaleChest:small?.Name||null,
          availableChestSizes:groupAssets(groupByName(c,'BodyUpper')).map(a=>a.Name),
          expectedArtworkGender:'F',publicAppearanceUntouched:true,
          note:'Catalog support does not guarantee every bra sprite has a flat-cup drawing.'};
      },
      braFitStatus(subject=member(me())) {
        const c=findChar(Number(subject));
        if(!c)return {error:'Character is not available in this room.'};
        const draft=app.studio?.subject===member(c)?app.studio:null;
        const partner=currentPartner(),pid=member(partner);
        const profile=pid ? (app.remote[key(pid,member(c))] || app.profiles[key(pid,member(c))]) : null;
        const look=draft?.look || profile?.look || snapshot(c);
        const fit=draft?draft.fit:privateFit(c);
        return {...braFitInfo(c,look,fit,draft?draft.braChest:privateBraChest(c)),subject:member(c),editing:!!draft,privateOnly:true};
      },
      roomRenderStatus() {
        const p=currentPartner();
        return {version:VERSION,screen:typeof CurrentScreen!=='undefined'?CurrentScreen:'unknown',
          partner:p?.MemberNumber||null,hasSavedLook:!!(p&&effectiveLook(p)),
          localHasSavedLook:!!(me()&&effectiveLook(me())),
          partnerFit:p?privateFit(p):null,localFit:me()?privateFit(me()):null,
          partnerBraChest:p?privateBraChest(p):null,localBraChest:me()?privateBraChest(me()):null,
          privateDrawCharacter:app.privateDrawCalls,privateDrawCanvas:app.privateCanvasCalls,
          drawCanvasCalls:app.canvasHookCalls,roomDrawCalls:app.roomDrawCalls,
          nativeDrawSkips:app.nativeDrawSkips,render:app.diagnostics.render,
          hookCoverage:{canvas:app.canvasHookNames,native:app.nativeHookNames}};
      },
      visualUseOptions(memberNumber,groupName) {
        const c=findChar(Number(memberNumber));const g=c?groupByName(c,String(groupName||'')):null;
        if(!c||!g)return [];
        const st=app.studio?.subject===member(c)?app.studio:null;
        const active=(st?.look||snapshot(c)).find(r=>r.group===g.Name);
        return active?itemVisualOptions(assetByName(c,g,active.asset)).map(o=>({name:o.name,type:o.type})):[];
      },
      diagnostics(){
        const p=currentPartner(),sub=app.studio?.subject||member(me()),c=findChar(sub);
        const look=app.studio?.look || snapshot(c);
        const checked=normalizeLook(c,look);
        return {version:VERSION,subject:sub,privateFit:app.studio?normalizeFit(app.studio.fit):privateFit(c),flatModeApplied:shouldUseFlatFeminine(c,app.studio?app.studio.fit:privateFit(c),appearanceFor(c,look,app.studio?app.studio.fit:privateFit(c))),flatBodyUpperAsset:smallestUpperBodyAsset(c,hasBraInAppearance(c?.Appearance))?.Name||null,publicItems:c?.Appearance?.length||0,appearanceGroups:assetGroups(c).filter(g=>g.Category==='Appearance').length,gearGroups:assetGroups(c).filter(g=>g.Category==='Item').length,catalogAssets:assetGroups(c).reduce((sum,g)=>sum+groupAssets(g).length,0),draftItems:look.length,validItems:checked.look?.length||0,skipped:checked.dropped,lastEditSkipped:app.diagnostics.lastEditSkipped,render:app.diagnostics.render,partnerDetected:!!p&&!!app.peers.get(member(p)),partnerVersion:app.peers.get(member(p))?.version||null,partnerAllowsEdits:app.peers.get(member(p))?.accept,hasCanvas:!!c?.Canvas,editing:!!app.studio,dirtyPreview:!!app.studio?.dirty,studioOverridesRoom:false,remoteChangedInStudio:!!app.studio?.remoteChanged,storedProfiles:Object.keys(app.profiles).filter(k=>k.startsWith(member(p)+':')).map(k=>({key:k,changed:app.profiles[k]?.changed,removed:!!app.profiles[k]?.removed,items:app.profiles[k]?.look?.length||0})),sync:cloneJson(app.diagnostics.sync),pendingPackets:app.packets.size,studioFit:app.studioFit?cloneJson(app.studioFit):null,previewSize:app.previewSize,studioLayout:app.studioLayout,launcherPosition:app.launcherPosition,thumbnailFocus:app.thumbnailFocus,savedOutfits:app.studio?savedOutfitsFor(app.studio).length:0,history:{undo:app.studio?.undo?.length||0,redo:app.studio?.redo?.length||0},favoriteCount:Object.keys(app.favorites).length,comparePublic:!!app.studio?.comparePublic,interactionGuard:isNativeInteractionOpen(),drawHook:{roomHookAvailable:app.roomDrawHookAvailable,roomHookSeen:app.roomDrawHookSeen,roomCalls:app.roomDrawCalls,privateCalls:app.privateDrawCalls,nativeSkips:app.nativeDrawSkips,canvasHookCalls:app.canvasHookCalls,privateCanvasCalls:app.privateCanvasCalls,canvasHookNames:app.canvasHookNames,nativeHookNames:app.nativeHookNames,nativeDrawScope:app.nativeDrawScope,renderReadyChecks:app.renderReadyChecks},savedLookActive:!!(c&&effectiveLook(c))};
      },
      refresh(){refreshView();},
      savedOutfits(){return app.studio?savedOutfitsFor(app.studio).map(x=>({id:x.id,name:x.name,savedAt:x.savedAt})):[];},
      resetLauncher(){app.launcherPosition=null;saveSettings();applyLauncherPosition();},
      // Emergency local-only switch, never changes public appearance.
      disable(){const partner=currentPartner();app.enabled=false;closeStudio();saveSettings();refreshView();if(partner)syncSend(member(partner),{type:'DISABLED'});if(app.panel)renderPanel();},
    });
    console.log(`[Paw Private Wardrobe] ${VERSION} initialized`);
  }
  if (globalThis.PawPrivateWardrobe) {console.warn('[Paw Private Wardrobe] Already loaded. Disable older versions of the userscript and refresh.');return;}
  const timer=setInterval(()=>{if(!app.ready && !app.initFatal)init();else if(app.ready)heartbeat();},12000);
  init();
})();
