import React, { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  ShieldPlus,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { SAMPLE_STAFF_CREDENTIALS } from "../data/seedData";
import firebaseConfig from "../../firebase-applet-config.json";

const FIREBASE_AUTH_PROVIDERS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

export function LoginView() {
  const {
    authLoading,
    accessDeniedEmail,
    loginWithGoogle,
    loginWithEmailPassword,
    logout,
  } = useHospital();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [needsProviderEnable, setNeedsProviderEnable] = useState(false);
  const [showSampleDirectory, setShowSampleDirectory] = useState(true);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setNeedsProviderEnable(false);
    setSubmitting(true);
    try {
      const result = await loginWithEmailPassword(identifier, password);
      if (!result.ok) {
        setLoginError(result.error || "Invalid credentials.");
        setNeedsProviderEnable(Boolean(result.needsProviderEnable));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function fillSampleAccount(email: string, pass: string) {
    setIdentifier(email);
    setPassword(pass);
    setLoginError(null);
    setNeedsProviderEnable(false);
  }

  return (
    <div className="min-h-screen ambient-canvas text-slate-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 mx-auto">
            <ShieldPlus className="w-6 h-6 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 font-display">
            MedCore AI
          </h1>
          <p className="text-sm text-slate-400">
            Smart Hospital & Emergency Operations Platform
          </p>
        </div>

        {/* Main Auth Card — STRICTLY NO designation/role selector */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-7 space-y-6">
          {authLoading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-100">
                  Verifying hospital credentials
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Fetching your assigned clinical workspace from database...
                </p>
              </div>
            </div>
          ) : accessDeniedEmail ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-950/30 border border-amber-800/60">
                <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h2 className="text-sm font-semibold text-amber-200">
                    Staff Profile Not Linked Yet
                  </h2>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    The signed-in account{" "}
                    <span className="font-mono text-amber-100">{accessDeniedEmail}</span> is not
                    registered in the hospital staff directory yet. Ask your Hospital Administrator
                    to assign your email a role — or if this is your first launch, sign in once as{" "}
                    <span className="font-mono text-amber-100">admin@medcore.org</span> (or your
                    Google Admin account) to initialize the database directory.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm font-medium text-slate-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign out and switch account
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-100">
                  Hospital Staff Sign In
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sign in with your hospital Email ID & Password or Google account. Your role and
                  shift permissions are fetched directly from the database.
                </p>
              </div>

              {/* Manual Email ID / Staff ID + Password Form (NO designation selector) */}
              <form onSubmit={handleManualSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="medcore-email-id"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Staff Email ID or Staff ID
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="medcore-email-id"
                      type="text"
                      required
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="doctor@medcore.org or DOC-02"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="medcore-password"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="medcore-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter staff password"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-900/70 space-y-2">
                    <div className="flex items-start gap-2 text-xs text-red-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                      <span>{loginError}</span>
                    </div>
                    {needsProviderEnable && (
                      <div className="pl-6 space-y-1.5 text-xs text-red-200/90">
                        <p>
                          1. Open Firebase Console → Authentication → Sign-in method.
                          <br />
                          2. Click <strong>Add new provider</strong> → <strong>Email/Password</strong> → toggle{" "}
                          <strong>Enable</strong> → <strong>Save</strong>.
                        </p>
                        <a
                          href={FIREBASE_AUTH_PROVIDERS_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium underline"
                        >
                          Open Firebase Auth Providers
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-sm font-semibold transition-colors cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In with ID & Password"
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-slate-800" />
                <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-slate-500">
                  or continue with
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={loginWithGoogle}
                className="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800/70 text-slate-100 text-sm font-medium transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.48-1.72 4.34-5.27 4.34-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.79 4.1 14.69 3.2 12.17 3.2 7.21 3.2 3.2 7.21 3.2 12.5s4.01 9.3 8.97 9.3c5.18 0 8.62-3.64 8.62-8.77 0-.59-.07-1.04-.14-1.93z"
                  />
                </svg>
                Sign in with Google
              </button>

              {/* Sample @medcore.org Staff Credentials Reference (Click to Auto-Fill ID & Password) */}
              <div className="pt-4 border-t border-slate-800/90 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowSampleDirectory((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    Sample @medcore.org Staff Credentials
                  </span>
                  {showSampleDirectory ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>

                {showSampleDirectory && (
                  <div className="rounded-lg border border-slate-800 bg-[#0B1120] divide-y divide-slate-800/80 overflow-hidden">
                    {SAMPLE_STAFF_CREDENTIALS.slice(0, 5).map((cred) => (
                      <div
                        key={cred.staffId}
                        className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-200 truncate">
                            {cred.roleLabel}{" "}
                            <span className="text-slate-500 font-normal">
                              ({cred.fullName})
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 truncate">
                            {cred.email} · <span className="text-slate-300">{cred.password}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => fillSampleAccount(cred.email, cred.password)}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
