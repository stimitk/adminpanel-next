"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import Link from "next/link";
import { demoEnabled, demoCredentials } from "../lib/demo-config";
import { useRouter } from "next/navigation";
import { api, errorText, setSession } from "../lib/api";
import { portal } from "../lib/portal";
import type { Profile, Session } from "../lib/types";
import { Form, Heading, Notice } from "./ui";

const AuthContext = createContext<{
  profile: Profile | null;
  login: (session: Session) => void;
  logout: () => void;
}>({ profile: null, login: () => {}, logout: () => {} });
export function useAuth() {
  return useContext(AuthContext);
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();
  function login(value: Session) {
    setSession(value);
    setProfile(value.profile);
  }
  function logout() {
    setSession(null);
    setProfile(null);
    router.replace("/login");
  }
  useEffect(() => {
    const expired = () => {
      setProfile(null);
      router.replace("/login");
    };
    window.addEventListener("kgamify:expired", expired);
    return () => window.removeEventListener("kgamify:expired", expired);
  }, [router]);
  return (
    <AuthContext.Provider value={{ profile, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<{
        teacher?: Profile;
        admin?: Profile;
        user?: Profile;
        tokens: { accessToken: string; refreshToken: string };
      }>(`/auth/${portal.kind === "teacher" ? "teacher" : "admin"}/login`, {
        method: "POST",
        public: true,
        body: {
          [portal.kind === "teacher" ? "identifier" : "username"]: String(
            data.get("identifier"),
          ).trim(),
          password: String(data.get("password")),
        },
      });
      const profile = result.teacher || result.admin || result.user;
      if (
        !profile ||
        !result.tokens?.accessToken ||
        !result.tokens?.refreshToken
      )
        throw new Error(
          "The sign-in response is incomplete. Please contact your administrator.",
        );
      if (
        portal.kind === "admin"
          ? profile.role !== "superadmin"
          : !["teacher", "superadmin"].includes(profile.role)
      )
        throw new Error("This account does not have access to this portal.");
      login({ profile, ...result.tokens });
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(
        next &&
          next.startsWith("/") &&
          !next.startsWith("//") &&
          !next.includes("\\")
          ? next
          : "/dashboard",
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page login-page">
      <div className="auth-box">
        <section className="auth-form" aria-labelledby="login-title">
          <div className="login-content">
            <h1 id="login-title">Welcome back.</h1>
            <p className="login-description">
              Sign in to your {portal.title.toLowerCase()}.
            </p>
            <form onSubmit={submit} aria-busy={busy}>
              {error && <Notice>{error}</Notice>}
              <div className="field">
                <label htmlFor="identifier">
                  {portal.kind === "teacher" ? "Email or username" : "Username"}
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  required
                  autoComplete="username"
                  placeholder={
                    portal.kind === "teacher"
                      ? "Enter your email or username"
                      : "Enter your username"
                  }
                  disabled={busy}
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </div>
              <div className="field">
                <div className="password-label">
                  <label htmlFor="password">Password</label>
                  <Link href="/forgot-password">Forgot password?</Link>
                </div>
                <div className="password-field">
                  <input
                    id="password"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    disabled={busy}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                    aria-controls="password"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {show && <path d="m3 3 18 18" />}
                    </svg>
                  </button>
                </div>
              </div>
              <button className="login-submit" type="submit" disabled={busy}>
                <span>{busy ? "Signing in…" : "Sign in"}</span>
                {!busy && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 12h16m-6-6 6 6-6 6" />
                  </svg>
                )}
              </button>
              {portal.kind === "teacher" && (
                <p className="login-signup">
                  New to kGamify? <Link href="/signup">Create an account</Link>
                </p>
              )}
            </form>
            {demoEnabled && (
              <details className="demo-credentials">
                <summary>Demo credentials</summary>
                <p>Sample data only. No backend account is required.</p>
                <dl>
                  <dt>{portal.kind === "teacher" ? "Email" : "Username"}</dt>
                  <dd>
                    <code>{demoCredentials[portal.kind].identifier}</code>
                  </dd>
                  <dt>Password</dt>
                  <dd>
                    <code>{demoCredentials[portal.kind].password}</code>
                  </dd>
                </dl>
              </details>
            )}
          </div>
          <p className="login-footer">kGamify · {portal.title}</p>
        </section>
        <aside className="auth-brand login-brand">
          <img src="/brand/KLOGO.png" alt="kGamify" width="180" height="180" />
          <div className="login-brand-copy">
            <p>
              {portal.kind === "teacher" ? (
                <>
                  Create.
                  <br />
                  Challenge.
                  <br />
                  Inspire.
                </>
              ) : (
                <>
                  One place.
                  <br />
                  Every championship.
                </>
              )}
            </p>
            <span>{portal.title}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

export function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="auth-page login-page signup-page">
      <div className="auth-box">
        <section className="auth-form" aria-labelledby="signup-title">
          <div className="login-content signup-content">
            <h1 id="signup-title">Create your account.</h1>
            <p className="login-description">
              Get started with Championship Maker.
            </p>
            <form onSubmit={(event) => event.preventDefault()}>
              <div className="signup-fields">
                <div className="field">
                  <label htmlFor="signup-name">Full name</label>
                  <input
                    id="signup-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-username">Username</label>
                  <input
                    id="signup-username"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Choose a username"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-email">Email address</label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@institution.edu"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-phone">Phone number</label>
                  <input
                    id="signup-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Your phone number"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-institute">Institute</label>
                  <input
                    id="signup-institute"
                    name="institute"
                    autoComplete="organization"
                    placeholder="Your institute"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-department">Department</label>
                  <input
                    id="signup-department"
                    name="department"
                    placeholder="Your department"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-password">Password</label>
                  <div className="password-field">
                    <input
                      id="signup-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="At least 8 characters"
                      required
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide passwords" : "Show passwords"
                      }
                      aria-pressed={showPassword}
                      aria-controls="signup-password signup-confirm-password"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        {showPassword && <path d="m3 3 18 18" />}
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="signup-confirm-password">
                    Confirm password
                  </label>
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Repeat your password"
                    required
                  />
                </div>
              </div>
              <p
                id="signup-availability"
                className="signup-availability"
                role="status"
              >
                Teacher registration is currently unavailable. Contact your
                administrator to request an account.
              </p>
              <button
                className="login-submit"
                type="submit"
                disabled
                aria-describedby="signup-availability"
              >
                Create account
              </button>
              <p className="login-signup">
                Already have an account? <Link href="/login">Sign in</Link>
              </p>
            </form>
          </div>
          <p className="login-footer">kGamify · Championship Maker</p>
        </section>
        <aside className="auth-brand login-brand">
          <img src="/brand/KLOGO.png" alt="kGamify" width="180" height="180" />
          <div className="login-brand-copy">
            <p>
              Create.
              <br />
              Challenge.
              <br />
              Inspire.
            </p>
            <span>Championship Maker</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);
  return (
    <main className="auth-page">
      <section className="recovery-box">
        <Link href="/login">Back to login</Link>
        <Heading
          title={reset ? "Reset Password" : "Forgot Password"}
          description={
            reset
              ? "Choose a new password for your account."
              : "Request a password reset link by email."
          }
        />
        <Form
          key={token || "recovery"}
          fields={
            reset
              ? [
                  {
                    name: "token",
                    label: "Reset token",
                    required: true,
                    value: token,
                  },
                  {
                    name: "newPassword",
                    label: "New password",
                    type: "password",
                    required: true,
                    minLength: 8,
                  },
                  {
                    name: "confirmPassword",
                    label: "Confirm password",
                    type: "password",
                    required: true,
                    minLength: 8,
                  },
                ]
              : [
                  {
                    name: "email",
                    label: "Email",
                    type: "email",
                    required: true,
                  },
                ]
          }
          submitLabel={reset ? "Reset password" : "Send reset link"}
          onSubmit={async (values) => {
            if (reset) {
              if (values.newPassword !== values.confirmPassword)
                throw new Error("Passwords do not match.");
              await api("/auth/reset-password", {
                method: "POST",
                public: true,
                body: { token: values.token, newPassword: values.newPassword },
              });
            } else
              await api("/auth/forgot-password", {
                method: "POST",
                public: true,
                body: {
                  email: values.email,
                  role: portal.kind === "teacher" ? "teacher" : "admin",
                },
              });
          }}
        />
        <p className="muted">
          {reset
            ? "Return to login after resetting your password."
            : "If the account exists, reset instructions will be sent to its email address."}
        </p>
      </section>
    </main>
  );
}
