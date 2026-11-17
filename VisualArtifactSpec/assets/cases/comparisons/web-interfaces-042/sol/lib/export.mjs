import { MODEL_VERSION } from './physics.mjs';

export const CSV_COLUMNS = Object.freeze([
  'schema_version', 'model_version', 'point', 'saved_at', 'n1', 'n2',
  'incidence_deg', 'model_refraction_deg', 'total_internal_reflection',
  'reflection_deg', 'critical_angle_deg', 'prediction', 'observed_refraction_deg', 'observation_notes'
]);

export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export function exportCSV(points) {
  if (!points.length) throw new Error('Save an experiment before exporting your notebook.');
  const rows = points.map(point => [
    1, point.modelVersion || MODEL_VERSION, point.id, point.savedAt, point.n1, point.n2,
    point.angle, point.refractionAngle, point.totalInternalReflection, point.reflectionAngle,
    point.criticalAngle, point.prediction, point.observedAngle, point.observation
  ]);
  return '\ufeff' + [CSV_COLUMNS, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
