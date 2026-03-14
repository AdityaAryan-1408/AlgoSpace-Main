import { jsonOk, handleApiError } from "@/lib/api";

export async function GET() {
    try {
        const publicKey = process.env.VAPID_PUBLIC_KEY || "";
        return jsonOk({ publicKey });
    } catch (error) {
        return handleApiError(error);
    }
}
