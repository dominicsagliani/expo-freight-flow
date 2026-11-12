import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader, Panel, ComingNext } from "@/components/app/page-header";
import { membershipQuery } from "@/lib/queries";
import { ROLE_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ExpoHaul" },
      { name: "description", content: "Your account, company, and access settings." },
      { property: "og:title", content: "Settings — ExpoHaul" },
      { property: "og:description", content: "Account, company, and access settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Settings" title="Settings" description="Your account and company access." />
      <Panel title="Your account" bodyClassName="grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <div className="eyebrow">Name</div>
          <div className="mt-0.5 text-sm">{m.fullName}</div>
        </div>
        <div>
          <div className="eyebrow">Email</div>
          <div className="mt-0.5 text-sm">{m.email}</div>
        </div>
        <div>
          <div className="eyebrow">Company · Role</div>
          <div className="mt-0.5 text-sm">
            {m.organizationName} · {m.role ? ROLE_LABEL[m.role] : "No role"}
          </div>
        </div>
      </Panel>
      <ComingNext
        phase="Upcoming"
        title="Company administration"
        items={["Invite users and assign roles", "Link exhibitor and operator accounts", "Company profile and branding", "Platform-level customer management for super admins"]}
      />
    </div>
  );
}
