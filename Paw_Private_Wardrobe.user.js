// ==UserScript==
// @name         Paw Private Wardrobe (Two-Person)
// @namespace    https://bondageprojects.com/
// @version      0.2.25-beta
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
 * Paw Private Wardrobe, beta 0.2.25
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
  const VERSION = '0.2.25-beta';
  const MARKER = 'PWRD1:';
  const MAX_ITEMS = 240;
  const HIDE_ITEM = '@private-remove';
  const MAX_PACKET_BYTES = 120000;
  const CHUNK_SIZE = 480;
  const RETRY_MS = 60000;
  const MAX_SAVED_OUTFITS = 30;
  const SAFE_COLOR = /^(?:#[\da-fA-F]{3,8}|[\w ,.#()-]{1,80})$/;
  const style = `
/* Paw Private Wardrobe – Moonlit Atelier */
#pwr-launcher{position:fixed;z-index:2147483000;right:18px;bottom:112px;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;padding:12px 17px;border-radius:999px;border:1px solid #d4a5f0;background:linear-gradient(120deg,#513071,#9251a4);color:#fff;font:700 13px/1.3 system-ui,-apple-system,sans-serif;box-shadow:0 9px 24px #11071bc0, inset 0 1px #ffffff38;cursor:pointer;transition:transform .16s,box-shadow .16s}
#pwr-launcher.pwr-dragging{cursor:grabbing;transform:none!important;opacity:.93}
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
/* 0.2.23: direct manipulation of optional clothing/accessories in the private preview */
#pwr-studio .pwr-character-holder{position:relative;display:block;width:max-content;height:max-content;isolation:isolate}
#pwr-studio .pwr-item-drag-overlay{position:absolute!important;inset:0!important;z-index:4!important;display:block!important;cursor:grab!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;background:transparent!important;overscroll-behavior:contain!important;}
#pwr-studio .pwr-item-drag-overlay.pwr-moving{cursor:grabbing!important;}
#pwr-studio .pwr-drag-instruction{position:absolute;left:50%;top:10px;transform:translateX(-50%);padding:7px 11px;background:#23182fe6;border:1px solid #d5a1e4;border-radius:11px;color:#fff;font:700 11px/1.3 system-ui;white-space:nowrap;max-width:95%;pointer-events:none;box-shadow:0 3px 13px #070311a0;text-align:center;}
#pwr-studio .pwr-drag-delta{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:#291c38ed;color:#f4d8ff;border:1px solid #af83ca;border-radius:10px;padding:5px 10px;font:700 11px/1.3 system-ui;white-space:nowrap;pointer-events:none;}
#pwr-studio .pwr-drag-toggle.pwr-active{background:linear-gradient(130deg,#aa6fba,#624c9a)!important;border-color:#eac5ff!important;box-shadow:0 0 0 1px #e6b3ff6a!important;}

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

/* Atelier v0.2.4: expandable sections, saved looks and hex wheel. */
#pwr-studio .pwr-details{display:block;min-width:0}
#pwr-studio .pwr-details>summary{display:flex;align-items:center;gap:9px;list-style:none;cursor:pointer;user-select:none;min-height:26px}
#pwr-studio .pwr-details>summary::-webkit-details-marker{display:none}
#pwr-studio .pwr-details>summary:after{content:'▾';margin-left:auto;color:#d2b7e5;transition:transform .15s}
#pwr-studio .pwr-details:not([open])>summary:after{transform:rotate(-90deg)}
#pwr-studio .pwr-details>.pwr-section-body{margin-top:10px}
#pwr-studio .pwr-saved-section{border-color:#836098;background:linear-gradient(155deg,#2b1d3a,#231a31)}
#pwr-studio .pwr-preset-entry{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;align-items:center;padding:8px;border:1px solid #554063;border-radius:11px;margin-top:7px;background:#1c1526}
#pwr-studio .pwr-preset-entry input{min-width:0;height:35px!important}
#pwr-studio .pwr-preset-entry button{padding:7px 9px;min-height:33px}
#pwr-studio .pwr-preset-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#pwr-studio .pwr-preset-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#pwr-studio .pwr-preset-row input{flex:1;min-width:140px}
#pwr-studio .pwr-colorbar{align-items:flex-start}
#pwr-studio .pwr-hex-picker{border:1px solid #85619d;border-radius:13px;background:#191122;padding:11px;margin-top:11px}
#pwr-studio .pwr-hex-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
#pwr-studio .pwr-hex-chip{display:inline-block;width:31px;height:31px;border-radius:9px;border:2px solid #f7dcff;box-shadow:0 0 0 1px #6a4c7b}
#pwr-studio .pwr-sv-canvas{display:block;width:100%;height:130px;touch-action:none;cursor:crosshair;border-radius:10px;border:1px solid #9577ae;margin-top:10px}
#pwr-studio .pwr-hue{width:100%;height:18px;accent-color:#ac67ca;cursor:pointer;margin-top:12px;appearance:none;background:linear-gradient(to right,red,#ff0,lime,cyan,blue,magenta,red);border-radius:99px;border:1px solid #cba4dd}
#pwr-studio .pwr-hue::-webkit-slider-thumb{appearance:none;width:17px;height:23px;background:#fff;border:2px solid #654376;border-radius:7px}
#pwr-studio .pwr-hue::-moz-range-thumb{width:15px;height:21px;background:#fff;border:2px solid #654376;border-radius:7px}
#pwr-studio .pwr-swatch-grid{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:5px;margin-top:10px}
#pwr-studio .pwr-swatch-grid button{min-width:0;min-height:27px;padding:0;border:1px solid #e0cbf2ad;border-radius:7px;box-shadow:inset 0 0 0 1px #140b1980}
#pwr-studio .pwr-layers{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0}
#pwr-studio .pwr-layer{padding:6px 10px!important;min-height:30px!important;font-size:12px!important}
#pwr-studio .pwr-layer.pwr-active{outline:2px solid #efb9ff;border-color:#efb9ff}
#pwr-studio .pwr-color-buttons{display:flex;align-items:center;gap:7px;margin-top:10px;flex-wrap:wrap}
#pwr-studio .pwr-asset-grid.pwr-with-previews{grid-template-columns:repeat(3,minmax(0,1fr))}
#pwr-studio .pwr-asset.pwr-has-preview{min-height:154px;gap:5px}
#pwr-studio .pwr-asset-preview{height:120px;max-height:120px;width:auto;max-width:100%;margin:0 auto;object-fit:contain}
#pwr-studio .pwr-asset .pwr-preview-placeholder{height:120px;display:grid;place-items:center;color:#bda0cb;font-size:11px}
#pwr-studio .pwr-asset-label{font-size:11px;line-height:1.2;overflow-wrap:anywhere}
@media (max-width:700px){#pwr-studio .pwr-asset-grid.pwr-with-previews{grid-template-columns:repeat(2,minmax(0,1fr))}#pwr-studio .pwr-preset-entry{grid-template-columns:minmax(0,1fr) auto}#pwr-studio .pwr-preset-entry .pwr-danger{grid-column:2}}

/* v0.2.6 — readable asset names and mode-aware character closeups. */
#pwr-studio .pwr-asset-visual{position:relative;overflow:hidden;width:100%;border-radius:10px;background:radial-gradient(ellipse at 50% 38%,#68517a,#281c33 82%);isolation:isolate;flex:0 0 auto}
#pwr-studio .pwr-asset-visual canvas.pwr-asset-preview{width:100%;height:165px;display:block;border-radius:0;background:transparent!important;object-fit:contain}
#pwr-studio .pwr-asset-visual.pwr-focus-hair canvas{height:194px}
#pwr-studio .pwr-asset-visual.pwr-focus-body canvas{height:256px}
#pwr-studio .pwr-asset-visual.pwr-focus-upper-body canvas,#pwr-studio .pwr-asset-visual.pwr-focus-lower-body canvas{height:192px}
#pwr-studio .pwr-asset-raw-name{position:absolute;left:0;right:0;bottom:0;padding:7px 8px 6px;text-align:center;font-size:12px;font-weight:750;line-height:1.2;letter-spacing:.01em;color:#fff;overflow-wrap:anywhere;text-shadow:0 1px 4px #0c041c;background:linear-gradient(0deg,#140c1cf2,#140c1cbd 78%,#140c1c00);pointer-events:none;max-height:50%;overflow:hidden}
#pwr-studio .pwr-asset-hint{font-size:11px;color:#ddcaed;line-height:1.22;min-height:0;text-align:center}
#pwr-studio .pwr-asset.pwr-has-preview{min-height:0;justify-content:flex-start;padding:8px!important;gap:7px}
#pwr-studio .pwr-asset.pwr-has-preview .pwr-asset-label{min-height:0;font-size:11px}
#pwr-studio .pwr-preview-failed{display:block;position:absolute;top:33%;left:0;right:0;text-align:center;font-size:11px;color:#e4c6ef;pointer-events:none}
#pwr-studio .pwr-preview-loading{display:grid;place-items:center;font-size:11px;color:#f0d4ff;min-height:100px}
@media (max-width:700px){
  #pwr-studio .pwr-asset-visual canvas.pwr-asset-preview{height:130px}
  #pwr-studio .pwr-asset-visual.pwr-focus-hair canvas{height:170px}
  #pwr-studio .pwr-asset-visual.pwr-focus-body canvas{height:220px}
  #pwr-studio .pwr-asset-visual.pwr-focus-upper-body canvas,#pwr-studio .pwr-asset-visual.pwr-focus-lower-body canvas{height:165px}
  #pwr-studio .pwr-asset-raw-name{font-size:10.5px;padding:5px 4px}
}

/* v0.2.4 — bigger, item-focused previews and a viewport-aware color tray. */
#pwr-studio .pwr-assets-section{flex:0 0 auto;min-height:0;overflow:visible}
#pwr-studio .pwr-assets-section>.pwr-section-body{min-height:0;overflow:visible}
#pwr-studio .pwr-asset-grid{overflow:visible;flex:none;grid-auto-rows:auto;gap:10px;padding:3px 2px}
#pwr-studio .pwr-asset-grid.pwr-with-previews{grid-template-columns:repeat(2,minmax(0,1fr))}
#pwr-studio .pwr-asset.pwr-has-preview{min-height:200px;padding:10px!important;gap:9px;justify-content:space-between}
#pwr-studio .pwr-asset-preview{width:100%;height:165px;max-height:none;max-width:100%;object-fit:contain;object-position:center;display:block;border-radius:9px;background:radial-gradient(ellipse at 50% 38%,#665079,#281d33 80%)}
#pwr-studio .pwr-asset .pwr-preview-placeholder{height:165px;width:100%;border-radius:9px;background:#24192d;display:grid;place-items:center;font-size:16px}
#pwr-studio .pwr-asset-label{min-height:2.3em;display:grid;place-items:center;font-size:12px;font-weight:650;line-height:1.15;word-break:normal}
#pwr-studio .pwr-fit-row{margin-top:8px;flex-wrap:nowrap}
#pwr-studio .pwr-fit-row select{flex:1;width:100%;min-width:0;max-width:none}
@media (max-width:700px){#pwr-studio .pwr-fit-row{flex-wrap:wrap}}
#pwr-studio .pwr-asset-copy{display:grid;gap:2px;align-self:stretch}
#pwr-studio .pwr-asset-title{display:grid;place-items:center;font-size:12px;font-weight:700;line-height:1.18;color:#f7efff;text-align:center;overflow-wrap:anywhere;min-height:1.2em}
#pwr-studio .pwr-asset-sub{display:grid;place-items:center;font-size:10.5px;line-height:1.18;color:#cbb6d8;text-align:center;overflow-wrap:anywhere;opacity:.95;min-height:1.1em}
#pwr-studio .pwr-asset.pwr-active{outline:1px solid #e7b5f7}
#pwr-studio .pwr-asset-grid.pwr-with-previews .pwr-asset{overflow:hidden}
#pwr-studio .pwr-preview-hint{color:#ceb4e1;font-size:11px;font-weight:550}
/* Swatches MUST not inherit the global gradient button background. */
#pwr-studio .pwr-swatch-grid button,#pwr-studio .pwr-swatch-grid button:hover,#pwr-studio .pwr-swatch-grid button:focus{
  background:var(--pwr-swatch,#745083)!important;background-image:none!important;
  border:1px solid #e0cbf2cc!important;box-shadow:inset 0 0 0 1px #160d22a6!important;
  min-height:32px;padding:0!important;border-radius:7px;
}
#pwr-studio .pwr-swatch-grid button:hover{outline:2px solid #e5c0ff;outline-offset:1px;transform:none}
#pwr-studio .pwr-swatch-heading{font-weight:750;color:#d8c5e5;margin-top:10px;font-size:11px;letter-spacing:.04em}
/* Color controls are above the list, and the expanded editor floats ABOVE the item cards.
   It is intentionally closed by default so it does not obscure item selection. */
#pwr-studio .pwr-colors-section{position:sticky;top:0;z-index:100;flex:0 0 auto;
  background:linear-gradient(125deg,#362344,#241b31);border-color:#9f71b9;
  box-shadow:0 8px 22px #0b041ab8;overflow:visible}
#pwr-studio .pwr-colors-section[open]{z-index:101}
#pwr-studio .pwr-colors-section>.pwr-section-body{
  position:fixed;top:max(88px,13dvh);right:max(20px,calc((100vw - 1480px)/2 + 25px));width:min(460px,calc(100vw - 28px));
  max-height:min(69dvh,620px);overflow-y:auto;overscroll-behavior:contain;
  background:#21172d;border:1px solid #a67bc0;border-radius:14px;
  padding:12px;box-shadow:0 18px 45px #080311ed,0 0 0 1px #ffffff14;
  scrollbar-color:#8b68a3 #22152e;z-index:102
}
#pwr-studio .pwr-colors-section:not([open])>.pwr-section-body{display:none}
#pwr-studio .pwr-hex-picker{margin-top:7px}
#pwr-studio .pwr-picker-close-row{display:flex;justify-content:flex-end;align-items:center;position:sticky;top:-12px;z-index:4;padding:4px 0 7px;background:#21172d}
#pwr-studio .pwr-swatch-grid{grid-template-columns:repeat(8,minmax(0,1fr))}
@media (max-width:700px){
  #pwr-studio .pwr-asset-grid.pwr-with-previews{grid-template-columns:repeat(2,minmax(0,1fr))}
  #pwr-studio .pwr-asset.pwr-has-preview{min-height:150px;padding:6px!important}
  #pwr-studio .pwr-asset-preview,#pwr-studio .pwr-asset .pwr-preview-placeholder{height:115px}
  #pwr-studio .pwr-asset-title{font-size:11px}
  #pwr-studio .pwr-asset-sub{font-size:10px}
  #pwr-studio .pwr-colors-section>.pwr-section-body{top:14dvh;right:12px;max-height:68dvh}
}

/* v0.2.10: keep image and both labels visible; never present empty cards silently. */
#pwr-studio .pwr-asset-visual{position:relative;min-height:120px}
#pwr-studio .pwr-asset-visual .pwr-preview-pending{position:absolute;inset:0;display:grid;place-items:center;padding:12px;text-align:center;color:#d6b7e8;font-size:12px;background:#261b32ba;pointer-events:none}
#pwr-studio .pwr-asset-visual .pwr-preview-unavailable{color:#e3bbce;background:#251b30f2}
#pwr-studio .pwr-asset-copy{padding:0 4px 3px}
#pwr-studio .pwr-asset-title{font-size:13px}
#pwr-studio .pwr-asset-sub{font-size:11px;color:#cfb6e0}

/* v0.2.14: chest-size comparison for Bra8 and other breast-sized items. */
#pwr-studio .pwr-bra-compare{border:1px solid #8b61a7;border-radius:13px;padding:10px;margin-top:9px;background:#21162e}
#pwr-studio .pwr-bra-compare h3{font-size:12px;letter-spacing:.02em;margin:0 0 5px}
#pwr-studio .pwr-bra-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}
#pwr-studio .pwr-bra-choice{padding:6px!important;min-width:0!important;background:#291d37!important;display:grid;gap:5px;justify-items:center;overflow:hidden}
#pwr-studio .pwr-bra-choice.pwr-active{border:2px solid #f0b7ff!important;background:#64437a!important}
#pwr-studio .pwr-bra-choice canvas{width:100%;height:112px;object-fit:contain;border-radius:7px;background:radial-gradient(ellipse at 50% 35%,#785a91,#241a32 86%)}
#pwr-studio .pwr-bra-choice span{font-size:11px;line-height:1.2;overflow-wrap:anywhere;text-align:center}
#pwr-studio .pwr-bra-compare .pwr-help{margin:7px 0 0}
@media(max-width:650px){#pwr-studio .pwr-bra-choices{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* v0.2.18 — usability: undo/redo, side-by-side-like public comparison, favorites */
#pwr-studio .pwr-history-btn{min-height:34px!important;padding:7px 11px!important}
#pwr-studio .pwr-compare-btn{padding:6px 9px!important;min-height:29px!important;font-size:11px!important}
#pwr-studio .pwr-public-tag{color:#ffdfbb;border-color:#b27c65;background:#352637a8}
#pwr-studio .pwr-asset-card{position:relative;min-width:0;min-height:0;display:flex;align-items:stretch}
#pwr-studio .pwr-asset-card>.pwr-asset{width:100%;height:100%;min-width:0}
#pwr-studio .pwr-star{position:absolute;top:12px;right:12px;z-index:2;min-width:32px!important;min-height:31px!important;padding:3px 7px!important;border:1px solid #bc89d7!important;background:#27192dcc!important;color:#ead0f7!important;font-size:18px!important;line-height:1!important;border-radius:10px!important;box-shadow:0 1px 9px #0d051a8c!important}
#pwr-studio .pwr-star.pwr-star-active{color:#ffe4a5!important;background:#6c4a49ed!important;border-color:#ffe1a3!important}
#pwr-studio .pwr-star:hover{transform:none!important;background:#764b82!important}
#pwr-studio .pwr-favorite-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:7px 0}
#pwr-studio .pwr-favorite-tools .pwr-secondary{min-height:30px;padding:5px 10px;font-size:11px}
#pwr-studio .pwr-favorite-tools .pwr-active{background:#64416f!important;border-color:#dcb1fa!important}
#pwr-studio .pwr-empty-results{border:1px dashed #785c86;padding:18px;text-align:center;border-radius:10px;color:#d4c0df;font-size:12px}
@media(max-width:700px){#pwr-studio .pwr-star{top:7px;right:7px;min-width:29px!important;min-height:29px!important}}
/* v0.2.17 — safe, detached extended item variants. */
#pwr-studio .pwr-use-section{border-color:#795c96;background:linear-gradient(145deg,#2b2039,#1f192c)}
#pwr-studio .pwr-use-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}
#pwr-studio .pwr-use-choice{min-height:45px!important;white-space:normal;text-align:center;overflow-wrap:anywhere;padding:8px!important}
#pwr-studio .pwr-use-choice.pwr-active{outline:2px solid #e7bcfb;background:linear-gradient(135deg,#ae7bca,#754492)!important}
#pwr-studio .pwr-use-status{padding:8px 10px;background:#1b1227;border:1px solid #58436e;border-radius:9px;color:#f2dcff;font-size:12px}
@media(max-width:600px){#pwr-studio .pwr-use-choices{grid-template-columns:1fr}}
/* v0.2.16 — compact AEE-inspired private item tuning. */
#pwr-studio .pwr-tuning-section{border-color:#7e5b9a;background:linear-gradient(155deg,#2b203b,#21182e)}
#pwr-studio .pwr-tune-head{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
#pwr-studio .pwr-tune-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
#pwr-studio .pwr-tune-ctrl{min-width:0;padding:9px;background:#1b1425;border:1px solid #564467;border-radius:11px}
#pwr-studio .pwr-tune-label{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px;color:#e8d8f3;font-weight:650;margin-bottom:7px}
#pwr-studio .pwr-tune-val{color:#d9b2f3;font-variant-numeric:tabular-nums}
#pwr-studio .pwr-tune-ctrl input[type=range]{width:100%;accent-color:#c983e5;cursor:pointer}
#pwr-studio .pwr-tune-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
#pwr-studio .pwr-tune-actions button{flex:1;min-width:110px}
#pwr-studio .pwr-tune-checks{display:flex;flex-wrap:wrap;gap:15px;margin:7px 0}
#pwr-studio .pwr-tune-checks label{display:flex;align-items:center;gap:6px}
#pwr-studio .pwr-tune-ctrl[aria-disabled=true]{opacity:.55}
@media(max-width:680px){#pwr-studio .pwr-tune-grid{grid-template-columns:1fr}}

/* 0.2.20: Avoid free-floating BC canvases when bra comparisons are present. */
#pwr-studio .pwr-bra-compare{display:block;position:relative!important;min-width:0;max-width:100%;overflow:hidden!important;contain:layout paint;}
#pwr-studio .pwr-bra-compare>summary{display:flex;align-items:center;gap:8px;min-height:30px;cursor:pointer;list-style:none;font-weight:750;font-size:12px;user-select:none;}
#pwr-studio .pwr-bra-compare>summary::-webkit-details-marker{display:none}
#pwr-studio .pwr-bra-compare>summary::after{content:'▾';margin-left:auto;color:#d9b2f3}
#pwr-studio .pwr-bra-compare:not([open])>summary::after{content:'▸'}
#pwr-studio .pwr-bra-compare:not([open])>.pwr-bra-compare-body{display:none!important}
#pwr-studio .pwr-bra-compare-body{min-width:0;max-width:100%;padding-top:4px;overflow:hidden}
#pwr-studio .pwr-bra-choices{min-width:0;max-width:100%;overflow:hidden;grid-template-columns:repeat(3,minmax(0,1fr))}
#pwr-studio .pwr-bra-choice{position:relative!important;inset:auto!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;contain:layout paint;}
#pwr-studio .pwr-bra-choice canvas{position:static!important;inset:auto!important;display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;height:112px!important;max-height:112px!important;box-sizing:border-box!important;transform:none!important;z-index:auto!important;float:none!important;}
@media(max-width:650px){#pwr-studio .pwr-bra-choices{grid-template-columns:repeat(2,minmax(0,1fr))}}


/* 0.2.21: Native BC ColorIndex based multi-layer palette. */
#pwr-studio .pwr-layer-head{display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap;margin:8px 0 6px}
#pwr-studio .pwr-layer-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:6px 0 10px}
#pwr-studio button.pwr-layer-tile{display:flex;align-items:center;gap:9px;text-align:left;min-width:0;min-height:53px;padding:7px 9px!important;background:#30223f!important;border:1px solid #71538a!important;border-radius:10px}
#pwr-studio button.pwr-layer-tile:hover{background:#463056!important}
#pwr-studio button.pwr-layer-tile.pwr-active{background:#56346c!important;border-color:#e1a9f4!important;box-shadow:0 0 0 1px #d6a0e45a}
#pwr-studio .pwr-layer-swatch{width:32px;height:32px;min-width:32px;flex:none;border:1px solid #dec0ef;border-radius:8px;background:repeating-conic-gradient(#c8b1d8 0% 25%,#57446b 0% 50%) 50%/12px 12px;box-shadow:inset 0 0 0 1px #180d2699}
#pwr-studio .pwr-layer-info{display:flex;flex-direction:column;align-items:flex-start;min-width:0;line-height:1.3;gap:3px}
#pwr-studio .pwr-layer-title{font-size:12px;font-weight:750;overflow-wrap:anywhere}
#pwr-studio .pwr-layer-detail{font-size:10px;color:#d5c1e4;overflow-wrap:anywhere}
#pwr-studio .pwr-layer-editing{font-size:11px;color:#edd4ff;font-weight:700;margin:5px 0 0}
#pwr-studio .pwr-color-buttons button{white-space:normal}
@media(max-width:500px){#pwr-studio .pwr-layer-list{grid-template-columns:1fr}}


/* v0.2.22: The HSV pad is DOM/CSS rather than a canvas.
   BC and AEE can style or capture canvas nodes, so keep the color pad isolated. */
#pwr-studio .pwr-hex-picker{position:relative;min-width:0;max-width:100%;overflow:visible;}
#pwr-studio .pwr-hex-picker div.pwr-sv-canvas{
  display:block!important;position:relative!important;inset:auto!important;
  top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;
  width:100%!important;max-width:100%!important;height:130px!important;
  min-height:130px!important;box-sizing:border-box!important;margin:10px 0 0!important;
  border:1px solid #9577ae!important;border-radius:10px!important;
  overflow:hidden!important;isolation:isolate;z-index:auto!important;
  transform:none!important;filter:none!important;float:none!important;
  touch-action:none!important;cursor:crosshair;
  background-image:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),linear-gradient(to right,#f00,#f00);
}
#pwr-studio .pwr-sv-canvas .pwr-sv-marker{
  display:block;position:absolute!important;width:14px;height:14px;
  border-radius:50%;border:2px solid white;outline:1px solid #26142e;
  box-shadow:0 0 0 1px #38274499,0 1px 5px #180d28b5;
  transform:translate(-50%,-50%)!important;
  z-index:1;pointer-events:none;
}
#pwr-studio .pwr-colors-section>.pwr-section-body{overflow-x:hidden;}
#pwr-studio .pwr-hex-picker .pwr-hue{position:relative!important;inset:auto!important;display:block!important;}


/* 0.2.24: Native-inspired BC wardrobe composition. No native inventory or dress APIs are called. */
#pwr-studio.pwr-native{padding:7px;background:#07030ac9}
#pwr-studio.pwr-native .pwr-shell{width:min(1660px,100%);height:min(960px,99dvh);border-radius:9px;border:1px solid #8d48b8;background:#100b18}
#pwr-studio.pwr-native .pwr-toolbar{padding:9px 14px;background:linear-gradient(90deg,#130b1de3,#2c193c);border-bottom:1px solid #7836a0}
#pwr-studio.pwr-native .pwr-brand-icon{border-radius:7px;height:38px;flex-basis:38px;font-size:20px}
#pwr-studio.pwr-native .pwr-subhead{font-size:11px}
#pwr-studio.pwr-native .pwr-main{display:grid;grid-template-columns:66px minmax(275px,39%) minmax(0,1fr);grid-template-areas:'nav stage side';min-height:0}
#pwr-studio .pwr-native-nav{display:none}
#pwr-studio.pwr-native .pwr-native-nav{grid-area:nav;display:flex;flex-direction:column;align-items:stretch;gap:7px;min-width:0;padding:13px 7px;background:#0b0a11e8;border-right:1px solid #5f2880;overflow-y:auto;scrollbar-width:thin}
#pwr-studio .pwr-native-nav button{display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;min-width:0;min-height:55px;padding:5px 2px!important;font-size:10px!important;font-weight:600;line-height:1.1;border:1px solid #694079!important;border-radius:7px!important;background:linear-gradient(#25172e,#100d19)!important;color:#e2c8ef!important}
#pwr-studio .pwr-native-nav button.pwr-active{background:linear-gradient(#633078,#311842)!important;border-color:#da9ffc!important;color:white!important;box-shadow:0 0 0 1px #b968e85e!important}
#pwr-studio .pwr-native-nav .pwr-nav-icon{font-size:22px;line-height:1.1;color:#c57cfa}
#pwr-studio.pwr-native .pwr-stage{grid-area:stage;background:#1d1126d8;border-right:1px solid #703a8a;padding:12px;gap:8px}
#pwr-studio.pwr-native .pwr-stage-title{flex-wrap:wrap}
#pwr-studio.pwr-native .pwr-scene{border:1px solid #5d3773;border-radius:9px;box-shadow:inset 0 0 12px #1a0d2aa1;min-height:160px}
#pwr-studio.pwr-native .pwr-backdrop-card{border-radius:8px;background:#1c1425c9;padding:9px}
#pwr-studio.pwr-native .pwr-side{grid-area:side;background:#100b18ee;padding:12px;gap:9px}
#pwr-studio.pwr-native .pwr-side>.pwr-tabs,#pwr-studio.pwr-native .pwr-slot-section{display:none!important}
#pwr-studio .pwr-native-rows{display:none}
#pwr-studio.pwr-native .pwr-native-rows{display:block;flex:none;min-height:0;max-height:min(43vh,390px);overflow-y:auto;scrollbar-color:#8c49aa #211427;scrollbar-width:thin;border:1px solid #653785;border-radius:8px;background:#120d1b}
#pwr-studio .pwr-native-listhead{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 11px;background:#261630;border-bottom:1px solid #663380;font-size:11px;font-weight:800;letter-spacing:.055em;color:#dfbaf8;position:sticky;top:0;z-index:2}
#pwr-studio .pwr-native-row{display:grid;grid-template-columns:35px minmax(0,1fr) 30px 30px 43px 35px;gap:4px;align-items:center;min-height:53px;padding:5px 6px;border-bottom:1px solid #3e2849;min-width:0;background:#180f21}
#pwr-studio .pwr-native-row:nth-of-type(2n){background:#21132b}
#pwr-studio .pwr-native-row.pwr-active{background:#3a204c;box-shadow:inset 3px 0 #d088fc}
#pwr-studio .pwr-native-row:last-child{border-bottom:0}
#pwr-studio .pwr-native-row .pwr-native-slot-symbol{color:#d095f7;font-size:19px;font-weight:800;text-align:center}
#pwr-studio .pwr-native-row button{min-width:0;min-height:34px;padding:5px!important;border-radius:5px!important;border:1px solid #623a7a!important;box-shadow:none!important;background:#26172f!important;font-weight:650;font-size:12px}
#pwr-studio .pwr-native-row button:hover{background:#592c71!important;border-color:#b271d0!important}
#pwr-studio .pwr-native-row button.pwr-native-selected{padding:5px 8px!important;display:flex;flex-direction:column;justify-content:center;align-items:stretch;text-align:left;gap:2px;min-height:42px;background:#24172e!important}
#pwr-studio .pwr-native-row.pwr-active button.pwr-native-selected{background:#61357a!important;border-color:#c583e8!important}
#pwr-studio .pwr-native-row .pwr-native-name{font-size:10px;line-height:1.15;color:#c6a8da;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pwr-studio .pwr-native-row .pwr-native-current{font-size:12px;line-height:1.25;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pwr-studio .pwr-native-row button.pwr-native-swatch{background:#24172f!important;display:grid;place-items:center}
#pwr-studio .pwr-native-row .pwr-native-color-chip{display:block;width:22px;height:22px;max-width:100%;border-radius:50%;border:1px solid #f2ceff;background:repeating-conic-gradient(#d6c2e0 0% 25%,#694276 0% 50%) 50%/9px 9px}
#pwr-studio .pwr-native-row .pwr-native-color-chip[data-color='true']{background:var(--pwr-active-color)!important}
#pwr-studio.pwr-native .pwr-section{border-radius:8px;padding:10px;background:#21162d;border-color:#55326d}
#pwr-studio.pwr-native .pwr-assets-section{order:0}
#pwr-studio.pwr-native .pwr-assets-section>summary{background:#2a1a37;min-height:35px;padding:5px;border-radius:6px}
#pwr-studio.pwr-native .pwr-asset-grid.pwr-with-previews{grid-template-columns:repeat(2,minmax(0,1fr))}
#pwr-studio.pwr-native .pwr-asset-card{min-width:0}
#pwr-studio.pwr-native .pwr-asset.pwr-has-preview{min-height:160px}
#pwr-studio.pwr-native .pwr-asset-preview{max-height:145px}
#pwr-studio.pwr-native .pwr-colors-section{top:0}
#pwr-studio .pwr-layout-btn{border-color:#c180e0!important;font-size:11px!important;white-space:nowrap}
#pwr-studio.pwr-native .pwr-layout-btn{background:#3d2555!important}
@media(max-width:1100px){#pwr-studio.pwr-native .pwr-main{grid-template-columns:54px minmax(205px,36%) minmax(0,1fr)}#pwr-studio .pwr-native-nav button{min-height:48px;font-size:9px!important}#pwr-studio .pwr-native-row{grid-template-columns:28px minmax(0,1fr) 26px 26px 35px 30px;gap:3px;padding:5px 3px}#pwr-studio .pwr-native-row .pwr-native-slot-symbol{font-size:16px}}
@media(max-width:750px){
  #pwr-studio.pwr-native .pwr-main{grid-template-columns:minmax(0,1fr);grid-template-rows:60px minmax(210px,35%) minmax(310px,1fr);grid-template-areas:'nav' 'stage' 'side'}
  #pwr-studio.pwr-native .pwr-native-nav{flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:5px;gap:5px}
  #pwr-studio.pwr-native .pwr-native-nav button{flex:1;min-width:61px;min-height:45px;gap:2px}
  #pwr-studio .pwr-native-nav .pwr-nav-icon{font-size:18px}
  #pwr-studio.pwr-native .pwr-stage{overflow-y:auto;padding:6px;gap:5px}
  #pwr-studio.pwr-native .pwr-scene{flex:0 0 170px;min-height:170px}
  #pwr-studio.pwr-native .pwr-stage-title{display:flex!important}
  #pwr-studio.pwr-native .pwr-side{overflow-y:auto;padding:7px}
  #pwr-studio.pwr-native .pwr-native-rows{max-height:220px}
}
@media(max-width:460px){#pwr-studio .pwr-native-row{grid-template-columns:22px minmax(0,1fr) 24px 24px 28px 27px;gap:2px;min-height:46px}#pwr-studio .pwr-native-row button{font-size:10px!important;padding:3px!important}#pwr-studio .pwr-native-row .pwr-native-current{font-size:11px}}

@media (prefers-reduced-motion:reduce){#pwr-studio button,#pwr-studio input,#pwr-launcher{transition:none!important;transform:none!important}}
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
    try {
      app.mod = globalThis.bcModSdk.registerMod({name:'PawPrivateWardrobe',fullName:'Paw Private Wardrobe',version:'0.2.25'});
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
          if (app.enabled && C && member(C) && eligiblePartnerForCharacter(C)) {
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
    } catch(err) {console.error('[Paw Private Wardrobe] Hook registration failed',err);return false;}
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
    const partner=currentPartner();
    if (!partner) return null;
    const targets=[me(),partner];
    for(let i=0;i<Math.min(args.length,10);i++) {
      const source=args[i];
      if (!source || (typeof source!=='object' && typeof source!=='function')) continue;
      for(const c of targets){
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
    st.look=look;st.fit=normalizeFit(entry.fit);st.braChest=normalizeBraChest(c,entry.braChest);
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
    root.classList.toggle('pwr-native',app.studioLayout==='bc');
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
    const undo=button('↶ Undo',undoStudio,'pwr-secondary pwr-history-btn');undo.title='Undo the last wardrobe change (Ctrl+Z)';undo.disabled=!st.undo?.length;
    const redo=button('↷ Redo',redoStudio,'pwr-secondary pwr-history-btn');redo.title='Redo a reverted wardrobe change (Ctrl+Y)';redo.disabled=!st.redo?.length;
    append(topButtons,undo,redo);
    const layout=button(app.studioLayout==='bc'?'▤ Atelier layout':'◫ BC layout',()=>{app.studioLayout=app.studioLayout==='bc'?'atelier':'bc';saveSettings();renderStudio();},'pwr-secondary pwr-layout-btn');
    layout.title='Switch between BC-inspired wardrobe and the original Atelier editor';
    append(topButtons,layout);
    append(topButtons,button('Discard & close',closeStudio,'pwr-secondary'),button(st.remoteChanged&&st.overwriteConfirmed?'Overwrite & share':'Save & share',saveStudio,'pwr-save'));
    append(h,topButtons);append(toolbar,h);
    if(st.remoteChanged) {
      const alert=node('div',undefined,'pwr-pale');
      append(alert,node('span','Your partner sent a newer look while you were editing. It already appears in the room. Your draft is unchanged.'));
      const actions=node('div',undefined,'pwr-row');
      append(actions,button('Load newer look',()=>{
        const saved=app.profiles[key(st.partner,st.subject)];
        recordStudioChange(st);
        st.look=cloneJson(saved&&!saved.removed&&saved.look?saved.look:snapshot(c));
        st.comparePublic=false;
        st.fit=normalizeFit(saved?.fit);
        st.braChest=normalizeBraChest(c,saved?.braChest);
        st.remoteChanged=false;st.overwriteConfirmed=false;st.dirty=false;
        app.studioClones=new WeakMap();renderStudio();
      }));
      append(alert,actions);append(toolbar,alert);
    }
    const main=node('div',undefined,'pwr-main');shell.appendChild(main);
    const nativeNav=node('nav',undefined,'pwr-native-nav');
    nativeNav.setAttribute('aria-label','Appearance categories');
    const navTabs=[['Clothing','▤'],['Body','♙'],['Accessories','✦'],['Gear','⚙'],['All','☰']];
    for(const [tab,symbol] of navTabs){
      const b=button('',()=>{app.editorTab=tab;app.editorPage=0;app.editorSearch='';app.editorGroup='';st.dragEnabled=false;st.dragTempLook=null;renderStudio();},'pwr-native-nav-button'+(app.editorTab===tab?' pwr-active':''));
      b.title=tab;
      b.setAttribute('aria-label',tab);
      append(b,node('span',symbol,'pwr-nav-icon'),node('span',tab));
      append(nativeNav,b);
    }
    append(main,nativeNav);
    const stage=node('div',undefined,'pwr-stage');main.appendChild(stage);
    const stageTitle=node('div',undefined,'pwr-stage-title');
    append(stageTitle,node('span','Character preview','pwr-label-upper'));
    const previewState=node('div',undefined,'pwr-row');previewState.style.margin='0';previewState.style.gap='7px';
    append(previewState,node('span',st.comparePublic?'PUBLIC · COMPARISON':'PRIVATE · LOCAL ONLY','pwr-mini-tag'+(st.comparePublic?' pwr-public-tag':'')));
    const compare=button(st.comparePublic?'Show private draft':'Compare public look',()=>{st.comparePublic=!st.comparePublic;renderStudio();},'pwr-secondary pwr-compare-btn');
    compare.title='Switch the studio preview without changing your private outfit';
    append(previewState,compare);
    // The same drag toggle is also available in Fine-tune below.
    const chosenForMove=st.look.find(r=>r.group===app.editorGroup && r.asset!==HIDE_ITEM);
    if(adjustableRecord(c,chosenForMove)){
      const on=st.dragEnabled&&st.dragGroup===app.editorGroup;
      const toggle=button(on?'✥ Drag: ON':'✥ Drag item',()=>{
        st.dragEnabled=!on;st.dragGroup=app.editorGroup;st.comparePublic=false;
        st.dragTempLook=null;st.dragTempClones=null;renderStudio();
      },'pwr-secondary pwr-drag-toggle'+(on?' pwr-active':''));
      toggle.title='Drag anywhere on the character preview to move the selected item';
      append(previewState,toggle);
    }
    append(stageTitle,previewState);
    append(stage,stageTitle);
    const scene=node('div',undefined,'pwr-scene');applyBackground(scene);stage.appendChild(scene);
    const sceneInner=node('div',undefined,'pwr-scene-inner');append(scene,sceneInner);
    const characterHolder=node('div',undefined,'pwr-character-holder');append(sceneInner,characterHolder);
    const canvas=node('canvas');canvas.className='pwr-character-canvas';canvas.width=500;canvas.height=1000;
    append(characterHolder,canvas);
    // A pointer surface covering only the preview (never the wardrobe controls).
    // Move optional items by editing the same private X/Y values as Fine-tune.
    const activeDragRecord=st.look.find(r=>r.group===app.editorGroup && r.asset!==HIDE_ITEM);
    const canDragSelected=adjustableRecord(c,activeDragRecord);
    if(canDragSelected && st.dragEnabled && st.dragGroup===app.editorGroup && !st.comparePublic){
      const surface=node('div',undefined,'pwr-item-drag-overlay');
      surface.setAttribute('role','application');
      surface.setAttribute('aria-label','Drag to position '+displayName(activeDragRecord.asset));
      const hint=node('span','Drag to move '+displayName(activeDragRecord.asset),'pwr-drag-instruction');
      const delta=node('span','Release to apply · Esc to cancel','pwr-drag-delta');
      append(surface,hint,delta);append(characterHolder,surface);
      let drag=null;
      const previewHeight=()=>Number(app.studioFit?.destination?.[3])||app.previewSize||380;
      const sourceHeight=()=>Number(app.studioFit?.visible?.[3])||0;
      const pointerMove=e=>{
        if(!drag || e.pointerId!==drag.id)return;
        const scalar=drag.scalar;
        const diffX=e.clientX-drag.clientX,diffY=e.clientY-drag.clientY;
        const newX=Math.round(clamp(drag.startX+diffX*scalar,...tuneLimits.x));
        const newY=Math.round(clamp(drag.startY+diffY*scalar,...tuneLimits.y));
        if(newX===drag.x&&newY===drag.y)return;
        drag.x=newX;drag.y=newY;drag.moved=true;
        delta.textContent=`Offset X ${newX}px · Y ${newY}px`;
        // Show the new placement during the drag, but rate-limit expensive BC renders.
        const now=Date.now();
        if(now-drag.lastPaint>300){
          drag.lastPaint=now;
          const draft=cloneJson(st.look);
          const item=draft.find(r=>r.group===drag.group&&r.asset===drag.asset);
          if(item){
            item.tune={...DEFAULT_TUNE,...(normalizeTune(item.tune)||{}),x:newX,y:newY};
            st.dragTempLook=draft;st.dragTempClones=new WeakMap();
            drawStudioCanvas();
          }
        }
        e.preventDefault();
      };
      surface.addEventListener('pointerdown',e=>{
        if(drag || (e.pointerType==='mouse' && e.button!==0))return;
        const scale=sourceHeight()/previewHeight();
        if(!Number.isFinite(scale)||scale<=0){delta.textContent='Preview still loading — try again';return;}
        const tune=normalizeTune(activeDragRecord.tune)||DEFAULT_TUNE;
        drag={id:e.pointerId,clientX:e.clientX,clientY:e.clientY,scalar:scale,
          startX:tune.x,startY:tune.y,x:tune.x,y:tune.y,moved:false,lastPaint:0,
          group:activeDragRecord.group,asset:activeDragRecord.asset};
        surface.classList.add('pwr-moving');
        try{surface.setPointerCapture(e.pointerId);}catch(_){}
        e.preventDefault();
      });
      surface.addEventListener('pointermove',pointerMove);
      const finish=e=>{
        if(!drag || e.pointerId!==drag.id)return;
        const last=drag;drag=null;
        surface.classList.remove('pwr-moving');
        st.dragTempLook=null;st.dragTempClones=null;
        if(e.type==='pointerup' && last.moved && (last.x!==last.startX||last.y!==last.startY)){
          // One undo entry for the whole gesture; never publish automatically.
          modifyStudio(list=>{
            const item=list.find(r=>r.group===last.group&&r.asset===last.asset);
            if(item)item.tune={...DEFAULT_TUNE,...(normalizeTune(item.tune)||{}),x:last.x,y:last.y};
          });
        }else drawStudioCanvas();
        e.preventDefault();
      };
      surface.addEventListener('pointerup',finish);
      surface.addEventListener('pointercancel',finish);
      surface.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){
        const id=drag.id;finish({pointerId:id,type:'pointercancel',preventDefault(){}});
      }});
    }
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
    const fitRow=node('div',undefined,'pwr-backdrop-row pwr-fit-row');
    append(fitRow,node('span','Private body fit'));
    const fitSelect=makeSelect(fitRow,[
      ['auto','Automatic · female Small for bras'],
      ['flat','Flat feminine · any gender'],
      ['original','Original body / gender']
    ],normalizeFit(st.fit),value=>{
      changeStudioFit(value,st.braChest);
    });
    fitSelect.title='Only the private illustration changes. Public body, gender, clothing and equipment remain untouched.';
    append(backdropCard,fitRow);
    append(backdropCard,node('p','Automatic recognizes common non-female gender values and flat chest assets. Every bra in Automatic or Flat feminine mode uses the smallest available female chest by default (normally Small). Original is an opt-out. This affects detached art only, not public body data.','pwr-help'));
    // Bra8 (Lace and Satin) and similar bras may supply a shaped sprite even
    // with a flat BodyUpper. Compare the ACTUAL local game drawings rather than
    // claiming that merely setting Gender=F reshapes the sprite artwork.
    const fitAppearance=appearanceFor(c,st.look,st.fit,st.braChest);
    const selectedBra=fitAppearance?.find(it=>hasBraInAppearance([it]));
    if(selectedBra && shouldRenderFeminine(c,st.fit,fitAppearance)) {
      // Bra previews are OPTIONAL and generated only when opened. Previously
      // these hidden canvases were created on every atelier render and could
      // escape the preview area under BC/other-addon global canvas styles.
      const compare=node('details',undefined,'pwr-bra-compare');
      compare.open=!!app.sections.braCompare;
      append(compare,node('summary','Bra artwork fit · '+displayName(selectedBra.Asset?.Description||selectedBra.Asset?.Name||'Bra')));
      const inner=node('div',undefined,'pwr-bra-compare-body');
      append(inner,node('p','Compare body variants for this bra. Private preview only. Open this panel to render comparison pictures.','pwr-help'));
      const variants=['auto',...groupAssets(groupByName(c,'BodyUpper')).map(a=>a.Name)];
      const choiceGrid=node('div',undefined,'pwr-bra-choices');append(inner,choiceGrid);
      append(compare,inner);
      const mountChoices=()=>{
        if(!compare.open||choiceGrid.childElementCount||app.studio!==st)return;
      for(const choice of variants) {
        const active=normalizeBraChest(c,st.braChest)===choice;
        const tile=button('',()=>{
          changeStudioFit(st.fit,choice);
        },'pwr-bra-choice'+(active?' pwr-active':''));
        const canvas=node('canvas');canvas.width=180;canvas.height=150;
        append(tile,canvas,node('span',choice==='auto'?'Automatic · smallest female':choice));
        append(choiceGrid,tile);
        const cache=new WeakMap();let attempts=0,complete=false;
        const drawChoice=()=>{
          if(app.studio!==st || !canvas.isConnected||complete)return;
          try {
            const clone=getRenderClone(c,st.look,cache,drawChoice,st.fit,choice);
            const src=clone?.Canvas;
            if(src && thumbnailCanvasReady(src)) {
              const full=visibleStudioBounds(src);
              // Chest-focused, stable framing. A wide crop leaves shoulders and
              // neckline visible for assessing bra cup fit.
              const bx=full.x+full.width*.10,by=full.y+full.height*.20;
              const bw=full.width*.80,bh=full.height*.41;
              const ctx=canvas.getContext('2d');
              if(ctx) {
                const scale=Math.min(canvas.width/bw,canvas.height/bh);
                const w=bw*scale,h=bh*scale;
                ctx.clearRect(0,0,canvas.width,canvas.height);
                ctx.drawImage(src,bx,by,bw,bh,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
                complete=true;
              }
            }
          }catch(_){/* a BC sprite may be unavailable */}
          if(!complete && ++attempts<10)setTimeout(drawChoice,120+attempts*145);
        };
        setTimeout(drawChoice,100);
      }
      };
      compare.addEventListener('toggle',()=>{
        app.sections.braCompare=compare.open;
        if(compare.open)mountChoices();
      });
      append(backdropCard,compare);
      if(compare.open)mountChoices();
    }
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
    for(const tab of ['Clothing','Body','Accessories','Gear','All'])append(tabs,button(tab,()=>{app.editorTab=tab;app.editorPage=0;app.editorSearch='';app.editorGroup='';st.dragEnabled=false;st.dragTempLook=null;renderStudio();},'pwr-tab'+(app.editorTab===tab?' pwr-active':'')));
    append(side,tabs);
    let groups=assetGroups(c).filter(g=>app.editorTab==='All'||groupClass(g)===app.editorTab);
    if(!groups.length)groups=assetGroups(c);
    if(!groups.some(g=>g.Name===app.editorGroup))app.editorGroup=groups[0]?.Name||'';
    const createFold=(heading,n,sectionClass,which)=>{
      const section=node('details',undefined,'pwr-section pwr-details '+(sectionClass||''));
      section.open=app.sections[which]!==false;
      section.addEventListener('toggle',()=>{app.sections[which]=section.open;});
      const summary=node('summary');append(summary,node('span',n,'pwr-step'),node('h3',heading));append(section,summary);
      const body=node('div',undefined,'pwr-section-body');append(section,body);append(side,section);return {section,body};
    };
    // Native-inspired slot list: familiar BC rows with inline style arrows and
    // color / configuration shortcuts. They only modify detached private drafts.
    const nativeRows=node('section',undefined,'pwr-native-rows');
    nativeRows.setAttribute('aria-label','Appearance slots');
    const listHeader=node('div',undefined,'pwr-native-listhead');
    append(listHeader,node('span','APPEARANCE · '+app.editorTab.toUpperCase()),node('span',groups.length+' slots'));
    append(nativeRows,listHeader);
    const selectNativeGroup=(g,section)=>{
      app.editorGroup=g.Name;app.editorPage=0;app.editorSearch='';
      st.dragEnabled=false;st.dragTempLook=null;
      if(section)app.sections[section]=true;
      renderStudio();
      if(section){
        // Scroll the target section into the visible portion of the pane.
        const name=section==='colors'?'.pwr-colors-section':section==='use'?'.pwr-use-section':'.pwr-assets-section';
        const target=app.studioPanel?.querySelector(name);
        if(target && section!=='colors')target.scrollIntoView({block:'nearest',behavior:'auto'});
      }
    };
    const nativeGlyph=g=>g.Category==='Item'?'⚙':/hair|head|face|eye|ear/i.test(g.Name)?'♙':/shoe|boot|sock|foot/i.test(g.Name)?'♧':/bra|dress|cloth|top|suit|skirt|pant/i.test(g.Name)?'▤':'✦';
    for(const g of groups){
      const record=st.look.find(r=>r.group===g.Name && r.asset!==HIDE_ITEM);
      const equipped=record?assetByName(c,g,record.asset):null;
      const itemName=equipped?displayName(equipped.Description||equipped.Name):record?displayName(record.asset):'None';
      const selected=g.Name===app.editorGroup;
      const row=node('div',undefined,'pwr-native-row'+(selected?' pwr-active':''));
      append(row,node('span',nativeGlyph(g),'pwr-native-slot-symbol'));
      const sel=button('',()=>selectNativeGroup(g,'styles'),'pwr-native-selected');
      sel.title='Browse '+displayName(g.Description||g.Name);
      append(sel,node('span',displayName(g.Description||g.Name),'pwr-native-name'),node('span',itemName,'pwr-native-current'));
      append(row,sel);
      const variants=groupAssets(g).filter(a=>a?.Name);
      const removable=!!(g.AllowNone||g.Category==='Item');
      const choices=removable?[null,...variants]:variants;
      const currentIdx=choices.findIndex(a=>(a?.Name||null)===(record?.asset||null));
      const cycle=delta=>{
        if(!choices.length)return;
        const newIndex=((currentIdx<0?0:currentIdx)+delta+choices.length)%choices.length;
        const chosen=choices[newIndex];
        // A style change is one Undo step; preserve color and supported visual
        // overrides only when the same asset is chosen again.
        modifyStudio(list=>{
          const old=list.find(x=>x.group===g.Name && x.asset!==HIDE_ITEM);
          for(let i=list.length-1;i>=0;i--)if(list[i].group===g.Name)list.splice(i,1);
          if(chosen)list.push(withTune({group:g.Name,asset:chosen.Name,color:old?.color||'Default',...(old?.asset===chosen.Name&&old?.use?{use:old.use}:{})},old?.asset===chosen.Name?normalizeTune(old?.tune):null));
          else if(g.Category==='Item')list.push({group:g.Name,asset:HIDE_ITEM,color:'Default'});
        });
      };
      const back=button('‹',()=>cycle(-1),'pwr-native-arrow');back.title='Previous style';back.setAttribute('aria-label','Previous '+g.Name+' style');back.disabled=!choices.length;
      const forward=button('›',()=>cycle(1),'pwr-native-arrow');forward.title='Next style';forward.setAttribute('aria-label','Next '+g.Name+' style');forward.disabled=!choices.length;
      append(row,back,forward);
      const colorBtn=button('',()=>{app.activeColorLayer=0;selectNativeGroup(g,'colors');},'pwr-native-swatch');
      colorBtn.title='Edit colors for '+g.Name;
      colorBtn.setAttribute('aria-label','Edit '+g.Name+' colors');
      const chip=node('span',undefined,'pwr-native-color-chip');
      const col=Array.isArray(record?.color)?record.color.find(x=>/^#[0-9a-f]{3,8}$/i.test(x)):record?.color;
      if(typeof col==='string'&&/^#[0-9a-f]{3,8}$/i.test(col)){chip.style.setProperty('--pwr-active-color',col);chip.setAttribute('data-color','true');}
      append(colorBtn,chip);append(row,colorBtn);
      const use=button('⚙',()=>selectNativeGroup(g,'use'),'pwr-native-config');use.title='Use / Configure '+g.Name;use.setAttribute('aria-label','Configure '+g.Name);
      append(row,use);
      append(nativeRows,row);
    }
    side.appendChild(nativeRows);
    const slotFold=createFold('Choose a private visual slot','01','pwr-slot-section', 'slots');
    const slotSection=slotFold.body;
    append(slotSection,node('div','Full BC catalog · no purchase or gender filtering · Gear is visual-only and does not equip real items.','pwr-help'));
    const groupGrid=node('div',undefined,'pwr-groups');
    for(const g of groups){
      const current=st.look.find(x=>x.group===g.Name);
      append(groupGrid,button(`${displayName(g.Description||g.Name)}${current?' ●':''}`,()=>{app.editorGroup=g.Name;app.editorPage=0;app.editorSearch='';st.dragEnabled=false;st.dragTempLook=null;renderStudio();},'pwr-group'+(app.editorGroup===g.Name?' pwr-active':'')));
    }
    append(slotSection,groupGrid);
    const group=groupByName(c,app.editorGroup);
    if(!group)return;
    const assetSection=createFold('Choose '+displayName(group.Description||group.Name),'02','pwr-assets-section','styles').body;
    const chooseHeader=node('div',undefined,'pwr-head');
    append(chooseHeader,node('span','Catalog previews · click once to style privately','pwr-preview-hint'));
    append(chooseHeader,button(app.thumbnailFocus==='item'?'Zoom: ITEM':'Zoom: FULL',()=>{app.thumbnailFocus=app.thumbnailFocus==='item'?'full':'item';saveSettings();renderStudio();},'pwr-secondary'));
    append(chooseHeader,button(app.showThumbnails?'Previews ON':'Previews OFF',()=>{app.showThumbnails=!app.showThumbnails;saveSettings();renderStudio();},'pwr-secondary'));
    append(assetSection,chooseHeader);
    const search=node('input');search.type='search';search.placeholder='Search styles in this slot…';search.value=app.editorSearch;
    search.addEventListener('input',()=>{app.editorSearch=search.value;app.editorPage=0;renderAssetGrid();});
    append(assetSection,search);
    const favoriteTools=node('div',undefined,'pwr-favorite-tools');
    const favoriteFilter=button(app.favoritesOnly?'★ Favorites only':'☆ Show favorites',()=>{
      app.favoritesOnly=!app.favoritesOnly;app.editorPage=0;renderStudio();
    },'pwr-secondary'+(app.favoritesOnly?' pwr-active':''));
    favoriteFilter.title='Filter the current asset slot to your starred items';
    append(favoriteTools,favoriteFilter,node('span','Star an item card to keep it handy. Favorites stay on this account.','pwr-help'));
    append(assetSection,favoriteTools);
    const grid=node('div',undefined,'pwr-asset-grid');append(assetSection,grid);
    const pager=node('div',undefined,'pwr-row pwr-pager');append(assetSection,pager);
    const current=st.look.find(r=>r.group===group.Name && r.asset !== HIDE_ITEM);
    let thumbIndex=0;
    // Unlike the older "remove the whole group" baseline, the reference
    // retains mandatory Body/Hair groups. Existing selected style is the
    // comparison when available; otherwise use the original public slot.
    const mode=thumbnailMode(group);
    const publicSlot=snapshot(c).find(x=>x.group===group.Name);
    const referenceLook=cloneJson(st.look);
    if(!current && publicSlot && mode!=='item')referenceLook.push(publicSlot);
    const referenceCache=new WeakMap();
    // R134/R133: appearance canvases can become ready in stages, and some
    // browsers populate their character sprites after CharacterLoadCanvas
    // returns. Never mark a blank crop as a successful thumbnail.
    function thumbHasPixels(canvas) {
      try {
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx || !ctx.getImageData)return true;
        const w=canvas.width,h=canvas.height;
        const data=ctx.getImageData(0,0,w,h).data;
        let pixels=0;
        for(let i=3;i<data.length;i+=32)if(data[i]>12&&++pixels>12)return true;
        return false;
      }catch(_){return true;} // Protected canvas: drawing itself is best effort.
    }
    // Item sprites may finish loading after a cloned canvas is cached.
    // Rebuilding the temporary clone (not Player.Appearance) refreshes each
    // thumbnail without requiring the user to click an item on every page.
    function invalidateThumbnailClone(cache,character) {
      try {cache.delete(character);referenceCache.delete(character);}catch(_){}
    }
    function addTilePreview(tile,asset) {
      if(!app.showThumbnails)return;
      if(!asset){append(tile,node('div','✕ Remove','pwr-preview-placeholder'));return;}
      const look=cloneJson(st.look),i=look.findIndex(item=>item.group===group.Name);
      if(i>=0)look.splice(i,1);
      look.push({group:group.Name,asset:asset.Name,color:current?.color||'Default',...(current?.asset===asset.Name&&current?.use?{use:current.use}:{})});
      const visual=node('div',undefined,'pwr-asset-visual pwr-focus-'+mode);
      const mini=node('canvas');mini.width=250;
      mini.height=mode==='body'?340:mode==='hair'?250:(mode==='upper-body'||mode==='lower-body')?240:198;
      mini.className='pwr-asset-preview';mini.title='Preview '+asset.Name;
      append(visual,mini);append(tile,visual);
      const hint=node('div','Loading preview…','pwr-preview-pending');
      append(visual,hint);
      const cache=new WeakMap();
      let drawn=false,tries=0,refreshes=0,stopped=false;
      const canContinue=()=>app.studio===st && mini.isConnected && !stopped;
      const schedule=(delay)=>{if(canContinue())setTimeout(draw,delay);};
      const paint=(src,box)=>{
        const ctx=mini.getContext?.('2d',{willReadFrequently:true});
        if(!ctx||!box||box.width<=0||box.height<=0)return false;
        const scale=Math.min(mini.width/box.width,mini.height/box.height);
        const w=box.width*scale,h=box.height*scale;
        ctx.clearRect(0,0,mini.width,mini.height);
        ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
        ctx.drawImage(src,box.x,box.y,box.width,box.height,(mini.width-w)/2,(mini.height-h)/2,w,h);
        return thumbHasPixels(mini);
      };
      const draw=()=>{
        if(!canContinue())return;
        let visible=false;
        try {
          const replica=getRenderClone(c,look,cache,draw,st.fit,st.braChest);
          const source=replica?.Canvas;
          if(source && thumbnailCanvasReady(source)) {
            // A failed/delayed reference should never prevent the candidate
            // itself from appearing. Use slot-based framing until both render.
            const same=current?.asset===asset.Name;
            const referenceNeeded=app.thumbnailFocus==='item'&&mode==='item'&&!same;
            const baseline=referenceNeeded?getRenderClone(c,referenceLook,referenceCache,draw,st.fit,st.braChest):null;
            const baseReady=!!baseline?.Canvas&&thumbnailCanvasReady(baseline.Canvas);
            const focused=app.thumbnailFocus==='full'?visibleStudioBounds(source)
              :thumbnailFocusBounds(source,baseReady?baseline.Canvas:null,group,mini.width/mini.height);
            visible=paint(source,focused);
            // Assets which extend beyond their slot or whose crop arrives
            // partially loaded are retried using the full visible silhouette.
            if(!visible)visible=paint(source,visibleStudioBounds(source));
            if(!visible)visible=paint(source,{x:0,y:0,width:source.width,height:source.height});
          }
        }catch(err){
          if(tries===0)console.debug('[Paw Private Wardrobe] Thumbnail retry:',group.Name,asset.Name,String(err));
        }
        if(visible){
          hint.remove();drawn=true;
          // One late refresh after the first nonblank drawing catches assets
          // that load additional sprite layers asynchronously.
          // Also rebuild after a partially drawn character succeeds: a
          // nonempty image alone does not prove all of its item art is ready.
          if(refreshes++<3){
            if(refreshes===1 || refreshes===3)invalidateThumbnailClone(cache,c);
            schedule(refreshes===1?650:refreshes===2?1600:2600);
          }
        }else if(tries++<22){
          if([3,7,12,17].includes(tries))invalidateThumbnailClone(cache,c);
          schedule(160+Math.min(tries*165,1150));
        }else if(!drawn){
          stopped=true;hint.textContent='Preview unavailable';
          hint.classList.add('pwr-preview-unavailable');
          hint.title='BC has not provided a drawable preview for this asset.';
        }
      };
      // Throttle candidate renders to reduce stalls when selecting a catalog
      // with many asset variants. Do not hide the labels while loading.
      const stagger=100*(thumbIndex++);
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(draw,stagger));
      else setTimeout(draw,stagger);
    }
    function renderAssetGrid() {
      const all=groupAssets(group).filter(a=>a?.Name);
      const filtered=all.filter(a=>`${a.Name} ${a.Description||''}`.toLowerCase().includes(app.editorSearch.toLowerCase()));
      const visible=app.favoritesOnly?filtered.filter(a=>isFavorite(group.Name,a.Name)):filtered;
      // Show the equipped style first (when included by search/favorites),
      // followed immediately by Remove, then the other catalog styles.
      // If there are no matching styles, keep Remove available as the only tile.
      const ordered=visible.slice();
      const equippedIndex=ordered.findIndex(a=>a.Name===current?.asset);
      if(equippedIndex>0)ordered.unshift(ordered.splice(equippedIndex,1)[0]);
      const canRemove=!!(group.AllowNone || group.Category==='Item');
      const assets=canRemove ? (ordered.length?[ordered[0],null,...ordered.slice(1)]:[null]) : ordered;
      const perPage=app.showThumbnails?6:12,total=Math.max(1,Math.ceil(assets.length/perPage));
      app.editorPage=Math.min(app.editorPage,total-1);
      grid.replaceChildren();grid.classList.toggle('pwr-with-previews',app.showThumbnails);
      for(const asset of assets.slice(app.editorPage*perPage,(app.editorPage+1)*perPage)) {
        const isChosen=asset?current?.asset===asset.Name:!current;
        const tile=button('',()=>modifyStudio(list=>{
          const i=list.findIndex(r=>r.group===group.Name);if(i>=0)list.splice(i,1);
          if(asset)list.push(withTune({group:group.Name,asset:asset.Name,color:current?.color||'Default',...(current?.asset===asset.Name&&current?.use?{use:current.use}:{})},current?.asset===asset.Name?normalizeTune(current?.tune):null));
          else if(group.Category==='Item')list.push({group:group.Name,asset:HIDE_ITEM,color:'Default'});
        }),'pwr-asset'+(isChosen?' pwr-active':'')+(app.showThumbnails?' pwr-has-preview':''));
        tile.title=asset?.Name||'Remove this item';
        if(!app.showThumbnails||!asset)append(tile,node('span',asset?'◇':'✕','pwr-asset-icon'));
        addTilePreview(tile,asset);
        const friendly=asset?.Description?displayName(asset.Description):'';
        const readable=asset ? (friendly || displayName(asset.Name)) : '(None / Remove)';
        const rawName=asset ? String(asset.Name) : 'Remove';
        const copy=node('div',undefined,'pwr-asset-copy');
        append(copy,node('span',readable,'pwr-asset-title'));
        if(asset) append(copy,node('span',rawName,'pwr-asset-sub'));
        else append(copy,node('span','Clear this slot','pwr-asset-sub'));
        append(tile,copy);
        const card=node('div',undefined,'pwr-asset-card');append(card,tile);
        if(asset) {
          const favorite=isFavorite(group.Name,asset.Name);
          const star=button(favorite?'★':'☆',()=>{toggleFavorite(group.Name,asset.Name);renderAssetGrid();},'pwr-star'+(favorite?' pwr-star-active':''));
          star.title=favorite?'Remove from favorites':'Add to favorites';
          star.setAttribute('aria-label',star.title+' '+asset.Name);
          append(card,star);
        }
        append(grid,card);
      }
      if(visible.length===0)append(grid,node('div',app.favoritesOnly?'No favorites in this slot. Turn off Favorites only or star an item.':'No matching assets. Try another search.','pwr-empty-results'));
      pager.replaceChildren();
      append(pager,button('◀',()=>{app.editorPage=Math.max(0,app.editorPage-1);renderAssetGrid();},'pwr-secondary'));
      pager.lastElementChild.disabled=app.editorPage===0;
      append(pager,node('span',`Page ${app.editorPage+1} / ${total} · ${assets.length} choices`));
      append(pager,button('▶',()=>{app.editorPage=Math.min(total-1,app.editorPage+1);renderAssetGrid();},'pwr-secondary'));
      pager.lastElementChild.disabled=app.editorPage>=total-1;
    }
    renderAssetGrid();
    // AEE-inspired whole-item controls. These apply only to detached private
    // clothing/accessory canvases, not body geometry or BC's native Items.
    const tuningSection=createFold('Fine-tune selected item','05','pwr-tuning-section','tuning').body;
    const tuneRecord=st.look.find(r=>r.group===group.Name && r.asset!==HIDE_ITEM);
    const tuneReady=adjustableRecord(c,tuneRecord);
    const tuneHead=node('div',undefined,'pwr-tune-head');
    append(tuneHead,node('strong',tuneRecord?displayName(tuneRecord.asset):'No item equipped'));
    if(tuneRecord)append(tuneHead,node('span',tuneReady?'Private visual layer':'Body / required slot','pwr-mini-tag'));
    append(tuningSection,tuneHead);
    if(!tuneReady){
      append(tuningSection,node('p','Choose optional clothing or an accessory. Required body parts and native gear are excluded from pixel transforms to avoid corrupting the character drawing.','pwr-help'));
    } else {
      append(tuningSection,node('p','Move, resize or fade just this item. Draw order is adjustable among modified items. This is an experimental private visual effect, not BC native layer editing.','pwr-help'));
      const dragOn=st.dragEnabled&&st.dragGroup===group.Name;
      append(tuningSection,button(dragOn?'✥ Stop dragging':'✥ Drag item on character preview',()=>{
        st.dragEnabled=!dragOn;st.dragGroup=group.Name;st.comparePublic=false;
        st.dragTempLook=null;st.dragTempClones=null;renderStudio();
      },'pwr-secondary pwr-drag-toggle'+(dragOn?' pwr-active':'')));
      append(tuningSection,node('p','Turn on Drag, then drag across the character preview to adjust X/Y. Release to apply. You can Undo the entire move.','pwr-help'));
      const settings=normalizeTune(tuneRecord.tune)||{...DEFAULT_TUNE};
      const grid=node('div',undefined,'pwr-tune-grid');
      const fields=[['opacity','Opacity','%'],['x','Horizontal offset',' px'],['y','Vertical offset',' px'],['angle','Rotation','°'],['scaleX','Width scale','%'],['scaleY','Height scale','%'],['priority','Overlay order','']];
      const setField=(field,value)=>{
        modifyStudio(list=>{const item=list.find(r=>r.group===group.Name);if(!item)return;
          item.tune={...DEFAULT_TUNE,...(normalizeTune(item.tune)||{}),[field]:value};
        });
      };
      for(const [field,title,units] of fields){
        const cell=node('div',undefined,'pwr-tune-ctrl');
        const lbl=node('div',undefined,'pwr-tune-label');
        append(lbl,node('span',title),node('span',settings[field]+units,'pwr-tune-val'));
        const slider=node('input');slider.type='range';slider.min=String(tuneLimits[field][0]);slider.max=String(tuneLimits[field][1]);
        slider.step=String(field==='x'||field==='y'?2:field==='angle'?5:field==='priority'?1:5);
        slider.value=String(settings[field]);slider.setAttribute('aria-label',title);
        slider.addEventListener('input',()=>lbl.lastChild.textContent=slider.value+units);
        slider.addEventListener('change',()=>setField(field,Number(slider.value)));
        append(cell,lbl,slider);append(grid,cell);
      }
      append(tuningSection,grid);
      const mirror=node('div',undefined,'pwr-tune-checks');
      for(const [field,title] of [['mirrorX','Mirror horizontally'],['mirrorY','Flip vertically']]){
        checkbox(mirror,title,settings[field],value=>setField(field,value));
      }
      append(tuningSection,mirror);
      const actions=node('div',undefined,'pwr-tune-actions');
      append(actions,button('Reset item adjustments',()=>modifyStudio(list=>{
        const item=list.find(r=>r.group===group.Name);if(item)delete item.tune;
      }),'pwr-secondary'));
      append(tuningSection,actions);
    }
    // BC's safe, visual-only extended item variant picker. It is NOT the
    // native Use screen; native actions are never called from this editor.
    const useSection=createFold('Use / Configure item','06','pwr-use-section','use').body;
    const useRecord=st.look.find(r=>r.group===group.Name && r.asset!==HIDE_ITEM);
    const useAsset=useRecord?assetByName(c,group,useRecord.asset):null;
    const variants=itemVisualOptions(useAsset);
    if(!useRecord) {
      append(useSection,node('p','Choose an item to see its visual configuration options.','pwr-help'));
    } else if(!variants.length) {
      append(useSection,node('p','This asset has no supported visual style choices exposed in the loaded BC catalog. Its native Use menu may contain actions or custom screens that are not safe to run inside a private preview.','pwr-help'));
    } else {
      append(useSection,node('div',displayName(useRecord.asset)+' · '+variants.length+' visual options','pwr-use-status'));
      append(useSection,node('p','These are appearance variants only. Selecting a mode does not activate devices, send actions, change restraints, or modify the public BC item.','pwr-help'));
      const options=node('div',undefined,'pwr-use-choices');
      for(const variant of variants) {
        const selected=useRecord.use?.type===variant.type;
        const choice=button(variant.name,()=>modifyStudio(list=>{
          const item=list.find(r=>r.group===group.Name&&r.asset===useRecord.asset);if(!item)return;
          item.use={type:variant.type,...(variant.typeRecord?{typeRecord:variant.typeRecord}:{})};
        }),'pwr-use-choice'+(selected?' pwr-active':''));
        choice.title='Private appearance mode: '+variant.type;
        append(options,choice);
      }
      append(useSection,options);
      append(useSection,button('Reset visual mode',()=>modifyStudio(list=>{
        const item=list.find(r=>r.group===group.Name&&r.asset===useRecord.asset);
        if(item)delete item.use;
      }),'pwr-secondary'));
    }
    // Saved private outfits: pair+subject-specific and local to this account.
    const savedSection=createFold('Saved private outfits','03','pwr-saved-section','outfits').body;
    const presets=savedOutfitsFor(st);
    append(savedSection,node('p','Saved locally, never in the public BC wardrobe. Loading makes a draft; Save & share sends it.','pwr-help'));
    const savePresetRow=node('div',undefined,'pwr-preset-row');
    const presetName=node('input');presetName.type='text';presetName.maxLength=60;presetName.placeholder='Outfit name (e.g. Moonlit Kitty)';
    const savePresetButton=button('＋ Save current draft',()=>saveOutfitPreset(presetName.value));
    append(savePresetRow,presetName,savePresetButton);append(savedSection,savePresetRow);
    append(savedSection,node('div',presets.length+' / '+MAX_SAVED_OUTFITS+' saved outfits for '+(c.Name||st.subject),'pwr-help'));
    for(const preset of presets.slice(0,MAX_SAVED_OUTFITS)){
      if(!preset||!Array.isArray(preset.look)||typeof preset.id!=='string')continue;
      const entry=node('div',undefined,'pwr-preset-entry');
      const nameInput=node('input');nameInput.type='text';nameInput.maxLength=60;nameInput.value=String(preset.name||'Untitled').slice(0,60);
      nameInput.title='Edit name, then click Rename';
      const actions=node('div',undefined,'pwr-preset-actions');
      append(actions,button('Load',()=>loadOutfitPreset(preset.id)),button('Rename',()=>renameOutfitPreset(preset.id,nameInput.value),'pwr-secondary'));
      append(entry,nameInput,actions,button('Delete',()=>deleteOutfitPreset(preset.id),'pwr-danger'));append(savedSection,entry);
    }
    const colorFold=createFold('Color atelier · Hex picker · stays on top','04','pwr-colors-section','colors');
    side.insertBefore(colorFold.section,tabs.nextSibling); // always accessible while scrolling
    const colors=colorFold.body;
    const colorClose=node('div',undefined,'pwr-picker-close-row');
    append(colorClose,node('span','Color picker','pwr-help'),button('✕ Close picker',()=>{colorFold.section.open=false;app.sections.colors=false;},'pwr-secondary'));
    append(colors,colorClose);
    const currentItem=st.look.find(r=>r.group===group.Name && r.asset !== HIDE_ITEM);
    const selectedAsset=currentItem?assetByName(c,group,currentItem.asset):null;
    const definitions=selectedAsset?colorLayerDefinitions(selectedAsset,group,currentItem?.color):[];
    const colorableCount=definitions.length;
    if(!currentItem||!colorableCount){append(colors,node('p',!currentItem?'Choose an item in this slot before changing its colors.':'BC does not mark this asset as colorable.','pwr-help'));}
    else {
      const layers=colorLayersForRecord(currentItem,colorableCount);
      const layerIndex=Math.max(0,Math.min(layers.length-1,app.activeColorLayer));
      app.activeColorLayer=layerIndex;
      const layerHeader=node('div',undefined,'pwr-layer-head');
      append(layerHeader,node('b','Item color layers ('+colorableCount+')'),node('span','Select a layer to edit it','pwr-help'));
      append(colors,layerHeader);
      const layerList=node('div',undefined,'pwr-layer-list');
      for(const entry of definitions){
        const i=entry.index, value=layers[i],isDefault=value==='Default';
        const selection=button('',()=>{
          app.activeColorLayer=i;
          // Save this layer choice in view state only; colors remain draft-only.
          app.sections.colors=true;renderStudio();
        },'pwr-layer-tile'+(layerIndex===i?' pwr-active':''));
        selection.title=entry.name||'Color layer '+(i+1);
        selection.setAttribute('aria-label','Edit '+entry.title+' color '+value);
        const chip=node('span',undefined,'pwr-layer-swatch');
        if(/^#[0-9a-f]{3,8}$/i.test(value))chip.style.background=value;
        const summary=node('span',undefined,'pwr-layer-info');
        append(summary,node('span',entry.title,'pwr-layer-title'),node('span',value==='Default'?'BC default color':value,'pwr-layer-detail'));
        append(selection,chip,summary);append(layerList,selection);
      }
      append(colors,layerList);
      append(colors,node('div','Editing: '+definitions[layerIndex].title,'pwr-layer-editing'));
      const hexBox=node('div',undefined,'pwr-hex-picker');append(colors,hexBox);
      const head=node('div',undefined,'pwr-hex-head');append(hexBox,head);
      const swatch=node('span',undefined,'pwr-hex-chip');
      const hex=node('input');hex.type='text';hex.placeholder='#RRGGBB';hex.inputMode='text';hex.maxLength=7;
      hex.style.maxWidth='145px';hex.style.width='145px';
      const selectedLayer=layers[layerIndex];
      const cleanHex=s=>{
        const t=String(s||'').trim();
        if(/^#[0-9a-f]{6}$/i.test(t))return t.toUpperCase();
        if(/^#[0-9a-f]{3}$/i.test(t))return '#'+[...t.slice(1)].map(x=>x+x).join('').toUpperCase();
        return null;
      };
      hex.value=cleanHex(selectedLayer)||'#D6A6EC';
      swatch.style.backgroundColor=hex.value;
      append(head,node('b','HEX  #RRGGBB'),swatch,hex);
      // HSV control produces CSS hex values, never browser-native RGB dialogs.
      const hsvFromHex=value=>{
        const h=cleanHex(value)||'#D6A6EC';const r=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,b=parseInt(h.slice(5,7),16)/255;
        const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
        let hue=0;if(d){switch(max){case r:hue=((g-b)/d)%6;break;case g:hue=(b-r)/d+2;break;default:hue=(r-g)/d+4;}hue=(hue*60+360)%360;}
        return {h:hue,s:max===0?0:d/max,v:max};
      };
      const hexFromHSV=(h,s,v)=>{
        const f=n=>{const k=(n+h/60)%6;return Math.round(255*v*(1-s*Math.max(0,Math.min(k,4-k,1))));};
        return '#'+[f(5),f(3),f(1)].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
      };
      let hsv=hsvFromHex(hex.value);
      // CSS HSV pad: avoid a real canvas because game/addon canvas rules can
      // displace it to the top of the screen and cover other studio controls.
      const plane=node('div');plane.className='pwr-sv-canvas';
      plane.setAttribute('role','slider');plane.setAttribute('tabindex','0');
      plane.setAttribute('aria-label','Saturation and brightness');
      plane.setAttribute('aria-valuemin','0');plane.setAttribute('aria-valuemax','100');
      const marker=node('span',undefined,'pwr-sv-marker');plane.appendChild(marker);
      const hue=node('input');hue.type='range';hue.className='pwr-hue';hue.min='0';hue.max='360';hue.value=String(Math.round(hsv.h));hue.setAttribute('aria-label','Hue');
      const drawPlane=()=>{
        const hueColor=hexFromHSV(hsv.h,1,1);
        // Black vertical overlay, white horizontal overlay, hue underneath.
        plane.style.backgroundImage='linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),linear-gradient(to right,'+hueColor+','+hueColor+')';
        marker.style.left=(hsv.s*100)+'%';
        marker.style.top=((1-hsv.v)*100)+'%';
        plane.setAttribute('aria-valuenow',String(Math.round(hsv.v*100)));
        plane.setAttribute('aria-valuetext','Saturation '+Math.round(hsv.s*100)+'%, brightness '+Math.round(hsv.v*100)+'%');
      };
      const syncHex=()=>{hex.value=hexFromHSV(hsv.h,hsv.s,hsv.v);swatch.style.backgroundColor=hex.value;drawPlane();};
      const pickAt=e=>{const rect=plane.getBoundingClientRect();if(!rect.width||!rect.height)return;
        hsv.s=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));hsv.v=1-Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));syncHex();};
      let dragging=false;
      plane.addEventListener('pointerdown',e=>{dragging=true;plane.setPointerCapture?.(e.pointerId);pickAt(e);e.preventDefault();});
      plane.addEventListener('pointermove',e=>{if(dragging)pickAt(e);});
      plane.addEventListener('pointerup',e=>{if(dragging)pickAt(e);dragging=false;});
      plane.addEventListener('pointercancel',()=>{dragging=false;});
      // Keyboard users can adjust the selected color without a pointer.
      plane.addEventListener('keydown',e=>{
        const step=e.shiftKey?0.10:0.02;
        if(e.key==='ArrowLeft')hsv.s=Math.max(0,hsv.s-step);
        else if(e.key==='ArrowRight')hsv.s=Math.min(1,hsv.s+step);
        else if(e.key==='ArrowUp')hsv.v=Math.min(1,hsv.v+step);
        else if(e.key==='ArrowDown')hsv.v=Math.max(0,hsv.v-step);
        else return;
        e.preventDefault();syncHex();
      });
      hue.addEventListener('input',()=>{hsv.h=Number(hue.value);syncHex();});
      hex.addEventListener('input',()=>{const val=cleanHex(hex.value);if(val){hsv=hsvFromHex(val);hue.value=String(Math.round(hsv.h));swatch.style.backgroundColor=val;drawPlane();}});
      append(hexBox,plane,hue);
      append(hexBox,node('div','PRESET COLORS · click to select','pwr-swatch-heading'));
      const palettes=node('div',undefined,'pwr-swatch-grid');
      const palette=['#FFFFFF','#000000','#E4B7FF','#D86ECA','#AB68D2','#6F3E91','#FF9CC4','#E06666','#F6AB50','#F2DF75','#7DC77C','#4BA8A8','#7FC3EE','#4E73CE','#956655','#B9B9B9','#FADCDD','#C99282','#805AAF','#4D375F'];
      for(const col of palette){const choice=button('',()=>{hsv=hsvFromHex(col);hue.value=String(Math.round(hsv.h));syncHex();});choice.style.setProperty('--pwr-swatch',col);choice.title=col;choice.setAttribute('aria-label','Choose '+col);append(palettes,choice);}
      append(hexBox,palettes);
      const apply=()=>{
        const valid=cleanHex(hex.value);
        if(!valid){hex.style.borderColor='#f37e8f';setStatus('Enter a valid hex color such as #D6A6EC.');return;}
        modifyStudio(list=>{
          const item=list.find(r=>r.group===group.Name && r.asset===currentItem.asset);
          if(!item)return;
          recolorSingleLayer(item,colorableCount,layerIndex,valid);
        });
      };
      const reset=()=>modifyStudio(list=>{
        const item=list.find(r=>r.group===group.Name && r.asset===currentItem.asset);
        if(item)recolorSingleLayer(item,colorableCount,layerIndex,'Default');
      });
      const actionRow=node('div',undefined,'pwr-color-buttons');
      append(actionRow,button('Apply to '+definitions[layerIndex].title,apply),
        button('Reset this layer',reset,'pwr-secondary'));
      if(colorableCount>1){
        append(actionRow,button('Apply hex to all layers',()=>{
          const valid=cleanHex(hex.value);
          if(!valid){setStatus('Enter a valid hex color, e.g. #D6A6EC.');return;}
          modifyStudio(list=>{
            const item=list.find(r=>r.group===group.Name && r.asset===currentItem.asset);
            if(item)item.color=Array(colorableCount).fill(valid);
          });
        },'pwr-secondary'),button('Reset all layers',()=>modifyStudio(list=>{
          const item=list.find(r=>r.group===group.Name && r.asset===currentItem.asset);
          if(item)item.color=Array(colorableCount).fill('Default');
        }),'pwr-secondary'));
      }
      append(hexBox,actionRow,node('p','Each swatch edits its own BC ColorIndex. Colors are kept in the private draft, saved with outfit presets, and shared only after Save & share. Some sprite layers intentionally share the same color index.','pwr-help'));
      drawPlane();
    }
    const bottom=node('div',undefined,'pwr-bottom');shell.appendChild(bottom);
    const quick=node('div',undefined,'pwr-row');
    append(quick,button('Remove all clothing',()=>modifyStudio((list,character)=>{
      const remove=new Set(assetGroups(character).filter(g=>isClothes(g)&&g.AllowNone).map(g=>g.Name));
      for(let i=list.length-1;i>=0;i--)if(remove.has(list[i].group))list.splice(i,1);
    })),button('Copy public look',()=>modifyStudio((list,character)=>list.splice(0,list.length,...snapshot(character))),'pwr-secondary'),
    button('Reset private look',clearPrivateLook,'pwr-danger'));
    const bottomTop=node('div',undefined,'pwr-bottom-top');append(bottomTop,node('span','QUICK ACTIONS','pwr-label-upper'));append(bottomTop,quick);append(bottom,bottomTop);
    append(bottom,node('div','Save & share commits a visual-only look. Catalog access ignores gender/purchases, but missing gender-specific sprite art may not render. Public clothes, restraints, inventory, permissions, and interactions are never changed.','pwr-help'));
    drawStudioCanvas();
    // Asset images can become ready after CharacterLoadCanvas returns. Retry
    // against the *same* draft so the first click always schedules its preview.
    const ticket=++app.studioDrawTicket;
    const previewCanvas=canvas;
    for(const delay of [20,90,220,500,1100])setTimeout(()=>{
      if(app.studio===st && app.studioDrawTicket===ticket &&
         app.studioPanel?.querySelector('.pwr-character-canvas')===previewCanvas)drawStudioCanvas();
    },delay);
    if(typeof ResizeObserver==='function'){
      const observer=new ResizeObserver(()=>{
        if(app.studio===st && app.studioPanel?.querySelector('.pwr-scene')===scene)drawStudioCanvas();
      });
      observer.observe(scene);app.studioResizeObserver=observer;
    }
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
    loadSettings();
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
    if(app.ready)return;
    if(!me())return;
    loadSettings();
    if(!addHooks()) {app.status='Requires BC ModSDK / bcModSdk to be loaded first.';return;}
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
    if(typeof ResizeObserver!=='function' && typeof window!=='undefined')window.addEventListener('resize',()=>{if(app.studio)drawStudioCanvas();});
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
  const timer=setInterval(()=>{if(!app.ready)init();else heartbeat();},4000);
  init();
})();
