import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";

const DEFAULT_ADMIN = {
  id: "admin-default",
  username: process.env.PORTAL_DEFAULT_ADMIN_USERNAME ?? "admin",
  password: process.env.PORTAL_DEFAULT_ADMIN_PASSWORD ?? "admin123",
  displayName: process.env.PORTAL_DEFAULT_ADMIN_DISPLAY_NAME ?? "Administrator",
};

let bootstrapped = false;

export async function ensureDefaultAdminUser() {
  if (bootstrapped) {
    return;
  }

  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.username, DEFAULT_ADMIN.username))
    .limit(1);

  if (existing.length === 0) {
    const { hash, salt } = hashPassword(DEFAULT_ADMIN.password);
    await db.insert(adminUsers).values({
      id: DEFAULT_ADMIN.id,
      username: DEFAULT_ADMIN.username,
      passwordHash: hash,
      passwordSalt: salt,
      displayName: DEFAULT_ADMIN.displayName,
      updatedAt: new Date(),
    });
  }

  bootstrapped = true;
}
