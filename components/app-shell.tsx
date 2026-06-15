import { BottomNav } from "@/components/bottom-nav";

type AppShellProps = {
  children: React.ReactNode;
  roomName: string;
  roomSlug?: string;
  subtitle?: string;
};

export async function AppShell({ children, roomName, roomSlug, subtitle = "Friend prediction rooms" }: AppShellProps) {
  return (
    <main className="app-frame">
      <header className="top-bar">
        <div>
          <p className="room-label">FIFA World Cup 2026</p>
          <h2>Gam3bling</h2>
          <p className="header-subtitle">{headerSubtitle(roomName, subtitle)}</p>
        </div>
        <div className="tournament-badge" aria-label="World Cup 2026">
          <strong>WC</strong>
          <span>26</span>
        </div>
      </header>
      {children}
      <BottomNav roomSlug={roomSlug} />
    </main>
  );
}

function headerSubtitle(roomName: string, subtitle: string): string {
  if (roomName.toLowerCase() === "gam3bling") {
    return subtitle;
  }

  return `${roomName} · ${subtitle}`;
}
