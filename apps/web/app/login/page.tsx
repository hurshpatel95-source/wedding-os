"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "password" | "magic";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

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
      setError(signInError.message);
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
          <CardTitle className="font-serif text-2xl">wedding-os</CardTitle>
          <CardDescription>Barcelona · September 2027</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  ? "Forgot? Ask Hursh — passwords are admin-set for this private workspace."
                  : "We'll email a single-use link. Stays signed in for ~7 days."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
