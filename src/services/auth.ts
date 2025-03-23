import { AuthMethodsResponse, Session } from "../types/auth";

interface LoginCredentials {
  email: string;
  password: string;
}

export class AuthService {
  private static readonly API_BASE_URL = "https://app.ddddao.top";

  static async login(credentials: LoginCredentials): Promise<boolean> {
    try {
      // First, get the CSRF token
      const csrfResponse = await fetch(`${this.API_BASE_URL}/api/auth/csrf`);
      const { csrfToken } = await csrfResponse.json();

      // Then, perform the login
      const response = await fetch(
        `${this.API_BASE_URL}/api/auth/callback/credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...credentials,
            csrfToken,
            callbackUrl: `${this.API_BASE_URL}/`,
            json: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      return data.url.includes("error") ? false : true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  static async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/auth/signout`, {
        method: "POST",
        credentials: "include",
      });
      return response.ok;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  }

  static async getCurrentSession(): Promise<Session | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/auth/session`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to get session");
      }
      return await response.json();
    } catch (error) {
      console.error("Session error:", error);
      return null;
    }
  }

  static async getAuthMethods(): Promise<AuthMethodsResponse | null> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/api/user-auth-methods`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to get auth methods");
      }
      return await response.json();
    } catch (error) {
      console.error("Auth methods error:", error);
      return null;
    }
  }

  static async deleteAuthMethod(id: number): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/api/user-auth-methods/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Delete auth method error:", error);
      return false;
    }
  }

  static async updateAuthMethodFromBackground(id: number): Promise<boolean> {
    try {
      // Get the cookies from background script
      const cookies = await chrome.runtime.sendMessage({ type: "GET_COOKIES" });

      if (!cookies) {
        throw new Error("No cookies found");
      }

      const response = await fetch(
        `${this.API_BASE_URL}/api/user-auth-methods/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cookies }),
          credentials: "include",
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Update auth method error:", error);
      return false;
    }
  }
}
