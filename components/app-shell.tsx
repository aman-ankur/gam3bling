import { BottomNav } from "@/components/bottom-nav";

type AppShellProps = {
  children: React.ReactNode;
  roomName: string;
  roomSlug?: string;
  subtitle?: string;
};

export async function AppShell({ children, roomName, roomSlug, subtitle = "Friend prediction rooms" }: AppShellProps) {
  const roomShell = Boolean(roomSlug && !isBrandShell(roomName));
  const brandShell = isBrandShell(roomName);

  return (
    <main className="app-frame">
      <header className={roomShell ? "top-bar room-top-bar" : "top-bar"}>
        <div>
          {roomShell ? (
            <h2>FIFA World Cup 2026</h2>
          ) : (
            <>
              <p className="room-label">FIFA World Cup 2026</p>
              <h2>{headerTitle(roomName)}</h2>
              {brandShell ? null : <p className="header-subtitle">{headerSubtitle(roomName, subtitle)}</p>}
            </>
          )}
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

function headerTitle(roomName: string): string {
  if (isBrandShell(roomName)) {
    return "Gam3bling";
  }

  return roomName;
}

function headerSubtitle(roomName: string, subtitle: string): string {
  if (isBrandShell(roomName)) {
    return subtitle;
  }

  return `Gam3bling · ${subtitle}`;
}

function isBrandShell(roomName: string): boolean {
  return roomName.toLowerCase() === "gam3bling";
}
