export async function register() {
  const { ensurePortalSchema } = await import("@/lib/db");
  try {
    await ensurePortalSchema();
    console.log("Database schema applied successfully.");
  } catch (error) {
    console.error("FATAL: Failed to apply database schema:", error);
    process.exit(1);
  }
}
