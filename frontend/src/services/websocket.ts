const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const WS_URL = API_URL.replace(/^http/, "ws") + "/ws/connect";

export class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string;
  private onMessageCallback?: (data: any) => void;
  private onStatusChangeCallback?: (status: string) => void;

  constructor(token: string) {
    this.token = token;
  }

  connect() {
    if (this.ws) return;

    const url = `${WS_URL}?token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.onStatusChangeCallback?.("connected");
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WebSocket received:", data);
      this.onMessageCallback?.(data);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.onStatusChangeCallback?.("error");
    };
    this.ws.onclose = () => {
      console.error("WebSocket closed");
      this.onStatusChangeCallback?.("disconnected");
      this.ws = null;
    };
  }

  send(message: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not connected");
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onMessage(callback: (data: any) => void) {
    this.onMessageCallback = callback;
  }

  onStatusChange(callback: (status: string) => void) {
    this.onStatusChangeCallback = callback;
  }
}
