import React, { useCallback } from 'react';
import api from '../services/api';
import { buildBlockTimecodes } from '../utils/lyricsSyncTimecode';

/**
 * useLyricsSync
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincronização automática da letra com a música original.
 *
 * • Envia apenas a música original (URL) e o TEXTO de cada bloco, na ordem,
 *   exatamente como estão no editor — nada é reescrito nem reagrupado.
 * • O backend descobre o tempo de cada palavra com o ctc-forced-aligner e
 *   devolve início/fim por bloco (início = 1ª palavra, fim = última palavra).
 * • Só os tempos mudam: `startTime` e `endTime` em MM:SS, sem milissegundos.
 */

const SYNC_ENDPOINT = '/lyrics/sync';

const FRIENDLY_ERRORS = {
  ALIGN_MISSING_AUDIO: 'Envie a música original antes de sincronizar a letra.',
  ALIGN_NO_LYRICS: 'Envie a letra antes de sincronizar.',
  ALIGN_UNAVAILABLE:
    'O sincronizador de letras não está disponível neste servidor no momento. Tente novamente mais tarde.',
  ALIGN_TIMEOUT:
    'A sincronização demorou mais do que o esperado. Tente novamente com uma música mais curta.',
  ALIGN_AUDIO_PREPARE_FAILED:
    'Não foi possível ler o áudio enviado. Confirme que o arquivo está íntegro e tente novamente.',
  ALIGN_PROCESS_FAILED:
    'O alinhador não conseguiu processar este áudio. Tente uma música mais curta.',
  DEMUCS_PROCESS_FAILED:
    'A separação da música falhou no servidor. Tente um áudio menor ou em MP3.',
};

export const useLyricsSync = ({ stanzas = [], mediaFiles = {}, onStanzasChange } = {}) => {
  const canSync = Boolean(mediaFiles?.musicaOriginal) && stanzas.length > 0;

  const syncLyrics = useCallback(async () => {
    const audioUrl = mediaFiles?.musicaOriginal;

    if (!audioUrl) {
      const error = new Error('Envie a música original antes de sincronizar a letra.');
      error.code = 'ALIGN_MISSING_AUDIO';
      throw error;
    }

    if (!stanzas.length) {
      const error = new Error('Envie a letra antes de sincronizar.');
      error.code = 'ALIGN_NO_LYRICS';
      throw error;
    }

    const payload = {
      audioUrl,
      stanzas: stanzas.map((stanza) => String(stanza?.text ?? '')),
    };

    const response = await api.post(SYNC_ENDPOINT, payload);
    const rawBlocks = response.data?.blocks;

    if (!Array.isArray(rawBlocks) || !rawBlocks.length) {
      const error = new Error('O servidor não retornou os tempos da sincronização.');
      error.code = 'ALIGN_EMPTY_RESPONSE';
      throw error;
    }

    const timecodes = buildBlockTimecodes(rawBlocks);
    const byIndex = new Map(timecodes.map((block) => [block.index, block]));

    let applied = 0;

    const nextStanzas = stanzas.map((stanza, position) => {
      const block = byIndex.get(position) ?? timecodes[position];

      if (!block) return stanza;

      applied += 1;

      return {
        ...stanza,
        startTime: block.startTime,
        endTime: block.endTime,
        hasManualStart: true,
        hasManualEnd: true,
      };
    });

    if (!applied) {
      const error = new Error('Nenhum bloco pôde ser sincronizado.');
      error.code = 'ALIGN_EMPTY_RESPONSE';
      throw error;
    }

    onStanzasChange?.(nextStanzas);

    return {
      applied,
      total: stanzas.length,
      engine: response.data?.engine || 'ctc-forced-aligner-1.0.2',
      mode: response.data?.mode || null,
      elapsedSec: response.data?.elapsedSec ?? null,
      estimated: timecodes.filter((block) => block.estimated).length
        || (response.data?.mode === 'proportional' ? timecodes.length : 0),
    };
  }, [mediaFiles, onStanzasChange, stanzas]);

  return { canSync, syncLyrics };
};

export const describeSyncError = (error) => {
  const code = error?.response?.data?.code || error?.code;
  const serverMessage = error?.response?.data?.error;

  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  if (error?.response?.status === 504) {
    return FRIENDLY_ERRORS.ALIGN_TIMEOUT;
  }
  if (error?.response?.status === 507) {
    return 'O servidor atingiu o limite de memória. Tente uma música mais curta; a letra não foi alterada.';
  }
  if (serverMessage) return serverMessage;

  return 'Não foi possível sincronizar a letra. Tente novamente.';
};

export default useLyricsSync;
