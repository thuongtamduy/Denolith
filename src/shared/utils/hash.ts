/**
 * Generate a cryptographically random salt (16 bytes, base64-encoded).
 * Unlike UUID, this uses crypto.getRandomValues() which is a CSPRNG.
 */
function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export async function hashPassword(
  password: string,
  salt?: string,
): Promise<string> {
  const useSalt = salt ?? generateSalt();
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
      salt: encoder.encode(useSalt),
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
  return `${useSalt}:${hashHex}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt] = storedHash.split(":");
  if (!salt) return false;
  const checkHash = await hashPassword(password, salt);

  // Constant-time comparison — prevents timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(checkHash);
  const b = encoder.encode(storedHash);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
