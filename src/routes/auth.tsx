import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/app/logo";

type Mode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — ExpoHaul" },
      { name: "description", content: "Sign in to ExpoHaul to manage material handling, freight, and dispatch." },
      { property: "og:title", content: "Sign in — ExpoHaul" },
      { property: "og:description", content: "Access your ExpoHaul material handling workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safeRedirect(value: string | undefined) {
  if (!value) return "/dashboard";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/dashboard";
    const path = url.pathname + url.search;
    return path.startsWith("/auth") ? "/dashboard" : path;
  } catch {
    return "/dashboard";
  }
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function AuthPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const goNext = () => router.history.push(safeRedirect(search.redirect));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) goNext();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: fullName } },
        });
        if (error) throw error;
        if (!data.session) setNotice("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If an account exists for that email, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error(result.error.message ?? "Sign-in failed");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-navy-foreground lg:flex lg:flex-col">
        <div className="absolute inset-0 grid-lines" />
        <div className="relative">
          <Wordmark inverse />
        </div>
        <div className="relative mt-auto max-w-md">
          <div className="eyebrow mb-4 text-sidebar-primary">Material handling, digitized</div>
          <h1 className="text-4xl font-bold leading-tight">The operating system for material handling.</h1>
          <p className="mt-4 text-base text-sidebar-foreground">
            Forklift tickets, freight identification, dispatch, and billing — one source of truth from dock to booth.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-sidebar-border pt-6 text-sm">
            <div>
              <dt className="text-sidebar-foreground/70">Tickets</dt>
              <dd className="font-display text-xl font-semibold">Real-time</dd>
            </div>
            <div>
              <dt className="text-sidebar-foreground/70">Freight</dt>
              <dd className="font-display text-xl font-semibold">QR-tracked</dd>
            </div>
            <div>
              <dt className="text-sidebar-foreground/70">Billing</dt>
              <dd className="font-display text-xl font-semibold">Rate-card</dd>
            </div>
          </dl>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          <h2 className="text-2xl font-semibold">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Enter your work email and we'll send a reset link."
              : "Use your work account to access your company workspace."}
          </p>

          {mode !== "forgot" && (
            <div className="mt-6 grid gap-2.5">
              <Button
                type="button"
                variant="outline"
                className="h-10 bg-card font-medium"
                onClick={() => oauth("google")}
              >
                <GoogleIcon /> Continue with Google
              </Button>
              <button type="button" className="lovable-auth-button" onClick={() => oauth("lovable")}>
                Continue with Lovable
              </button>
              <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className={`grid gap-4 ${mode === "forgot" ? "mt-6" : ""}`}>
            {mode === "signup" && (
              <div className="grid gap-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button type="button" className="text-xs font-medium text-status-progress hover:underline" onClick={() => setMode("forgot")}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
            {notice && <p className="rounded-md bg-teal-soft px-3 py-2 text-sm text-status-progress">{notice}</p>}
            <Button type="submit" className="h-10" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New to ExpoHaul?{" "}
                <button className="font-medium text-foreground hover:underline" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <button className="font-medium text-foreground hover:underline" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            )}
          </p>
          <p className="mt-10 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">
              expohaul — the operating system for material handling
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
