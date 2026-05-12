"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "password" | "magic";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Surface ?error= and the URL hash from Supabase auth callbacks.
  // E.g. magic-link expiry returns #error=access_denied&error_description=...
  useEffect(() => {
    const qErr = searchParams.get("error");
    if (qErr === "expired") {
      setBanner(
        "That link has expired. Send yourself a new magic link or sign in with your password.",
      );
      setMode("magic");
      return;
    }
    if (qErr === "auth") {
      setBanner("Sign-in failed. Try again or use the password.");
      return;
    }
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const desc = hash.get("error_description");
      if (desc) {
        setBanner(decodeURIComponent(desc.replace(/\+/g, " ")));
        setMode("magic");
        // Clean the URL so a refresh doesn't re-show the banner
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [searchParams]);

  const handlePasswordSignIn = async () => {
    if (!email || !password) return;
    setStatus("submitting");
    setError(null);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      // Map the most common Supabase auth message to friendlier copy that
      // points users at the magic-link fallback. Other errors pass through.
      const friendly = signInError.message.includes("Invalid login credentials")
        ? "Wrong email or password. Try the magic-link option above if you didn't set a password."
        : signInError.message;
      setError(friendly);
      setStatus("idle");
      return;
    }

    // Route by org_role: org_admins land on the planner studio, everyone
    // else on the couple shell. Read defensively in case the planner-OS
    // migration hasn't been applied yet.
    let destination = "/";
    try {
      const userId = data.user?.id;
      if (userId) {
        const sb = supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              eq: (
                col: string,
                val: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: { org_role?: string | null } | null;
                }>;
              };
            };
          };
        };
        const { data: profile } = await sb
          .from("users")
          .select("org_role")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.org_role === "org_admin") {
          destination = "/admin";
        }
      }
    } catch {
      // pre-migration — fall back to /
    }
    window.location.href = destination;
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setStatus("submitting");
    setError(null);
    const supabase = createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (signInError) {
      setError(signInError.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-serif text-2xl">Acquired Planner</CardTitle>
          <CardDescription>Sign in to your wedding workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {banner && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{banner}</span>
            </div>
          )}
          {status === "sent" ? (
            <p className="text-sm text-muted-foreground">
              Check <span className="font-medium text-foreground">{email}</span> for a sign-in link.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-full bg-stone-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className={`rounded-full py-1.5 font-medium transition ${
                    mode === "password" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setMode("magic")}
                  className={`rounded-full py-1.5 font-medium transition ${
                    mode === "magic" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                  }`}
                >
                  Magic link
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {mode === "password" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handlePasswordSignIn();
                    }}
                  />
                </div>
              )}

              <Button
                onClick={mode === "password" ? handlePasswordSignIn : handleMagicLink}
                disabled={
                  status === "submitting" ||
                  !email ||
                  (mode === "password" && !password)
                }
                className="w-full"
              >
                {status === "submitting"
                  ? mode === "password"
                    ? "Signing in…"
                    : "Sending…"
                  : mode === "password"
                  ? "Sign in"
                  : "Send magic link"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-center text-xs text-muted-foreground">
                {mode === "password"
                  ? "Forgot? Use the magic-link option above."
                  : "We'll email a single-use link. Stays signed in for ~7 days."}
              </p>
              {mode === "magic" && (
                <p className="text-center text-xs text-muted-foreground">
                  Didn&rsquo;t get the link? Switch to password above, or check
                  your spam.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
