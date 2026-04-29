export async function hashPassword(
  password: string,
  salt: string = crypto.randomUUID(),
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000, // 100,000 vòng lặp để làm chậm máy tính, chống Brute-force
      hash: "SHA-256",
    },
    keyMaterial,
    256, // độ dài bit
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
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
