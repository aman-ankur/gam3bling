"use client";

import { usePathname } from "next/navigation";

type BottomNavProps = {
  roomSlug?: string;
};

export function BottomNav({ roomSlug }: BottomNavProps) {
  const pathname = usePathname();
  const roomBase = roomSlug ? `/r/${roomSlug}` : "/r/goa-wc-chaos";
  const navItems = [
    { href: "/", label: "Home" },
    { href: `${roomBase}/matches`, label: "Matches" },
    { href: `${roomBase}/leaderboard`, label: "Board" },
    { href: roomBase, label: "Room" }
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {navItems.map((item) => (
        <a
          aria-current={isCurrentNavItem(pathname, item.href) ? "page" : undefined}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </a>
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
