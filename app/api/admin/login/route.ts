import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL } from "@/lib/config";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminConfig";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  const backendResponse = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });

  const payload = await backendResponse.json().catch(() => null);

  if (!backendResponse.ok) {
    return NextResponse.json(payload ?? { detail: "Login failed" }, {
      status: backendResponse.status,
    });
  }

  const { access_token, expires_at, admin } = payload as {
    access_token: string;
    expires_at: string | null;
    admin: unknown;
  };

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expires_at ? new Date(expires_at) : undefined,
  });

  // Never return the raw token to the client — only the admin profile.
  return NextResponse.json({ admin });
}
