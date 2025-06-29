import { AuthMethodsResponse, EnumPlatform, Session } from "../types/auth";
import { debounce } from "lodash";

interface LoginCredentials {
  email: string;
  password: string;
}

export class AuthService {
  private static readonly API_BASE_URL = "https://app.ddddao.top";

  // Create a persistent debounced function for logging (user's test version)
  private static debouncedLogFunction = debounce(
    (platform: EnumPlatform, token: string, linkedId?: number) => {
      console.log("debounceSync", platform, token, linkedId);
      return this.sync(platform, token, linkedId);
    },
    1000,
    { leading: true, trailing: false }
  );

  static async login(credentials: LoginCredentials): Promise<boolean> {
    try {
      console.log("[AuthService] Starting login process...");

      // First, get the CSRF token
      console.log("[AuthService] Fetching CSRF token...");
      const csrfResponse = await fetch(`${this.API_BASE_URL}/api/auth/csrf`, {
        credentials: "include",
      });
      const { csrfToken } = await csrfResponse.json();
      console.log("[AuthService] Got CSRF token:", csrfToken);

      // Then, perform the login
      console.log("[AuthService] Attempting login with credentials...");
      const response = await fetch(
        `${this.API_BASE_URL}/api/auth/callback/credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            ...credentials,
            csrfToken,
            callbackUrl: `${this.API_BASE_URL}/`,
            json: true,
          }),
        }
      );

      // 302 Found is expected and indicates a successful login with redirect
      if (!response.ok && response.status !== 302) {
        console.error(
          "[AuthService] Login failed with status:",
          response.status
        );
        throw new Error("Login failed");
      }

      return true;
    } catch (error) {
      console.error("[AuthService] Login error:", error);
      return false;
    }
  }

  static async logout(): Promise<boolean> {
    try {
      console.log("[AuthService] Starting logout process...");

      const response = await fetch(`${this.API_BASE_URL}/api/auth/signout`, {
        method: "POST",
        credentials: "include",
      });

      console.log("[AuthService] Logout response status:", response.status);

      // Clear all cookies for the domain
      const cookies = await chrome.cookies.getAll({ domain: "ddddao.top" });
      console.log("[AuthService] Found cookies to remove:", cookies.length);

      for (const cookie of cookies) {
        await chrome.cookies.remove({
          url: `${this.API_BASE_URL}${cookie.path}`,
          name: cookie.name,
        });
      }

      // Clear local storage
      localStorage.clear();

      // Clear session storage
      sessionStorage.clear();

      return response.ok;
    } catch (error) {
      console.error("[AuthService] Logout error:", error);
      return false;
    }
  }

  static async getCurrentSession(): Promise<Session | null> {
    try {
      console.log("[AuthService] Checking current session...");
      const response = await fetch(`${this.API_BASE_URL}/api/auth/session`, {
        credentials: "include",
      });

      console.log(
        "[AuthService] Session check response status:",
        response.status
      );

      if (!response.ok) {
        console.error("[AuthService] Failed to get session:", response.status);
        throw new Error("Failed to get session");
      }

      const session = await response.json();
      console.log("[AuthService] Current session:", session);

      // Check if session is empty or doesn't have required user data
      if (!session || !session.user || !session.user.email) {
        console.log("[AuthService] No valid session found");
        return null;
      }

      return session;
    } catch (error) {
      console.error("[AuthService] Session check error:", error);
      return null;
    }
  }

  static async getAuthMethods(): Promise<AuthMethodsResponse | null> {
    try {
      console.log("[AuthService] Fetching auth methods...");
      const response = await fetch(
        `${this.API_BASE_URL}/api/user-auth-methods`,
        {
          credentials: "include",
        }
      );

      console.log(
        "[AuthService] Auth methods response status:",
        response.status
      );

      if (!response.ok) {
        console.error(
          "[AuthService] Failed to get auth methods:",
          response.status
        );
        throw new Error("Failed to get auth methods");
      }

      const data = await response.json();
      console.log("[AuthService] Auth methods data:", data);
      return data;
    } catch (error) {
      console.error("[AuthService] Auth methods error:", error);
      return null;
    }
  }

  static async deleteAuthMethod(
    id: number,
    platform: EnumPlatform
  ): Promise<boolean> {
    try {
      console.log("[AuthService] Deleting auth method:", id);
      const response = await fetch(
        `${this.API_BASE_URL}/api/user-auth-methods`,
        {
          method: "DELETE",
          credentials: "include",
          body: JSON.stringify({
            id,
            platform,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "[AuthService] Delete auth method response status:",
        response.status
      );
      return response.ok;
    } catch (error) {
      console.error("[AuthService] Delete auth method error:", error);
      return false;
    }
  }

  static async debounceSync(
    platform: EnumPlatform,
    token: string,
    linkedId?: number
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const result = AuthService.debouncedLogFunction(
        platform,
        token,
        linkedId
      );
      // Handle the case where debounce returns undefined (when called too frequently)
      if (result === undefined) {
        console.log("[AuthService] Debounced call skipped (too frequent)");
        return {
          success: false,
          message: "Request rate limited - please wait before trying again",
        };
      }
      // Since result is a Promise<{success: boolean, message?: string}>, we need to await it
      return await result;
    } catch (error) {
      console.error("[AuthService] Debounced sync error:", error);
      return { success: false, message: "Debounced sync error occurred" };
    }
  }

  static async sync(
    platform: EnumPlatform,
    token: string,
    linkedId?: number
  ): Promise<{ success: boolean; message?: string }> {
    try {
      console.log("[AuthService] Syncing auth method:", platform, token);
      const payload = {
        id: linkedId,
        platform,
        value: token,
      };
      console.log(
        "[AuthService] Request payload:",
        JSON.stringify(payload, null, 2)
      );

      const response = await fetch(
        `${this.API_BASE_URL}/api/user-auth-methods`,
        {
          method: linkedId === undefined ? "POST" : "PUT",
          credentials: "include",
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log(
        "[AuthService] Sync auth method response status:",
        response.status
      );
      const data = await response.json();
      console.log("[AuthService] Sync auth method response data:", data);
      if (data.success) {
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (error) {
      console.error("[AuthService] Sync error:", error);
      return { success: false, message: "Network error occurred" };
    }
  }
}
