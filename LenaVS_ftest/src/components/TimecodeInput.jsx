import React from 'react';
import { DEFAULT_TIMECODE, normalizeFixedTimecode } from '../utils/timecode';

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

const TimecodeInput = ({
  value = DEFAULT_TIMECODE,
  onChange = () => {},
  onCommit = () => {},
  className = '',
  placeholder = 'MM:SS.CC',
  ariaLabel = 'Tempo',
  title,
  disabled = false,
}) => {
  const displayValue = value === null || value === undefined ? '' : String(value);

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      maxLength={12}
      value={displayValue}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        const rawValue = event.target.value.trim();
        if (!rawValue) {
          onCommit('');
          return;
        }

        const normalized = normalizeFixedTimecode(rawValue, DEFAULT_TIMECODE);
        onChange(normalized);
        onCommit(normalized);
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      title={title || 'Use MM:SS ou MM:SS.CC'}
      disabled={disabled}
      data-timecode-input="true"
    />
  );
};

export const isTextEntryElement = (element) => {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  const tagName = element.tagName;

  if (tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  if (tagName !== 'INPUT') {
    return false;
  }

  const type = String(element.getAttribute('type') || 'text').toLowerCase();

  return !NON_TEXT_INPUT_TYPES.has(type);
};

export default TimecodeInput;
