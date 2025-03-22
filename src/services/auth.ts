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

  static async getCurrentSession(): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/auth/session`);
      if (!response.ok) {
        throw new Error("Failed to get session");
      }
      return await response.json();
    } catch (error) {
      console.error("Session error:", error);
      return null;
    }
  }
}
