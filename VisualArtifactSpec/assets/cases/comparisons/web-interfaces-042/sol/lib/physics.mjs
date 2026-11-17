export const BOUNDARY_TOLERANCE = 1e-10;
export const MODEL_VERSION = 'snell-planar-1';
export const LIMITS = Object.freeze({ n1: [1, 2.5], n2: [1, 2.5], angle: [0, 89.9] });

export function validParameter(name, value) {
  const bounds = LIMITS[name];
  return Boolean(bounds) && Number.isFinite(value) && value >= bounds[0] && value <= bounds[1];
}

/** Angles are in degrees, measured from the normal. Undefined angles are null. */
export function calculate({ n1, n2, angle }) {
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

export function snapshot(draft, id, savedAt = new Date().toISOString()) {
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
