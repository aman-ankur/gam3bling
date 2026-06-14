import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "gb_session";

export type PlayerSession = {
  playerId: string;
  roomId: string;
  roomSlug: string;
};

export async function getPlayerSession(): Promise<PlayerSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;

  if (!value) {
    return null;
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature || !isValidSignature(payload, signature)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PlayerSession;
  } catch {
    return null;
  }
}

export async function setPlayerSession(session: PlayerSession): Promise<void> {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 120
  });
}

export function hashSecret(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function isValidSignature(payload: string, signature: string): boolean {
  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function getSecret(): string {
  return process.env.APP_SESSION_SECRET || "local-dev-session-secret";
}
