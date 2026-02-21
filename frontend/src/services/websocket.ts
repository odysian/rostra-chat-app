import { logDebug, logError } from "../utils/logger";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_BASE_URL =
  resolveWebSocketBaseUrl(API_URL, import.meta.env.VITE_WS_URL) ||
  "ws://localhost:8000";

const WS_URL = `${WS_BASE_URL}/ws/connect`;

export function resolveWebSocketBaseUrl(apiUrl: string, wsUrl?: string): string {
  const explicitWsUrl = wsUrl?.trim();
  if (explicitWsUrl) {
    return explicitWsUrl.replace(/^http/i, "ws").replace(/\/+$/, "");
  }

  // Accept API URLs with optional trailing slash or /api suffix.
  const normalizedApiUrl = apiUrl.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
  return normalizedApiUrl.replace(/^http/i, "ws");
}

// WebSocket retry configuration
const WS_RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 2000,  // 2s
  maxDelay: 30000, // 30s
  timeout: 10000   // 10s connection timeout
};

export class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string;
  private onMessageCallback?: (data: unknown) => void;
  private onStatusChangeCallback?: (status: string) => void;
  private retryCount: number = 0;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private connectionTimeout?: number;

  constructor(token: string) {
    this.token = token;
  }

  // Validate token before attempting connection
  private async validateToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        signal: AbortSignal.timeout(5000), // 5s timeout for validation
      });

      return response.ok;
    } catch (error) {
      logError("Token validation failed:", error);
      return false;
    }
  }

  // Calculate retry delay with exponential backoff
  private getRetryDelay(): number {
    const delay = Math.min(
      WS_RETRY_CONFIG.baseDelay * Math.pow(2, this.retryCount),
      WS_RETRY_CONFIG.maxDelay
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  // Attempt to reconnect with backoff
  private async attemptReconnect() {
    if (!this.shouldReconnect || this.isConnecting || this.retryCount >= WS_RETRY_CONFIG.maxRetries) {
      return;
    }

    this.retryCount++;
    this.isConnecting = true;
    this.onStatusChangeCallback?.("reconnecting");

    const delay = this.getRetryDelay();
    logDebug(
      `WebSocket reconnecting in ${delay}ms (attempt ${this.retryCount}/${WS_RETRY_CONFIG.maxRetries})`
    );

    setTimeout(() => {
      this.isConnecting = false;
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    // Validate token before connecting
    const isValid = await this.validateToken();
    if (!isValid) {
      logError("WebSocket token validation failed");
      this.onStatusChangeCallback?.("error");
      return;
    }

    this.isConnecting = true;
    this.onStatusChangeCallback?.("connecting");

    const url = `${WS_URL}?token=${encodeURIComponent(this.token)}`;
    
    try {
      this.ws = new WebSocket(url);
      
      // Set connection timeout
      this.connectionTimeout = window.setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          logError("WebSocket connection timeout");
        }
      }, WS_RETRY_CONFIG.timeout);

      this.ws.onopen = () => {
        logDebug("WebSocket connected");
        clearTimeout(this.connectionTimeout);
        this.isConnecting = false;
        this.retryCount = 0; // Reset retry count on successful connection
        this.onStatusChangeCallback?.("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logDebug("WebSocket received:", data);
          this.onMessageCallback?.(data);
        } catch (error) {
          // Keep the socket alive even if one payload is malformed.
          logError("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        logError("WebSocket error:", error);
        clearTimeout(this.connectionTimeout);
        this.isConnecting = false;
        this.onStatusChangeCallback?.("error");
      };

      this.ws.onclose = (event) => {
        logError("WebSocket closed:", event.code, event.reason);
        clearTimeout(this.connectionTimeout);
        this.ws = null;
        this.isConnecting = false;

        if (this.shouldReconnect && event.code !== 1000) {
          // Attempt to reconnect for abnormal closures
          this.attemptReconnect();
        } else {
          this.onStatusChangeCallback?.("disconnected");
        }
      };
    } catch (error) {
      logError("WebSocket connection failed:", error);
      this.isConnecting = false;
      this.onStatusChangeCallback?.("error");
    }
  }

  send(message: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      logError("WebSocket is not connected");
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    clearTimeout(this.connectionTimeout);
    
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    
    this.isConnecting = false;
    this.retryCount = 0;
  }

  // Update token and reconnect if necessary
  updateToken(newToken: string) {
    this.token = newToken;
    this.disconnect();
    this.shouldReconnect = true; // Re-enable reconnection with new token
    
    // Wait a brief moment before reconnecting
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, 100);
  }

  onMessage(callback: (data: unknown) => void) {
    this.onMessageCallback = callback;
  }

  onStatusChange(callback: (status: string) => void) {
    this.onStatusChangeCallback = callback;
  }
}
