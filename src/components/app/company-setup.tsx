import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/app/page-header";

export function CompanySetup({ email }: { email: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_my_organization", { _name: name });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Your company workspace is ready");
    await qc.invalidateQueries();
  }

  async function recheck() {
    await qc.invalidateQueries({ queryKey: ["membership"] });
  }

  return (
    <div className="mx-auto grid max-w-xl gap-6 py-8">
      <div>
        <div className="eyebrow">Welcome</div>
        <h1 className="mt-1 text-2xl font-semibold">Set up your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each contractor gets a private workspace. Nobody outside your company can see its events, exhibitors, freight or tickets.
        </p>
      </div>
      <Panel title="Create a contractor company" bodyClassName="p-4">
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="org-name">Company name</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
          </div>
          <Button type="submit" disabled={busy} className="w-fit">{busy ? "Creating…" : "Create workspace"}</Button>
          <p className="text-xs text-muted-foreground">You'll be the company admin and can invite dispatchers, operators and exhibitors.</p>
        </form>
      </Panel>
      <Panel title="Joining an existing company?" bodyClassName="grid gap-2 p-4 text-sm">
        <p className="text-muted-foreground">
          Ask your company admin to invite <span className="font-medium text-foreground">{email}</span>. Once your email is confirmed, the invitation is picked up automatically.
        </p>
        <Button variant="outline" size="sm" className="w-fit" onClick={recheck}>Check for invitation</Button>
      </Panel>
    </div>
  );
}
