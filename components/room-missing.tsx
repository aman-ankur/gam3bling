import Link from "next/link";
import { AppShell } from "@/components/app-shell";

type RoomMissingProps = {
  slug: string;
};

export function RoomMissing({ slug }: RoomMissingProps) {
  return (
    <AppShell roomName="Gam3bling" roomSlug={slug} subtitle="Room unavailable">
      <section className="hero-card setup-hero" aria-labelledby="room-missing-title">
        <div className="cup-mark">GB</div>
        <p className="eyebrow">Room not found</p>
        <h1 id="room-missing-title">Check the invite</h1>
        <p>This room is not available. Use the invite code from your friend or create a new room.</p>
      </section>

      <Link className="primary-button standalone-action" href="/">
        Join by room code
      </Link>
      <Link className="ghost-link" href="/new">
        Create a new room
      </Link>
    </AppShell>
  );
}
