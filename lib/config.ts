function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const API_URL = requireEnv(
  "NEXT_PUBLIC_API_URL",
  process.env.NEXT_PUBLIC_API_URL,
);

export const TENANT_ID = requireEnv(
  "NEXT_PUBLIC_TENANT_ID",
  process.env.NEXT_PUBLIC_TENANT_ID,
);

export const PROGRAM_ID = requireEnv(
  "NEXT_PUBLIC_PROGRAM_ID",
  process.env.NEXT_PUBLIC_PROGRAM_ID,
);
