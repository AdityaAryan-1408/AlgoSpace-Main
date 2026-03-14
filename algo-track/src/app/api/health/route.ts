import { jsonOk } from "@/lib/api";

export async function GET() {
  return jsonOk({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
