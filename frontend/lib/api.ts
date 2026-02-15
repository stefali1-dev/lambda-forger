export interface HealthResponse {
  ok: boolean;
  service?: string;
}

export interface UploadResponse {
  s3Urls: string[];
}

export interface DeployRequest {
  code: string;
  template: "chatCompletion";
  openaiKey: string;
  s3ContextFiles?: string[];
}

export interface DeployResponse {
  functionUrl: string;
  functionName: string;
  curlExample: string;
}

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

export function getBackendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

function buildUrl(path: string): string {
  const baseUrl = getBackendBaseUrl().replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

async function request<T>(
  path: string,
  init: RequestInit,
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (!response.ok) {
      const error = typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`;
      throw new Error(error);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Check backend availability and try again.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unexpected network error.");
  } finally {
    clearTimeout(timeout);
  }
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health", {
    method: "GET",
  });
}

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file, file.name);
  }

  return request<UploadResponse>(
    "/upload",
    {
      method: "POST",
      body: formData,
    },
    60_000,
  );
}

export function deployLambda(payload: DeployRequest): Promise<DeployResponse> {
  return request<DeployResponse>(
    "/deploy",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    120_000,
  );
}
