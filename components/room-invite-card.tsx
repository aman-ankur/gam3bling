"use client";

import { useState } from "react";

type RoomInviteCardProps = {
  inviteCode?: string;
  shortLink: string;
};

export function RoomInviteCard({ inviteCode, shortLink }: RoomInviteCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(shortLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="invite-card" aria-labelledby="invite-title">
      <p className="eyebrow">Invite link</p>
      <h3 id="invite-title">{shortLink}</h3>
      <div className="code-box" aria-label="Invite code">
        {inviteCode ?? "Hidden after creation"}
      </div>
      <button className="primary-button" onClick={copyInvite} type="button">
        {copied ? "Copied" : "Copy invite"}
      </button>
    </section>
  );
}
