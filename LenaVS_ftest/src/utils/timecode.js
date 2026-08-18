export const DEFAULT_TIMECODE = '00:00';
export const MAX_FIXED_TIMECODE_MINUTES = 99;
export const MAX_FIXED_TIMECODE_SECONDS = (MAX_FIXED_TIMECODE_MINUTES * 60) + 59.99;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeFractionDigits = (rawFraction = '') => String(rawFraction || '').replace(/\D/g, '').slice(0, 2);

export const sanitizeFixedTimecodeInput = (value) => (
  String(value ?? '')
    .replace(',', '.')
    .replace(/[^\d:.]/g, '')
    .replace(/\.(?=.*\.)/g, '')
);

export const isCompleteFixedTimecode = (value) => {
  const raw = String(value ?? '').trim().replace(',', '.');
  return /^\d{1,2}:\d{2}(?:\.\d{1,2})?$/.test(raw) || /^\d{1,2}:\d{2}:\d{2}(?:\.\d{1,2})?$/.test(raw);
};

export const formatFixedTimecode = (value, { decimals = 'auto' } = {}) => {
  const safe = clamp(Number(value) || 0, 0, MAX_FIXED_TIMECODE_SECONDS);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secondsFloat = safe % 60;
  const wholeSeconds = Math.floor(secondsFloat);
  const hasFraction = Math.abs(secondsFloat - wholeSeconds) > 0.0005;
  const resolvedDecimals = decimals === 'auto' ? (hasFraction ? 2 : 0) : Math.max(0, Math.min(2, Number(decimals) || 0));
  const centiseconds = resolvedDecimals > 0 ? Math.round((secondsFloat - wholeSeconds) * 100) : 0;

  let normalizedHours = hours;
  let normalizedMinutes = minutes;
  let normalizedSeconds = wholeSeconds;
  let normalizedCentiseconds = centiseconds;

  if (normalizedCentiseconds >= 100) {
    normalizedCentiseconds = 0;
    normalizedSeconds += 1;
  }
  if (normalizedSeconds >= 60) {
    normalizedSeconds = 0;
    normalizedMinutes += 1;
  }
  if (normalizedMinutes >= 60) {
    normalizedMinutes = 0;
    normalizedHours += 1;
  }

  const fractionSuffix = resolvedDecimals > 0
    ? `.${String(normalizedCentiseconds).padStart(2, '0')}`
    : '';

  if (normalizedHours > 0) {
    return `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}:${String(normalizedSeconds).padStart(2, '0')}${fractionSuffix}`;
  }

  return `${String(normalizedMinutes).padStart(2, '0')}:${String(normalizedSeconds).padStart(2, '0')}${fractionSuffix}`;
};

export const parseFixedTimecode = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, 0, MAX_FIXED_TIMECODE_SECONDS);
  }

  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) return null;

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return clamp(Number(raw), 0, MAX_FIXED_TIMECODE_SECONDS);
  }

  const parts = raw.split(':');
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const last = parts[parts.length - 1];
  const [secondsPart, fractionPart = ''] = last.split('.');
  const seconds = Number(secondsPart);
  const fractionDigits = normalizeFractionDigits(fractionPart);
  const fraction = fractionDigits ? Number(`0.${fractionDigits}`) : 0;

  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 60) {
    return null;
  }

  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > MAX_FIXED_TIMECODE_MINUTES) {
      return null;
    }
    return clamp((minutes * 60) + seconds + fraction, 0, MAX_FIXED_TIMECODE_SECONDS);
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0 || minutes >= 60) {
    return null;
  }

  return Math.max(0, (hours * 3600) + (minutes * 60) + seconds + fraction);
};

export const normalizeFixedTimecode = (value, fallback = DEFAULT_TIMECODE) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback;
  }

  const raw = String(value).trim().replace(',', '.');
  const parsed = parseFixedTimecode(raw);
  if (parsed === null) {
    return fallback;
  }

  const keepDecimals = /\.\d{1,2}$/.test(raw) || (typeof value === 'number' && !Number.isInteger(value));
  return formatFixedTimecode(parsed, { decimals: keepDecimals ? 2 : 0 });
};

export const parseTimecode = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  const fixedTime = parseFixedTimecode(value);
  if (fixedTime !== null) {
    return fixedTime;
  }

  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) return null;

  if (!/^\d{1,2}:\d{1,2}:\d{1,2}(?:\.\d+)?$/.test(raw)) {
    return null;
  }

  const [hoursRaw, minutesRaw, secondsRaw] = raw.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return Math.max(0, (hours * 3600) + (minutes * 60) + seconds);
};

export const formatTimecode = (value, { decimals = 0 } = {}) => {
  const safe = Math.max(0, Number(value) || 0);
  const resolvedDecimals = Math.max(0, Math.min(2, Number(decimals) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secondsFloat = safe % 60;
  const wholeSeconds = Math.floor(secondsFloat);
  const centiseconds = resolvedDecimals > 0 ? Math.round((secondsFloat - wholeSeconds) * 100) : 0;

  let normalizedHours = hours;
  let normalizedMinutes = minutes;
  let normalizedSeconds = wholeSeconds;
  let normalizedCentiseconds = centiseconds;

  if (normalizedCentiseconds >= 100) {
    normalizedCentiseconds = 0;
    normalizedSeconds += 1;
  }
  if (normalizedSeconds >= 60) {
    normalizedSeconds = 0;
    normalizedMinutes += 1;
  }
  if (normalizedMinutes >= 60) {
    normalizedMinutes = 0;
    normalizedHours += 1;
  }

  const fractionSuffix = resolvedDecimals > 0
    ? `.${String(normalizedCentiseconds).padStart(2, '0')}`
    : '';

  if (normalizedHours > 0) {
    return `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}:${String(normalizedSeconds).padStart(2, '0')}${fractionSuffix}`;
  }

  return `${String(normalizedMinutes).padStart(2, '0')}:${String(normalizedSeconds).padStart(2, '0')}${fractionSuffix}`;
};
