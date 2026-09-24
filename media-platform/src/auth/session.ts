const encoder = new TextEncoder();

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function newSessionToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sessionTokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 30) {
  return [
    `mkety_media_session=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

export function clearSessionCookie() {
  return "mkety_media_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
