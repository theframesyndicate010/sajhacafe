import { staticClient } from "./staticClient.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const USE_STATIC_DATA = import.meta.env.VITE_USE_API !== "true";
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000);
const API_RETRY_COUNT = Math.max(0, Number(import.meta.env.VITE_API_RETRY_COUNT || 1));

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const isIdempotentMethod = (method) => ["GET", "HEAD"].includes(method);

async function parseResponsePayload(response) {
  if (response.status === 204) {
    return {};
  }

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const textPayload = await response.text().catch(() => "");
  return textPayload ? { message: textPayload } : {};
}

function createTimeoutSignal(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Request timeout"));
  }, timeoutMs);

  let onAbort = null;
  if (externalSignal) {
    onAbort = () => controller.abort(externalSignal.reason);

    if (externalSignal.aborted) {
      onAbort();
    } else {
      externalSignal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId);
      if (externalSignal && onAbort) {
        externalSignal.removeEventListener("abort", onAbort);
      }
    },
  };
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const maxAttempts = isIdempotentMethod(method) ? API_RETRY_COUNT + 1 : 1;

  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;

    const timeout = createTimeoutSignal(API_TIMEOUT_MS, options.signal);

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        method,
        signal: timeout.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      const payload = await parseResponsePayload(response);

      if (!response.ok) {
        const error = new Error(
          payload.message || payload.error || `Request failed (${response.status})`,
        );

        error.status = response.status;

        const shouldRetry =
          isIdempotentMethod(method) && response.status >= 500 && attempt < maxAttempts;
        if (shouldRetry) {
          await wait(250 * attempt);
          timeout.dispose();
          continue;
        }

        throw error;
      }

      timeout.dispose();
      return payload;
    } catch (error) {
      timeout.dispose();

      const isTimeout = error?.name === "AbortError";
      const isNetworkFailure = error instanceof TypeError;
      const statusCode = Number(error?.status || 0);

      const shouldRetry =
        isIdempotentMethod(method) &&
        attempt < maxAttempts &&
        (isTimeout || isNetworkFailure || statusCode >= 500);

      if (shouldRetry) {
        await wait(250 * attempt);
        continue;
      }

      if (isTimeout) {
        throw new Error("Request timed out. Please try again.");
      }

      if (isNetworkFailure) {
        throw new Error("Unable to connect to server. Check your network and try again.");
      }

      throw error;
    }
  }

  throw new Error("Request failed after retry attempts.");
}

const remoteClient = {
  getBusinesses: () => request("/businesses"),

  getDashboard: (businessId) =>
    request(`/dashboard?businessId=${encodeURIComponent(businessId)}`),

  getCatalog: (businessId, params = {}) => {
    const searchParams = new URLSearchParams({ businessId });

    if (params.search) {
      searchParams.set("search", params.search);
    }

    if (params.category) {
      searchParams.set("category", params.category);
    }

    return request(`/catalog?${searchParams.toString()}`);
  },

  createCatalogItem: (payload) =>
    request("/catalog", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getInvoices: (businessId) =>
    request(`/invoices?businessId=${encodeURIComponent(businessId)}`),

  getInvoiceById: (invoiceId) => request(`/invoices/${invoiceId}`),

  createInvoice: (payload) =>
    request("/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSales: (businessId) => request(`/sales?businessId=${encodeURIComponent(businessId)}`),

  getTransactions: (businessId, type = "") => {
    const params = new URLSearchParams({ businessId });
    if (type) {
      params.set("type", type);
    }

    return request(`/transactions?${params.toString()}`);
  },

  createTransaction: (payload) =>
    request("/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getReportSummary: (businessId) =>
    request(`/reports/summary?businessId=${encodeURIComponent(businessId)}`),

  getRevenueReport: (businessId, period = "monthly") =>
    request(
      `/reports/revenue?businessId=${encodeURIComponent(businessId)}&period=${encodeURIComponent(period)}`,
    ),

  getHealth: () => request("/health"),

  getPreferences: () => request("/preferences"),

  updatePreferences: (payload) =>
    request("/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

// The static client is the default so `npm run build` can be hosted anywhere.
// Use VITE_USE_API=true when deploying alongside the Express API.
export const apiClient = USE_STATIC_DATA ? staticClient : remoteClient;
