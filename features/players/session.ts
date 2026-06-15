import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "gb_session";
const MAX_ROOM_SESSIONS = 12;

export type PlayerSession = {
  playerId: string;
  roomId: string;
  roomSlug: string;
};

type PlayerSessionCookie = PlayerSession & {
  roomSessions?: PlayerSession[];
};

export async function getPlayerSession(): Promise<PlayerSession | null> {
  const sessions = await getPlayerSessions();

  return sessions[0] ?? null;
}

export async function getPlayerSessionForRoom(roomSlug: string): Promise<PlayerSession | null> {
  const sessions = await getPlayerSessions();

  return sessions.find((session) => session.roomSlug === roomSlug) ?? null;
}

export async function getPlayerSessions(): Promise<PlayerSession[]> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;

  if (!value) {
    return [];
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature || !isValidSignature(payload, signature)) {
    return [];
  }

  try {
    return normalizeCookieSessions(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PlayerSessionCookie);
  } catch {
    return [];
  }
}

export async function setPlayerSession(session: PlayerSession): Promise<void> {
  const sessions = mergeSessions(session, await getPlayerSessions());
  const payload = Buffer.from(JSON.stringify({ ...session, roomSessions: sessions }), "utf8").toString("base64url");
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

function normalizeCookieSessions(cookie: PlayerSessionCookie): PlayerSession[] {
  return mergeSessions(cookie, cookie.roomSessions ?? []);
}

function mergeSessions(activeSession: PlayerSession, existingSessions: PlayerSession[]): PlayerSession[] {
  const sessionsByRoom = new Map<string, PlayerSession>();

  for (const session of [activeSession, ...existingSessions]) {
    if (!session.playerId || !session.roomId || !session.roomSlug || sessionsByRoom.has(session.roomId)) {
      continue;
    }

    sessionsByRoom.set(session.roomId, {
      playerId: session.playerId,
      roomId: session.roomId,
      roomSlug: session.roomSlug
    });
  }

  return Array.from(sessionsByRoom.values()).slice(0, MAX_ROOM_SESSIONS);
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
