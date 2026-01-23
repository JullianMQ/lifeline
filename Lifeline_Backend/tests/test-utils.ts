import { WebSocket } from "ws";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  phone_no: string;
  role: string;
  password: string;
}

export const TEST_USERS: TestUser[] = [
  {
    id: "vM2AijO3q38WcXOUi62UXYBzb4yxAKY5",
    name: "test 1",
    email: "test1@example.com",
    phone_no: "09123456789",
    role: "mutual",
    password: "password"
  },
  {
    id: "F1uJm0ESHy4TVC83VvRLkm7ktGUJWDAD",
    name: "test 2",
    email: "test2@example.com",
    phone_no: "09123456788",
    role: "mutual",
    password: "password"
  },
  {
    id: "5roqNFFVRpeXakMlnI1Z1sv7qLiAU2I6",
    name: "test 3",
    email: "test3@example.com",
    phone_no: "09123456787",
    role: "mutual",
    password: "password"
  },
  {
    id: "baVlMoPI5L8Zo3XV2kBoumvKtuQIzjeP",
    name: "test 4",
    email: "test4@example.com",
    phone_no: "09123456786",
    role: "dependent",
    password: "password"
  },
  {
    id: "RDyBF4FLadkHQ4SyUFnwMzHHay9UI4sM",
    name: "test 5",
    email: "test5@example.com",
    phone_no: "09123456785",
    role: "dependent",
    password: "password"
  }
];

export interface AuthCookies {
  [key: string]: string;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export const TEST_SERVER_URL = "ws://localhost:3000/api/ws";
export const TEST_API_URL = "http://localhost:3000/api";

export async function authenticateUser(email: string, password: string): Promise<AuthCookies> {
  const response = await fetch(`${TEST_API_URL}/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(`Authentication failed for ${email}`);
  }

  const cookies: AuthCookies = {};
  const setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader) {
    setCookieHeader.split(",").forEach(cookie => {
      const [nameValue] = cookie.trim().split(";");
      const [name, value] = nameValue.split("=");
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    });
  }

  return cookies;
}

export function formatCookies(cookies: AuthCookies): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export function createAuthenticatedWebSocket(cookies: AuthCookies): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const cookieHeader = formatCookies(cookies);
    const headers = {
      "Cookie": cookieHeader
    };

    const ws = new WebSocket(TEST_SERVER_URL, { headers });

    ws.on("open", () => resolve(ws));
    ws.on("error", (error) => reject(error));
  });
}

export function waitForMessage(ws: WebSocket, timeout: number = 5000): Promise<WebSocketMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for message")), timeout);

    ws.on("message", (data) => {
      clearTimeout(timer);
      try {
        const message = JSON.parse(data.toString());
        resolve(message);
      } catch (error) {
        reject(new Error("Failed to parse message"));
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function sendMessage(ws: WebSocket, message: any): Promise<void> {
  ws.send(JSON.stringify(message));
  await new Promise(resolve => setTimeout(resolve, 100));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createMessageCollector(ws: WebSocket): {
  messages: WebSocketMessage[];
  collector: () => void;
} {
  const messages: WebSocketMessage[] = [];

  const listener = (data: any) => {
    try {
      const message = JSON.parse(data.toString());
      messages.push(message);
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  };

  ws.on("message", listener);

  return {
    messages,
    collector: () => {
      ws.off("message", listener);
    }
  };
}
