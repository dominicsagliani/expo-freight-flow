import { Forklift } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Eye,
  LayoutDashboard,
  Map,
  Package,
  Receipt,
  Route as RouteIcon,
  ScanLine,
  Settings,
  Users,
  Trophy,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { LogoMark } from "./logo";
import type { AppRole } from "@/lib/labels";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; roles?: AppRole[] };

const STAFF: AppRole[] = ["super_admin", "company_admin", "dispatcher"];
const WORK: AppRole[] = [...STAFF, "operator", "exhibitor"];

const operations: NavItem[] = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, roles: WORK },
  { title: "Event status", url: "/event-status", icon: Eye, roles: [...STAFF, "venue", "organizer"] },
  { title: "Events", url: "/events", icon: CalendarDays, roles: STAFF },
  { title: "Exhibitors", url: "/exhibitors", icon: Building2, roles: STAFF },
  { title: "Freight Management", url: "/freight", icon: Package, roles: WORK },
  { title: "Material Handling Tickets", url: "/tickets", icon: ClipboardList, roles: WORK },
  { title: "My Driver Dashboard", url: "/operator", icon: ScanLine, roles: ["operator", ...STAFF] },
  { title: "Forklift Mode", url: "/forklift", icon: Forklift, roles: ["operator", ...STAFF] },
  { title: "Dispatch", url: "/dispatch", icon: RouteIcon, roles: STAFF },
  { title: "Floor plan", url: "/floor-plan", icon: Map, roles: STAFF },
  { title: "Fleet inventory", url: "/equipment", icon: Forklift, roles: STAFF },
  { title: "Worker list", url: "/operators", icon: Users, roles: STAFF },
  { title: "Performance & bonuses", url: "/incentives", icon: Trophy, roles: STAFF },
];

const admin: NavItem[] = [
  { title: "Billing & Reports", url: "/billing", icon: Receipt, roles: [...STAFF, "exhibitor"] },
  { title: "Plans & Billing", url: "/plans", icon: CreditCard, roles: STAFF },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar({ role, orgName }: { role: AppRole | null; orgName: string }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const path = useRouterState({ select: (r) => r.location.pathname });
  const visible = (i: NavItem) => !i.roles || (role != null && i.roles.includes(role));
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  const renderGroup = (label: string, items: NavItem[]) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/50">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.filter(visible).map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className="h-9 text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--sidebar-primary)]"
              >
                <Link to={item.url} onClick={() => isMobile && setOpenMobile(false)}>
                  <item.icon className="data-[active=true]:text-sidebar-primary" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pb-2 pt-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <LogoMark className="size-8 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="font-display text-base text-sidebar-accent-foreground"><span className="font-bold">Expo</span>Haul</div>
              <div className="truncate text-xs text-sidebar-foreground/60">{orgName}</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Operations", operations)}
        {renderGroup("Management", admin)}
      </SidebarContent>
      {!collapsed && (
        <SidebarFooter className="px-4 pb-4">
          <p className="text-[0.6875rem] leading-relaxed text-sidebar-foreground/45">
            The operating system for material handling.
          </p>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
