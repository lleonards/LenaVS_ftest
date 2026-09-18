export const DEFAULT_TIMECODE = '00:00';
export const MAX_FIXED_TIMECODE_MINUTES = 99;
export const MAX_FIXED_TIMECODE_SECONDS = (MAX_FIXED_TIMECODE_MINUTES * 60) + 59;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pad = (value) => String(value).padStart(2, '0');

/** Segundos -> "MM:SS" (sem milissegundos). */
export const secondsToFixedTimecode = (value) => {
  const numeric = Number(value);
  const safe = clamp(Number.isFinite(numeric) ? Math.floor(numeric) : 0, 0, MAX_FIXED_TIMECODE_SECONDS);

  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
};

/**
 * Converte o retorno do /api/lyrics/sync em tempos MM:SS por bloco.
 * Início = 1ª palavra | Fim = última palavra.
 */
export const buildBlockTimecodes = (blocks = []) => {
  if (!Array.isArray(blocks)) return [];

  return blocks
    .map((block, position) => {
      const index = Number.isInteger(Number(block?.index)) ? Number(block.index) : position;
      const startSec = Number(block?.startSec);
      const endSec = Number(block?.endSec);

      if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) return null;

      const safeStart = clamp(Math.min(startSec, endSec), 0, MAX_FIXED_TIMECODE_SECONDS);
      const safeEnd = clamp(Math.max(startSec, endSec), 0, MAX_FIXED_TIMECODE_SECONDS);

      const startSeconds = Math.floor(safeStart);
      let endSeconds = Math.floor(safeEnd);

      if (endSeconds <= startSeconds) {
        endSeconds = Math.min(startSeconds + 1, MAX_FIXED_TIMECODE_SECONDS);
      }

      return {
        index,
        startTime: secondsToFixedTimecode(startSeconds),
        endTime: secondsToFixedTimecode(endSeconds),
        startSec: Number(safeStart.toFixed(3)),
        endSec: Number(safeEnd.toFixed(3)),
        wordCount: Number(block?.wordCount) || 0,
        alignedWords: Number(block?.alignedWords) || 0,
        estimated: Boolean(block?.estimated),
      };
    })
    .filter(Boolean);
};

export default { secondsToFixedTimecode, buildBlockTimecodes };
