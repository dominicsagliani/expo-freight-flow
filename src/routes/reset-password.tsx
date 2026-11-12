import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/app/logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — ExpoHaul" },
      { name: "description", content: "Choose a new password for your ExpoHaul account." },
      { property: "og:title", content: "Set a new password — ExpoHaul" },
      { property: "og:description", content: "Choose a new password for your ExpoHaul account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const isRecovery = typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={onSubmit} className="grid w-full max-w-sm gap-4">
        <Wordmark />
        <h1 className="mt-4 text-2xl font-semibold">Set a new password</h1>
        {!isRecovery && (
          <p className="text-sm text-muted-foreground">Open this page from the reset link in your email.</p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
