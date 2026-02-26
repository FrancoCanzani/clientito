const BASE = "/api";

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const errorMessage =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : response.statusText;

    const error = new Error(errorMessage || "Request failed") as Error & {
      status?: number;
    };
    error.name = "ApiError";
    error.status = response.status;
    throw error;
  }

  return response;
}
