import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/app/page-header";
import { exhibitorsQuery, invitationsQuery, operatorsQuery } from "@/lib/queries";
import { ROLE_LABEL } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";

type InviteRole = "company_admin" | "dispatcher" | "operator" | "exhibitor";
const ROLES: InviteRole[] = ["company_admin", "dispatcher", "operator", "exhibitor"];

export function TeamInvitations({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { data: invites = [] } = useQuery(invitationsQuery(orgId));
  const { data: exhibitors = [] } = useQuery(exhibitorsQuery());
  const { data: operators = [] } = useQuery(operatorsQuery());
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("dispatcher");
  const [linkId, setLinkId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("invitations").insert({
      organization_id: orgId,
      email,
      role,
      exhibitor_id: role === "exhibitor" ? linkId || null : null,
      operator_id: role === "operator" ? linkId || null : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Invitation saved for ${email}`);
    setEmail("");
    setLinkId("");
    qc.invalidateQueries({ queryKey: ["invitations", orgId] });
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["invitations", orgId] });
  }

  const linkOptions =
    role === "exhibitor"
      ? exhibitors.map((x) => ({ id: x.id, label: x.company_name }))
      : role === "operator"
        ? operators.map((x) => ({ id: x.id, label: x.full_name }))
        : [];

  return (
    <Panel title="Team & invitations" bodyClassName="grid gap-4 p-4">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="inv-email">Email</Label>
          <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => { setRole(v as InviteRole); setLinkId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{role === "exhibitor" ? "Exhibitor" : role === "operator" ? "Operator" : "Link"}</Label>
          <Select value={linkId} onValueChange={setLinkId} disabled={linkOptions.length === 0}>
            <SelectTrigger><SelectValue placeholder={linkOptions.length ? "Choose…" : "Not needed"} /></SelectTrigger>
            <SelectContent>
              {linkOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Invite"}</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        No email is sent yet — tell the person to create an account with this exact email. They join your company once their email is confirmed.
      </p>
      {invites.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{i.email}</span>{" "}
                <span className="text-muted-foreground">
                  · {ROLE_LABEL[i.role]}
                  {i.exhibitor ? ` · ${i.exhibitor.company_name}` : ""}
                  {i.operator ? ` · ${i.operator.full_name}` : ""} · {i.status} · {fmtDateTime(i.created_at)}
                </span>
              </span>
              {i.status === "pending" && (
                <Button variant="ghost" size="sm" onClick={() => revoke(i.id)}>Revoke</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
