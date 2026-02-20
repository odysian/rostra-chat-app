const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const WS_URL = API_URL.replace(/^http/, "ws") + "/ws/connect";

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
      console.error("Token validation failed:", error);
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
    console.log(`WebSocket reconnecting in ${delay}ms (attempt ${this.retryCount}/${WS_RETRY_CONFIG.maxRetries})`);

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
      console.error("WebSocket token validation failed");
      this.onStatusChangeCallback?.("error");
      return;
    }

    this.isConnecting = true;
    this.onStatusChangeCallback?.("connecting");

    const url = `${WS_URL}?token=${this.token}`;
    
    try {
      this.ws = new WebSocket(url);
      
      // Set connection timeout
      this.connectionTimeout = window.setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          console.error("WebSocket connection timeout");
        }
      }, WS_RETRY_CONFIG.timeout);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        clearTimeout(this.connectionTimeout);
        this.isConnecting = false;
        this.retryCount = 0; // Reset retry count on successful connection
        this.onStatusChangeCallback?.("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket received:", data);
          this.onMessageCallback?.(data);
        } catch (error) {
          // Keep the socket alive even if one payload is malformed.
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        clearTimeout(this.connectionTimeout);
        this.isConnecting = false;
        this.onStatusChangeCallback?.("error");
      };

      this.ws.onclose = (event) => {
        console.error("WebSocket closed:", event.code, event.reason);
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
      console.error("WebSocket connection failed:", error);
      this.isConnecting = false;
      this.onStatusChangeCallback?.("error");
    }
  }

  send(message: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not connected");
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
