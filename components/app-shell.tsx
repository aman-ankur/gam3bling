import { Avatar } from "@/components/avatar";
import { BottomNav } from "@/components/bottom-nav";
import { getPlayerSession } from "@/features/players/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type AppShellProps = {
  children: React.ReactNode;
  roomName: string;
  roomSlug?: string;
  subtitle?: string;
};

type HeaderProfile = {
  initials: string;
  label: string;
};

export async function AppShell({ children, roomName, roomSlug, subtitle = "3 predictions lock soon" }: AppShellProps) {
  const profile = await getHeaderProfile(roomSlug);

  return (
    <main className="app-frame">
      <header className="top-bar">
        <div>
          <p className="room-label">{roomName}</p>
          <h2>{subtitle}</h2>
        </div>
        <Avatar initials={profile.initials} tone="green" label={profile.label} />
      </header>
      {children}
      <BottomNav roomSlug={roomSlug} />
    </main>
  );
}

async function getHeaderProfile(roomSlug?: string): Promise<HeaderProfile> {
  const fallback = { initials: "GB", label: "Gam3Bling profile" };

  if (!roomSlug) {
    return fallback;
  }

  const session = await getPlayerSession();

  if (!session || session.roomSlug !== roomSlug) {
    return fallback;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return fallback;
  }

  const { data: player } = await supabase
    .from("players")
    .select("display_name, avatar_initials")
    .eq("id", session.playerId)
    .single();

  if (!player) {
    return fallback;
  }

  return {
    initials: player.avatar_initials ?? fallback.initials,
    label: `${player.display_name ?? "Player"} profile`
  };
}
