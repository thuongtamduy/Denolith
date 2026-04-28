export async function hashPassword(
  password: string,
  salt: string = crypto.randomUUID(),
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${salt}:${hashHex}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt] = storedHash.split(":");
  if (!salt) return false;
  const checkHash = await hashPassword(password, salt);
  return checkHash === storedHash;
}
