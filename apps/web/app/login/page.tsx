"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email) return;
    setStatus("sending");
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
      setStatus("error");
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
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={status === "sending" || !email}
                className="w-full"
              >
                {status === "sending" ? "Sending…" : "Send magic link"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
