# Frontend — Correções aplicadas

Este arquivo ZIP contém o frontend original do LenaVS (última versão estável) com **patch crítico** no sistema de sincronização automática de letras. Eram três bugs que combinavam para gerar `Failed to load resource: 422` no console:

## Bugs corrigidos

1. **`FilesPanel.jsx` → `handleSynchronizeLyrics`** não tratava o status 422 nem exibia mensagem amigável. Agora:
   - Trata `error.response?.status === 422` com mensagem específica ("Vocal não detectado", com tom informativo, não de erro)
   - Trata erro de rede e erros internos separadamente
   - Marca `lyricsPanelNotice` somente quando há estrofes sincronizadas
   - Continua silenciando o `console.error` para o usuário final

2. **`utils/stanza.js` → `hasVocalEvidence`** agora considera `vocalPresence === false` E `syncVocalPresence === false` para esconder a estrofe quando não há vocal — exatamente como você pediu.

3. **`services/api.js`** — interceptor de resposta agora identifica o 422 de sync explicitamente e adiciona um campo `isExpected: true` no erro para que o frontend possa distinguir de erros genuínos.

## Como rodar

```bash
npm install
npm run dev       # http://localhost:5173
```

Aponte para o backend novo (`backend.zip`) através de `VITE_API_URL=http://localhost:10000` (ou via `localStorage.setItem('LENAVS_API_URL', …)`).

## O que NÃO mudou

Toda a base do projeto foi preservada (rotas, Supabase, painel de preview, exportação, painel de projetos, header, login, registro, pagamento). Apenas os arquivos críticos do sync foram corrigidos. Caso queira apenas a correção pontual, dentro de `src/`:

- `src/components/FilesPanel.css` — sem mudanças
- `src/components/FilesPanel.jsx` — **modificado** (handleSynchronizeLyrics corrigido + funções auxiliares adicionadas)
- `src/utils/stanza.js` — **modificado** (hasVocalEvidence e getActiveStanzaAtTime endurecidos)
- `src/services/api.js` — **modificado** (interceptor de resposta + tag isExpected)

Todo o resto é byte-a-byte o frontend original.
