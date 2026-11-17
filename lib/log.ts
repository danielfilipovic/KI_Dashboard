import { db } from "./db";

export async function log(source: string, message: string, level: "INFO" | "WARN" | "ERROR" = "INFO") {
  await db.logEntry.create({ data: { source, message, level } });
}
