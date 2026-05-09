import crypto from "node:crypto";

export interface RpaStatusPayload {
  run_key: string;
  status: "success" | "failed" | "running";
  attempt_no: number;
  message?: string;
  completed_at?: string;
}

export function hashStatusPayload(payload: RpaStatusPayload): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
