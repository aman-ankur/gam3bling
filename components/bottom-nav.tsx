"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BottomNavProps = {
  roomSlug?: string;
};

export function BottomNav({ roomSlug }: BottomNavProps) {
  const pathname = usePathname();
  const roomBase = roomSlug ? `/r/${roomSlug}` : "/r/world-cup-room";
  const navItems = [
    { href: "/", label: "Home" },
    { href: `${roomBase}/matches`, label: "Matches" },
    { href: `${roomBase}/leaderboard`, label: "Board" },
    { href: roomBase, label: "Room" }
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {navItems.map((item) => (
        <Link
          aria-current={isCurrentNavItem(pathname, item.href) ? "page" : undefined}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function isCurrentNavItem(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href.endsWith("/matches")) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return pathname === href;
}
