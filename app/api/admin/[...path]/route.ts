import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { API_URL } from "@/lib/config";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminConfig";

/**
 * Generic authenticated reverse proxy: forwards any /api/admin/<path> call
 * to the real FastAPI backend at /<path>, injecting the Bearer token read
 * from the httpOnly session cookie. This is a single catch-all so ~40
 * backend endpoints don't each need a hand-written Route Handler; the
 * backend's own auth dependency remains the real security boundary.
 */
async function proxyToBackend(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ detail: "Missing session" }, { status: 401 });
  }

  const { path } = await params;
  const targetUrl = `${API_URL}/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      // Re-append to a fresh FormData rather than pass the stream through —
      // fetch sets the correct multipart boundary header automatically.
      body = await request.formData();
    } else {
      const text = await request.text();
      if (text) {
        body = text;
        headers.set("Content-Type", "application/json");
      }
    }
  }

  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  const responseHeaders = new Headers();
  const backendContentType = backendResponse.headers.get("content-type");
  if (backendContentType) responseHeaders.set("content-type", backendContentType);

  // Null-body statuses (204/205/304) must not be given a body at all — even
  // an empty ArrayBuffer — or the Response constructor throws.
  if (backendResponse.status === 204 || backendResponse.status === 205 || backendResponse.status === 304) {
    return new NextResponse(null, { status: backendResponse.status, headers: responseHeaders });
  }

  const responseBody = await backendResponse.arrayBuffer();
  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return proxyToBackend(request, params);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return proxyToBackend(request, params);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return proxyToBackend(request, params);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return proxyToBackend(request, params);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return proxyToBackend(request, params);
}
