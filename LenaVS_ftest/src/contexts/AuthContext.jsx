import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { hasSupabaseConfig, supabase } from '../services/supabase';
import api from '../services/api';
const AuthContext = createContext(null);
const AUTH_BOOT_TIMEOUT_MS = 5000;
const getAuthCallbackParams = () => {
  if (typeof window === 'undefined') {
    return {
      accessToken: null,
      refreshToken: null,
      code: null,
      tokenHash: null,
      type: null,
    };
  }
  const hash = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(
    window.location.search || ''
  );
  return {
    accessToken: hashParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token'),
    code: searchParams.get('code'),
    tokenHash: searchParams.get('token_hash'),
    type: searchParams.get('type'),
  };
};
const hasSupabaseAuthCallback = () => {
  const {
    accessToken,
    refreshToken,
    code,
    tokenHash,
  } = getAuthCallbackParams();
  return Boolean(
    (accessToken && refreshToken) ||
    code ||
    tokenHash
  );
};
const redirectToEditorAfterAuthCallback = () => {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '/editor';
  window.location.replace(url.toString());
};
const getEmailRedirectUrl = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
};
const withTimeout = async (
  promise,
  timeoutMs,
  fallbackValue,
  timeoutMessage
) => {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      if (timeoutMessage) {
        console.warn(timeoutMessage);
      }
      resolve(fallbackValue);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      promise,
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};
const parseDateOrNull = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
};
const normalizeDisplayName = (value) => {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
};
const getSafeAuthMessage = (error, context = 'login') => {
  const payload = error?.response?.data || {};
  const code = String(
    payload.code ||
    error?.code ||
    ''
  ).toLowerCase();
  const rawMessage = String(
    payload.error ||
    payload.message ||
    error?.message ||
    ''
  );

  if (
    context === 'login' &&
    (
      code === 'invalid_login_credentials' ||
      /invalid login credentials|invalid credentials|invalid password|password is incorrect/i.test(rawMessage)
    )
  ) {
    return 'senha incorreta';
  }

  if (code === 'email_not_confirmed' || /email not confirmed/i.test(rawMessage)) {
    return 'Confirme seu e-mail antes de entrar.';
  }

  if (code === 'invalid_email') {
    return 'Digite um e-mail válido.';
  }

  if (code === 'password_required') {
    return 'Digite sua senha.';
  }

  if (rawMessage) {
    return rawMessage;
  }

  return context === 'login'
    ? 'Não foi possível fazer login. Tente novamente.'
    : 'Não foi possível concluir a autenticação. Tente novamente.';
};
const deriveProfileFromSessionUser = (sessionUser) => {
  const metadata = sessionUser?.user_metadata || {};
  const displayName =
    normalizeDisplayName(metadata.display_name) ||
    normalizeDisplayName(metadata.full_name) ||
    normalizeDisplayName(metadata.name) ||
    '';
  const avatarUrl =
    String(
      metadata.avatar_url ||
      metadata.picture ||
      metadata.photo_url ||
      ''
    ).trim() || null;
  return {
    displayName,
    avatarUrl,
    email: sessionUser?.email || null,
  };
};
const EmailConfirmationNotice = ({
  email,
  onClose,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        width: 'min(360px, calc(100vw - 40px))',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px',
        border: '1px solid #e9e3f5',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        boxShadow: '0 8px 28px rgba(30, 20, 55, 0.12)',
        color: '#2d2640',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: '30px',
          height: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          backgroundColor: '#f3edff',
          color: '#7651c9',
          fontSize: '16px',
          lineHeight: 1,
        }}
      >
        ✓
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <strong
          style={{
            display: 'block',
            marginBottom: '4px',
            fontSize: '14px',
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          Confirme seu e-mail
        </strong>
        <span
          style={{
            display: 'block',
            color: '#6f687e',
            fontSize: '13px',
            lineHeight: 1.5,
            overflowWrap: 'anywhere',
          }}
        >
          Enviamos um link para{' '}
          <strong
            style={{
              color: '#4f4563',
              fontWeight: 600,
            }}
          >
            {email || 'seu e-mail'}
          </strong>
          . Verifique sua caixa de entrada.
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        style={{
          flexShrink: 0,
          width: '24px',
          height: '24px',
          margin: '-2px -4px 0 0',
          padding: 0,
          border: 0,
          background: 'transparent',
          color: '#9a93a8',
          cursor: 'pointer',
          fontSize: '20px',
          fontWeight: 400,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
};
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [plan, setPlan] = useState('free');
  const [subscriptionStatus, setSubscriptionStatus] =
    useState('inactive');
  const [unlimitedUntil, setUnlimitedUntil] =
    useState(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [emailConfirmationNotice, setEmailConfirmationNotice] =
    useState(null);
  const sessionRef = useRef(null);
  const resetLocalUserState = () => {
    setCredits(0);
    setPlan('free');
    setSubscriptionStatus('inactive');
    setUnlimitedUntil(null);
    setDisplayName('');
    setAvatarUrl(null);
    setUserEmail(null);
  };
  const applyUserSnapshot = (
    data,
    fallbackUser = null
  ) => {
    const fallbackProfile =
      deriveProfileFromSessionUser(fallbackUser);
    setCredits(data?.credits ?? 0);
    setPlan(
      data?.plan ?? 'free'
    );
    setSubscriptionStatus(
      data?.subscription_status ?? 'inactive'
    );
    setUnlimitedUntil(
      data?.unlimited_access_until ?? null
    );
    setDisplayName(
      normalizeDisplayName(data?.display_name) ||
      fallbackProfile.displayName ||
      ''
    );
    setAvatarUrl(
      String(data?.avatar_url || '').trim() ||
      fallbackProfile.avatarUrl ||
      null
    );
    setUserEmail(
      data?.email ||
      fallbackProfile.email ||
      null
    );
    return data ?? null;
  };
  const fetchUserData = async (
    userId,
    fallbackUser = session?.user ?? null
  ) => {
    try {
      if (!userId || !hasSupabaseConfig) {
        resetLocalUserState();
        return null;
      }
      try {
        const backendResponse = await withTimeout(
          api.get('/user/me'),
          AUTH_BOOT_TIMEOUT_MS,
          null,
          'Timeout ao buscar dados do usuário no backend. Tentando fallback direto no Supabase.'
        );
        if (backendResponse?.data) {
          return applyUserSnapshot(
            backendResponse.data,
            fallbackUser
          );
        }
      } catch (backendError) {
        console.warn(
          'Falha ao sincronizar usuário pelo backend. Usando fallback do Supabase:',
          backendError?.response?.data?.error ||
          backendError?.message
        );
      }
      const { data, error } = await withTimeout(
        supabase
          .from('users')
          .select(
            'credits, plan, subscription_status, unlimited_access_until'
          )
          .eq('id', userId)
          .maybeSingle(),
        AUTH_BOOT_TIMEOUT_MS,
        {
          data: null,
          error: new Error(
            'Timeout ao buscar dados do usuário.'
          ),
        },
        'Timeout ao buscar dados do usuário no Supabase. Seguindo com plano free.'
      );
      if (error) {
        console.warn(
          'Erro ao buscar dados do usuário:',
          error.message
        );
        resetLocalUserState();
        return null;
      }
      return applyUserSnapshot(
        data,
        fallbackUser
      );
    } catch (error) {
      console.error(
        'Erro inesperado ao buscar dados do usuário:',
        error
      );
      resetLocalUserState();
      return null;
    }
  };
  const refreshCredits = async () => {
    const userId = session?.user?.id;
    if (!userId) {
      return null;
    }
    return fetchUserData(
      userId,
      session?.user ?? null
    );
  };
  const updateProfile = async ({
    displayName: nextDisplayName,
    avatarFile = null,
    removeAvatar = false,
  } = {}) => {
    const normalizedDisplayName =
      normalizeDisplayName(nextDisplayName);
    const formData = new FormData();
    formData.append(
      'name',
      normalizedDisplayName
    );
    if (avatarFile) {
      formData.append(
        'avatar',
        avatarFile
      );
    }
    if (removeAvatar) {
      formData.append(
        'removeAvatar',
        'true'
      );
    }
    const { data } = await api.put(
      '/user/profile',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    applyUserSnapshot(
      data,
      session?.user ?? null
    );
    return data;
  };
  useEffect(() => {
    let isMounted = true;
    const cameFromSupabaseAuthCallback =
      hasSupabaseAuthCallback();
    let callbackRedirectHandled = false;
    const getCurrentSession = async () => {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_BOOT_TIMEOUT_MS,
        {
          data: {
            session: null,
          },
          error: new Error(
            'Timeout ao recuperar a sessão.'
          ),
        },
        'Timeout ao recuperar sessão do Supabase. Liberando a interface para evitar tela infinita de carregamento.'
      );
      if (error) {
        console.error(
          'Erro ao recuperar sessão:',
          error.message
        );
      }
      return data?.session ?? null;
    };
    const restoreSessionFromCallback = async () => {
      let currentSession = await getCurrentSession();
      if (currentSession) {
        return currentSession;
      }
      const {
        accessToken,
        refreshToken,
        code,
        tokenHash,
        type,
      } = getAuthCallbackParams();
      if (accessToken && refreshToken) {
        try {
          const { data, error } = await withTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            AUTH_BOOT_TIMEOUT_MS,
            {
              data: {
                session: null,
              },
              error: new Error(
                'Timeout ao restaurar a sessão pelo link de confirmação.'
              ),
            },
            'Timeout ao restaurar a sessão recebida pelo link de confirmação.'
          );
          if (!error && data?.session) {
            return data.session;
          }
          if (error) {
            console.warn(
              'Não foi possível restaurar a sessão pelos tokens do link:',
              error.message
            );
          }
        } catch (error) {
          console.warn(
            'Erro ao restaurar a sessão pelos tokens do link:',
            error?.message
          );
        }
      }
      if (code) {
        try {
          const { data, error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            AUTH_BOOT_TIMEOUT_MS,
            {
              data: {
                session: null,
              },
              error: new Error(
                'Timeout ao trocar o código de confirmação.'
              ),
            },
            'Timeout ao trocar o código recebido pelo link de confirmação.'
          );
          if (!error && data?.session) {
            return data.session;
          }
          if (error) {
            console.warn(
              'Não foi possível trocar o código de confirmação:',
              error.message
            );
          }
        } catch (error) {
          console.warn(
            'Erro ao trocar o código de confirmação:',
            error?.message
          );
        }
      }
      if (tokenHash) {
        const allowedTypes = [
          'signup',
          'invite',
          'recovery',
          'email_change',
          'email',
        ];
        const verificationType =
          allowedTypes.includes(type)
            ? type
            : 'signup';
        try {
          const { data, error } = await withTimeout(
            supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: verificationType,
            }),
            AUTH_BOOT_TIMEOUT_MS,
            {
              data: {
                session: null,
              },
              error: new Error(
                'Timeout ao validar o link de confirmação.'
              ),
            },
            'Timeout ao validar o link recebido por e-mail.'
          );
          if (!error && data?.session) {
            return data.session;
          }
          if (error) {
            console.warn(
              'Não foi possível validar o link de confirmação:',
              error.message
            );
          }
        } catch (error) {
          console.warn(
            'Erro ao validar o link de confirmação:',
            error?.message
          );
        }
      }
      currentSession = await getCurrentSession();
      return currentSession;
    };
    const initializeAuth = async () => {
      try {
        if (!hasSupabaseConfig) {
          if (isMounted) {
            setSession(null);
            resetLocalUserState();
          }
          return;
        }
        const currentSession =
          cameFromSupabaseAuthCallback
            ? await restoreSessionFromCallback()
            : await getCurrentSession();
        if (!isMounted) {
          return;
        }
        sessionRef.current = currentSession;
        setSession(currentSession);
        if (currentSession?.user) {
          await fetchUserData(
            currentSession.user.id,
            currentSession.user
          );
          if (
            cameFromSupabaseAuthCallback &&
            !callbackRedirectHandled
          ) {
            callbackRedirectHandled = true;
            redirectToEditorAfterAuthCallback();
          }
        } else {
          resetLocalUserState();
        }
      } catch (error) {
        console.error(
          'Erro inesperado ao inicializar autenticação:',
          error
        );
        if (isMounted) {
          sessionRef.current = null;
          setSession(null);
          resetLocalUserState();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) {
          return;
        }
        const nextSession = newSession ?? null;
        sessionRef.current = nextSession;
        setSession(nextSession);
        if (nextSession?.user) {
          const fallbackProfile =
            deriveProfileFromSessionUser(
              nextSession.user
            );
          setDisplayName(
            fallbackProfile.displayName || ''
          );
          setAvatarUrl(
            fallbackProfile.avatarUrl || null
          );
          setUserEmail(
            fallbackProfile.email || null
          );
          void fetchUserData(
            nextSession.user.id,
            nextSession.user
          );
          const canRedirectFromAuthCallback =
            event === 'SIGNED_IN' ||
            event === 'INITIAL_SESSION' ||
            event === 'TOKEN_REFRESHED';
          if (
            cameFromSupabaseAuthCallback &&
            canRedirectFromAuthCallback &&
            !callbackRedirectHandled
          ) {
            callbackRedirectHandled = true;
            redirectToEditorAfterAuthCallback();
          }
        } else {
          resetLocalUserState();
        }
      }
    );
    void initializeAuth();
    const handleVisibility = () => {
      const currentSession =
        sessionRef.current;
      if (
        document.visibilityState === 'visible' &&
        currentSession?.user?.id
      ) {
        void fetchUserData(
          currentSession.user.id,
          currentSession.user
        );
      }
    };
    document.addEventListener(
      'visibilitychange',
      handleVisibility
    );
    return () => {
      isMounted = false;
      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      );
      listener?.subscription
        ?.unsubscribe?.();
    };
  }, []);
  const signUp = async (
    email,
    password,
    name,
    countryCode = 'BR',
    acceptedLegal = false
  ) => {
    const normalizedEmail =
      String(email || '')
        .trim()
        .toLowerCase();
    const normalizedName =
      String(name || '').trim();
    const normalizedCountryCode =
      String(countryCode || 'BR')
        .trim()
        .toUpperCase();
    const normalizedCountryGroup =
      normalizedCountryCode === 'BR'
        ? 'BR'
        : 'INTL';
    const preferredCurrency =
      normalizedCountryGroup === 'BR'
        ? 'BRL'
        : 'USD';
    const countryLabelMap = {
      BR: 'Brasil',
      US: 'Estados Unidos',
      CA: 'Canadá',
      AU: 'Austrália',
      NZ: 'Nova Zelândia',
      SG: 'Singapura',
      HK: 'Hong Kong',
      OTHER: 'Outros',
    };
    const selectedCountryLabel =
      countryLabelMap[normalizedCountryCode] ||
      'Outros';
    if (!acceptedLegal) {
      throw new Error(
        'Você precisa aceitar os termos de uso e a política de privacidade para criar a conta.'
      );
    }
    const acceptedAt =
      new Date().toISOString();
    const { error } =
      await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: normalizedName,
            full_name: normalizedName,
            display_name: normalizedName,
            country_group:
              normalizedCountryGroup,
            country:
              normalizedCountryCode,
            country_code:
              normalizedCountryCode,
            country_label:
              selectedCountryLabel,
            preferred_currency:
              preferredCurrency,
            accepted_legal_terms:
              true,
            legal_acceptance_at:
              acceptedAt,
            privacy_policy_version:
              '2026-06',
          },
          emailRedirectTo:
            getEmailRedirectUrl(),
        },
      });
    if (error) {
      throw error;
    }
    setEmailConfirmationNotice({
      email: normalizedEmail,
    });
  };
  const signIn = async (
    email,
    password
  ) => {
    const normalizedEmail =
      String(email || '')
        .trim()
        .toLowerCase();
    const { data } = await api.post('/auth/login', {
      email: normalizedEmail,
      password,
    });
    const returnedSession = data?.session || null;

    if (returnedSession) {
      const { error: sessionError } =
        await supabase.auth.setSession(returnedSession);
      if (sessionError) {
        throw sessionError;
      }
    }

    setEmailConfirmationNotice(null);
    if (returnedSession) {
      sessionRef.current =
        returnedSession;
      setSession(
        returnedSession
      );
      await fetchUserData(
        returnedSession.user.id,
        returnedSession.user
      );
    }
    return returnedSession;
  };
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn(
        'Falha ao encerrar sessão do Supabase:',
        error?.message
      );
    }
    sessionRef.current = null;
    setSession(null);
    resetLocalUserState();
  };
  const hasUnlimitedAccess = useMemo(() => {
    const untilDate =
      parseDateOrNull(unlimitedUntil);
    if (untilDate) {
      return untilDate.getTime() > Date.now();
    }
    return (
      plan === 'pro' &&
      subscriptionStatus === 'active'
    );
  }, [
    plan,
    subscriptionStatus,
    unlimitedUntil,
  ]);
  const creditsLabel =
    hasUnlimitedAccess
      ? 'unlimited'
      : Math.max(
          0,
          Number(credits) || 0
        );
  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session),
        loading,
        credits,
        creditsLabel,
        plan,
        subscriptionStatus,
        unlimitedUntil,
        hasUnlimitedAccess,
        displayName,
        avatarUrl,
        userEmail,
        signUp,
        signIn,
        signOut,
        refreshCredits,
        updateProfile,
         getSafeAuthMessage,
      }}
    >
      {children}
      {emailConfirmationNotice && (
        <EmailConfirmationNotice
          email={emailConfirmationNotice.email}
          onClose={() => {
            setEmailConfirmationNotice(null);
          }}
        />
      )}
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  return useContext(AuthContext);
};
