import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { createRoom } from "@/features/rooms/actions";

export const dynamic = "force-dynamic";

export default function NewRoomPage() {
  return (
    <AppShell roomName="Gam3bling" subtitle="New prediction room">
      <section className="hero-card setup-hero" aria-labelledby="create-room-title">
        <div className="cup-mark">GB</div>
        <p className="eyebrow">World Cup 2026</p>
        <h1 id="create-room-title">Create a room</h1>
        <p>Start a friend room with a short link, one invite code, and simple name entry.</p>
      </section>

      <form action={createRoom} className="form-card" aria-label="Create room form">
        <label>
          Room name
          <input aria-label="Room name" defaultValue="World Cup Room" name="roomName" />
        </label>
        <label>
          Your display name
          <input aria-label="Your display name" name="displayName" placeholder="John" />
        </label>

        <div aria-label="Avatar choices" className="avatar-strip">
          <button aria-label="Choose avatar AK" className="avatar-choice selected" type="button">
            <Avatar initials="AK" tone="green" />
          </button>
          <button aria-label="Choose avatar AS" className="avatar-choice" type="button">
            <Avatar initials="AS" tone="blue" />
          </button>
          <button aria-label="Choose avatar RJ" className="avatar-choice" type="button">
            <Avatar initials="RJ" tone="gold" />
          </button>
        </div>

        <SubmitButton pendingLabel="Creating room...">Generate room</SubmitButton>
      </form>
    </AppShell>
  );
}
