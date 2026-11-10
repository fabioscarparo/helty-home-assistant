/*
 * Helty Flow40 card for Home Assistant
 * https://github.com/fabioscarparo/helty-home-assistant
 *
 * A Lovelace card that recalls the wall panel of the Helty Flow40, built
 * with the patterns of the core cards: power, ventilation with its four
 * speeds, Night, Hyper, Free cooling, the filter and the two temperatures. It works with the
 * ESPHome configuration of the same repository (1.0.0 or later), and finds
 * the entities of the device by type, device class and icon, so it keeps
 * working in any language and after a rename.
 *
 * MIT License - Copyright (c) 2026 Fabio Scarparo
 */

const VERSION = "1.0.0";
const CARD_TYPE = "helty-flow40-card";
const EDITOR_TYPE = "helty-flow40-card-editor";
const MODEL = "helty-flow40"; // from `project: name: fabioscarparo.helty-flow40`
const DEFAULT_COLOR = "light-blue";
const NO_VALUE = new Set(["unavailable", "unknown", ""]);
const PENDING_MS = 12000; // how long a command is shown before the unit confirms it
const CYCLE_MS = 600; // repeated taps on the ventilation key are sent as one command

// Entities of the device, recognized by domain, device class and the icon
// set in helty-flow40.yaml. `entities:` in the card config overrides any of them.
const ROLES = {
  fan: { domain: "fan" },
  hyper: { domain: "switch", icon: "mdi:fan-chevron-up" },
  night: { domain: "switch", icon: "mdi:weather-night" },
  free_cooling: { domain: "switch", icon: "mdi:snowflake" },
  filter: { domain: "binary_sensor", icon: "mdi:air-filter" },
  frost: { domain: "binary_sensor", icon: "mdi:snowflake-alert" },
  modbus: { domain: "binary_sensor", deviceClass: "connectivity" },
  indoor: { domain: "sensor", deviceClass: "temperature", icon: "mdi:home-thermometer" },
  outdoor: { domain: "sensor", deviceClass: "temperature", icon: "mdi:sun-thermometer" },
};
const PRESETS = ["night", "hyper", "free_cooling"];

// ---------------------------------------------------------------------------
// Strings: Italian, English for any other language
// ---------------------------------------------------------------------------

const STRINGS = {
  en: {
    name: "Helty Flow40",
    description: "Controls and temperatures of the Helty Flow40, laid out like its wall panel.",
    off: "Off",
    on: "On",
    speed: "Speed {n}",
    unavailable: "Not responding",
    power: "Turn on or off",
    ventilation: "Ventilation: next speed, off after 4",
    ventilation_name: "Ventilation",
    night: "Night",
    hyper: "Hyper",
    free_cooling: "Free cooling",
    filter: "Filter",
    indoor: "Indoor temperature",
    outdoor: "Outdoor temperature",
    indoor_short: "Indoor",
    outdoor_short: "Outdoor",
    offline_title: "The unit isn't answering",
    offline: "No reply over Modbus: check the power and the wiring of the module.",
    filter_title: "Clean the filter",
    filter_text:
      "Clean or replace the filter, then reset the alarm on the unit's panel: hold ventilation and hyper together for 5 seconds, until all the LEDs blink twice.",
    frost_title: "Frost alarm",
    frost_text: "The unit is protecting itself from frost.",
    fault_title: "Fault",
    no_device: "Choose your Helty Flow40 in the card settings.",
    no_fan:
      "This device has no Helty Flow40 fan. The card needs the ESPHome configuration 1.0.0 or later from the helty-home-assistant repository.",
    editor: { device_id: "Device", name: "Name", color: "Color" },
  },
  it: {
    name: "Helty Flow40",
    description: "Comandi e temperature della Helty Flow40, disposti come sul suo pannello a parete.",
    off: "Spenta",
    on: "Accesa",
    speed: "Velocità {n}",
    unavailable: "Non risponde",
    power: "Accendi o spegni",
    ventilation: "Ventilazione: velocità successiva, spenta dopo la 4",
    ventilation_name: "Ventilazione",
    night: "Notte",
    hyper: "Hyper",
    free_cooling: "Free cooling",
    filter: "Filtro",
    indoor: "Temperatura ambiente",
    outdoor: "Temperatura esterna",
    indoor_short: "Ambiente",
    outdoor_short: "Esterna",
    offline_title: "La VMC non risponde",
    offline: "Nessuna risposta via Modbus: controlla l'alimentazione e i cavi del modulo.",
    filter_title: "Pulisci il filtro",
    filter_text:
      "Pulisci o sostituisci il filtro, poi azzera l'allarme dal pannello della VMC: tieni premuti insieme ventilazione e iperventilazione per 5 secondi, finché tutti i LED lampeggiano due volte.",
    frost_title: "Allarme ghiaccio",
    frost_text: "La VMC si sta proteggendo dal ghiaccio.",
    fault_title: "Guasto",
    no_device: "Scegli la tua Helty Flow40 nelle impostazioni della scheda.",
    no_fan:
      "Su questo dispositivo non c'è la ventola della Helty Flow40. La scheda richiede la configurazione ESPHome 1.0.0 o successiva del repository helty-home-assistant.",
    editor: { device_id: "Dispositivo", name: "Nome", color: "Colore" },
  },
};

const langOf = (hass) => {
  const lang = String(hass?.locale?.language || hass?.language || navigator.language || "en").toLowerCase();
  return lang.startsWith("it") ? "it" : "en";
};

function translate(hass, key, vars) {
  const lang = langOf(hass);
  const text = key.split(".").reduce((obj, part) => obj?.[part], STRINGS[lang]) ?? key.split(".").reduce((obj, part) => obj?.[part], STRINGS.en) ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "") : text;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HA_COLORS = new Set(["primary", "accent", "red", "pink", "purple", "deep-purple", "indigo", "blue", "light-blue",
  "cyan", "teal", "green", "light-green", "lime", "yellow", "amber", "orange", "deep-orange", "brown", "light-grey",
  "grey", "dark-grey", "blue-grey", "black", "white", "disabled"]);
const colorVar = (color) => (HA_COLORS.has(color) ? `var(--${color}-color)` : color);

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fire = (node, type, detail) =>
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));

function deviceName(hass, deviceId) {
  const device = hass.devices?.[deviceId];
  return device?.name_by_user || device?.name || "";
}

// The entities of the device, by role. Overrides from the config win.
function resolveEntities(hass, deviceId, overrides) {
  const found = {};
  const temperatures = [];
  const problems = [];
  for (const entry of Object.values(hass.entities || {})) {
    if (entry.device_id !== deviceId) continue;
    const id = entry.entity_id;
    const domain = id.split(".")[0];
    const attributes = hass.states[id]?.attributes || {};
    if (attributes.restored) continue; // left behind by an older configuration
    for (const [role, rule] of Object.entries(ROLES)) {
      if (found[role] || rule.domain !== domain) continue;
      if (rule.icon && rule.icon !== attributes.icon) continue;
      if (rule.deviceClass && rule.deviceClass !== attributes.device_class) continue;
      found[role] = id;
      break;
    }
    if (domain === "sensor" && attributes.device_class === "temperature") temperatures.push(id);
    if (domain === "binary_sensor" && attributes.device_class === "problem") problems.push(id);
  }
  // Configurations older than 1.0.0 have no icons on the temperatures: they are
  // registered in the order of the YAML, indoor first.
  const spare = temperatures.filter((id) => id !== found.indoor && id !== found.outdoor);
  if (!found.indoor && spare.length) found.indoor = spare.shift();
  if (!found.outdoor && spare.length) found.outdoor = spare.shift();
  for (const [role, id] of Object.entries(overrides || {})) {
    if (ROLES[role] && typeof id === "string" && id.startsWith(`${ROLES[role].domain}.`)) found[role] = id;
  }
  found.problems = problems.filter((id) => id !== found.filter && id !== found.frost);
  return found;
}

function speedOf(fanState) {
  const percentage = Number(fanState?.attributes?.percentage);
  const step = Number(fanState?.attributes?.percentage_step) || 25;
  if (!Number.isFinite(percentage) || percentage <= 0) return 0;
  return Math.min(4, Math.max(1, Math.round(percentage / step)));
}

// What the panel shows: unavailable, off, on (waiting), speed1-4, night, hyper,
// free_cooling, or preset (a preset without its switch).
function modeOf(hass, ents) {
  const fan = hass.states[ents.fan];
  if (!fan || NO_VALUE.has(fan.state)) return "unavailable";
  if (ents.modbus && hass.states[ents.modbus]?.state === "off") return "unavailable";
  if (fan.state !== "on") return "off";
  for (const preset of PRESETS) {
    if (ents[preset] && hass.states[ents[preset]]?.state === "on") return preset;
  }
  if (fan.attributes?.preset_mode) return "preset";
  return `speed${speedOf(fan) || 1}`;
}

// ---------------------------------------------------------------------------
// Symbols: line drawings that recall the ones printed on the wall panel
// ---------------------------------------------------------------------------

const svg = (body, extra = "") =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"${extra}>${body}</svg>`;
const rotate = (body, count) =>
  Array.from({ length: count }, (_, i) => `<g transform="rotate(${(360 / count) * i} 12 12)">${body}</g>`).join("");

const SYMBOLS = {
  ventilation: svg(
    rotate('<path d="M12.6 10.3c-.3-2.7.6-5.1 2.6-5.4 2-.3 2.6 2.5.1 6"/>', 4) + '<circle cx="12" cy="12" r="1.7"/>',
  ),
  night: svg(
    '<path d="M12.6 4.6a6.2 6.2 0 0 0 6.8 6.8 7.6 7.6 0 1 1-6.8-6.8Z"/><path d="M17.4 3.4v2.8M16 4.8h2.8"/><path d="M20.4 7.6v1.8M19.5 8.5h1.8"/>',
  ),
  hyper: svg(rotate('<path d="M12 9.6c.5-2.2 1.9-4 3.9-5"/>', 8) + '<circle cx="12" cy="12" r="2.4"/>'),
  free_cooling: svg(
    [8, 12, 16].map((y) => `<path d="M3.5 ${y}c1.4-1.3 2.8-1.3 4.25 0s2.85 1.3 4.25 0 2.85-1.3 4.25 0 2.8 1.3 4.25 0"/>`).join(""),
  ),
  filter: svg('<path d="M4.5 5.5h15l-5.6 6.6v5.6l-3.8 1.9v-7.5Z"/>'),
};

// ---------------------------------------------------------------------------
// Styles: Home Assistant tokens only, raw values only as fallbacks
// ---------------------------------------------------------------------------

const STYLES = `
:host {
  display: block;
  --accent: var(--light-blue-color, #03a9f4);
  --tile-color: var(--state-inactive-color, #9e9e9e);
  --radius: var(--ha-card-features-border-radius, var(--ha-border-radius-lg, 12px));
}
ha-card { height: 100%; overflow: hidden; }
.card {
  display: flex; flex-direction: column; gap: var(--ha-space-3, 12px);
  padding: var(--ha-space-3, 12px) var(--ha-space-4, 16px) var(--ha-space-4, 16px);
  container-type: inline-size;
  font-family: var(--ha-font-family-body, Roboto, Noto, sans-serif);
  color: var(--primary-text-color);
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; color: inherit; background: none; border: none; margin: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:disabled { cursor: not-allowed; }
svg { display: block; }
[hidden] { display: none !important; }

/* Header, like the tile card: the icon turns the unit on and off */
.tile { display: flex; align-items: center; gap: 10px; min-height: 40px; }
.tile-icon {
  position: relative; flex: none; width: 36px; height: 36px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--ha-tile-icon-border-radius, var(--ha-border-radius-pill, 9999px));
  color: var(--tile-color); --mdc-icon-size: 24px; outline: none;
}
.tile-icon::before { content: ""; position: absolute; inset: 0; background: var(--tile-color); opacity: 0.2; transition: opacity 180ms ease-in-out; }
.tile-icon:hover:not(:disabled)::before { opacity: 0.35; }
.tile-icon > * { position: relative; }
.tile-icon:focus-visible { box-shadow: 0 0 0 2px var(--tile-color); }
.tile-info { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: start; border-radius: var(--ha-border-radius-sm, 4px); outline: none; }
.tile-info:focus-visible { box-shadow: 0 0 0 2px var(--tile-color); }
.primary, .secondary { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.primary { font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500); line-height: 20px; letter-spacing: 0.1px; color: var(--primary-text-color); }
.secondary { font-size: var(--ha-font-size-s, 12px); line-height: 16px; letter-spacing: 0.4px; color: var(--secondary-text-color); }

/* The panel: two columns that recall the wall panel of the unit */
.panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ha-space-2, 8px); }
.panel.disabled > * { opacity: 0.38; }

/* Temperatures in the place of the panel's sensor: small tiles with the icon
   in a tinted circle, like the tile card, the label and the value */
.reading {
  position: relative; overflow: hidden; min-width: 0; height: 48px; box-sizing: border-box;
  display: flex; align-items: center; gap: var(--ha-space-2, 8px); padding: 0 var(--ha-space-3, 12px) 0 6px;
  border-radius: var(--radius); text-align: start; outline: none;
}
.reading::before { content: ""; position: absolute; inset: 0; background: var(--disabled-color, #bdbdbd); opacity: 0.2; transition: opacity 180ms ease-in-out; pointer-events: none; }
.reading:hover:not(:disabled)::before { opacity: 0.3; }
.reading > * { position: relative; }
.reading .symbol { position: relative; overflow: hidden; color: var(--state-icon-color, #44739e); --mdc-icon-size: 22px; }
.reading .symbol::before { content: ""; position: absolute; inset: 0; background: currentColor; opacity: 0.2; }
.reading .symbol ha-icon { position: relative; }
.reading .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.reading .label { font-size: var(--ha-font-size-s, 12px); line-height: 16px; letter-spacing: 0.4px; color: var(--secondary-text-color); }
.reading .value { font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500); line-height: 20px; letter-spacing: 0.1px; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
.reading .label, .reading .value { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reading:focus-visible { box-shadow: 0 0 0 2px var(--accent); }

/* Controls, like card features: neutral fill, tinted with the running mode */
.control {
  position: relative; overflow: hidden; min-width: 0; height: 48px; box-sizing: border-box;
  display: flex; align-items: center; gap: var(--ha-space-2, 8px); padding: 0 var(--ha-space-3, 12px) 0 6px;
  border-radius: var(--radius); color: var(--primary-text-color); text-align: start; outline: none;
}
.control::before { content: ""; position: absolute; inset: 0; background: var(--disabled-color, #bdbdbd); opacity: 0.2; transition: opacity 180ms ease-in-out, background-color 180ms ease-in-out; pointer-events: none; }
.control:hover:not(:disabled)::before { opacity: 0.3; }
.control > * { position: relative; }
.symbol {
  flex: none; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--ha-tile-icon-border-radius, var(--ha-border-radius-pill, 9999px));
  transition: background-color 180ms ease-in-out, color 180ms ease-in-out;
}
.symbol svg { width: 24px; height: 24px; }
.name { flex: 1; min-width: 0; font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500); line-height: 20px; letter-spacing: 0.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.control.active::before { background: var(--accent); opacity: 0.2; }
.control.active:hover:not(:disabled)::before { opacity: 0.3; }
.control.active .symbol { background: var(--accent); color: var(--text-primary-color, #fff); }
.control.alarm::before { background: var(--warning-color, #ffa600); opacity: 0.2; }
.control.alarm .symbol { background: var(--warning-color, #ffa600); color: var(--text-primary-color, #fff); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.55; } }
.control:focus-visible { box-shadow: 0 0 0 2px var(--accent); }

/* Speeds 1-4, like the segmented control; they fill up like the LEDs of the panel */
.speeds { position: relative; min-width: 0; height: 48px; box-sizing: border-box; display: flex; gap: 4px; padding: 4px; border-radius: var(--radius); }
.speeds::before { content: ""; position: absolute; inset: 0; border-radius: inherit; background: var(--disabled-color, #bdbdbd); opacity: 0.2; pointer-events: none; }
.speed {
  position: relative; flex: 1; min-width: 0; border-radius: calc(var(--radius) - 4px);
  font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500); color: var(--primary-text-color); outline: none;
}
.speed::before { content: ""; position: absolute; inset: 0; border-radius: inherit; background: var(--accent); opacity: 0; transition: opacity 80ms ease-in-out; }
.speed:hover:not(:disabled)::before { opacity: 0.2; }
.speed.on { color: var(--text-primary-color, #fff); }
.speed.on::before { opacity: 1; }
.speed.on.dim { color: var(--accent); }
.speed.on.dim::before { opacity: 0.3; }
.speed span { position: relative; }
.speed:focus-visible { box-shadow: 0 0 0 2px var(--accent); }

/* Long names end with an ellipsis, with the whole text in the tooltip. Medium
   cards get smaller symbols to keep the names readable; narrow cards show the
   symbols and the values only. */
@container (max-width: 360px) {
  .control, .reading { gap: 6px; padding-inline: 5px var(--ha-space-2, 8px); }
  .symbol { width: 30px; height: 30px; }
  .control .symbol svg { width: 20px; height: 20px; }
  .reading .symbol { --mdc-icon-size: 20px; }
}
@container (max-width: 250px) {
  .name, .reading .label { display: none; }
  .control { justify-content: center; padding: 0; }
}

/* Alerts, like ha-alert */
.alerts { display: flex; flex-direction: column; gap: var(--ha-space-2, 8px); }
.alerts:empty { display: none; }
.alert { position: relative; display: flex; padding: 12px; border-radius: var(--ha-border-radius-lg, 12px); overflow: hidden; }
.alert::before { content: ""; position: absolute; inset: 0; background: var(--alert-color); opacity: 0.12; }
.alert ha-icon { position: relative; flex: none; color: var(--alert-color); }
.alert .text { position: relative; margin-inline: 8px; line-height: normal; font-size: var(--ha-font-size-m, 14px); color: var(--primary-text-color); }
.alert .title { margin-top: 2px; font-weight: var(--ha-font-weight-bold, 700); }
.alert.warning { --alert-color: var(--warning-color, #ffa600); }
.alert.error { --alert-color: var(--error-color, #db4437); }
.alert.info { --alert-color: var(--info-color, #039be5); }
.message { font-size: var(--ha-font-size-m, 14px); color: var(--secondary-text-color); }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 1ms !important; transition-duration: 1ms !important; }
  .control.alarm .symbol { animation: none; }
}
`;

const control = (attrs, symbol) =>
  `<button class="control" ${attrs}><span class="symbol">${symbol}</span><span class="name"></span></button>`;
const reading = (role, icon) =>
  `<button class="reading" data-action="more-info" data-role="${role}"><span class="symbol"><ha-icon icon="${icon}"></ha-icon></span><span class="text"><span class="label"></span><span class="value"></span></span></button>`;

// Same places as on the wall panel: the sensor at the top, ventilation with its
// four speeds, Night and Hyper on the left, Free cooling and the filter on the right
const MARKUP = `
<div class="header tile" hidden>
  <button class="tile-icon" data-action="power"><ha-icon icon="mdi:fan"></ha-icon></button>
  <button class="tile-info" data-action="more-info" data-role="fan"><span class="primary"></span><span class="secondary"></span></button>
</div>
<div class="panel" hidden>
  ${reading("indoor", "mdi:home-thermometer")}
  ${reading("outdoor", "mdi:sun-thermometer")}
  ${control('data-action="ventilation"', SYMBOLS.ventilation)}
  <div class="speeds" role="group">${[1, 2, 3, 4].map((n) => `<button class="speed" data-action="speed" data-speed="${n}"><span>${n}</span></button>`).join("")}</div>
  ${control('data-action="preset" data-preset="night"', SYMBOLS.night)}
  ${control('data-action="preset" data-preset="free_cooling"', SYMBOLS.free_cooling)}
  ${control('data-action="preset" data-preset="hyper"', SYMBOLS.hyper)}
  ${control('data-action="more-info" data-role="filter"', SYMBOLS.filter)}
</div>
<div class="alerts" role="status"></div>
<div class="message" hidden></div>
`;

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

class HeltyFlow40Card extends HTMLElement {
  constructor() {
    super();
    this._pending = null; // { mode, until }
    this._renders = 0;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLES}</style><ha-card><div class="card">${MARKUP}</div></ha-card>`;
    this._header = root.querySelector(".header");
    this._panel = root.querySelector(".panel");
    this._alerts = root.querySelector(".alerts");
    this._message = root.querySelector(".message");
    this._lastAlerts = "";
    root.addEventListener("click", (ev) => this._onClick(ev));
  }

  // --- Lovelace card API ---------------------------------------------------

  static getConfigElement() {
    return document.createElement(EDITOR_TYPE);
  }

  static getStubConfig(hass) {
    return { device_id: findDevice(hass) ?? "" };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = { ...config };
    this._entsKey = null;
    this.style.setProperty("--accent", colorVar(this._config.color || DEFAULT_COLOR));
    this._update();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!old || this._changed(old, hass)) this._update();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 6 };
  }

  // --- Rendering -------------------------------------------------------------

  _changed(old, hass) {
    if (old.entities !== hass.entities || old.devices !== hass.devices || old.locale !== hass.locale || old.language !== hass.language || old.themes !== hass.themes) return true;
    const ents = this._ents || {};
    const watched = [...Object.keys(ROLES).map((role) => ents[role]), ...(ents.problems || [])];
    return watched.some((id) => id && old.states[id] !== hass.states[id]);
  }

  _resolve() {
    const hass = this._hass;
    const key = [hass.entities, this._config.device_id, JSON.stringify(this._config.entities || {})];
    const states = hass.states;
    // Icons and device classes live in the states: resolve again until every role is found
    if (this._entsKey && this._entsKey.every((v, i) => v === key[i]) && (this._entsComplete || this._entsStates === states)) return;
    this._ents = resolveEntities(hass, this._config.device_id, this._config.entities);
    this._entsKey = key;
    this._entsStates = states;
    this._entsComplete = Object.keys(ROLES).every((role) => this._ents[role]);
  }

  _t(key, vars) {
    return translate(this._hass, key, vars);
  }

  _update() {
    const hass = this._hass;
    const config = this._config;
    if (!hass || !config) return;
    this._renders += 1;

    if (!config.device_id) return this._showMessage(this._t("no_device"));
    this._resolve();
    const ents = this._ents;
    if (!ents.fan) return this._showMessage(this._t("no_fan"));
    this._message.hidden = true;
    this._header.hidden = false;
    this._panel.hidden = false;

    const actual = modeOf(hass, ents);
    this._actual = actual;
    if (this._pending && (Date.now() > this._pending.until || actual === "unavailable" || this._pending.done(actual))) {
      this._pending = null;
    }
    const mode = this._pending?.mode ?? actual;
    const offline = actual === "unavailable";
    const isOn = !offline && mode !== "off";
    const root = this.shadowRoot;

    // Header
    const fanState = hass.states[ents.fan];
    const name = config.name || deviceName(hass, config.device_id) || this._t("name");
    root.querySelector(".primary").textContent = name;
    root.querySelector(".secondary").textContent = this._modeLabel(mode);
    root.querySelector(".tile-info").setAttribute("aria-label", `${name}: ${this._modeLabel(mode)}`);
    this.style.setProperty("--tile-color", isOn ? "var(--accent)" : "var(--state-inactive-color, #9e9e9e)");
    const power = root.querySelector(".tile-icon");
    power.setAttribute("aria-pressed", String(isOn));
    power.setAttribute("aria-label", this._t("power"));
    power.title = this._t("power");
    power.disabled = offline;

    // Temperatures
    for (const role of ["indoor", "outdoor"]) {
      const el = this._panel.querySelector(`.reading[data-role="${role}"]`);
      const stateObj = ents[role] && hass.states[ents[role]];
      el.disabled = !stateObj;
      const value = !stateObj || NO_VALUE.has(stateObj.state) ? "-" : this._format(stateObj);
      el.querySelector(".label").textContent = this._t(`${role}_short`);
      el.querySelector(".value").textContent = value;
      el.setAttribute("aria-label", `${this._t(role)}: ${value}`);
      el.title = this._t(role);
    }

    // Controls
    this._panel.classList.toggle("disabled", offline);
    const setControl = (selector, active, label, title, missing = false) => {
      const el = this._panel.querySelector(selector);
      el.classList.toggle("active", active);
      el.setAttribute("aria-pressed", String(active));
      el.querySelector(".name").textContent = label;
      el.setAttribute("aria-label", title);
      el.title = title;
      el.disabled = offline || missing;
    };
    setControl('[data-action="ventilation"]', mode.startsWith("speed"), this._t("ventilation_name"), this._t("ventilation"));
    for (const preset of PRESETS) {
      setControl(`[data-preset="${preset}"]`, mode === preset, this._t(preset), this._t(preset), !ents[preset]);
    }

    // The speeds fill up like the LEDs of the panel: speed 3 fills 1, 2 and 3.
    // Night tints the first one, Hyper fills all four, Free cooling keeps the
    // speed the fan had.
    const bar = mode.startsWith("speed") ? Number(mode.slice(5))
      : mode === "hyper" ? 4
      : mode === "night" ? 1
      : mode === "free_cooling" || mode === "preset" ? speedOf(fanState) || 1
      : 0;
    for (const n of [1, 2, 3, 4]) {
      const el = this._panel.querySelector(`[data-speed="${n}"]`);
      el.classList.toggle("on", n <= bar);
      el.classList.toggle("dim", mode === "night" && n <= bar);
      el.setAttribute("aria-pressed", String(mode === `speed${n}`));
      el.setAttribute("aria-label", this._t("speed", { n }));
      el.title = this._t("speed", { n });
      el.disabled = offline;
    }

    // Filter: amber while it needs cleaning
    const filterOn = !offline && hass.states[ents.filter]?.state === "on";
    const filter = this._panel.querySelector('[data-role="filter"]');
    filter.classList.toggle("alarm", filterOn);
    filter.querySelector(".name").textContent = this._t("filter");
    filter.setAttribute("aria-label", filterOn ? this._t("filter_title") : this._t("filter"));
    filter.title = filter.getAttribute("aria-label");
    filter.disabled = !ents.filter;

    // Alerts
    const alerts = [];
    if (offline) alerts.push(["error", "mdi:lan-disconnect", this._t("offline_title"), this._t("offline")]);
    if (filterOn) alerts.push(["warning", "mdi:air-filter", this._t("filter_title"), this._t("filter_text")]);
    if (!offline && hass.states[ents.frost]?.state === "on") alerts.push(["warning", "mdi:snowflake-alert", this._t("frost_title"), this._t("frost_text")]);
    if (!offline) {
      const prefix = `${deviceName(hass, config.device_id)} `;
      const faults = ents.problems
        .filter((id) => hass.states[id]?.state === "on")
        .map((id) => {
          const name = hass.states[id].attributes.friendly_name || id;
          return prefix.trim() && name.startsWith(prefix) ? name.slice(prefix.length) : name;
        });
      if (faults.length) alerts.push(["error", "mdi:alert-circle-outline", this._t("fault_title"), faults.join(", ")]);
    }
    const html = alerts
      .map(([type, icon, title, text]) => `<div class="alert ${type}"><ha-icon icon="${icon}"></ha-icon><div class="text"><div class="title">${escapeHtml(title)}</div>${escapeHtml(text)}</div></div>`)
      .join("");
    if (html !== this._lastAlerts) {
      this._alerts.innerHTML = html;
      this._lastAlerts = html;
    }
  }

  _showMessage(text) {
    this._header.hidden = true;
    this._panel.hidden = true;
    this._alerts.innerHTML = "";
    this._lastAlerts = "";
    this._message.hidden = false;
    this._message.textContent = text;
  }

  _modeLabel(mode) {
    if (mode.startsWith("speed")) return this._t("speed", { n: mode.slice(5) });
    if (mode === "preset") return this._hass.states[this._ents.fan]?.attributes?.preset_mode || this._t("on");
    return this._t(mode);
  }

  _format(stateObj) {
    try {
      if (typeof this._hass.formatEntityState === "function") return this._hass.formatEntityState(stateObj);
    } catch (err) {
      // fall through to the raw value
    }
    const unit = stateObj.attributes?.unit_of_measurement;
    return unit ? `${stateObj.state} ${unit}` : stateObj.state;
  }

  // --- Actions ---------------------------------------------------------------

  _onClick(ev) {
    const el = ev.target.closest?.("[data-action]");
    if (!el || el.disabled || !this._ents) return;
    const action = el.dataset.action;
    if (action === "more-info") {
      const entityId = this._ents[el.dataset.role];
      if (entityId) fire(this, "hass-more-info", { entityId });
      return;
    }
    if (this._actual === "unavailable") return;
    const mode = this._pending?.mode ?? this._actual;
    const fan = this._ents.fan;
    if (action === "power") {
      if (mode === "off") this._command("on", "fan", "turn_on", { entity_id: fan }, (a) => a !== "off");
      else this._command("off", "fan", "turn_off", { entity_id: fan });
    } else if (action === "speed") {
      this._setSpeed(Number(el.dataset.speed));
    } else if (action === "ventilation") {
      this._cycleSpeed(mode);
    } else if (action === "preset") {
      const preset = el.dataset.preset;
      const entityId = this._ents[preset];
      if (!entityId) return;
      if (mode === preset) {
        // the switch goes back to the last speed used, which the fan keeps during a preset
        const speed = speedOf(this._hass.states[fan]) || 1;
        this._command(`speed${speed}`, "switch", "turn_off", { entity_id: entityId }, (a) => a !== preset);
      } else {
        this._command(preset, "switch", "turn_on", { entity_id: entityId });
      }
    }
  }

  _percentage(speed) {
    const step = Number(this._hass.states[this._ents.fan]?.attributes?.percentage_step) || 25;
    return Math.min(100, Math.round(step * speed));
  }

  _setSpeed(speed) {
    clearTimeout(this._cycleTimer);
    this._cycleTimer = null;
    this._command(`speed${speed}`, "fan", "set_percentage", { entity_id: this._ents.fan, percentage: this._percentage(speed) });
  }

  // Like the key on the panel: off, 1, 2, 3, 4, then off again. From a preset
  // it goes back to the speed the fan kept. Taps in a row are sent once.
  _cycleSpeed(mode) {
    const fan = this._ents.fan;
    const current = mode.startsWith("speed") ? Number(mode.slice(5)) : mode === "off" ? 0 : -1;
    const next = current < 0 ? speedOf(this._hass.states[fan]) || 1 : current === 4 ? 0 : current + 1;
    this._setPending(next ? `speed${next}` : "off");
    clearTimeout(this._cycleTimer);
    this._cycleTimer = setTimeout(() => {
      this._cycleTimer = null;
      if (next) this._call("fan", "set_percentage", { entity_id: fan, percentage: this._percentage(next) });
      else this._call("fan", "turn_off", { entity_id: fan });
    }, CYCLE_MS);
  }

  // Shows `mode` at once, until `done` says the unit has confirmed it or a timeout
  _command(mode, domain, service, data, done) {
    this._setPending(mode, done);
    this._call(domain, service, data);
  }

  _setPending(mode, done = (actual) => actual === mode) {
    this._pending = { mode, done, until: Date.now() + PENDING_MS };
    clearTimeout(this._pendingTimer);
    this._pendingTimer = setTimeout(() => this._update(), PENDING_MS + 50);
    this._update();
  }

  async _call(domain, service, data) {
    try {
      await this._hass.callService(domain, service, data);
    } catch (err) {
      this._pending = null;
      this._update();
      fire(this, "hass-notification", { message: err?.message ?? String(err) });
    }
  }
}

// The Flow40 to offer first: the model set by the ESPHome project, else the
// first ESPHome device with a fan.
function findDevice(hass) {
  const devices = Object.values(hass?.devices || {});
  const byModel = devices.find((d) => d.model === MODEL);
  if (byModel) return byModel.id;
  const fan = Object.values(hass?.entities || {}).find((e) => e.platform === "esphome" && e.entity_id.startsWith("fan.") && e.device_id);
  return fan?.device_id;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

async function loadHaForm() {
  if (customElements.get("ha-form")) return;
  const helpers = await window.loadCardHelpers?.();
  const card = await helpers?.createCardElement({ type: "entities", entities: [] });
  await card?.constructor?.getConfigElement?.();
}

class HeltyFlow40CardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    loadHaForm()
      .then(() => customElements.whenDefined("ha-form"))
      .then(() => this._render());
  }

  _render() {
    if (!this._hass || !this._config || !customElements.get("ha-form")) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => {
        const config = { ...ev.detail.value };
        for (const key of Object.keys(config)) {
          if (config[key] === "" || config[key] === undefined) delete config[key];
        }
        if (config.color === DEFAULT_COLOR) delete config.color;
        this._config = config;
        fire(this, "config-changed", { config });
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = { color: DEFAULT_COLOR, ...this._config };
    this._form.schema = [
      { name: "device_id", required: true, selector: { device: { filter: [{ integration: "esphome", model: MODEL }] } } },
      { name: "name", selector: { text: {} } },
      { name: "color", selector: { ui_color: { default_color: DEFAULT_COLOR } } },
    ];
    this._form.computeLabel = (schema) => translate(this._hass, `editor.${schema.name}`);
  }
}

// ---------------------------------------------------------------------------
// Registration, once Home Assistant has started (it swaps the element registry)
// ---------------------------------------------------------------------------

const define = () => {
  const registry = window.customElements;
  if (!registry.get(CARD_TYPE)) registry.define(CARD_TYPE, HeltyFlow40Card);
  if (!registry.get(EDITOR_TYPE)) registry.define(EDITOR_TYPE, HeltyFlow40CardEditor);
};

if (window.customElements.get("home-assistant") || window.customElements.get("hc-main")) {
  define();
} else {
  Promise.race([
    window.customElements.whenDefined("home-assistant"),
    window.customElements.whenDefined("hc-main"),
    new Promise((resolve) => setTimeout(resolve, 30000)),
  ]).then(define);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
  const pageHass = document.querySelector("home-assistant")?.hass;
  window.customCards.push({
    type: CARD_TYPE,
    name: translate(pageHass, "name"),
    description: translate(pageHass, "description"),
    preview: true,
    documentationURL: "https://github.com/fabioscarparo/helty-home-assistant#dashboard-card",
  });
}

console.info(
  `%c HELTY FLOW40 CARD %c ${VERSION} `,
  "color: white; background: #457abd; font-weight: 700;",
  "color: #457abd; background: white; font-weight: 700;",
);
