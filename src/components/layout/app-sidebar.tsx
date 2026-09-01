"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { adminNav, memberNav, type NavItem } from "@/config/navigation";
import { usePlatformBranding } from "@/features/settings/components/branding-provider";
import { cn } from "@/lib/utils";

interface SidebarUser {
  name: string;
  email: string;
  avatar?: string;
}

interface AppSidebarProps {
  isAdmin?: boolean;
  user: SidebarUser;
  unreadMessages?: number;
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = item.href === "/dashboard" || item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link href={item.href} onClick={onClick} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
      <item.icon className="size-4 shrink-0" />
      <span>{item.label}</span>
      {item.badge ? <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">{item.badge > 9 ? "9+" : item.badge}</span> : null}
    </Link>
  );
}

function BrandHeader({ href, compact = false }: { href: string; compact?: boolean }) {
  const { organizationName, logoUrl } = usePlatformBranding();
  return (
    <Link href={href} className="inline-flex min-w-0 items-center gap-2 font-semibold tracking-tight">
      {logoUrl ? <img src={logoUrl} alt="" className={compact ? "size-7 shrink-0 object-contain" : "size-8 shrink-0 object-contain"} /> : null}
      <span className="truncate">{organizationName}</span>
    </Link>
  );
}

function SidebarContent({ isAdmin, user, navItems, onNavClick, onSignOut }: { isAdmin?: boolean; user: SidebarUser; navItems: NavItem[]; onNavClick?: () => void; onSignOut: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <BrandHeader href={isAdmin ? "/admin" : "/dashboard"} />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => <NavLink key={item.href} item={item} onClick={onNavClick} />)}
        {isAdmin ? <><Separator className="my-3" /><p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Administration</p>{adminNav.map((item) => <NavLink key={item.href} item={item} onClick={onNavClick} />)}</> : null}
      </nav>
      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent">
              <Avatar size="sm">{user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}<AvatarFallback>{user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{user.name}</p>{user.email ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}</div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            {!isAdmin ? <DropdownMenuItem asChild><Link href="/profile"><User />Profile</Link></DropdownMenuItem> : null}
            {!isAdmin ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onSignOut(); }}><LogOut />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppSidebar({ isAdmin, user, unreadMessages }: AppSidebarProps) {
  const router = useRouter();
  const navItems = isAdmin ? [] : memberNav.map((item) => item.label === "Messages" && unreadMessages ? { ...item, badge: unreadMessages } : item);
  async function signOut() {
    await fetch(isAdmin ? "/api/admin/session/logout" : "/api/access/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    router.replace(isAdmin ? "/admin-login" : "/login");
    router.refresh();
  }
  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r bg-background lg:block"><div className="sticky top-0 h-dvh overflow-y-auto"><SidebarContent isAdmin={isAdmin} user={user} navItems={navItems} onSignOut={() => void signOut()} /></div></aside>
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm lg:hidden">
        <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon"><Menu className="size-5" /><span className="sr-only">Open menu</span></Button></SheetTrigger><SheetContent side="left" className="w-60 p-0" showCloseButton={false}><SheetTitle className="sr-only">Navigation</SheetTitle><SidebarContent isAdmin={isAdmin} user={user} navItems={navItems} onNavClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))} onSignOut={() => void signOut()} /></SheetContent></Sheet>
        <BrandHeader href={isAdmin ? "/admin" : "/dashboard"} compact />
      </div>
    </>
  );
}
