import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useOAT } from "../../oat/react/index.js";

const GOOGLE_IDENTITY_SCRIPT_ID = "lingop-google-identity-services";
const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID =
  "282731122867-44foqiia4t7716eno00trg1s54519egf.apps.googleusercontent.com";
const CAMP_LINGO_ICON_URL =
  "https://camplingo.com/camplingo/favicon/favicon-96x96.png";

type AuthErrorLike = { message?: string } | string | null | undefined;
type AuthResult = Promise<{ error?: AuthErrorLike }>;

export type CampLingoAuthSupabaseClient = {
  auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): AuthResult;
    signUp(credentials: { email: string; password: string }): AuthResult;
    signInWithIdToken(credentials: {
      provider: "google";
      token: string;
    }): AuthResult;
  };
};

type GoogleCredentialResponse = {
  credential?: string;
};

export type CampLingoGoogleButtonTheme =
  | "outline"
  | "filled_blue"
  | "filled_black"
  | "outline_dark";

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          theme: CampLingoGoogleButtonTheme;
          size: "large";
          shape: "rectangular";
          width: number;
        },
      ): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
    __NEXT_DATA__?: { page?: string };
  }
}

let googleIdentityScriptPromise: Promise<GoogleIdentityServices> | null = null;

function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Identity Services requires a browser."));
  }
  if (window.google) return Promise.resolve(window.google);
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const handleLoad = () => {
      if (window.google) {
        resolve(window.google);
        return;
      }
      googleIdentityScriptPromise = null;
      reject(new Error("Google Identity Services loaded without its browser API."));
    };
    const handleError = () => {
      googleIdentityScriptPromise = null;
      reject(new Error("Unable to load Google Identity Services."));
    };

    const existingScript = document.getElementById(
      GOOGLE_IDENTITY_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
}

export enum CampLingoAuthFormMode {
  LOG_IN = "Log in",
  SIGN_UP = "Sign up",
}

export type CampLingoAuthFormProps = {
  supabaseClient: CampLingoAuthSupabaseClient;
  guiLang: string;
  initialMode?: CampLingoAuthFormMode;
  onSuccessfulAuth?: (authMode: CampLingoAuthFormMode) => void;
  hideLoginSignupModeSwitcher?: boolean;
  /** Temporarily used by legacy OA/OS consumers that disable Google auth. */
  isGoogleAuthVisible?: boolean;
  /** Uses one of Google Identity Services' native button themes. */
  googleButtonTheme?: CampLingoGoogleButtonTheme;
  className?: string;
};

function authErrorMessage(error: AuthErrorLike): string {
  if (typeof error === "string") return error;
  return error?.message || String(error || "Unknown error");
}

function isClassicCampLingoLocation(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "classic.camplingo.com" ||
    // Retains the same reset-link behavior when Classic is run under this
    // monorepo's internal route (including localhost development).
    window.location.pathname.startsWith("/cl-learn-cefr") ||
    window.__NEXT_DATA__?.page?.startsWith("/cl-learn-cefr") === true
  );
}

function forgotPasswordURL(guiLang: string, email: string): string {
  const normalizedGuiLang = guiLang.toLowerCase() || "en";
  const url = new URL(
    `https://camplingo.com/${encodeURIComponent(normalizedGuiLang)}/auth/forgot-password`,
  );
  if (isClassicCampLingoLocation()) url.searchParams.set("app", "classic");
  if (email) url.searchParams.set("email", email);
  return url.toString();
}

function FieldIcon({ type }: { type: "email" | "password" }) {
  return type === "email" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5.5h18v13H3zM4 7l8 6 8-6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15 12v2" />
    </svg>
  );
}

/**
 * Camp Lingo's shared browser login/signup form.
 *
 * The consumer supplies its browser-configured Supabase client and current GUI
 * language. Lingop owns the common Camp Lingo branding, auth behavior, OAT
 * source strings, and Google Identity Services integration.
 */
export function CampLingoAuthForm({
  supabaseClient,
  guiLang,
  initialMode = CampLingoAuthFormMode.LOG_IN,
  onSuccessfulAuth,
  hideLoginSignupModeSwitcher = false,
  isGoogleAuthVisible = true,
  googleButtonTheme = "outline",
  className,
}: CampLingoAuthFormProps) {
  const { OAT } = useOAT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<CampLingoAuthFormMode>(initialMode);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  const onSuccessfulAuthRef = useRef(onSuccessfulAuth);

  const mainLabel =
    mode === CampLingoAuthFormMode.LOG_IN ? OAT("Log in") : OAT("Sign up");
  const oppositeModeLabel =
    mode === CampLingoAuthFormMode.LOG_IN ? OAT("Sign up") : OAT("Log in");
  const resetPasswordURL = useMemo(
    () => forgotPasswordURL(guiLang, email),
    [guiLang, email],
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    onSuccessfulAuthRef.current = onSuccessfulAuth;
  }, [onSuccessfulAuth]);

  // Forces No-Focus Initially
  useEffect(() => {
    emailInputRef.current?.blur();
  }, []);

  useEffect(() => {
    if (!isGoogleAuthVisible || !googleButtonRef.current) return;

    let cancelled = false;
    const button = googleButtonRef.current;
    void loadGoogleIdentityServices()
      .then((google) => {
        if (cancelled) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (!response.credential) return;
            setLoading(true);
            setErrorMessage("");
            void supabaseClient.auth
              .signInWithIdToken({
                provider: "google",
                token: response.credential,
              })
              .then(({ error }) => {
                if (error) {
                  console.error("Continue-with-Google Error:", error);
                  setErrorMessage(authErrorMessage(error));
                  return;
                }
                onSuccessfulAuthRef.current?.(modeRef.current);
              })
              .catch((error: unknown) => {
                console.error("Continue-with-Google Error:", error);
                setErrorMessage(authErrorMessage(error as AuthErrorLike));
              })
              .finally(() => setLoading(false));
          },
        });
        button.replaceChildren();
        google.accounts.id.renderButton(button, {
          theme: googleButtonTheme,
          size: "large",
          shape: "rectangular",
          width: 320,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Google Identity Services Error:", error);
        setErrorMessage(authErrorMessage(error as AuthErrorLike));
      });

    return () => {
      cancelled = true;
      button.replaceChildren();
    };
  }, [googleButtonTheme, isGoogleAuthVisible, supabaseClient]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (
      mode === CampLingoAuthFormMode.SIGN_UP &&
      password !== confirmPassword
    ) {
      setErrorMessage(OAT("Passwords do not match."));
      return;
    }

    setLoading(true);
    try {
      const { error } =
        mode === CampLingoAuthFormMode.LOG_IN
          ? await supabaseClient.auth.signInWithPassword({ email, password })
          : await supabaseClient.auth.signUp({ email, password });

      if (error) {
        let message = authErrorMessage(error);
        if (message === "Invalid login credentials") {
          message = OAT(
            "Sorry, that email-password pair didn't match any of our records. Please try again with different details.",
          );
        }
        if (message === "Password should be at least 6 characters") {
          message = OAT("Password must be at least 6 characters.");
        }
        setErrorMessage(message);
        return;
      }

      onSuccessfulAuth?.(mode);
      // NOTE: Stripe-Customer-Existence takes a while for stripe.customers.search to recognize (30s+) - e.g. for checking subscriptions.
      // NOTE: Historically, for OA/OS: This will navigate to /os/index.tsx with 'from=signup' var, which causes /os/index.tsx's getServerSideProps to trigger '@/utils/serverOnly/createNewUserAssets'.
    } catch (error) {
      setErrorMessage(authErrorMessage(error as AuthErrorLike));
    } finally {
      setLoading(false);
    }
  }

  const rootClassName = ["lingop-camp-lingo-auth-form", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClassName} aria-busy={loading || undefined}>
      <div className="lingop-camp-lingo-auth-form__brand">
        <span>Camp Lingo</span>
        <img src={CAMP_LINGO_ICON_URL} alt="Camp Lingo Icon" />
      </div>
      <h1>{mainLabel}</h1>

      {isGoogleAuthVisible && (
        <>
          <div
            ref={googleButtonRef}
            className="lingop-camp-lingo-auth-form__google"
          />
          <div className="lingop-camp-lingo-auth-form__separator">
            <span />
            <small>{OAT("or")}</small>
            <span />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <label className="lingop-camp-lingo-auth-form__field">
          <span className="lingop-camp-lingo-auth-form__field-icon">
            <FieldIcon type="email" />
          </span>
          <span className="lingop-camp-lingo-auth-form__visually-hidden">
            {OAT("Email")}
          </span>
          <input
            ref={emailInputRef}
            name="email"
            type="email"
            autoComplete="username"
            placeholder={OAT("Email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="lingop-camp-lingo-auth-form__field">
          <span className="lingop-camp-lingo-auth-form__field-icon">
            <FieldIcon type="password" />
          </span>
          <span className="lingop-camp-lingo-auth-form__visually-hidden">
            {OAT("Password")}
          </span>
          <input
            name="password"
            type="password"
            autoComplete={
              mode === CampLingoAuthFormMode.LOG_IN
                ? "current-password"
                : "new-password"
            }
            placeholder={OAT("Password")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </label>

        {mode === CampLingoAuthFormMode.LOG_IN && (
          <a
            className="lingop-camp-lingo-auth-form__forgot-password"
            href={resetPasswordURL}
          >
            {OAT("Forgot Password")}
          </a>
        )}

        {mode === CampLingoAuthFormMode.SIGN_UP && (
          <label className="lingop-camp-lingo-auth-form__field">
            <span className="lingop-camp-lingo-auth-form__field-icon">
              <FieldIcon type="password" />
            </span>
            <span className="lingop-camp-lingo-auth-form__visually-hidden">
              {OAT("Re-Type Password")}
            </span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder={OAT("Re-Type Password")}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>
        )}

        {errorMessage && (
          <p className="lingop-camp-lingo-auth-form__error" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          className="lingop-camp-lingo-auth-form__submit"
          type="submit"
          disabled={loading || !email || !password}
        >
          {loading && <span className="lingop-camp-lingo-auth-form__spinner" />}
          {mainLabel}
        </button>

        {!hideLoginSignupModeSwitcher && (
          <p className="lingop-camp-lingo-auth-form__mode-switcher">
            <span>
              {mode === CampLingoAuthFormMode.LOG_IN
                ? OAT("Don't have an account?")
                : OAT("Already have an account?")}
            </span>{" "}
            <button
              type="button"
              onClick={() =>
                setMode(
                  mode === CampLingoAuthFormMode.LOG_IN
                    ? CampLingoAuthFormMode.SIGN_UP
                    : CampLingoAuthFormMode.LOG_IN,
                )
              }
            >
              {oppositeModeLabel}
            </button>
          </p>
        )}
      </form>
    </section>
  );
}
