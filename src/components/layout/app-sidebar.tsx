"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { memberNav, adminNav, type NavItem } from "@/config/navigation";

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

function NavLink({
  item,
  onClick,
}: {
  item: NavItem;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    item.href === "/dashboard" || item.href === "/admin"
      ? pathname === item.href
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <item.icon className="size-4 shrink-0" />
      <span>{item.label}</span>
      {item.badge ? (
        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
          {item.badge > 9 ? "9+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarContent({
  isAdmin,
  user,
  navItems,
  onNavClick,
}: {
  isAdmin?: boolean;
  user: SidebarUser;
  navItems: NavItem[];
  onNavClick?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-4 py-5">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight"
        >
          Foyzul&apos;s Circle
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavClick} />
        ))}

        {isAdmin && (
          <>
            <Separator className="my-3" />
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} onClick={onNavClick} />
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent">
              <Avatar size="sm">
                {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">
                <LogOut />
                Sign out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppSidebar({ isAdmin, user, unreadMessages }: AppSidebarProps) {
  const navItems = memberNav.map((item) =>
    item.label === "Messages" && unreadMessages
      ? { ...item, badge: unreadMessages }
      : item
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-background lg:block">
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <SidebarContent
            isAdmin={isAdmin}
            user={user}
            navItems={navItems}
          />
        </div>
      </aside>

      {/* Mobile header + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent
              isAdmin={isAdmin}
              user={user}
              navItems={navItems}
              onNavClick={() => {
                // Close sheet by dispatching escape key
                document.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "Escape" })
                );
              }}
            />
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          Foyzul&apos;s Circle
        </Link>
      </div>
    </>
  );
}
