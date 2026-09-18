import axios from 'axios';
import { supabase } from './supabase';
import { goToAppRoute } from '../utils/appPath';

const DEFAULT_PRODUCTION_API_URL = 'https://lenavs-backend-1-gv24.onrender.com';
const RUNTIME_OVERRIDE_KEY = 'LENAVS_API_URL';
const PROBE_TIMEOUT_MS = 4000;

const normalizeBase = (value) => String(value || '').trim().replace(/\/+$/, '');

const isLocalHostname = (hostname = '') => /^(localhost|127\.0\.0\.1)$/i.test(String(hostname || '').trim());

const getRuntimeOverrideBase = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeBase(window.__LENAVS_API_URL__)
    || normalizeBase(window.localStorage?.getItem(RUNTIME_OVERRIDE_KEY));
};

const deriveBaseFromHostname = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const { origin, hostname, protocol } = window.location;

  if (isLocalHostname(hostname)) {
    return 'http://localhost:10000';
  }

  if (/onrender\.com$/i.test(hostname)) {
    return `${protocol}//${hostname.replace(/frontend/gi, 'backend')}`;
  }

  return '';
};

// Resolução FIXA e determinística (sem sondagem de rede por requisição).
// A sondagem por request era a causa do HTTP 504 no login: cada chamada
// disparava 2 fetch's sem timeout contra o backend dormindo, travando tudo.
const pickInitialBase = () =>
  normalizeBase(import.meta.env.VITE_API_URL)
  || normalizeBase(getRuntimeOverrideBase())
  || normalizeBase(deriveBaseFromHostname())
  || (import.meta.env.MODE === 'production'
    ? DEFAULT_PRODUCTION_API_URL
    : 'http://localhost:10000');

let activeBase = pickInitialBase();

// Único probe com timeout curto, em segundo plano, apenas para avisar no
// console se o backend estiver fora do ar. Nunca bloqueia nem redireciona.
const warmProbe = async () => {
  if (typeof fetch === 'undefined') {
    return;
  }

  const probe = async (path) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(`${activeBase}${path}`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    if (await probe('/api/legal/privacy-policy')) {
      return;
    }
    await probe('/health');
  } catch {
    // silencioso
  }
};

if (typeof window !== 'undefined') {
  warmProbe();
}

const api = axios.create({
  baseURL: `${activeBase}/api`,
  withCredentials: false,
  timeout: 900000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (session?.access_token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${session.access_token}`,
        };
      }
    } catch (error) {
      console.error('Erro ao preparar requisição da API:', error);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const message = String(error.response?.data?.error || '').toLowerCase();
    const backendPayload = error.response?.data || {};
    const backendCode = String(backendPayload.code || '').toLowerCase();

    // Falha do Supabase (402 / quota / spend cap / restricted due to):
    // NÃO deslogar o usuário — o problema é a cota do projeto, não a sessão.
    const isQuota = (
      status === 402
      || backendCode === 'storage_quota_exceeded'
      || backendCode === 'supabase_restricted'
      || backendCode === 'billing_restricted'
      || /exceed_storage_size_quota|exceed storage size|storage quota|restricted due to|spend cap|plan upgrade/i.test(message)
    );

    if (isQuota) {
      return Promise.reject(error);
    }

    // Só desloga em mensagens EXPLÍCITAS de sessão inválida; nunca apaga
    // preferências nem o override de URL do localStorage.
    const explicitlyInvalidSession =
      (status === 401 || status === 403) && (
        message.includes('sessão inválida')
        || message.includes('sessao invalida')
        || message.includes('token inválido')
        || message.includes('token invalido')
        || message.includes('expirada')
      );

    if (explicitlyInvalidSession) {
      console.warn('Sessão explicitamente inválida. Limpando sessão local do Supabase...');

      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.warn('Falha ao encerrar sessão Supabase:', signOutError?.message);
      }

      try {
        const sessionKeys = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
            sessionKeys.push(key);
          }
        }
        sessionKeys.forEach((key) => window.localStorage.removeItem(key));
      } catch (lsError) {
        console.warn('Não foi possível limpar apenas as chaves de sessão:', lsError?.message);
      }

      if (typeof window !== 'undefined' && window.location && !window.location.hash?.includes('/login')) {
        try { goToAppRoute('/login'); } catch (_) {}
      }
    }

    return Promise.reject(error);
  }
);

export const getApiBaseUrl = async () => activeBase;

export default api;
