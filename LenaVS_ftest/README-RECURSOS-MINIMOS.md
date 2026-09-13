# LenaVS Frontend — instalação e build

## 1) Instalar e buildar
```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_API_URL
npm run build          # gera a pasta dist/ — suba como site estático (Netlify/Vercel/Render)
```

## 2) O que foi alterado para não sobrecarregar o servidor (1vCPU/2GB)
- **Polling de exportação com backoff exponencial**: em vez de consultar o status do
  vídeo a cada 1,5s fixo, o app agora espera 3s → 4s → 5,5s → … (teto de 15s entre
  tentativas). O servidor recebe uma fração das requisições durante a renderização.
- Sem realtime/polling contínuo: a sincronização de projeto é salva manualmente pelo
  usuário (e antes de exportar), não em autosave agressivo.

## 3) Deploy rápido
- Netlify/Vercel: apontar build command `npm run build` e pasta `dist`.
- Se usar API em Render, adicione o frontend em `ALLOWED_ORIGINS` do backend.
