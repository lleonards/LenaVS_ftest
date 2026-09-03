# Sincronização automática (Lyrics Aligner) — Frontend

## O que mudou

### Painel Arquivos (`src/components/FilesPanel.jsx`)

Novo botão **"Sincronizar automaticamente"** no painel **Arquivos**, posicionado
**abaixo do botão "Criar instrumental com IA"**.

- **Só fica clicável** depois que o usuário faz upload de **música original E
  letra** (arquivo ou colada manualmente) **e** existem blocos de letra
  (`canAutoSync`).
- Envia os blocos **exatamente como estão** — a organização em blocos que já
  existe na LenaVS é mantida. O Lyrics Aligner serve apenas para descobrir os
  tempos das palavras: **não** cria, exclui, divide, junta ou reorganiza
  blocos.
- Aplica os tempos recebidos **por índice**: `bloco.start` = tempo da primeira
  palavra do bloco; `bloco.end` = tempo da última. Blocos sem tempo identificado
  mantêm os tempos que já tinham — nunca recebem tempo inventado.
- Blocos sincronizados são marcados com `hasManualStart`/`hasManualEnd` para o
  editor tratá-los como tempos definidos.
- Mensagens amigáveis durante o processamento:
  - Ao iniciar: **"🎵 Estamos ouvindo a música para sincronizar sua letra
    automaticamente..."**
  - Ao concluir: **"✨ Pronto! Sua letra foi sincronizada automaticamente."**
  - Em erro: mensagem amigável, sem erro técnico cru.

### Editor (`src/pages/Editor.jsx`)

Novo callback `handleStanzasSynced` normaliza e aplica os tempos sincronizados
via `normalizeStanzas`, mantendo a estrutura de blocos existente.

## Formato de tempo

O backend devolve `startTime`/`endTime` em **segundos com milissegundos**
(ex.: `10.012`). O frontend converte para **mm:ss** com `formatFixedTimecode`
do `src/utils/timecode.js` — **o editor continua mostrando somente minutos e
segundos, sem milissegundos**.

## Como funciona

```
FilesPanel                    Backend                        Lyrics Aligner
──────────                    ───────                        ──────────────
POST /api/lyrics/auto-sync →  autoSyncLyrics()
  { audioUrl, blocks }        └─ syncLyricsStanzasWithAligner()
                                 └─ alignLyricsWordsWithAudio() ──► ctc-forced-aligner
                                    (letra do usuário = referência)  [{word,start,end}]
                                └─ mapAlignedWordsToBlocks()
                                   consumo sequencial de tokens
resposta:                    ◄──
 { success, engine,
   blocks: [{text, startTime, endTime}] }
```

## Instalação

```bash
npm install
npm run dev        # http://localhost:5173
```

Consulte `AUTO_SYNC.md` no backend para as variáveis de ambiente e a
instalação do Lyrics Aligner no servidor.
