// Local-file compatibility bundle; original modules remain alongside this file.
(()=>{
const BOUNDARY_TOLERANCE = 1e-10;
const MODEL_VERSION = 'snell-planar-1';
const LIMITS = Object.freeze({ n1: [1, 2.5], n2: [1, 2.5], angle: [0, 89.9] });

function validParameter(name, value) {
  const bounds = LIMITS[name];
  return Boolean(bounds) && Number.isFinite(value) && value >= bounds[0] && value <= bounds[1];
}

/** Angles are in degrees, measured from the normal. Undefined angles are null. */
function calculate({ n1, n2, angle }) {
  if (!validParameter('n1', n1) || !validParameter('n2', n2) || !validParameter('angle', angle)) {
    throw new RangeError('Indices must be 1–2.5 and incidence must be 0–89.9 degrees.');
  }
  const sine = n1 * Math.sin(angle * Math.PI / 180) / n2;
  const totalInternalReflection = sine > 1 + BOUNDARY_TOLERANCE;
  const criticalAngle = n1 > n2 ? Math.asin(n2 / n1) * 180 / Math.PI : null;
  // Preserve the exact critical identity when sin(asin(x)) loses an ulp.
  const exactlyCritical = criticalAngle !== null && angle === criticalAngle;
  const refractionAngle = totalInternalReflection ? null : exactlyCritical ? 90 : Math.asin(Math.min(1, sine)) * 180 / Math.PI;
  const atCritical = !totalInternalReflection && n1 > n2 &&
    (sine >= 1 || Math.abs(angle - criticalAngle) <= 1e-12);
  let behavior = 'toward-normal';
  if (totalInternalReflection) behavior = 'total-internal-reflection';
  else if (atCritical) behavior = 'critical';
  else if (angle === 0) behavior = 'along-normal';
  else if (n1 === n2) behavior = 'straight';
  else if (n1 > n2) behavior = 'away-from-normal';
  return Object.freeze({
    modelVersion: MODEL_VERSION,
    sine,
    refractionAngle,
    reflectionAngle: totalInternalReflection ? angle : null,
    criticalAngle,
    totalInternalReflection,
    atCritical,
    behavior
  });
}

function snapshot(draft, id, savedAt = new Date().toISOString()) {
  const conditions = { n1: draft.n1, n2: draft.n2, angle: draft.angle };
  const result = calculate(conditions);
  const observedText = String(draft.observedAngle ?? '').trim();
  const observedAngle = observedText === '' ? null : Number(observedText);
  if (observedAngle !== null && (!Number.isFinite(observedAngle) || observedAngle < 0 || observedAngle > 90)) {
    throw new RangeError('An observed angle must be 0–90 degrees, or left empty.');
  }
  return Object.freeze({
    id,
    savedAt,
    ...conditions,
    ...result,
    prediction: String(draft.prediction ?? ''),
    observedAngle,
    observation: String(draft.observation ?? '')
  });
}


const CSV_COLUMNS = Object.freeze([
  'schema_version', 'model_version', 'point', 'saved_at', 'n1', 'n2',
  'incidence_deg', 'model_refraction_deg', 'total_internal_reflection',
  'reflection_deg', 'critical_angle_deg', 'prediction', 'observed_refraction_deg', 'observation_notes'
]);

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

function exportCSV(points) {
  if (!points.length) throw new Error('Save an experiment before exporting your notebook.');
  const rows = points.map(point => [
    1, point.modelVersion || MODEL_VERSION, point.id, point.savedAt, point.n1, point.n2,
    point.angle, point.refractionAngle, point.totalInternalReflection, point.reflectionAngle,
    point.criticalAngle, point.prediction, point.observedAngle, point.observation
  ]);
  return '\ufeff' + [CSV_COLUMNS, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}


const $ = id => document.getElementById(id);
const STORAGE_KEY = 'opticslab.notebook.v1';
const compact = window.matchMedia('(max-width: 540px)');
const indexFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 10 });
const formatIndex = value => indexFormatter.format(value);
const inputIndex = value => {
  const text = String(value);
  if (!text.includes('.')) return text + '.00';
  return text.split('.')[1].length === 1 ? text + '0' : text;
};
const formatAngle = (value, digits = 2) => value === null ? '—' : `${value.toFixed(digits)}°`;
const conditionDigits = point => point.criticalAngle !== null && Math.abs(point.angle - point.criticalAngle) < .05 ? 10 : 2;
const pointName = id => `Point ${String(id).padStart(2, '0')}`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const initialState = () => ({
  schemaVersion: 1,
  draft: {
    n1: 1, n2: 1.5, angle: 30,
    raw: { n1: '1.00', n2: '1.50', angle: '30' },
    prediction: '', observedAngle: '', observation: '', showAngles: true, presetId: null
  },
  points: [],
  nextId: 1
});

let state = initialState();
let examples = [];
let storageDisabled = false;
let rawRecovery = null;
let feedbackTimer;
let deletedPoint = null;
let comparisonOpen = false;
const selected = new Set();
const inputErrors = new Map();

function storageNotice(message, recovery = false) {
  $('storage-message').textContent = message;
  $('storage-notice').hidden = false;
  $('recovery-button').hidden = !recovery;
  $('persistence-label').textContent = 'Kept in this tab · export before closing';
}

function validStoredState(candidate) {
  if (!candidate || candidate.schemaVersion !== 1 || !candidate.draft || !Array.isArray(candidate.points)) return false;
  const draft = candidate.draft;
  if (!['n1', 'n2', 'angle'].every(key => validParameter(key, draft[key]))) return false;
  if (!draft.raw || !['n1', 'n2', 'angle'].every(key => typeof draft.raw[key] === 'string')) return false;
  if (!['prediction', 'observation', 'observedAngle'].every(key => typeof draft[key] === 'string')) return false;
  if (typeof draft.showAngles !== 'boolean') return false;
  const ids = new Set();
  let highestId = 0;
  for (const point of candidate.points) {
    if (!point || !Number.isSafeInteger(point.id) || point.id < 1 || ids.has(point.id)) return false;
    if (!['n1', 'n2', 'angle'].every(key => validParameter(key, point[key]))) return false;
    if (typeof point.savedAt !== 'string' || !Number.isFinite(Date.parse(point.savedAt))) return false;
    if (typeof point.prediction !== 'string' || typeof point.observation !== 'string') return false;
    if (point.observedAngle !== null && (!Number.isFinite(point.observedAngle) || point.observedAngle < 0 || point.observedAngle > 90)) return false;
    const result = calculate(point);
    if (point.modelVersion !== MODEL_VERSION) return false;
    for (const key of ['refractionAngle', 'criticalAngle', 'reflectionAngle']) {
      if (result[key] === null ? point[key] !== null : !Number.isFinite(point[key]) || Math.abs(result[key] - point[key]) > 1e-8) return false;
    }
    if (point.totalInternalReflection !== result.totalInternalReflection || point.behavior !== result.behavior) return false;
    ids.add(point.id);
    highestId = Math.max(highestId, point.id);
  }
  return Number.isSafeInteger(candidate.nextId) && candidate.nextId > highestId;
}

function loadState() {
  let stored;
  try { stored = localStorage.getItem(STORAGE_KEY); }
  catch {
    storageDisabled = true;
    storageNotice('Browser storage is unavailable. You can work in this tab; export your saved points before closing it.');
    return;
  }
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    if (!validStoredState(parsed)) throw new Error('Unsupported or incomplete notebook');
    state = parsed;
    state.points = state.points.map(point => Object.freeze(point));
  } catch {
    storageDisabled = true;
    rawRecovery = stored;
    storageNotice('The stored notebook could not be opened. Existing browser data is untouched; this session will not overwrite it. Download the stored data for recovery, and export any new points before closing.', true);
  }
}

function persist() {
  if (storageDisabled) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('storage-notice').hidden = true;
    $('persistence-label').textContent = 'Saved on this device';
    return true;
  } catch {
    storageNotice('Your changes are kept in this tab, but browser storage could not save them. Export your notebook before closing; your existing stored data has not been erased.');
    return false;
  }
}

function notify(message, error = false, undo = false) {
  clearTimeout(feedbackTimer);
  $('feedback-message').textContent = message;
  $('action-feedback').classList.toggle('error', error);
  $('action-feedback').hidden = false;
  $('undo-delete').hidden = !undo;
  feedbackTimer = setTimeout(() => { $('action-feedback').hidden = true; }, undo ? 12000 : error ? 10000 : 6000);
}

function updateSlider(name) {
  const range = $(`${name}-range`);
  const value = state.draft[name];
  range.value = value;
  const [min, max] = LIMITS[name];
  range.style.setProperty('--fill', `${(value - min) / (max - min) * 100}%`);
  range.setAttribute('aria-valuetext', name === 'angle' ? `${value} degrees from the normal` : `Refractive index ${value}`);
}

function validateField(name, raw) {
  const value = raw.trim() === '' ? NaN : Number(raw);
  const valid = validParameter(name, value);
  const error = $(`${name}-error`);
  error.hidden = valid;
  $(`${name}-number`).setAttribute('aria-invalid', String(!valid));
  if (!valid) {
    const message = name === 'angle' ? 'Enter an angle from 0° to 89.9°. The diagram keeps the last valid value.' : 'Enter an index from 1 to 2.5. The diagram keeps the last valid value.';
    error.textContent = message;
    inputErrors.set(name, message);
  } else {
    inputErrors.delete(name);
    state.draft[name] = value;
  }
  return valid;
}

function validateObserved() {
  const raw = state.draft.observedAngle.trim();
  const value = Number(raw);
  const valid = raw === '' || (Number.isFinite(value) && value >= 0 && value <= 90);
  $('observed-error').hidden = valid;
  $('observed-angle').setAttribute('aria-invalid', String(!valid));
  if (!valid) {
    $('observed-error').textContent = 'Enter a measured angle from 0° to 90°, or leave it blank. Your other notes are kept.';
    inputErrors.set('observed', 'An observed angle must be 0–90 degrees or left blank.');
  } else inputErrors.delete('observed');
  return valid;
}

function syncControls() {
  for (const name of ['n1', 'n2', 'angle']) {
    $(`${name}-number`).value = state.draft.raw[name];
    validateField(name, state.draft.raw[name]);
    updateSlider(name);
  }
  $('show-angles').checked = state.draft.showAngles;
  $('prediction').value = state.draft.prediction;
  $('observation').value = state.draft.observation;
  $('observed-angle').value = state.draft.observedAngle;
  validateObserved();
  if (inputErrors.has('observed')) $('draft-notes').open = true;
}

const polar = (cx, cy, r, angle) => ({ x: cx + r * Math.cos(angle * Math.PI / 180), y: cy + r * Math.sin(angle * Math.PI / 180) });
function arcPath(cx, cy, r, start, end) {
  const a = polar(cx, cy, r, start);
  const b = polar(cx, cy, r, end);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
}

function arrowAt(a, b, fraction, color, size) {
  const x = a.x + (b.x - a.x) * fraction;
  const y = a.y + (b.y - a.y) * fraction;
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  return `<path d="M ${-size} ${-size * .5} L 0 0 L ${-size} ${size * .5}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" transform="translate(${x} ${y}) rotate(${angle})"/>`;
}

function rayMarkup(parameters, result, { mini = false, id = 'main', showAngles = true } = {}) {
  const small = !mini && compact.matches;
  const h = mini ? 200 : small ? 330 : 360;
  const w = mini ? 320 : Math.round($('ray-diagram').clientWidth / Math.max(1, $('ray-diagram').clientHeight) * h);
  const cx = mini ? 160 : w * .53;
  const cy = h / 2;
  const pad = mini ? 15 : small ? 23 : 32;
  const theta1 = parameters.angle * Math.PI / 180;
  const s1 = Math.sin(theta1), c1 = Math.cos(theta1);
  const incidentLength = Math.min((cx - pad) / Math.max(s1, 1e-12), (cy - pad) / Math.max(c1, 1e-12));
  const origin = { x: cx, y: cy };
  const incident = { x: cx - s1 * incidentLength, y: cy - c1 * incidentLength };
  const font = mini ? 8 : 12;
  const indexFont = mini ? 12 : small ? 16 : 17;
  const labelX = mini ? 16 : small ? 20 : 28;
  const labelY = mini ? 22 : small ? 30 : 33;
  const line = (from, to, color, kind, angle) => `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-opacity=".10" stroke-width="9"/><line data-ray="${kind}" data-angle-deg="${angle}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="${mini ? 1.8 : 2.5}" stroke-linecap="round"/>${arrowAt(from, to, .61, color, mini ? 7 : 10)}`;
  let markup = `
    <defs><pattern id="grid-${id}" width="${mini ? 20 : small ? 24 : 29}" height="${mini ? 20 : small ? 24 : 29}" patternUnits="userSpaceOnUse"><path d="M 29 0 H 0 V 29" fill="none" stroke="#658079" stroke-width=".5" opacity=".24"/></pattern></defs>
    <rect width="${w}" height="${cy}" fill="#15353a"/>
    <rect y="${cy}" width="${w}" height="${cy}" fill="#1d4243"/>
    <rect width="${w}" height="${h}" fill="url(#grid-${id})"/>
    <line x1="0" y1="${cy}" x2="${w}" y2="${cy}" stroke="#8da89e" stroke-opacity=".55"/>
    <line x1="${cx}" y1="${mini ? 12 : 18}" x2="${cx}" y2="${h - (mini ? 12 : 18)}" stroke="#86aaa1" stroke-dasharray="4 5" stroke-opacity=".65" stroke-width="1"/>
    <text x="${labelX}" y="${labelY}" fill="#9cbab0" font-family="sans-serif" font-size="${font}" letter-spacing="1.2">MEDIUM 1</text>
    <text x="${labelX}" y="${labelY + (mini ? 18 : 24)}" fill="#deebe3" font-family="sans-serif" font-size="${indexFont}">n₁ = ${formatIndex(parameters.n1)}</text>
    <text x="${labelX}" y="${cy + (mini ? 27 : 40)}" fill="#9cbab0" font-family="sans-serif" font-size="${font}" letter-spacing="1.2">MEDIUM 2</text>
    <text x="${labelX}" y="${cy + (mini ? 45 : 64)}" fill="#deebe3" font-family="sans-serif" font-size="${indexFont}">n₂ = ${formatIndex(parameters.n2)}</text>
    ${!mini ? `<text x="${cx + 12}" y="${small ? 25 : 26}" fill="#83a79c" font-family="sans-serif" font-size="${font}">normal</text><text x="${w - (small ? 16 : 28)}" y="${cy + 18}" text-anchor="end" fill="#8cac9f" font-family="sans-serif" font-size="${font - 1}" letter-spacing=".6">interface</text>` : ''}
    ${line(incident, origin, '#edc46a', 'incident', parameters.angle)}
    <circle cx="${incident.x}" cy="${incident.y}" r="${mini ? 2.8 : 4}" fill="#edc46a"/>
  `;
  const r = mini ? 28 : small ? 42 : 51;
  if (showAngles && parameters.angle > .01) {
    markup += `<path data-arc="incidence" d="${arcPath(cx, cy, r, -90 - parameters.angle, -90)}" fill="none" stroke="#edc46a" stroke-opacity=".75" stroke-width="1"/>`;
  }
  if (showAngles && !mini) {
    const label = polar(cx, cy, r + 12, -90 - parameters.angle);
    markup += `<text x="${label.x - 12}" y="${label.y - 4}" text-anchor="end" fill="#e4c371" font-family="sans-serif" font-size="13">${small ? '' : 'θ₁ '}${parameters.angle.toFixed(1)}°</text>`;
  }
  if (result.totalInternalReflection) {
    const length = Math.min((w - cx - pad) / Math.max(s1, 1e-12), (cy - pad) / Math.max(c1, 1e-12));
    const reflected = { x: cx + s1 * length, y: cy - c1 * length };
    markup += line(origin, reflected, '#eab084', 'reflection', parameters.angle);
    if (showAngles && parameters.angle > .01) markup += `<path data-arc="reflection" d="${arcPath(cx, cy, r, -90, -90 + parameters.angle)}" fill="none" stroke="#eab084" stroke-opacity=".75" stroke-width="1"/>`;
    if (showAngles && !mini) {
      const label = polar(cx, cy, r + 21, -90 + parameters.angle / 2);
      markup += `<text x="${label.x + 12}" y="${label.y - 2}" fill="#eab084" font-family="sans-serif" font-size="13">${small ? '' : 'θr '}${parameters.angle.toFixed(1)}°</text>`;
    }
    if (!mini) markup += `<text x="${cx}" y="${h - 32}" text-anchor="middle" fill="#9cbaaf" font-family="sans-serif" font-size="${small ? 11 : 10}">No refracted ray</text>`;
  } else {
    const theta2 = result.refractionAngle * Math.PI / 180;
    const s2 = Math.sin(theta2), c2 = Math.cos(theta2);
    const length = Math.min((w - cx - pad) / Math.max(s2, 1e-12), (h - cy - pad) / Math.max(c2, 1e-12));
    const refracted = { x: cx + s2 * length, y: cy + c2 * length };
    markup += line(origin, refracted, '#92debf', 'refraction', result.refractionAngle);
    if (showAngles && result.refractionAngle > .01) markup += `<path data-arc="refraction" d="${arcPath(cx, cy, r, 90 - result.refractionAngle, 90)}" fill="none" stroke="#92debf" stroke-opacity=".75" stroke-width="1"/>`;
    if (showAngles && !mini) {
      const label = polar(cx, cy, r + 14, 90 - result.refractionAngle);
      markup += `<text x="${label.x + 17}" y="${label.y + 11}" fill="#9cddbd" font-family="sans-serif" font-size="13">${small ? '' : 'θ₂ '}${result.refractionAngle.toFixed(1)}°</text>`;
    }
  }
  markup += `<circle cx="${cx}" cy="${cy}" r="${mini ? 3 : 4}" fill="#f0f6e7"/>`;
  return { markup, viewBox: `0 0 ${w} ${h}` };
}

const behaviorText = {
  'toward-normal': ['Bends toward the normal', 'The second medium has a higher refractive index.'],
  'away-from-normal': ['Bends away from the normal', 'The second medium has a lower refractive index.'],
  'straight': ['Continues in a straight line', 'Equal refractive indices mean no change in direction.'],
  'along-normal': ['Continues along the normal', 'At 0° incidence, the refraction angle is also 0°.'],
  'critical': ['At the critical angle', 'Refraction is 90°: the ray follows the interface.'],
  'total-internal-reflection': ['Total internal reflection', 'No refraction angle. The reflected angle equals incidence.']
};

function renderLive() {
  const result = calculate(state.draft);
  const { markup, viewBox } = rayMarkup(state.draft, result, { showAngles: state.draft.showAngles });
  const description = `Ideal planar interface. Medium 1 index ${state.draft.n1}; medium 2 index ${state.draft.n2}. Incidence ${state.draft.angle} degrees from the normal. ${result.totalInternalReflection ? `Total internal reflection; reflected angle ${state.draft.angle} degrees; no refraction angle.` : `Refraction ${result.refractionAngle} degrees.`}${result.criticalAngle === null ? '' : ` Critical angle ${result.criticalAngle} degrees.`}`;
  $('ray-diagram').setAttribute('viewBox', viewBox);
  $('ray-diagram').innerHTML = `<title id="ray-title">Live ideal refraction diagram</title><desc id="ray-description">${description}</desc>${markup}`;
  $('incidence-result').innerHTML = `${state.draft.angle.toFixed(2)}<span>°</span>`;
  $('incidence-result').title = `${state.draft.angle}°`;
  $('refraction-result').classList.toggle('tir-result', result.totalInternalReflection);
  $('refraction-result').innerHTML = result.totalInternalReflection ? 'Not defined' : `${result.refractionAngle.toFixed(2)}<span>°</span>`;
  $('refraction-result').title = result.totalInternalReflection ? 'Total internal reflection: there is no refraction angle.' : `${result.refractionAngle}°`;
  $('refraction-heading').innerHTML = result.totalInternalReflection ? 'Refraction <span>θ₂ · TIR</span>' : 'Refraction <span>θ₂</span>';
  $('critical-result').classList.toggle('text-result', result.criticalAngle === null);
  if (result.criticalAngle === null) {
    $('third-heading').textContent = 'Medium transition';
    $('critical-result').textContent = state.draft.n1 === state.draft.n2 ? 'Equal indices' : 'Lower → higher';
    $('critical-result').title = 'No critical angle when n₁ ≤ n₂.';
  } else {
    $('third-heading').innerHTML = 'Critical angle <span>θc</span>';
    $('critical-result').innerHTML = `${result.criticalAngle.toFixed(2)}<span>°</span>`;
    $('critical-result').title = `${result.criticalAngle}°`;
  }
  $('use-critical').hidden = result.criticalAngle === null;
  const criticalReachable = result.criticalAngle !== null && validParameter('angle', result.criticalAngle);
  $('use-critical').disabled = !criticalReachable || ['n1', 'n2', 'angle'].some(key => inputErrors.has(key));
  $('use-critical').innerHTML = criticalReachable ? `Set incidence to the critical angle ${icon('arrow')}` : 'Critical angle is above the 89.9° incidence limit';
  $('transmitted-legend').hidden = result.totalInternalReflection;
  $('reflected-legend').hidden = !result.totalInternalReflection;
  const [title, message] = behaviorText[result.behavior];
  $('behavior-title').textContent = title;
  $('behavior-description').textContent = message;
  $('behavior-note').classList.toggle('is-tir', result.totalInternalReflection);
  $('save-point').disabled = inputErrors.size > 0;
  $('swap-media').disabled = ['n1', 'n2', 'angle'].some(key => inputErrors.has(key));
  renderExampleSelection();
}

function renderExampleSelection() {
  for (const button of $('example-buttons').querySelectorAll('button')) {
    const example = examples.find(item => item.id === button.dataset.example);
    button.setAttribute('aria-pressed', String(example && ['n1', 'n2', 'angle'].every(key => example[key] === state.draft[key])));
  }
}

function applyParameters(parameters, presetId = null) {
  for (const name of ['n1', 'n2', 'angle']) {
    state.draft[name] = parameters[name];
    state.draft.raw[name] = name === 'angle' ? String(parameters[name]) : inputIndex(parameters[name]);
  }
  state.draft.presetId = presetId;
  syncControls();
  renderLive();
  renderQuestion();
  persist();
}

function renderQuestion() {
  const example = examples.find(item => item.id === state.draft.presetId);
  $('example-question').hidden = !example;
  $('example-question').textContent = example ? `${example.id} · ${example.question}` : '';
}

function resultBadge(point) {
  if (point.totalInternalReflection) return '<span class="result-badge tir">Total internal reflection</span>';
  if (point.atCritical) return '<span class="result-badge critical">Critical angle</span>';
  return '<span class="result-badge">Refraction</span>';
}

function exactAngle(value, absent = '—', digits = 2) {
  return value === null ? `<span class="undefined-angle">${absent}</span>` : `<span title="${value}°">${formatAngle(value, digits)}</span>`;
}

function renderNotebook() {
  const count = state.points.length;
  $('nav-count').textContent = count;
  $('notebook-count').textContent = count;
  $('notebook-empty').hidden = count > 0;
  $('notebook-data').hidden = count === 0;
  $('export-csv').disabled = count === 0;
  $('print-table').disabled = count === 0;
  $('experiment-rows').innerHTML = state.points.map(point => {
    const checked = selected.has(point.id);
    const hasNotes = point.prediction.trim() !== '' || point.observation.trim() !== '';
    return `<tr data-point-id="${point.id}" class="${checked ? 'selected-row' : ''}">
      <td><input type="checkbox" class="select-point" data-id="${point.id}" aria-label="Select ${pointName(point.id)} for comparison" ${checked ? 'checked' : ''}></td>
      <td class="point-id">${pointName(point.id)}</td>
      <td data-label="Media · n₁ → n₂"><span class="media-cell" title="n₁ = ${point.n1}; n₂ = ${point.n2}">${formatIndex(point.n1)}<span class="media-arrow">→</span>${formatIndex(point.n2)}</span></td>
      <td data-label="Incidence · θ₁">${exactAngle(point.angle, '—', conditionDigits(point))}</td>
      <td data-label="Model refraction · θ₂">${exactAngle(point.refractionAngle)}</td>
      <td data-label="Critical angle · θc">${exactAngle(point.criticalAngle, '—', conditionDigits(point))}</td>
      <td data-label="Measured refraction · θ₂">${point.observedAngle === null ? '<span class="not-recorded">Not recorded</span>' : exactAngle(point.observedAngle)}</td>
      <td data-label="Result">${resultBadge(point)}</td>
      <td><div class="row-actions"><button class="icon-button load-point" data-id="${point.id}" aria-label="Load parameters from ${pointName(point.id)}" title="Load parameters">${icon('arrow')}</button><button class="icon-button delete-point" data-id="${point.id}" aria-label="Delete ${pointName(point.id)}" title="Delete point">${icon('trash')}</button></div></td>
    </tr>${hasNotes ? `<tr class="row-note"><td colspan="9"><div class="saved-notes">${point.prediction.trim() ? `<div><strong>Prediction</strong><p>${escapeHTML(point.prediction)}</p></div>` : ''}${point.observation.trim() ? `<div><strong>Observation notes</strong><p>${escapeHTML(point.observation)}</p></div>` : ''}</div></td></tr>` : ''}`;
  }).join('');
  updateSelection();
  if (comparisonOpen) renderComparison();
}

function updateSelection() {
  $('compare-points').disabled = selected.size < 2;
  $('compare-label').textContent = selected.size ? `Compare ${selected.size} point${selected.size === 1 ? '' : 's'}` : 'Compare points';
  $('selection-help').textContent = selected.size ? `${selected.size} of 3 comparison slots selected.` : 'Select 2–3 points to compare side by side.';
}

function renderComparison() {
  if (selected.size < 2) {
    comparisonOpen = false;
    $('comparison').hidden = true;
    return;
  }
  const points = state.points.filter(point => selected.has(point.id));
  $('comparison').hidden = false;
  $('comparison-cards').classList.toggle('three-cards', points.length === 3);
  $('comparison-cards').innerHTML = points.map(point => {
    const { markup, viewBox } = rayMarkup(point, point, { mini: true, id: `point-${point.id}`, showAngles: true });
    return `<article class="comparison-card card"><div class="comparison-card-heading"><strong>${pointName(point.id)}</strong>${resultBadge(point)}</div>
      <svg class="mini-diagram" viewBox="${viewBox}" role="img" aria-label="${pointName(point.id)}: ${point.totalInternalReflection ? 'total internal reflection, no refraction angle' : `refraction ${formatAngle(point.refractionAngle)}`}">${markup}</svg>
      <div class="comparison-conditions"><dl>
        <div><dt>Incident medium · n₁</dt><dd title="${point.n1}">${formatIndex(point.n1)}</dd></div><div><dt>Transmission medium · n₂</dt><dd title="${point.n2}">${formatIndex(point.n2)}</dd></div>
        <div><dt>Incidence · θ₁</dt><dd>${exactAngle(point.angle, '—', conditionDigits(point))}</dd></div><div><dt>Model refraction · θ₂</dt><dd class="${point.totalInternalReflection ? 'long-value' : ''}">${point.totalInternalReflection ? 'Not defined · TIR' : exactAngle(point.refractionAngle)}</dd></div>
        ${point.criticalAngle === null ? '<div><dt>Critical condition</dt><dd class="long-value">No critical angle · n₁ ≤ n₂</dd></div>' : `<div><dt>Critical angle · θc</dt><dd>${exactAngle(point.criticalAngle, '—', conditionDigits(point))}</dd></div>`}
        <div><dt>Measured refraction · θ₂</dt><dd class="${point.observedAngle === null ? 'long-value' : ''}">${point.observedAngle === null ? 'Not recorded' : exactAngle(point.observedAngle)}</dd></div>
        ${point.totalInternalReflection ? `<div><dt>Reflected angle · θr</dt><dd>${exactAngle(point.reflectionAngle)}</dd></div>` : ''}
      </dl>${point.prediction.trim() || point.observation.trim() ? `<div class="prediction-saved">${point.prediction.trim() ? `<strong>Prediction</strong>${escapeHTML(point.prediction)}` : ''}${point.observation.trim() ? `<strong>Observation notes</strong>${escapeHTML(point.observation)}` : ''}</div>` : ''}
      <button class="text-button load-point" data-id="${point.id}">Load these parameters ${icon('arrow')}</button></div></article>`;
  }).join('');
}

function savePoint() {
  if (inputErrors.size) {
    notify('Correct the highlighted values before saving. Your notebook is unchanged.', true);
    return;
  }
  try {
    const point = snapshot(state.draft, state.nextId);
    state.points = [...state.points, point];
    state.nextId += 1;
    const stored = persist();
    renderNotebook();
    notify(stored ? `${pointName(point.id)} saved to your notebook.` : `${pointName(point.id)} saved in this tab. Export before closing.`, !stored);
  } catch (error) {
    notify(`Couldn't save this point. ${error.message} Your existing points are kept.`, true);
  }
}

function startDownload(contents, filename, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function handleLoad(id) {
  const point = state.points.find(item => item.id === id);
  if (!point) return;
  applyParameters(point);
  notify(`${pointName(id)} parameters loaded. Your draft notes are kept.`);
  $('workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('n1-number').focus({ preventScroll: true });
}

function bindEvents() {
  for (const name of ['n1', 'n2', 'angle']) {
    const number = $(`${name}-number`);
    const range = $(`${name}-range`);
    // Keep typed critical angles on the slider without step rounding.
    range.step = 'any';
    number.addEventListener('input', () => {
      state.draft.raw[name] = number.value;
      validateField(name, number.value);
      updateSlider(name);
      renderLive();
      persist();
    });
    const updateFromRange = value => {
      const [min, max] = LIMITS[name];
      const precision = name === 'angle' ? 10 : 100;
      state.draft[name] = Math.max(min, Math.min(max, Math.round(value * precision) / precision));
      state.draft.raw[name] = name === 'angle' ? String(state.draft[name]) : state.draft[name].toFixed(2);
      number.value = state.draft.raw[name];
      validateField(name, number.value);
      updateSlider(name);
      renderLive();
      persist();
    };
    range.addEventListener('input', () => updateFromRange(Number(range.value)));
    range.addEventListener('keydown', event => {
      const step = (name === 'angle' ? .1 : .01) * (event.shiftKey ? 10 : 1);
      const changes = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 10, PageDown: -step * 10 };
      if (event.key in changes) { event.preventDefault(); updateFromRange(state.draft[name] + changes[event.key]); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); updateFromRange(LIMITS[name][event.key === 'Home' ? 0 : 1]); }
    });
    number.addEventListener('keydown', event => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        updateFromRange(state.draft[name] + (event.key === 'ArrowUp' ? 1 : -1) * (name === 'angle' ? .1 : .01));
      }
    });
  }
  $('show-angles').addEventListener('change', () => {
    state.draft.showAngles = $('show-angles').checked;
    renderLive();
    persist();
  });
  $('swap-media').addEventListener('click', () => {
    applyParameters({ n1: state.draft.n2, n2: state.draft.n1, angle: state.draft.angle });
    notify('Media swapped. The critical condition has been recalculated.');
  });
  $('reset').addEventListener('click', () => {
    applyParameters({ n1: 1, n2: 1.5, angle: 30 });
    notify('Parameters reset to 1.00 → 1.50 at 30°. Your notes and saved points are kept.');
  });
  $('use-critical').addEventListener('click', () => {
    const criticalAngle = calculate(state.draft).criticalAngle;
    if (criticalAngle !== null && validParameter('angle', criticalAngle)) applyParameters({ ...state.draft, angle: criticalAngle });
  });
  $('save-point').addEventListener('click', savePoint);
  for (const [id, key] of [['prediction', 'prediction'], ['observation', 'observation'], ['observed-angle', 'observedAngle']]) {
    $(id).addEventListener('input', () => {
      state.draft[key] = $(id).value;
      if (key === 'observedAngle') { validateObserved(); renderLive(); }
      persist();
    });
  }
  $('example-buttons').addEventListener('click', event => {
    const button = event.target.closest('[data-example]');
    if (!button) return;
    const example = examples.find(item => item.id === button.dataset.example);
    if (example) applyParameters(example, example.id);
  });
  $('experiment-rows').addEventListener('change', event => {
    if (!event.target.matches('.select-point')) return;
    const checkbox = event.target;
    const id = Number(checkbox.dataset.id);
    if (checkbox.checked && selected.size >= 3) {
      checkbox.checked = false;
      notify('Compare up to three points at once. Deselect one point to choose another.', true);
      return;
    }
    if (checkbox.checked) selected.add(id); else selected.delete(id);
    checkbox.closest('tr').classList.toggle('selected-row', checkbox.checked);
    updateSelection();
    if (comparisonOpen) renderComparison();
  });
  $('experiment-rows').addEventListener('click', event => {
    const load = event.target.closest('.load-point');
    if (load) { handleLoad(Number(load.dataset.id)); return; }
    const button = event.target.closest('.delete-point');
    if (!button) return;
    const id = Number(button.dataset.id);
    const index = state.points.findIndex(point => point.id === id);
    if (index < 0) return;
    deletedPoint = { point: state.points[index], index };
    selected.delete(id);
    state.points = state.points.filter(point => point.id !== id);
    const stored = persist();
    renderNotebook();
    notify(`${pointName(id)} removed.${stored ? '' : ' Browser storage was not updated.'}`, !stored, true);
    const nextButton = $('experiment-rows').querySelector('.delete-point');
    if (nextButton) nextButton.focus({ preventScroll: true }); else $('save-point').focus({ preventScroll: true });
  });
  $('undo-delete').addEventListener('click', () => {
    if (!deletedPoint) return;
    const { point, index } = deletedPoint;
    const points = [...state.points];
    points.splice(index, 0, point);
    state.points = points;
    deletedPoint = null;
    const stored = persist();
    renderNotebook();
    notify(stored ? `${pointName(point.id)} restored.` : `${pointName(point.id)} restored in this tab. Export before closing.`, !stored);
    $('experiment-rows').querySelector(`.load-point[data-id="${point.id}"]`)?.focus({ preventScroll: true });
  });
  $('compare-points').addEventListener('click', () => {
    if (selected.size < 2) return;
    comparisonOpen = true;
    renderComparison();
    $('comparison').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('close-comparison').focus({ preventScroll: true });
  });
  $('close-comparison').addEventListener('click', () => {
    comparisonOpen = false;
    $('comparison').hidden = true;
    $('compare-points').focus({ preventScroll: true });
  });
  $('comparison-cards').addEventListener('click', event => {
    const button = event.target.closest('.load-point');
    if (button) handleLoad(Number(button.dataset.id));
  });
  $('export-csv').addEventListener('click', () => {
    try {
      const contents = exportCSV(state.points);
      startDownload(contents, `optics-lab-experiments-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
      notify(`CSV download started with all ${state.points.length} saved point${state.points.length === 1 ? '' : 's'}.`);
    } catch {
      notify('Could not start the CSV download. Your points are kept; try exporting again.', true);
    }
  });
  $('print-table').addEventListener('click', () => {
    if (!state.points.length) { notify('Save an experiment before printing the table.', true); return; }
    try { window.print(); }
    catch { notify('The print dialog could not open. Your points are kept; use your browser’s Print command.', true); }
  });
  $('recovery-button').addEventListener('click', () => {
    try { startDownload(rawRecovery, 'optics-lab-stored-data.txt', 'text/plain;charset=utf-8'); }
    catch { notify('Could not download the recovery file. Existing browser data is still untouched.', true); }
  });
  $('dismiss-feedback').addEventListener('click', () => { $('action-feedback').hidden = true; });
  const guide = $('guide-dialog');
  $('open-guide').addEventListener('click', () => guide.showModal());
  $('close-guide').addEventListener('click', () => guide.close());
  $('guide-start').addEventListener('click', () => guide.close());
  guide.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const first = $('close-guide');
    const last = $('guide-start');
    if (event.shiftKey && (document.activeElement === first || !guide.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !guide.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  guide.addEventListener('click', event => {
    if (event.target !== guide) return;
    const rect = guide.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) guide.close();
  });
  compact.addEventListener('change', renderLive);
  new ResizeObserver(renderLive).observe($('ray-diagram'));
}

async function loadExamples() {
  try {
    const response = (location.protocol === 'file:' ? new Response(JSON.stringify([
  {
    "id": "E1",
    "n1": 1,
    "n2": 1.5,
    "angle": 30,
    "question": "When light travels from a lower refractive index to a higher refractive index, which way does it bend?"
  },
  {
    "id": "E2",
    "n1": 1.5,
    "n2": 1,
    "angle": 30,
    "question": "Compare the angles after swapping the media"
  },
  {
    "id": "E3",
    "n1": 1.5,
    "n2": 1,
    "angle": 60,
    "question": "Why is there no transmission angle?"
  }
]
)) : await fetch('./data/experiments.json'));
    if (!response.ok) throw new Error('Local example file unavailable');
    const data = await response.json();
    if (!Array.isArray(data) || !data.every(example => typeof example.id === 'string' && typeof example.question === 'string' && ['n1', 'n2', 'angle'].every(key => validParameter(key, example[key])))) throw new Error('Invalid examples');
    examples = data;
    const labels = { E1: 'Lower → higher index', E2: 'Swap the perspective', E3: 'Total internal reflection' };
    $('example-buttons').innerHTML = examples.map(example => `<button class="example-button" data-example="${escapeHTML(example.id)}" aria-pressed="false"><span class="example-number">${escapeHTML(example.id)}</span>${escapeHTML(labels[example.id] || example.question)}${icon('arrow')}</button>`).join('');
    renderExampleSelection();
    renderQuestion();
  } catch {
    $('example-buttons').innerHTML = '<span class="examples-loading">Examples could not load. Use the controls to explore any conditions.</span>';
  }
}

loadState();
syncControls();
bindEvents();
renderLive();
renderNotebook();
loadExamples();

})();
