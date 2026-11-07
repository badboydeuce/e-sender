import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const token = request.headers.get("x-admin-token");
  const apiUrl = process.env.ESENDER_API_URL;
  if (!token) return NextResponse.json({ message: "Admin token required" }, { status: 401 });
  if (!apiUrl) return NextResponse.json({ message: "ESENDER_API_URL is not configured" }, { status: 503 });
  try {
    const response = await fetch(apiUrl.replace(/\/$/, "") + "/api/admin/devices", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    const body = await response.json().catch(() => ({ message: "Invalid API response" }));
    return NextResponse.json(body, { status: response.status });
  } catch { return NextResponse.json({ message: "Could not reach the eSender API" }, { status: 502 }); }
}
