// ==UserScript==
// @name         Paw Private Wardrobe (Two-Person)
// @namespace    https://bondageprojects.com/
// @version      0.3.11-beta
// @description  Private outfits with pose selection, unrestricted catalog and native-style editing.
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
 * Paw Private Wardrobe, beta 0.3.11
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
  const VERSION = '0.3.11-beta';
  const MARKER = 'PWRD1:';
  const MAX_ITEMS = 240;
  const HIDE_ITEM = '@private-remove';
  const MAX_PACKET_BYTES = 120000;
  const CHUNK_SIZE = 480;
  const RETRY_MS = 60000;
  const SEND_GAP_MS = 1000; // conservative Paw-only pacing; BC's own limits still apply
  const MAX_QUEUED_PARTS = 256;
  const PACKET_IDLE_MS = 30000;
  const PACKET_MAX_AGE_MS = 300000;
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
#pwr-studio .pwr-preview-tools select[aria-label="Private character pose"]{max-width:180px;min-width:130px}
@media(max-width:560px){#pwr-studio .pwr-preview-tools{display:flex!important;min-height:40px;padding:4px 7px;gap:6px}#pwr-studio .pwr-preview-tools > :not(.pwr-pose-label):not(.pwr-pose-select){display:none!important}#pwr-studio .pwr-pose-select{max-width:180px;min-width:100px}}
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
#pwr-studio .pwr-tile-art{height:111px;min-height:111px;display:grid;place-items:center;overflow:hidden;background:#28252e;position:relative}
#pwr-studio .pwr-tile-art img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%;max-height:100%;object-fit:contain!important;padding:4px;display:block!important}
#pwr-studio .pwr-tile-art canvas{width:100%;height:100%;display:block;object-fit:contain}
#pwr-studio .pwr-tile-placeholder{padding:6px;font-size:15px;color:#9765b2;line-height:1;text-align:center}
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
#pwr-studio .pwr-layering{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid #7300aa;background:#19131f}
#pwr-studio .pwr-layer-row{display:grid;grid-template-columns:minmax(85px,1fr) auto minmax(45px,65px) auto auto;gap:5px;align-items:center;border-top:1px solid #533464;padding:7px 0}
#pwr-studio .pwr-layer-row input{width:100%;min-width:0;padding:5px}
#pwr-studio .pwr-layer-row button{min-height:32px;padding:5px;font-size:12px}
#pwr-studio .pwr-layer-row .pwr-note{padding:2px 0;overflow-wrap:anywhere}
@media(max-width:560px){#pwr-studio .pwr-layer-row{grid-template-columns:auto 1fr auto auto}#pwr-studio .pwr-layer-row>div{grid-column:1/-1}}
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
    ready: false, mod: null, enabled: true, allowPartnerEdits: true, freezePrivateAnimations: true,
    selected: 0, panel: null, launcher: null, status: 'Starting...',
    profiles: {}, outfits: {}, launcherPosition: null, favorites: {}, favoritesOnly: false, sections: {slots:true,styles:true,tuning:false,use:false,colors:false,outfits:false}, activeColorLayer: 0, studioDrawTicket: 0, remote: {}, studio: null, studioPanel: null, studioClones: new WeakMap(), studioResizeObserver: null, studioFit: null, studioLayout: 'bc', previewSize: 380, showBackgroundTools: false, background: 'violet', customBackground: '', sessionBackground: '', showThumbnails: true, thumbnailFocus: 'item', lastSent: new Map(), peers: new Map(),
    netQueue: [], netTimer: null, netLastSend: -Infinity, netRoom: null, netSession: Math.random().toString(36).slice(2), netReplays: new Map(), netStats: {partsSent:0, cancelled:0, duplicateStates:0, replaySuppressed:0, peakParts:0},
    packets: new Map(), clones: new WeakMap(), lastCompleteRoomFrames: new WeakMap(), pendingRoomFrames: new WeakMap(), generation: 1, privateCloneBuilds: 0, privateCloneCacheHits: 0, frozenBaseRefreshes: 0, pendingFrameReuses: 0, atomicFrameSwaps: 0,
    cuddle: null, cuddlePositions: new Map(), cuddleFrame: 0,
    cuddleRunHook: false, cuddleDraws: 0, cuddleLast: null,
    drawScope: 0, nativeDrawScope: 0, roomDrawHookAvailable: false, roomDrawHookSeen: false, roomDrawCalls: 0, privateDrawCalls: 0, nativeDrawSkips: 0, canvasHookCalls: 0, privateCanvasCalls: 0, canvasHookNames: [], nativeHookNames: [], renderReadyChecks: 0,
    editorSubject: 0, editorGroup: '', editorAsset: '', editorTab: 'Clothing', editorPage: 0, editorSearch: '', lastAccount: 0,
    diagnostics: {dropped:[], lastEditSkipped:[], render:'not yet attempted', lastError:'', sync:{stateSent:0,stateReceived:0,ackReceived:0,ackRejected:0,lastSend:null,lastReceive:null,lastAck:null,lastProblem:''}},
  };
  // Performance: counters are cumulative until the page reloads.
  const perf = {catalogBuilds:0, pairScans:0, studioPaints:0, studioBuilds:0,
    cancelledComposites:0, diffPasses:0, roomRedraws:0, animatedRefreshThrottles:0};
  let frameDepth=0, framePair=undefined, replicaLoadDepth=0;
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
  // Private pose presets. These are the BC asset pose names; they are
  // assigned only to detached render clones, never the public character.
  const POSE_OPTIONS = [
    ['original','Original (follow BC)'],
    ['stand','Standing'],
    ['kneel','Kneeling'],
    ['kneelingSpread','Kneeling Spread'],
    ['legsClosed','Legs Closed'],
    ['spread','Legs Spread'],
    ['allFours','All Fours'],
    ['hogtied','Hogtied'],
  ];
  const BC_LOWER_POSES = Object.freeze({
    kneel:'Kneel', kneelingSpread:'KneelingSpread', legsClosed:'LegsClosed',
    spread:'Spread', allFours:'AllFours', hogtied:'Hogtied',
  });
  const BC_LOWER_POSE_SET = new Set([...Object.values(BC_LOWER_POSES),'Stand']);
  const normalizePrivatePose = value => POSE_OPTIONS.some(([id])=>id===value) ? value : 'original';
  function applyPrivatePose(replica, source, requested) {
    const mode=normalizePrivatePose(requested);
    if(mode==='original')return;
    const target=BC_LOWER_POSES[mode]||null; // stand is the default standing art
    // Preserve other pose categories (e.g. arms), but replace lower-body
    // categories so Kneel and Standing don't fight each other.
    const upper = values => Array.isArray(values) ? values.filter(value=>
      typeof value==='string' && !BC_LOWER_POSE_SET.has(value)) : [];
    const previousActive=upper(source?.ActivePose);
    const previousPose=upper(source?.Pose);
    replica.ActivePose=target?[...previousActive,target]:previousActive;
    replica.Pose=target?[...previousPose,target]:previousPose;
    // This changes only private artwork, never CharacterSetActivePose,
    // the real player or BC's network pose updates.
  }

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
  function privatePose(character) {
    const partner=currentPartner();
    if(!partner||!character)return 'original';
    const k=key(member(partner),member(character));
    const selected=(member(character)===member(me())&&!app.allowPartnerEdits)
      ?app.profiles[k]:(app.remote[k]?.look?app.remote[k]:app.profiles[k]);
    return normalizePrivatePose(selected?.pose);
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
  // Index once per registry revision, not once per wardrobe item.
  let registry=null;const EMPTY_REGISTRY=[];
  function getRegistry() {
    const groups=typeof AssetGroup!=='undefined' && Array.isArray(AssetGroup)?AssetGroup:EMPTY_REGISTRY;
    const assets=typeof Asset!=='undefined' && Array.isArray(Asset)?Asset:EMPTY_REGISTRY;
    if(registry && registry.groups===groups && registry.assets===assets &&
        registry.groupCount===groups.length && registry.assetCount===assets.length)return registry;
    const byGroup=new Map(),byName=new Map();
    for(const a of assets){
      if(!a?.Group?.Name || typeof a.Name!=='string')continue;
      if(!byGroup.has(a.Group.Name))byGroup.set(a.Group.Name,[]);
      byGroup.get(a.Group.Name).push(a);
      if(!byName.has(a.Name))byName.set(a.Name,[]);
      byName.get(a.Name).push(a);
    }
    perf.catalogBuilds++;
    return registry={groups,assets,groupCount:groups.length,assetCount:assets.length,
      byGroup,byName,families:new Map(),catalogs:new WeakMap(),previews:new WeakMap()};
  }
  function familyCatalog(c) {
    const reg=getRegistry(),fam=c.AssetFamily||'Female3DCG';
    let entry=reg.families.get(fam);
    if(!entry){
      const groups=reg.groups.filter(g=>g && (g.Category==='Appearance'||g.Category==='Item') &&
        (!g.Family||g.Family===fam)).sort((a,b)=>a.Name.localeCompare(b.Name));
      const names=new Map();for(const g of groups)if(!names.has(g.Name))names.set(g.Name,g);
      entry={groups,names};reg.families.set(fam,entry);
    }
    return entry;
  }
  const assetGroups=c=>c?familyCatalog(c).groups:[];
  const groupByName=(c,name)=>c?familyCatalog(c).names.get(name):undefined;
  function groupCatalog(group) {
    const reg=getRegistry();
    const list=Array.isArray(group.Asset)?group.Asset:null;
    const cached=reg.catalogs.get(group);
    if(cached && cached.list===list && cached.size===(list?.length||0))return cached;
    const result=[...(list||[])],known=new Set(result.map(a=>a?.Name));
    for(const a of reg.byGroup.get(group.Name)||[]){
      if((!a.Group.Family||!group.Family||a.Group.Family===group.Family)&&!known.has(a.Name)){
        result.push(a);known.add(a.Name);
      }
    }
    const assets=result.filter(a=>a&&typeof a.Name==='string'), names=new Map();
    for(const a of assets)if(!names.has(a.Name))names.set(a.Name,a);
    const entry={list,size:list?.length||0,assets,names,sorted:null};
    reg.catalogs.set(group,entry);return entry;
  }
  const groupAssets=g=>g?groupCatalog(g).assets:[];
  function sortedGroupAssets(g){
    const e=groupCatalog(g);
    return e.sorted||(e.sorted=e.assets.slice().sort((a,b)=>String(a.Description||a.Name).localeCompare(String(b.Description||b.Name))));
  }
  const assetByName = (c, g, assetName) => {
    if (!g || !assetName || assetName === HIDE_ITEM) return null;
    let a = groupCatalog(g).names.get(assetName);
    if (!a && typeof AssetGet === 'function') {
      try { a = AssetGet(c.AssetFamily || 'Female3DCG', g.Name, assetName); } catch (_) {}
    }
    return a || null;
  };
  // BC layers share a ColorIndex when they are colored together. Present
  // those indices, not every painted sprite/image, as independent choices.
  // The native BC inventory icons are standalone PNG artwork per asset,
  // stored separately from the 500x1000 character render layers. Resolve
  // those icons for EVERY group (clothing, hair, body, accessories and gear).
  // Avoid drawing a character into item tiles: that is slower and can display
  // the wearer's body/feet instead of the asset icon.
  // Native thumbnails may be shared across groups or renamed by an addon.
  // Keep actual asset identity separate from the preview URL.
  function catalogPreviewPaths(asset,familyHint) {
    if (!asset || typeof asset.Name!=='string' || !asset.Group?.Name) return [];
    const g=asset.Group;
    const family=typeof g.Family==='string' ? g.Family : g.Family?.Name || familyHint || 'Female3DCG';
    const reg=getRegistry();
    const previous=reg.previews.get(asset);
    if(previous?.family===family)return previous.paths.slice();
    const files=[];
    const add=raw=>{
      if(typeof raw!=='string'||!raw.trim())return;
      try{
        const url=new URL(raw.trim(),document.baseURI);
        if(!['http:','https:','blob:','data:'].includes(url.protocol))return;
        if(url.protocol==='data:'&&!/^data:image\/(?:png|jpeg|webp);/i.test(raw))return;
        if(!files.includes(url.href))files.push(url.href);
      }catch(_){}
    };
    const label=(v)=>typeof v==='string'&&v.trim()&&v.length<=180&&!/[\\/]/.test(v)?v.trim():null;
    const direct=(v)=>typeof v==='string'&&(/\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(v)||/^data:image\//i.test(v)||/^blob:/i.test(v));
    const imagePath=(group,name)=>{
      if(!label(group)||!label(name))return;
      add(`Assets/${encodeURIComponent(family)}/${encodeURIComponent(group)}/Preview/${encodeURIComponent(name)}.png`);
    };
    // Explicit icon overrides take precedence. Native metadata may use a bare filename.
    const aliases=[];
    for(const key of ['PreviewImage','DynamicPreviewImage','PreviewPath','PreviewName','Preview']) {
      const v=asset[key];
      if(direct(v)) {
        if(!/[\\/]/.test(v)&&!/^data:|^blob:/i.test(v))aliases.push(v.replace(/\.png$/i,''));
        else add(v);
      } else if(label(v))aliases.push(v);
    }
    for(const name of ['AssetGetPreviewPath','InventoryGetItemPath','AssetGetInventoryPath']) {
      try {const fn=globalThis[name];if(typeof fn==='function'){const v=fn(asset);if(direct(v))add(v);}}catch(_){}
    }
    const dynamicGroup=label(asset.DynamicGroupName)||label(g.DynamicGroupName);
    const dynamicName=label(asset.DynamicAssetName)||label(asset.DynamicName);
    const groups=[...new Set([dynamicGroup,g.Name].filter(Boolean))];
    const names=[...new Set([...aliases,dynamicName,asset.Name].filter(Boolean))];
    for(const group of groups)for(const name of names)imagePath(group,name);
    // Catalog entries with the identical internal name can share an icon.
    // Do not guess by translated display label, which can match unrelated items.
    if(typeof Asset!=='undefined'&&Array.isArray(Asset)){
      for(const other of reg.byName.get(asset.Name)||[]){
        if(other===asset||other?.Name!==asset.Name||!other.Group?.Name)continue;
        const f=other.Group.Family;
        if(f && (typeof f==='string'?f:f.Name)!==family)continue;
        imagePath(label(other.DynamicGroupName)||other.Group.Name, label(other.DynamicAssetName)||other.Name);
        if(files.length>=10)break;
      }
    }
    const paths=files.slice(0,10);reg.previews.set(asset,{family,paths});return paths.slice();
  }
  const previewURLCache=new Map();
  const previewFailures=new Map();
  function mountCatalogImage(art,asset,family,title) {
    const paths=catalogPreviewPaths(asset,family);
    const key=JSON.stringify(paths);
    const cached=previewURLCache.get(key);
    if(cached){const index=paths.indexOf(cached);if(index>=0)paths.splice(index,1);paths.unshift(cached);}
    const image=node('img');image.alt=title;image.loading='lazy';image.decoding='async';
    art.appendChild(image);
    let index=0;
    const failed=()=>{
      image.remove();
      const note=node('div','Preview unavailable','pwr-tile-placeholder');
      note.title='No standalone artwork could be loaded. Item selection is independent of this image.';
      append(art,note);
      previewFailures.set(asset.Group.Name+'/'+asset.Name,{paths:paths.slice(),at:Date.now()});
      if(previewFailures.size>80)previewFailures.delete(previewFailures.keys().next().value);
    };
    image.onload=()=>{if(!image.isConnected)return;previewURLCache.set(key,paths[index]);if(previewURLCache.size>400)previewURLCache.delete(previewURLCache.keys().next().value);previewFailures.delete(asset.Group.Name+'/'+asset.Name);};
    image.onerror=()=>{if(!image.isConnected)return;if(++index<paths.length)image.src=paths[index];else failed();};
    const recent=previewFailures.get(asset.Group.Name+'/'+asset.Name);
    if(recent && Date.now()-recent.at<60000 && JSON.stringify(recent.paths)===JSON.stringify(paths)){
      image.remove();append(art,node('div','Preview unavailable','pwr-tile-placeholder'));return;
    }
    if(paths.length)image.src=paths[0];else failed();
  }

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
    const type=typeof raw.type==='string'?raw.type:typeof raw.Type==='string'?raw.Type:null;
    if(type===null)return null;
    const choices=itemVisualOptions(asset);
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
  const tuneLimits={opacity:[0,100],x:[-180,180],y:[-250,250],angle:[-180,180],scaleX:[40,180],scaleY:[40,180],priority:[-100,100]};
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
    const offsets={};
    if(raw.layerOffsets && typeof raw.layerOffsets==='object' && !Array.isArray(raw.layerOffsets)) {
      for(const [name,value] of Object.entries(raw.layerOffsets).slice(0,64)) {
        if(name.length>100 || ['__proto__','constructor','prototype'].includes(name) || typeof value!=='number' || !Number.isFinite(value))continue;
        const n=Math.round(clamp(value,-100,100));if(n)offsets[name]=n;
      }
    }
    if(Object.keys(offsets).length)tune.layerOffsets=offsets;
    return Object.keys(DEFAULT_TUNE).some(k=>tune[k]!==DEFAULT_TUNE[k]) || tune.layerOffsets ? tune : null;
  }
  function adjustableRecord(c,record) {
    if(!record || record.asset===HIDE_ITEM)return false;
    const g=groupByName(c,record.group);
    // Essential body groups are not safe for isolated per-item compositing.
    return !!(g && g.Category==='Appearance' && g.AllowNone);
  }
  // The native engine accepts Property.OverridePriority as a numeric priority
  // or a map from layer names to absolute priorities (BC MR !3987).
  function hasGeometryTune(raw) {
    const t=normalizeTune(raw);
    return !!t && Object.keys(DEFAULT_TUNE).some(k=>k!=='priority' && t[k]!==DEFAULT_TUNE[k]);
  }
  function nativeLayerDefinitions(asset) {
    if(!asset)return [];
    const list=Array.isArray(asset.Layer)&&asset.Layer.length?asset.Layer:[{}];
    const unique=new Map();
    for(const layer of list) {
      const name=String(layer?.Name??'');
      if(name.length>100 || ['__proto__','constructor','prototype'].includes(name)||unique.has(name))continue;
      const base=[layer?.Priority,asset.Priority,asset.Group?.Priority].find(n=>typeof n==='number'&&Number.isFinite(n));
      unique.set(name,{name,base:base??0});
    }
    return [...unique.values()];
  }
  function applyNativeLayerOrder(item,raw) {
    const tune=normalizeTune(raw);
    if(!tune || (!tune.priority&&!tune.layerOffsets))return item;
    const definitions=nativeLayerDefinitions(item.Asset);
    if(!definitions.length)return item;
    const original=item.Property?.OverridePriority;
    const number=v=>typeof v==='number'&&Number.isFinite(v);
    const entries=definitions.map(({name,base})=>{
      const inherited=number(original)?original:(original && typeof original==='object' && Object.hasOwn(original,name) && number(original[name]))?original[name]:base;
      return [name, inherited+tune.priority+(tune.layerOffsets?.[name]||0)];
    });
    // Keep multi-layer garments internally ordered instead of flattening all
    // their sprites to a single priority. Never mutate shared Asset or Property.
    const override=entries.length===1 && entries[0][0]===''?entries[0][1]:Object.fromEntries(entries);
    return {...item,Property:{...(item.Property||{}),OverridePriority:override}};
  }
  function normalizeAssetTune(raw,asset) {
    const t=normalizeTune(raw);if(!t||!t.layerOffsets)return t;
    const allowed=new Set(nativeLayerDefinitions(asset).map(d=>d.name));
    return normalizeTune({...t,layerOffsets:Object.fromEntries(Object.entries(t.layerOffsets).filter(([name])=>allowed.has(name)))});
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
      const tune=adjustableRecord(c,normalized)?normalizeAssetTune(raw.tune,asset):null;
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
      modified.push(applyNativeLayerOrder(appearanceItem(asset,record.color,oldByGroup.get(record.group),record.use),record.tune));
    }
    return applyFeminineFlat(c,modified,fit,braChest);
  };
  const configKey = () => `pawPrivateWardrobe:v1:${member(me())}`;
  function loadSettings() {
    const id = member(me()); if (!id || id === app.lastAccount) return;
    app.lastAccount = id;stopCuddle();
    app.profiles = {}; app.outfits = {}; app.favorites = {}; app.remote = {}; app.peers.clear(); app.clones = new WeakMap(); app.lastCompleteRoomFrames=new WeakMap(); app.pendingRoomFrames=new WeakMap();
    app.diagnostics={dropped:[],lastEditSkipped:[],render:'not yet attempted',lastError:'',sync:{stateSent:0,stateReceived:0,ackReceived:0,ackRejected:0,lastSend:null,lastReceive:null,lastAck:null,lastProblem:''}};
    app.lastSent.clear(); app.packets.clear(); app.studio=null; app.studioClones=new WeakMap();
    app.privateCloneBuilds=0;app.privateCloneCacheHits=0;app.frozenBaseRefreshes=0;app.pendingFrameReuses=0;app.atomicFrameSwaps=0;
    try {
      const saved = JSON.parse(localStorage.getItem(configKey()) || '{}');
      if (saved && typeof saved === 'object') {
        app.enabled = saved.enabled !== false;
        app.freezePrivateAnimations = saved.freezePrivateAnimations !== false;
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
    try { localStorage.setItem(configKey(), JSON.stringify({enabled:app.enabled,freezePrivateAnimations:app.freezePrivateAnimations,allowPartnerEdits:app.allowPartnerEdits,selected:app.selected,profiles:app.profiles,outfits:app.outfits,favorites:app.favorites,launcherPosition:app.launcherPosition,previewModeV3:true,braAutoSmallMigrated215:true,studioLayout:app.studioLayout,background:app.background,previewSize:app.previewSize,customBackground:app.customBackground,showThumbnails:app.showThumbnails,thumbnailFocus:app.thumbnailFocus})); }
    catch(err) { console.warn('[Paw Private Wardrobe] Local save failed:',err); }
  }
  const currentPartner = () => {
    perf.pairScans++;
    const ps = partners();
    if (ps.length === 1 && !ps.some(c => member(c) === app.selected)) app.selected = member(ps[0]);
    return ps.find(c => member(c) === app.selected) || null;
  };
  function roomPair(){
    if(frameDepth && framePair!==undefined)return framePair;
    const own=me(),partner=app.enabled&&inRoom()?currentPartner():null;
    const pair=partner?{own,partner,pid:member(partner),mine:member(own)}:null;
    if(frameDepth)framePair=pair;
    return pair;
  }
  function effectiveProfile(c,pair=roomPair()){
    if(!app.enabled || !c || !pair || !inRoom())return null;
    const subject=member(c),{mine,pid}=pair;
    if(subject!==mine && subject!==pid)return null;
    const peer=app.peers.get(pid);
    if(peer && (!peer.enabled || (subject===pid && !peer.accept)))return null;
    const k=key(pid,subject);
    const entry=subject===mine&&!app.allowPartnerEdits?app.profiles[k]:
      (app.remote[k]?.look?app.remote[k]:app.profiles[k]);
    return entry?.look?entry:null;
  }
  function effectiveLook(c){return effectiveProfile(c)?.look||null;}
  function roomClone(c,profile){
    return getRenderClone(c,profile.look,app.clones,requestRoomRedraw,profile.fit,profile.braChest,profile.pose);
  }
  function invalidate() {
    app.generation++;framePair=undefined;
    // Keep the last COMPOSITED frames as a temporary fallback while a new
    // frame renders. Clearing these caused resized gear to flash at 100%.
    app.clones = new WeakMap();
  }
  function refreshView() {
    invalidate();
    // DrawCharacter renders private clones on demand. Never sync actual BC appearance.
    requestRoomRedraw();
  }
  let roomRedrawTimer=null;
  function requestRoomRedraw() {
    if(roomRedrawTimer!==null || !inRoom())return;
    roomRedrawTimer=setTimeout(()=>{
      roomRedrawTimer=null;if(!inRoom())return;
      perf.roomRedraws++;
      try {if(typeof AnimationRequestDraw==='function'){AnimationRequestDraw();return;}}catch(_){}
      try {if(typeof ChatRoomCharacterViewUpdate==='function')ChatRoomCharacterViewUpdate();}catch(_){}
    },0);
  }
  function networkRoom() {
    if(!inRoom())return null;
    if(typeof ServerSocket !== 'undefined' && ServerSocket?.connected===false)return null;
    const name=typeof ChatRoomData!=='undefined'?ChatRoomData?.Name:'';
    const space=typeof ChatRoomSpace!=='undefined'?ChatRoomSpace:'';
    return JSON.stringify([member(me()),name||'',space||'']);
  }
  function cancelNetwork(reason) {
    if(app.netTimer!==null){clearTimeout(app.netTimer);app.netTimer=null;}
    app.netStats.cancelled+=app.netQueue.length;
    app.netQueue=[];app.packets.clear();app.netReplays.clear();app.lastSent.clear();app.peers.clear();
    if(reason)app.diagnostics.sync.lastProblem=reason;
  }
  // A cuddle is a session-local pair arrangement, not a BC pose or an outfit packet.
  // Coordinates are BC logical screen coordinates, not browser pixels.
  function stopCuddle() {
    app.cuddle=null;app.cuddlePositions.clear();app.cuddleLast=null;
  }
  function startCuddle(moving,side='left',distance=110,vertical=28) {
    const p=currentPartner(),own=member(me()),pid=member(p),room=networkRoom();
    moving=Number(moving);
    if(!app.enabled || !room || !pid || ![own,pid].includes(moving) || !eligible(pid) || app.peers.get(pid)?.enabled===false)return false;
    const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
    app.cuddle={room,partner:pid,moving,anchor:moving===own?pid:own,
      side:side==='right'?'right':'left',distance:clamp(distance,0,300,110),vertical:clamp(vertical,-150,150,28)};
    app.cuddlePositions.clear();app.cuddleLast=null;requestRoomRedraw();return true;
  }
  function cuddleActive() {
    const q=app.cuddle;
    if(!q)return false;
    if(!app.enabled || q.room!==networkRoom() || app.selected!==q.partner || !eligible(q.partner)){
      stopCuddle();return false;
    }
    // A peer explicitly opting out also ends the local arrangement.
    if(app.peers.get(q.partner)?.enabled===false){stopCuddle();return false;}
    return true;
  }
  function cuddleDrawArgs(args) {
    // Never change wardrobe, item dialog, or unscoped drawing coordinates.
    // The supported path is an ordinary room character draw. No extra draw calls.
    if(!app.cuddle || app.nativeDrawScope || !app.drawScope || !cuddleActive())return args;
    const q=app.cuddle,c=args[0],id=member(c);
    if(!c || c.__PawPrivateReplica || (id!==q.moving && id!==q.anchor))return args;
    const [x,y,z]=args.slice(1,4);
    if(![x,y,z].every(Number.isFinite)||z<=0||z>4)return args;
    const now=Date.now();
    app.cuddlePositions.set(id,{x,y,z,frame:app.cuddleFrame,at:now});
    if(id!==q.moving)return args;
    const a=app.cuddlePositions.get(q.anchor);
    // If the other player is drawn later, use its previous frame position.
    // Don't reuse offscreen/stale positions from a different room or page.
    if(!a || now-a.at>1200 || (app.cuddleRunHook && app.cuddleFrame-a.frame>1))return args;
    const result=args.slice();
    // Match logical canvas centres and floor lines, preserving existing zoom.
    result[1]=a.x+250*(a.z-z)+(q.side==='right'?1:-1)*q.distance*a.z;
    result[2]=a.y+1000*(a.z-z)+q.vertical*a.z;
    app.cuddleDraws++;app.cuddleLast={moving:id,anchor:q.anchor,x:result[1],y:result[2],zoom:z};
    return result;
  }
  function checkNetworkRoom() {
    const room=networkRoom();
    if(room!==app.netRoom){if(app.cuddle && app.cuddle.room!==room)stopCuddle();cancelNetwork('');app.netRoom=room;app.netSession=Math.random().toString(36).slice(2);}
    return room;
  }
  function queuedParts(){return app.netQueue.reduce((n,j)=>n+j.total-j.index,0);}
  function scheduleNetwork() {
    if(app.netTimer!==null||!app.netQueue.length)return;
    const delay=Math.max(0,SEND_GAP_MS-(Date.now()-app.netLastSend));
    app.netTimer=setTimeout(()=>{app.netTimer=null;pumpNetwork();},delay);
  }
  function pumpNetwork() {
    const room=checkNetworkRoom();if(!room)return;
    while(app.netQueue.length) {
      const job=app.netQueue[0],peer=app.peers.get(job.target);
      const blocked=job.type==='STATE' && (!peer?.enabled || (job.subject===job.target && !peer.accept));
      if(job.room!==room || !eligible(job.target) || blocked || (!app.enabled && job.type!=='DISABLED' && job.type!=='STATE_ACK' && job.type!=='HELLO') || Date.now()-job.created>PACKET_MAX_AGE_MS){
        app.netQueue.shift();app.netStats.cancelled++;continue;
      }
      if(Date.now()-app.netLastSend<SEND_GAP_MS){scheduleNetwork();return;}
      try {
        app.netLastSend=Date.now();
        ServerSend('ChatRoomChat',{Type:'Hidden',Target:job.target,Content:`${MARKER}${job.tx}:${job.index+1}/${job.total}:${job.packed.slice(job.index*CHUNK_SIZE,(job.index+1)*CHUNK_SIZE)}`});
        app.netStats.partsSent++;job.index++;
        if(job.index>=job.total)app.netQueue.shift();
      }catch(err){app.netQueue.shift();app.netStats.cancelled++;app.diagnostics.sync.lastProblem='Private message send failed: '+String(err);}
      scheduleNetwork();return;
    }
  }
  const syncSend = (target, payload) => {
    const sync=app.diagnostics.sync;
    const room=checkNetworkRoom();
    if (!room || !eligible(target) || typeof ServerSend !== 'function') {
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
    const type=payload.type,subject=payload.subject;
    // Supersede unsent or partially sent older revisions, never send an obsolete outfit.
    if(type==='STATE'||type==='RESET'||type==='HELLO'||type==='DISABLED'){
      app.netQueue=app.netQueue.filter(j=>{
        if(j.target!==target)return true;
        const same=(type==='STATE'||type==='RESET')?((j.type==='STATE'||j.type==='RESET')&&j.subject===subject):type==='DISABLED'?j.type!=='STATE_ACK':j.type==='HELLO';
        if(same)app.netStats.cancelled++;
        return !same;
      });
    }
    if(queuedParts()+total>MAX_QUEUED_PARTS){sync.lastProblem='Private send queue is full; saved locally. Use Resync saved looks later.';return false;}
    const job={room,target,type,subject,tx,packed,total,index:0,created:Date.now()};
    app.netQueue.push(job);
    app.netStats.peakParts=Math.max(app.netStats.peakParts,queuedParts());
    scheduleNetwork();
    return true; // accepted into the bounded queue, not proof of delivery
  };
  function sendState(partner, subject, look, changed=Date.now(), fit='auto', braChest='auto', pose='original') {
    if (!eligible(partner)) return false;
    const peer = app.peers.get(partner);
    if (!peer || !peer.enabled) return false;
    if (subject === partner && !peer.accept) return false;
    const c = findChar(subject);
    const validated = validateLook(c, look);
    if (!validated) return false;
    if (subject !== member(me()) && subject !== partner) return false;
    const sent=syncSend(partner, {type:'STATE',subject,look:validated,fit:normalizeFit(fit),braChest:normalizeBraChest(c,braChest),pose:normalizePrivatePose(pose),ts:changed});
    if (sent) {app.netReplays.set(key(partner,subject),Number(changed||0)+':0');app.diagnostics.sync.stateSent++;app.diagnostics.sync.lastSend={subject,to:partner,ts:changed,at:Date.now(),items:validated.length};}
    return sent;
  }
  function sendReset(partner,subject,changed) {
    const sent=syncSend(partner,{type:'RESET',subject,ts:changed});
    if(sent)app.netReplays.set(key(partner,subject),Number(changed||0)+':1');return sent;
  }
  function knownRevisions(id){
    return [member(me()),id].flatMap(subject=>{
      const entry=app.profiles[key(id,subject)];
      return entry?[[subject,Number(entry.changed)||0,entry.removed?1:0]]:[];
    });
  }
  function sendSavedLooks(id, revisions=null, force=false) {
    if (!app.enabled || !eligible(id)) return;
    for (const subject of [member(me()), id]) {
      const saved = app.profiles[key(id,subject)];
      if (!saved) continue;
      const stamp=Number(saved.changed)||0;
      const remote=Array.isArray(revisions)?revisions.find(r=>Array.isArray(r)&&r[0]===subject):null;
      const replayKey=key(id,subject), signature=stamp+':'+(saved.removed?1:0);
      if(!force && ((remote && Number(remote[1])>=stamp)||app.netReplays.get(replayKey)===signature)){
        app.netStats.replaySuppressed++;continue;
      }
      const sent=saved.removed?sendReset(id,subject,stamp):Array.isArray(saved.look)&&sendState(id,subject,saved.look,stamp,saved.fit,saved.braChest,saved.pose);
      if(sent)app.netReplays.set(replayKey,signature);
    }
  }
  function sendHello(id, force=false) {
    if(!checkNetworkRoom())return;
    const last = app.lastSent.get(id) ?? -Infinity;
    if (!force && Date.now() - last < RETRY_MS) return;
    if(syncSend(id,{type:'HELLO',enabled:app.enabled,accept:app.allowPartnerEdits,script:VERSION,session:app.netSession,revisions:knownRevisions(id)}))app.lastSent.set(id,Date.now());
  }
  function parseChunk(data) {
    if (!data || typeof data.Content !== 'string' || !data.Content.startsWith(MARKER)) return false;
    const match = /^PWRD1:([\da-z]+):(\d+)\/(\d+):([\w+/=]+)$/i.exec(data.Content);
    if (!match) return true;
    const sender = Number(data.Sender || data.MemberNumber);
    if (!checkNetworkRoom() || !Number.isInteger(sender) || !eligible(sender)) return true;
    const i=Number(match[2]), n=Number(match[3]);
    if (n<1 || n>128 || i<1 || i>n || match[4].length > CHUNK_SIZE) return true;
    // Never trust the sender field included in a message body; use the game packet Sender.
    const packetKey = `${sender}:${match[1]}`;
    for (const [k,p] of app.packets) if (Date.now()-p.last > PACKET_IDLE_MS || Date.now()-p.when > PACKET_MAX_AGE_MS) app.packets.delete(k);
    let p=app.packets.get(packetKey);
    if (!p) {
      if (app.packets.size > 24) app.packets.delete(app.packets.keys().next().value);
      p={n,when:Date.now(),last:Date.now(),parts:new Array(n)};app.packets.set(packetKey,p);
    }
    if (p.n!==n) {app.packets.delete(packetKey);return true;}
    p.last=Date.now();p.parts[i-1]=match[4];
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
      const prior=app.peers.get(sender);
      const session=typeof payload.session==='string'?payload.session.slice(0,64):null;
      const changedSession=!prior || prior.session!==session || (!prior.enabled && payload.enabled!==false);
      const changedPermissions=!!prior && !prior.accept && payload.accept!==false;
      if(changedSession||changedPermissions)for(const subject of [member(me()),sender])app.netReplays.delete(key(sender,subject));
      app.peers.set(sender,{at:Date.now(),enabled:payload.enabled!==false,accept:payload.accept!==false,session,version:typeof payload.script==='string'?payload.script:'older beta'});
      // Respond only to an unknown peer, avoiding HELLO loops.
      if (app.enabled) {
        sendHello(sender,changedSession);
        if (payload.enabled !== false) sendSavedLooks(sender,payload.revisions);
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
    if (saved && Number(saved.changed||0)>=stamp) {
      app.netStats.duplicateStates++;
      ack('up-to-date','This revision or a newer wardrobe is already saved.');return;
    }
    if (payload.type==='RESET') {
      delete app.remote[k];
      app.profiles[k]={removed:true,changed:stamp};
      if(app.studio?.partner===sender && app.studio.subject===subject)app.studio.remoteChanged=true;
    } else {
      if (!Array.isArray(payload.look)) {ack('rejected','Invalid appearance data.');return;}
      const look=validateLook(findChar(subject),payload.look);
      if (!look) {ack('rejected','Assets could not be read.');return;}
      const fit=normalizeFit(payload.fit),braChest=normalizeBraChest(findChar(subject),payload.braChest),pose=normalizePrivatePose(payload.pose);
      app.remote[k]={look,fit,braChest,pose,received:Date.now()};
      // Keep synchronized private looks available after a refresh/rejoin.
      app.profiles[k]={look,fit,braChest,pose,changed:stamp};
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
      app.mod = globalThis.bcModSdk.registerMod({name:'PawPrivateWardrobe',fullName:'Paw Private Wardrobe',version:'0.3.11'});
      app.mod.hookFunction('ChatRoomMessage', 15, (args,next) => {
        try { if (parseChunk(args[0])) return; } catch(err) {console.error('[Paw Private Wardrobe] Message error:',err);}
        return next(args);
      });
      // BC rebuilds its public canvas for animated effects, blinks, sigils and
      // poses. Keep the PRIVATE clone stable while freeze mode is enabled.
      // The original BC refresh still runs, including room updates and native
      // item interactions. This only skips Paw's duplicate render.
      app.mod.hookFunction('CharacterLoadCanvas', 10, (args,next) => {
        const result=next(args);
        const c=args[0];
        if(c && !c.__PawPrivateReplica){
          const cached=app.clones.get(c);
          if(cached){
            if(app.freezePrivateAnimations || cached.tuned){app.frozenBaseRefreshes++;}
            else if(cached.pending){cached.dirty=true;perf.animatedRefreshThrottles++;}
            else if(performance.now()-cached.builtAt>=125)app.clones.delete(c);
            else {cached.dirty=true;perf.animatedRefreshThrottles++;}
          }
        }
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
      // Keep other addons' original character identity and placement arguments
      // until the late draw stage. Do not call next twice if a downstream hook throws.
      try {
        if(typeof globalThis.ChatRoomRun==='function') {
          app.mod.hookFunction('ChatRoomRun', 1000, (args,next)=>{
            app.cuddleFrame++;
            if(frameDepth++===0)framePair=undefined;
            try{return next(args);}finally{if(--frameDepth===0)framePair=undefined;}
          });
          app.cuddleRunHook=true;
        }
      }catch(_){ /* room character scope still works without a frame counter */ }
      app.mod.hookFunction('DrawCharacter', -1000, (args,next) => {
        let prepared=args;
        try {
          const C=args[0],subjectId=member(C);
          if(app.enabled && !replicaLoadDepth && C && !C.__PawPrivateReplica && subjectId &&
              (subjectId===member(me()) || subjectId===app.selected)){
            if(isNativeInteractionOpen()||app.nativeDrawScope>0){app.nativeDrawSkips++;}
            else {
              const pair=roomPair();
              if(pair && (subjectId===pair.mine||subjectId===pair.pid)){
                if(app.cuddle)prepared=cuddleDrawArgs(args);
                const profile=effectiveProfile(C,pair);
                if(profile){
                  const clone=roomClone(C,profile);
                  if(clone?.Canvas){
                    app.privateDrawCalls++;
                    app.diagnostics.render='private replica used in late DrawCharacter hook';
                    prepared=[clone,...prepared.slice(1)];
                  }
                }
              }
            }
          }
        } catch(err) {
          app.diagnostics.lastError='Private drawing: '+String(err);
          prepared=args;
        }
        return next(prepared);
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
    if(!app.enabled || replicaLoadDepth || !inRoom() || isNativeInteractionOpen())return null;
    // Most drawing helpers receive a URL, not a canvas. Reject those without
    // touching the room roster. During ChatRoomRun reuse the frame's pair.
    let possible=false;
    for(let i=0;i<Math.min(args.length,10);i++){
      const v=args[i];if(v && typeof v==='object' && typeof v.getContext==='function'){possible=true;break;}
    }
    if(!possible)return null;
    const own=me(),pair=frameDepth?roomPair():null;
    const partner=frameDepth?pair?.partner:(app.selected?findChar(app.selected):null);
    for(let i=0;i<Math.min(args.length,10);i++){
      const source=args[i];
      if(!source || typeof source!=='object')continue;
      const c=own&&(source===own.Canvas||source===own.CanvasBlink)?own:
        partner&&(source===partner.Canvas||source===partner.CanvasBlink)?partner:null;
      if(!c)continue;
      const profile=effectiveProfile(c,pair||roomPair());if(!profile)continue;
      const clone=roomClone(c,profile);if(!clone?.Canvas)continue;
      const replacement=source===c.CanvasBlink&&!app.freezePrivateAnimations?(clone.CanvasBlink||clone.Canvas):clone.Canvas;
      if(!replacement||replacement===source)continue;
      const updated=args.slice();updated[i]=replacement;app.privateCanvasCalls++;
      app.diagnostics.render='private character canvas substituted for room draw';return updated;
    }
    return null;
  }
  function eligiblePartnerForCharacter(c) {
    const p=currentPartner();
    return !!p && (member(c)===member(me()) || member(c)===member(p));
  }
  // The room must NEVER display a half-built transformed character.
  // BC and other addons can re-render the base while our compositor waits for
  // item-specific source canvases. These clones are detached and local only.
  function pendingPrivateRoomClone(c) {
    const cached=app.pendingRoomFrames.get(c);
    if(cached)return cached;
    const clone=Object.assign(Object.create(Object.getPrototypeOf(c)),c);
    const width=c.Canvas?.width||500,height=c.Canvas?.height||1000;
    const blank=document.createElement('canvas');blank.width=width;blank.height=height;
    clone.Canvas=blank;clone.CanvasBlink=blank;
    clone.__PawPrivateReplica=true;
    app.pendingRoomFrames.set(c,clone);
    return clone;
  }
  function immutablePrivateRoomClone(replica) {
    // A full copy is essential: a late BC animation must not repaint the same
    // canvas object AFTER we've completed item scaling/compositing.
    const width=replica.Canvas.width,height=replica.Canvas.height;
    const snapshot=document.createElement('canvas');
    snapshot.width=width;snapshot.height=height;
    const ctx=snapshot.getContext('2d');
    if(!ctx)throw new Error('No 2D context for finished private snapshot');
    ctx.drawImage(replica.Canvas,0,0);
    const display=Object.assign(Object.create(Object.getPrototypeOf(replica)),replica);
    display.Canvas=snapshot;
    display.CanvasBlink=snapshot; // don't flash unscaled art during blink
    display.__PawPrivateReplica=true;
    return display;
  }
  function getRenderClone(c,look,cache=app.clones,onReady=null,fit='auto',braChest='auto',pose='original',parentActive=null) {
    fit=normalizeFit(fit);
    braChest=normalizeBraChest(c,braChest);
    pose=normalizePrivatePose(pose);
    const room=cache===app.clones,studio=cache===app.studioClones,st=app.studio;
    const drag=!!st&&cache===st.dragTempClones;
    const cached=cache.get(c);
    const expired=room&&cached?.dirty&&!cached.pending&&!app.freezePrivateAnimations&&!cached.tuned&&performance.now()-cached.builtAt>=125;
    if (!expired && cached && cached.lookRef===look && cached.fit===fit && cached.braChest===braChest && cached.pose===pose && (!room||(cached.generation===app.generation&&cached.partner===app.selected))) {
      if(room)app.privateCloneCacheHits++;
      if(room && cached.pending && cached.fallback)app.pendingFrameReuses++;
      return cached.pending ? cached.fallback : (cached.clone||cached.fallback||null);
    }
    if(room)app.privateCloneBuilds++;else if(studio||drag)perf.studioBuilds++;
    const appearance=appearanceFor(c,look,fit,braChest);
    if(!appearance) {app.diagnostics.render='appearance data could not be normalized';return null;}
    const replica=Object.assign(Object.create(Object.getPrototypeOf(c)),c);
    replica.Appearance=appearance;
    if(shouldRenderFeminine(c,fit,appearance))replica.Gender='F';
    applyPrivatePose(replica,c,pose);
    replica.Canvas=document.createElement('canvas');
    replica.Canvas.width=c.Canvas?.width||500;
    replica.Canvas.height=c.Canvas?.height||1000;
    replica.CanvasBlink=document.createElement('canvas');
    replica.CanvasBlink.width=replica.Canvas.width;
    replica.CanvasBlink.height=replica.Canvas.height;
    replica.DrawAppearance=appearance;
    replica.__PawPrivateReplica=true;
    if(typeof CharacterLoadCanvas!=='function') {app.diagnostics.render='CharacterLoadCanvas is unavailable';return null;}
    const tuned=look.filter(r=>r.tune && hasGeometryTune(r.tune) && adjustableRecord(c,r)).slice(0,5);
    const previous=room ? app.lastCompleteRoomFrames.get(c) : null;
    // A previous fully adjusted frame is preferable to the public unscaled
    // outfit while the replacement is being composed. A blank private canvas
    // prevents a 100%-size flash on the very first frame after joining.
    const fallback=room && tuned.length ?
      ((previous?.partner===app.selected && previous.clone) || pendingPrivateRoomClone(c)) : null;
    const record={lookRef:look,fit,braChest,pose,generation:app.generation,
      pending:true,clone:null,fallback,failed:false,partner:room?app.selected:0,tuned:!!tuned.length,builtAt:performance.now(),dirty:false};
    cache.set(c,record);
    const active=()=>cache.get(c)===record && (!parentActive||parentActive()) &&
      (!room || (app.enabled && inRoom() && cache===app.clones && record.generation===app.generation && record.partner===app.selected)) &&
      (!studio || (app.studio===st && cache===app.studioClones)) &&
      (!drag || (app.studio===st && cache===st.dragTempClones));
    let synchronous=true;
    const notify=()=>{if(onReady && !synchronous && active())onReady();};
    const finish=(composed=true)=>{
      if(!active())return;
      if(!composed){
        record.failed=true;
        record.pending=false;
        record.clone=null;
        app.diagnostics.render='Item adjustments unavailable; retaining previous private frame';
        notify();
        return;
      }
      try {
        const finalClone=tuned.length ? immutablePrivateRoomClone(replica) : replica;
        record.clone=finalClone;
        record.pending=false;
        if(room) {
          app.lastCompleteRoomFrames.set(c,{partner:record.partner,clone:finalClone});
          if(tuned.length)app.atomicFrameSwaps++;
        }
        app.diagnostics.render=tuned.length?'private adjustments atomically composited':'private replica prepared; waiting for room draw';
      }catch(err){
        record.failed=true;
        record.pending=false;
        app.diagnostics.lastError='Private snapshot: '+String(err);
        record.clone=null;
      }
      notify();
    };
    const afterLoad=()=>{
      if(!active())return;
      if(!tuned.length){finish();return;}
      let tries=0;
      const awaitSource=()=>{
        if(!active())return;
        if(thumbnailCanvasReady(replica.Canvas)){
          try{applyPrivateItemTuning(c,replica,look,tuned,fit,braChest,pose,(composed)=>{
            if(active())finish(composed);
          },active);}catch(err){app.diagnostics.lastError='Item tuning: '+String(err);finish(false);}
          return;
        }
        if(++tries<12)setTimeout(awaitSource,140+tries*70);
        else {app.diagnostics.lastError='Item tuning: source drawing unavailable';finish(false);}
      };
      setTimeout(awaitSource,90);
    };
    try {
      let result;
      replicaLoadDepth++;
      try{result=CharacterLoadCanvas(replica);}finally{replicaLoadDepth--;}

      if(result && typeof result.then==='function'){
        Promise.resolve(result).then(afterLoad).catch(e=>{
          app.diagnostics.lastError='Asynchronous canvas failed: '+String(e);
          if(active())finish(false);
        });
      } else afterLoad();
      synchronous=false;
      if(tuned.length)return fallback;
      return record.pending?replica:(record.clone||replica);
    }catch(err){
      record.pending=false;
      record.failed=true;
      app.diagnostics.render='private canvas exception: '+String(err);
      console.warn('[Paw Private Wardrobe] Could not create safe private render:',err);
      return fallback;
    }
  }
  // Self-contained private compositor (not Liko-AEE's source code). It renders
  // each tuned clothing/accessory group once with the item omitted, then
  // uses the changed pixels as a movable visual layer on the detached canvas.
  // BC's native layer-order/alpha APIs differ by build, so this intentionally
  // does not write AEE properties to public Items or claim native layer parity.
  function applyPrivateItemTuning(c,replica,look,tuned,fit,braChest,pose,onDone,active=()=>true) {
    const width=replica.Canvas.width,height=replica.Canvas.height;
    if(!width||!height||width>2048||height>2048){onDone(false);return;}
    const raw=document.createElement('canvas');raw.width=width;raw.height=height;
    const rawCtx=raw.getContext('2d',{willReadFrequently:true});
    if(!rawCtx){onDone(false);return;}
    try {rawCtx.drawImage(replica.Canvas,0,0);}catch(_){onDone(false);return;}
    const originals=rawCtx.getImageData(0,0,width,height);
    const target=rawCtx.createImageData(width,height);target.data.set(originals.data);
    const layerData=rawCtx.createImageData(width,height);
    const overlays=[];
    const work=tuned.slice().sort((a,b)=>normalizeTune(a.tune).priority-normalizeTune(b.tune).priority);
    let nextIndex=0;
    const next=()=>{
      if(!active()){perf.cancelledComposites++;return;}
      if(nextIndex>=work.length){
        if(overlays.length!==work.length){
          app.diagnostics.lastError='Item compositor: '+overlays.length+'/'+work.length+' adjusted layers were ready';
          onDone(false);return;
        }
        let applied=false;
        try {
          const ctx=replica.Canvas.getContext('2d');
          if(ctx){
            ctx.clearRect(0,0,width,height);
            rawCtx.putImageData(target,0,0);
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
            applied=true;
          }
        }catch(e){app.diagnostics.lastError='Item compositor: '+String(e);}
        onDone(applied);return;
      }
      const item=work[nextIndex++],t=normalizeTune(item.tune);
      if(!t){next();return;}
      const group=groupByName(c,item.group);
      const removed=look.filter(x=>x.group!==item.group);
      // Render a compatible reference without this wardrobe item. We do not
      // mutate the Player or partner's actual Appearance.
      if(group?.Category==='Item')removed.push({group:item.group,asset:HIDE_ITEM,color:'Default'});
      const plain=removed.map(x=>{
        const t=normalizeTune(x.tune);
        const layerOnly=t?normalizeTune({priority:t.priority,layerOffsets:t.layerOffsets}):null;
        return {group:x.group,asset:x.asset,color:x.color,...(x.use?{use:x.use}:{}),...(layerOnly?{tune:layerOnly}:{})};
      });
      const cache=new WeakMap();let attempts=0,done=false;
      const advance=()=>{if(done)return;done=true;setTimeout(next,0);};
      const ready=()=>{
        if(done)return;
        if(!active()){done=true;perf.cancelledComposites++;return;}
        // Poll only. Passing ready as the clone callback caused synchronous
        // re-entry and duplicate extraction of the same layer.
        const base=getRenderClone(c,plain,cache,null,fit,braChest,pose,active);
        if(base?.Canvas && thumbnailCanvasReady(base.Canvas)) {
          try{
            const baseCanvas=base.Canvas;
            const baseCtx=baseCanvas.getContext('2d',{willReadFrequently:true});
            if(!baseCtx){advance();return;}
            const reference=baseCtx.getImageData(0,0,width,height).data;
            const src=originals.data;
            const px=target.data;const out=layerData.data;out.fill(0);
            perf.diffPasses++;
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
            if(maxX<minX||maxY<minY){advance();return;}
            // Keep the unedited base for subsequent groups; write the final
            // replacement onto the raw reference after extracting this layer.
            const bounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
            const cropped=document.createElement('canvas');cropped.width=bounds.w;cropped.height=bounds.h;
            cropped.getContext('2d').putImageData(layerData,-bounds.x,-bounds.y,bounds.x,bounds.y,bounds.w,bounds.h);
            overlays.push({canvas:cropped,bounds,tune:t});
          } catch(e) {app.diagnostics.lastError='Item diff: '+String(e);}
          advance();return;
        }
        if(++attempts<12)setTimeout(ready,110+attempts*75);
        else advance();
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
  // Do not treat cosmetic appearance groups as disposable clothing just
  // because BC or another addon marks them Clothing=true.
  // Match either BC's group ID or its description (for addon-defined groups).
  const isProtectedCosmetic = g => {
    const name=String(g?.Name||'');
    const desc=String(g?.Description||'');
    // Prefixes and CamelCase suffixes prevent false matches such as
    // Outerwear / Underwear (both contain the letters 'ear').
    return /^(?:Hair|Eyes?|EyeBrow|Brow|Lash|Pupil|Iris|Mouth|Lip|Nose|Face|Makeup|MakeUp|FacePaint|BodyPaint|BodyMark|Marking|Tattoo|Freckle|Ears?|Tails?|Wings?|Horns?|Body|Skin|Breast|ChestShape|Piercing|Nail|Scar|Blush|Mascara|Eyeshadow)/i.test(name)
      || /(?:Ears?|Tails?|Wings?|Horns?|Hair|FacePaint|Makeup|MakeUp|BodyMarking|Tattoo|Piercing)$/.test(name)
      || /^(?:face|ears?|tails?|wings?|horns?|hair|make.?up|body.?mark|skin|blush|eyeshadow|tattoo)/i.test(desc);
  };
  const isClearableClothing = g => !!(g && isClothes(g) && g.AllowNone && !isProtectedCosmetic(g));
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
    cancelStudioArtwork();clearTimeout(app.studioLatePaint);clearTimeout(app.studioLatePaint2);
    if(app.studioPaintFrame!=null){cancelAnimationFrame(app.studioPaintFrame);app.studioPaintFrame=null;}
    app.studio=null;app.studioClones=new WeakMap();app.studioFit=null;app.studioDrawTicket++;
    if(app.studioPanel){app.studioPanel.style.display='none';app.studioPanel.replaceChildren();}
    if(app.panel?.style.display!=='none')renderPanel();
  }
  const HISTORY_LIMIT=35;
  function studioSnapshot(st) {
    return {look:cloneJson(st.look),fit:normalizeFit(st.fit),braChest:st.braChest,pose:normalizePrivatePose(st.pose)};
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
    st.pose=normalizePrivatePose(previous.pose);
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
  function changeStudioPose(requested) {
    const st=app.studio;if(!st)return;
    const pose=normalizePrivatePose(requested);
    if(st.pose===pose)return;
    recordStudioChange(st);
    st.pose=pose;st.dirty=true;st.overwriteConfirmed=false;st.comparePublic=false;
    // The whole character pose affects every garment layer. Invalidate only
    // this studio clone; don't rebuild the item catalog for animation ticks.
    app.studioClones=new WeakMap();drawStudioCanvas();
    const history=app.studioPanel?.querySelectorAll('.pwr-history-btn');
    if(history?.length>1){history[0].disabled=!st.undo.length;history[1].disabled=!st.redo.length;}
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
    app.studio={partner:pid,subject,look:cloneJson(current||snapshot(c)),fit:normalizeFit(source?.fit),braChest:normalizeBraChest(c,source?.braChest),pose:normalizePrivatePose(source?.pose),dirty:false,remoteChanged:false,overwriteConfirmed:false,undo:[],redo:[],comparePublic:false,dragEnabled:false,dragGroup:null,dragTempLook:null,dragTempClones:null};
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
    const pid=st.partner,subject=st.subject,changed=Math.max(Date.now(),Number(app.profiles[key(pid,subject)]?.changed||0)+1);
    app.profiles[key(pid,subject)]={removed:true,changed};delete app.remote[key(pid,subject)];
    saveSettings();refreshView();closeStudio();
    const sent=app.peers.get(pid)?.enabled && sendReset(pid,subject,changed);
    setStatus(sent?'Reset queued for partner.':'Local private look reset; partner not connected.');
  }
  function saveStudio() {
    const st=app.studio;if(!st)return;
    if(st.remoteChanged && !st.overwriteConfirmed){st.overwriteConfirmed=true;renderStudio();return;}
    if(st.subject===st.partner && app.peers.get(st.partner)?.accept===false){setStatus('Your partner disabled remote styling.');return;}
    const c=findChar(st.subject),look=validateLook(c,st.look);if(!look)return;
    const pid=st.partner,subject=st.subject,changed=Math.max(Date.now(),Number(app.profiles[key(pid,subject)]?.changed||0)+1);
    app.profiles[key(pid,subject)]={look,fit:normalizeFit(st.fit),braChest:normalizeBraChest(c,st.braChest),pose:normalizePrivatePose(st.pose),changed};delete app.remote[key(pid,subject)];
    saveSettings();refreshView();closeStudio();
    const sent=sendState(pid,subject,look,changed,st.fit,st.braChest,st.pose);
    setStatus(sent?'Private look saved and queued for sharing; awaiting acknowledgment.':'Saved locally but partner delivery is unavailable.');
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
    list.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:title,look:cloneJson(valid),fit:normalizeFit(st.fit),braChest:normalizeBraChest(c,st.braChest),pose:normalizePrivatePose(st.pose),savedAt:Date.now()});
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
    app.nativeThumbCache=new Map();st.look=look;st.fit=normalizeFit(entry.fit);st.braChest=normalizeBraChest(c,entry.braChest);st.pose=normalizePrivatePose(entry.pose);
    st.dirty=true;st.overwriteConfirmed=false;st.comparePublic=false;
    app.studioClones=new WeakMap();renderStudio();
    setStatus('Loaded preset with private pose and body fit. Undo is available. Press Save & share when ready.');
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
      stopCuddle();app.selected=Number(v);app.editorSubject=0;saveSettings();refreshView();sendHello(app.selected,true);renderPanel();
    });
    const partner=currentPartner(),pid=member(partner),peer=app.peers.get(pid);
    append(panel,node('div',peer?.enabled?('● Partner addon detected · '+(peer.version===VERSION?'Both on '+VERSION.replace('-beta','')+' · Viewing':'Partner version '+(peer.version||'unknown')+' (update both accounts)')):peer?'Partner disabled sharing':'Waiting for partner addon','pwr-badge'));
    checkbox(panel,'View private appearances (on my screen)',app.enabled,v=>{
      app.enabled=v;if(!v)stopCuddle();saveSettings();refreshView();if(v)sendHello(pid,true);else syncSend(pid,{type:'DISABLED'});renderPanel();
    });
    checkbox(panel,'Freeze BC animation frames in my private view (faster)',app.freezePrivateAnimations,v=>{
      app.freezePrivateAnimations=v;saveSettings();refreshView();renderPanel();
    });
    append(panel,node('p','While your private view is active, glowing effects, blinking and other game-driven appearance frames stay on the last saved private render. When unfrozen, private animation rebuilds are limited to roughly 8 per second. BC continues running normally; this does not block messages, permissions or public appearance changes.','pwr-help'));
    append(panel,button('Refresh frozen character now',()=>{
      refreshView();setStatus('Private character snapshot refreshed.');
    },'pwr-secondary'));
    checkbox(panel,'Allow partner to change my private appearance',app.allowPartnerEdits,v=>{
      app.allowPartnerEdits=v;saveSettings();refreshView();sendHello(pid,true);renderPanel();
    });
    append(panel,node('div',`Mode: VIEWING · no active edits${app.studio?' (studio open separately)':''}`,'pwr-badge'));
    append(panel,node('h3','Private pair pose · Cuddle (experimental)'));
    const cuddleOn=cuddleActive(),q=app.cuddle;
    const cuddleBox=node('div',undefined,'pwr-badge');append(panel,cuddleBox);
    append(cuddleBox,node('p',cuddleOn?'Cuddle is active on this screen.':'Cuddle is off. Both clients can independently choose the same arrangement.','pwr-help'));
    let moving=q?.moving||pid,side=q?.side||'left',distance=q?.distance??110,vertical=q?.vertical??28;
    label(cuddleBox,'Character to move');
    makeSelect(cuddleBox,[[member(me()),me()?.Name||'My character'],[pid,partner.Name||'Partner']],moving,v=>{moving=Number(v);});
    label(cuddleBox,'Side of the other character');
    makeSelect(cuddleBox,[['left','Left'],['right','Right']],side,v=>{side=v;});
    const numberControl=(title,value,min,max,change)=>{
      const row=node('label');row.textContent=title+' ';
      const input=node('input');input.type='number';input.min=String(min);input.max=String(max);input.step='5';input.value=String(value);
      input.style.width='85px';input.addEventListener('input',()=>change(Number(input.value)));append(row,input);append(cuddleBox,row);
    };
    numberControl('Spacing (smaller = closer)',distance,0,300,v=>{distance=v;});
    numberControl('Vertical offset',vertical,-150,150,v=>{vertical=v;});
    const cuddleButtons=node('div',undefined,'pwr-row');append(cuddleBox,cuddleButtons);
    append(cuddleButtons,button(cuddleOn?'Apply cuddle position':'Start cuddle',()=>{
      const ok=startCuddle(moving,side,distance,vertical);
      setStatus(ok?'Cuddle enabled locally. Use the same character and offsets on the other client.':'Cuddle is unavailable for this pair.');renderPanel();
    }),button('End cuddle',()=>{stopCuddle();requestRoomRedraw();setStatus('Normal room placement restored.');renderPanel();},'pwr-secondary'));
    append(cuddleBox,node('p','Visual only: existing body poses and native draw order are kept. End cuddle before clicking an overlapping character or using Echo cuddle. No outfit or position packets are sent.','pwr-help'));
    append(panel,node('h3','Open wardrobe studio'));
    const targets=node('div',undefined,'pwr-row');
    const stylePartner=button(`Style ${partner.Name||'partner'}`,()=>beginStudio(pid),'');
    stylePartner.disabled=!!peer && !peer.accept;
    append(targets,button('Style myself',()=>beginStudio(member(me())),''),stylePartner);
    append(panel,targets);
    append(panel,node('p','The private wardrobe uses its own preview and background. Only Save & share updates the look your partner sees.','pwr-help'));
    append(panel,button('Resync saved looks',()=>{sendHello(pid,true);sendSavedLooks(pid,null,true);setStatus('Resync requested. Large outfits are sent gradually.');},'pwr-secondary'));
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
    if(box.measured)studioBoundsCache.set(source,{width,height,box});
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
  let readyProbe=null;
  function thumbnailCanvasReady(source) {
    // BC can populate the Canvas asynchronously even when CharacterLoadCanvas
    // itself returns void. Don't mark a transparent frame as successfully drawn.
    try {
      const probe=readyProbe||(readyProbe=document.createElement('canvas'));
      if(probe.width!==36||probe.height!==72){probe.width=36;probe.height=72;}
      const ctx=probe.getContext('2d',{willReadFrequently:true});
      if(!ctx||!ctx.getImageData)return true; // non-readable contexts: best effort
      ctx.clearRect(0,0,36,72);ctx.drawImage(source,0,0,36,72);
      const pixels=ctx.getImageData(0,0,36,72).data;
      for(let i=3;i<pixels.length;i+=4)if(pixels[i]>4)return true;
      return false;
    }catch(_){return true;}
  }
  let artworkTimers=[];
  function cancelStudioArtwork(){
    for(const id of artworkTimers)clearTimeout(id);artworkTimers=[];
    clearTimeout(app.nativeSearchTimer);
  }
  function scheduleSelectedArtworkRefresh(st,c) {
    for(const id of artworkTimers)clearTimeout(id);artworkTimers=[];
    const look=st.look,fit=st.fit,chest=st.braChest,pose=st.pose;
    const valid=()=>app.studio===st&&st.look===look&&st.fit===fit&&st.braChest===chest&&st.pose===pose&&!st.comparePublic&&!st.dragTempLook;
    // Retain one late native-art retry for asynchronously loaded sprites.
    if(!look.some(r=>hasGeometryTune(r.tune)))artworkTimers.push(setTimeout(()=>{
      if(!valid())return;
      const old=app.studioClones.get(c);if(old?.pending)return;
      app.studioClones.delete(c);drawStudioCanvas();
    },1100));
    artworkTimers.push(setTimeout(()=>{if(valid())drawStudioCanvas();},1800));
  }
  function drawStudioCanvas(){
    if(!app.studio||app.studioPaintFrame!=null)return;
    app.studioPaintFrame=requestAnimationFrame(()=>{app.studioPaintFrame=null;paintStudioCanvas();});
  }
  function paintStudioCanvas() {
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
        },st.fit,st.braChest,st.pose);
        source=clone?.Canvas;
      }
      if(!source)return; // Avoid displaying a stale drawing while private artwork loads.
      // FIXED character silhouette size in CSS pixels, independent of the
      // editor size. A smaller preview is scrollable instead of cropping.
      const b=visibleStudioBounds(source);
      perf.studioPaints++;
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
    const oldCanvas=root.querySelector('.pwr-character-canvas');
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
          st.look=cloneJson(saved.look);st.fit=normalizeFit(saved.fit);st.braChest=normalizeBraChest(c,saved.braChest);st.pose=normalizePrivatePose(saved.pose);
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
    const canvas=oldCanvas||node('canvas');canvas.className='pwr-character-canvas';
    if(!oldCanvas){canvas.width=500;canvas.height=1000;}sceneInner.appendChild(canvas);
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
    append(previewTools,node('span','Pose','pwr-pose-label'));
    const poseSelect=makeSelect(previewTools,POSE_OPTIONS,st.pose,value=>{
      changeStudioPose(value);
    });
    poseSelect.classList.add('pwr-pose-select');
    poseSelect.title='Private visual pose only. Does not change BC posture or restraints.';
    poseSelect.setAttribute('aria-label','Private character pose');
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
      const record=recFor(g),all=sortedGroupAssets(g);
      const equipped=record?all.find(a=>a.Name===record.asset):null;
      const choices=equipped?[equipped,...(g.AllowNone?[null]:[]),...all.filter(a=>a!==equipped)]:[...(g.AllowNone?[null]:[]),...all];
      return choices;
    };
    const selectAsset=(group,asset)=>{
      const before=st.look;
      if(asset && recFor(group)?.asset===asset.Name){scheduleSelectedArtworkRefresh(st,c);return;}
      modifyStudio(list=>{
        const index=list.findIndex(r=>r.group===group.Name);
        if(index>=0)list.splice(index,1);
        if(asset){
          // A new asset must not inherit the old asset's incompatible layer array.
          list.push({group:group.Name,asset:asset.Name,color:'Default'});
        }
      });
      if(asset && st.look!==before && st.look.some(r=>r.group===group.Name&&r.asset===asset.Name)) {
        scheduleSelectedArtworkRefresh(st,c);
      }
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
          const all=sortedGroupAssets(g);
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
        mountCatalogImage(art,asset,c.AssetFamily||'Female3DCG',title);
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
        const fields=[['x','X position',-180,180],['y','Y position',-250,250],['scaleX','Width',40,180],['scaleY','Height',40,180],['angle','Rotation',-180,180],['opacity','Opacity',0,100]];
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
        const layering=node('div',undefined,'pwr-layering');controls.appendChild(layering);
        append(layering,node('strong','Drawing layers · BC priority'));
        append(layering,node('div','Higher values draw in front. Whole item shifts all its layers together; individual offsets are added to that shift.','pwr-note'));
        const asset=assetByName(c,currentGroup,rec.asset);
        const layerRows=[];
        const currentTune=()=>normalizeTune(st.look.find(x=>x.group===currentGroup.Name)?.tune)||DEFAULT_TUNE;
        const updateOffsets=(name,value)=>{
          modifyStudioTuneFast(list=>{
            const item=list.find(x=>x.group===currentGroup.Name);if(!item)return;
            const old=normalizeTune(item.tune)||DEFAULT_TUNE;
            const offsets={...(old.layerOffsets||{})};
            if(name!==null){if(value)offsets[name]=value;else delete offsets[name];}
            const t=normalizeTune({...old,priority:name===null?value:old.priority,layerOffsets:offsets});
            if(t)item.tune=t;else delete item.tune;
          });
          refreshLayerRows();
        };
        const refreshLayerRows=()=>{
          const t=currentTune();
          for(const row of layerRows){
            const v=row.name===null?t.priority:(t.layerOffsets?.[row.name]||0);
            row.input.value=String(v);
            row.back.disabled=v<=-100;row.front.disabled=v>=100;
            row.hint.textContent=row.name===null?'Relative to native item order':'Catalog priority '+row.base+' · shift '+(t.priority+v);
          }
        };
        const addLayerRow=(name,title,base)=>{
          const row=node('div',undefined,'pwr-layer-row');layering.appendChild(row);
          const text=node('div');const hint=node('div',undefined,'pwr-note');
          append(text,node('strong',title),hint);append(row,text);
          const input=node('input');input.type='number';input.min='-100';input.max='100';input.step='1';input.setAttribute('aria-label',title+' priority offset');
          const get=()=>{const t=currentTune();return name===null?t.priority:(t.layerOffsets?.[name]||0);};
          const set=value=>updateOffsets(name,Math.round(clamp(Number.isFinite(value)?value:get(),-100,100)));
          const back=button('−',()=>set(get()-1));back.title='Move backward one priority';
          const front=button('+',()=>set(get()+1));front.title='Move forward one priority';
          input.addEventListener('change',()=>{if(input.value.trim()!=='')set(Number(input.value));else refreshLayerRows();});
          append(row,back,input,front,button('Reset',()=>set(0)));
          layerRows.push({name,base,input,back,front,hint});
        };
        addLayerRow(null,'Whole item',0);
        const definitions=nativeLayerDefinitions(asset);
        if(definitions.length>1 || (definitions.length===1 && definitions[0].name!=='')) {
          for(const [index,d] of definitions.entries())addLayerRow(d.name,d.name||'Layer '+(index+1),d.base);
        }
        refreshLayerRows();
        append(layering,button('Reset layer order',()=>{
          modifyStudioTuneFast(list=>{
            const item=list.find(x=>x.group===currentGroup.Name);if(!item)return;
            const t=normalizeTune({...item.tune,priority:0,layerOffsets:{}});
            if(t)item.tune=t;else delete item.tune;
          });refreshLayerRows();
        }));
        if(st.look.some(r=>hasGeometryTune(r.tune)))append(layering,node('p','Items with position, scale, rotation or opacity adjustments still use the experimental overlay compositor. For exact native overlap, reset those transforms on the affected items.','pwr-note'));
        append(layering,button('Reset transforms only (keep layers)',()=>modifyStudio(list=>{
          const item=list.find(x=>x.group===currentGroup.Name);if(!item)return;
          const old=normalizeTune(item.tune);if(!old)return;
          const t=normalizeTune({priority:old.priority,layerOffsets:old.layerOffsets});
          if(t)item.tune=t;else delete item.tune;
        })));
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
    append(leftActions,button('Clear clothing only',()=>modifyStudio((look,char)=>{
      const removable=new Set(assetGroups(char).filter(isClearableClothing).map(g=>g.Name));
      for(let i=look.length-1;i>=0;i--)if(removable.has(look[i].group))look.splice(i,1);
    })),button('Copy public',()=>modifyStudio((look,char)=>look.splice(0,look.length,...snapshot(char)))));
    const rightActions=node('div',undefined,'pwr-actions');bottom.appendChild(rightActions);
    append(rightActions,button('Private fit: '+(st.fit||'auto'),()=>changeStudioFit(st.fit==='auto'?'flat':st.fit==='flat'?'original':'auto',st.braChest)),
      button('Reset private look',clearPrivateLook,'pwr-cancel'));
    drawStudioCanvas();
    // Bounded late-art refresh; never tied to resizing or animation ticks.
    const ticket=app.studioDrawTicket;
    clearTimeout(app.studioLatePaint);clearTimeout(app.studioLatePaint2);
    const latePaint=()=>{if(app.studio===st && app.studioDrawTicket===ticket && canvas.isConnected)drawStudioCanvas();};
    app.studioLatePaint=setTimeout(latePaint,500);
    app.studioLatePaint2=setTimeout(latePaint,1200);
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
    checkNetworkRoom();
    if(app.cuddle)cuddleActive();
    for(const id of app.peers.keys())if(!eligible(id)){app.peers.delete(id);app.lastSent.delete(id);for(const subject of [member(me()),id])app.netReplays.delete(key(id,subject));}
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
      performanceStatus(){return {version:VERSION,animatedCloneMinIntervalMs:125,...perf,privateCloneBuilds:app.privateCloneBuilds,privateCloneCacheHits:app.privateCloneCacheHits,canvasHookCalls:app.canvasHookCalls,privateCanvasCalls:app.privateCanvasCalls,freezePrivateAnimations:app.freezePrivateAnimations,lastError:app.diagnostics.lastError};},
      networkStatus(){return {version:VERSION,connectedToRoom:!!networkRoom(),queuedParts:queuedParts(),queuedTransfers:app.netQueue.length,sendGapMs:SEND_GAP_MS,...app.netStats,sync:cloneJson(app.diagnostics.sync),lastRenderError:app.diagnostics.lastError};},
      assetPreviewStatus(group,assetName){
        const c=app.studio?findChar(app.studio.subject):me();
        const g=groupByName(c,String(group||app.nativeGroup||''));
        const a=assetByName(c,g,String(assetName||app.studio?.look?.find(r=>r.group===g?.Name)?.asset||''));
        if(!a)return {found:false,group:group||app.nativeGroup,asset:assetName};
        return {found:true,group:g.Name,asset:a.Name,dynamicGroup:a.DynamicGroupName||null,dynamicName:a.DynamicAssetName||a.DynamicName||null,paths:catalogPreviewPaths(a,c?.AssetFamily),failure:previewFailures.get(g.Name+'/'+a.Name)||null,draftSelected:app.studio?.look?.find(r=>r.group===g.Name)?.asset||null,render:app.diagnostics.render,lastError:app.diagnostics.lastError};
      },
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
      cuddleStatus(){return {active:cuddleActive(),settings:app.cuddle?{...app.cuddle}:null,roomHookAvailable:app.roomDrawHookAvailable,roomDrawSeen:app.roomDrawHookSeen,frameHook:app.cuddleRunHook,draws:app.cuddleDraws,last:app.cuddleLast,localOnly:true};},
      endCuddle(){stopCuddle();requestRoomRedraw();if(app.panel)renderPanel();},
      roomRenderStatus() {
        const p=currentPartner();
        return {version:VERSION,screen:typeof CurrentScreen!=='undefined'?CurrentScreen:'unknown',
          partner:p?.MemberNumber||null,hasSavedLook:!!(p&&effectiveLook(p)),
          localHasSavedLook:!!(me()&&effectiveLook(me())),
          partnerFit:p?privateFit(p):null,localFit:me()?privateFit(me()):null,
          partnerBraChest:p?privateBraChest(p):null,localBraChest:me()?privateBraChest(me()):null,partnerPose:p?privatePose(p):null,localPose:me()?privatePose(me()):null,
          privateDrawCharacter:app.privateDrawCalls,privateDrawCanvas:app.privateCanvasCalls,
          freezePrivateAnimations:app.freezePrivateAnimations,
          privateCloneBuilds:app.privateCloneBuilds,privateCloneCacheHits:app.privateCloneCacheHits,
          frozenBaseRefreshes:app.frozenBaseRefreshes,
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
        return {version:VERSION,subject:sub,privateFit:app.studio?normalizeFit(app.studio.fit):privateFit(c),flatModeApplied:shouldUseFlatFeminine(c,app.studio?app.studio.fit:privateFit(c),appearanceFor(c,look,app.studio?app.studio.fit:privateFit(c))),flatBodyUpperAsset:smallestUpperBodyAsset(c,hasBraInAppearance(c?.Appearance))?.Name||null,publicItems:c?.Appearance?.length||0,appearanceGroups:assetGroups(c).filter(g=>g.Category==='Appearance').length,gearGroups:assetGroups(c).filter(g=>g.Category==='Item').length,catalogAssets:assetGroups(c).reduce((sum,g)=>sum+groupAssets(g).length,0),draftItems:look.length,validItems:checked.look?.length||0,skipped:checked.dropped,lastEditSkipped:app.diagnostics.lastEditSkipped,render:app.diagnostics.render,partnerDetected:!!p&&!!app.peers.get(member(p)),partnerVersion:app.peers.get(member(p))?.version||null,partnerAllowsEdits:app.peers.get(member(p))?.accept,hasCanvas:!!c?.Canvas,editing:!!app.studio,dirtyPreview:!!app.studio?.dirty,studioOverridesRoom:false,remoteChangedInStudio:!!app.studio?.remoteChanged,storedProfiles:Object.keys(app.profiles).filter(k=>k.startsWith(member(p)+':')).map(k=>({key:k,changed:app.profiles[k]?.changed,removed:!!app.profiles[k]?.removed,items:app.profiles[k]?.look?.length||0})),sync:cloneJson(app.diagnostics.sync),pendingPackets:app.packets.size,studioFit:app.studioFit?cloneJson(app.studioFit):null,previewSize:app.previewSize,studioLayout:app.studioLayout,privatePose:app.studio?normalizePrivatePose(app.studio.pose):(c?privatePose(c):'original'),freezePrivateAnimations:app.freezePrivateAnimations,privateCloneBuilds:app.privateCloneBuilds,privateCloneCacheHits:app.privateCloneCacheHits,frozenBaseRefreshes:app.frozenBaseRefreshes,pendingFrameReuses:app.pendingFrameReuses,atomicFrameSwaps:app.atomicFrameSwaps,launcherPosition:app.launcherPosition,thumbnailFocus:app.thumbnailFocus,savedOutfits:app.studio?savedOutfitsFor(app.studio).length:0,history:{undo:app.studio?.undo?.length||0,redo:app.studio?.redo?.length||0},favoriteCount:Object.keys(app.favorites).length,comparePublic:!!app.studio?.comparePublic,interactionGuard:isNativeInteractionOpen(),drawHook:{roomHookAvailable:app.roomDrawHookAvailable,roomHookSeen:app.roomDrawHookSeen,roomCalls:app.roomDrawCalls,privateCalls:app.privateDrawCalls,nativeSkips:app.nativeDrawSkips,canvasHookCalls:app.canvasHookCalls,privateCanvasCalls:app.privateCanvasCalls,canvasHookNames:app.canvasHookNames,nativeHookNames:app.nativeHookNames,nativeDrawScope:app.nativeDrawScope,renderReadyChecks:app.renderReadyChecks},savedLookActive:!!(c&&effectiveLook(c))};
      },
      refresh(){registry=null;refreshView();if(app.studio){app.studioClones=new WeakMap();drawStudioCanvas();}},
      setFreezePrivateAnimations(enabled) {
        app.freezePrivateAnimations=!!enabled;saveSettings();refreshView();
        if(app.panel && app.panel.style.display!=='none')renderPanel();
        return app.freezePrivateAnimations;
      },
      savedOutfits(){return app.studio?savedOutfitsFor(app.studio).map(x=>({id:x.id,name:x.name,savedAt:x.savedAt})):[];},
      resetLauncher(){app.launcherPosition=null;saveSettings();applyLauncherPosition();},
      // Emergency local-only switch, never changes public appearance.
      disable(){const partner=currentPartner();stopCuddle();app.enabled=false;closeStudio();saveSettings();refreshView();if(partner)syncSend(member(partner),{type:'DISABLED'});if(app.panel)renderPanel();},
    });
    console.log(`[Paw Private Wardrobe] ${VERSION} initialized`);
  }
  if (globalThis.PawPrivateWardrobe) {console.warn('[Paw Private Wardrobe] Already loaded. Disable older versions of the userscript and refresh.');return;}
  const timer=setInterval(()=>{if(!app.ready && !app.initFatal)init();else if(app.ready)heartbeat();},12000);
  init();
})();
