import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "@/components/app/app-sidebar";
import { membershipQuery } from "@/lib/queries";
import { ROLE_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(membershipQuery()),
  component: AppLayout,
});

function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function AppLayout() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: {}, replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar role={m.role} orgName={m.organizationName} />
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-5">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="h-5 w-px bg-border" />
            <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{m.organizationName}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-left hover:bg-muted">
                <span className="hidden text-right leading-tight sm:block">
                  <span className="block text-sm font-medium text-foreground">{m.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{m.role ? ROLE_LABEL[m.role] : "No role"}</span>
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials(m.fullName)}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{m.fullName}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
