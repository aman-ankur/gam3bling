"use client";

import { useState } from "react";

type RoomInviteCardProps = {
  collapsible?: boolean;
  inviteCode?: string;
  inviteError?: string;
  recoverInviteAction?: (formData: FormData) => void | Promise<void>;
  shortLink: string;
};

export function RoomInviteCard({ collapsible = false, inviteCode, inviteError, recoverInviteAction, shortLink }: RoomInviteCardProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  async function copyInvite() {
    try {
      const inviteText = inviteCode ? `Invite link: ${shortLink}\nRoom code: ${inviteCode}` : `Invite link: ${shortLink}`;

      await navigator.clipboard.writeText(inviteText);
      setCopiedInvite(true);
    } catch {
      setCopiedInvite(false);
    }
  }

  async function copyCode() {
    if (!inviteCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
    } catch {
      setCopiedCode(false);
    }
  }

  const inviteBody = (
    <>
      <p className="eyebrow">Invite link</p>
      <h3 id="invite-title">{shortLink}</h3>
      <p className="invite-code-label">Room code</p>
      <div className="code-box" aria-label="Invite code">
        {inviteCode ?? "Code not saved yet"}
      </div>
      {inviteCode ? (
        <div className="invite-actions">
          <button className="primary-button" onClick={copyInvite} type="button">
            {copiedInvite ? "Copied" : "Copy link + code"}
          </button>
          <button className="ghost-link" onClick={copyCode} type="button">
            {copiedCode ? "Code copied" : "Copy code only"}
          </button>
        </div>
      ) : null}
      {!inviteCode && recoverInviteAction ? (
        <form action={recoverInviteAction} className="invite-recovery-form">
          <p>Legacy room: enter the room code once and it will stay visible here.</p>
          {inviteError ? <span role="alert">That room code did not match.</span> : null}
          <input aria-label="Recover room code" autoComplete="off" name="inviteCode" placeholder="TIGER7" />
          <button className="primary-button" type="submit">
            Save room code
          </button>
        </form>
      ) : null}
      {!inviteCode && !recoverInviteAction ? (
        <button className="primary-button" onClick={copyInvite} type="button">
          {copiedInvite ? "Copied" : "Copy invite link"}
        </button>
      ) : null}
    </>
  );

  if (collapsible) {
    return (
      <details className="invite-card room-accordion" aria-labelledby="invite-summary-title">
        <summary className="room-accordion-summary">
          <div>
            <p className="eyebrow">Invite link</p>
            <h2 id="invite-summary-title">Invite link</h2>
          </div>
          <span className="status-chip">Expand</span>
        </summary>
        <div className="room-accordion-body">
          {inviteBody}
        </div>
      </details>
    );
  }

  return (
    <section className="invite-card" aria-labelledby="invite-title">
      {inviteBody}
    </section>
  );
}
