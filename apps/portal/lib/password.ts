import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, passwordHash: string) {
  const hashBuffer = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const storedBuffer = Buffer.from(passwordHash, "hex");
  return timingSafeEqual(hashBuffer, storedBuffer);
}
