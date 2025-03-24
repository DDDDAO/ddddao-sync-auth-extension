import { useState, useEffect } from "react";
import { AuthService } from "../services/auth";
import { DDCookie, Session } from "../types/auth";
import { Alert } from "./components/alert";
import { Button } from "../components/ui/button";
import { LoginForm } from "./components/login-form";
import { AuthMethodsList } from "./components/auth-methods-list";
import { LoaderIcon } from "lucide-react";
import { BackgroundFetchedCookiesOrJwtTokenList } from "./components/background-fetched-cookies-list";

interface AlertState {
  show: boolean;
  title: string;
  message: string;
  type: "confirm" | "info" | "error";
  onConfirm?: () => void;
}

export default function Popup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authMethods, setAuthMethods] = useState<DDCookie[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [alert, setAlert] = useState<AlertState>({
    show: false,
    title: "",
    message: "",
    type: "info",
  });

  useEffect(() => {
    checkSession();
  }, []);

  const showAlert = (alert: Omit<AlertState, "show">) => {
    setAlert({ ...alert, show: true });
  };

  const hideAlert = () => {
    setAlert((prev) => ({ ...prev, show: false }));
  };

  const checkSession = async () => {
    const sessionData = await AuthService.getCurrentSession();
    setSession(sessionData);
    if (sessionData) {
      fetchAuthMethods();
    }
    setLoading(false);
  };

  const fetchAuthMethods = async () => {
    const response = await AuthService.getAuthMethods();
    if (response?.success) {
      setAuthMethods(response.data);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await AuthService.login({ email, password });
      if (success) {
        const sessionData = await AuthService.getCurrentSession();
        if (sessionData) {
          setSession(sessionData);
          setEmail("");
          setPassword("");
          fetchAuthMethods();
        } else {
          setError("Login successful but failed to get session data.");
        }
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } catch (err) {
      setError("An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    showAlert({
      title: "Confirm Logout",
      message: "Are you sure you want to log out?",
      type: "confirm",
      onConfirm: async () => {
        setLoading(true);
        try {
          const success = await AuthService.logout();
          if (success) {
            setSession(null);
            setAuthMethods([]);
          } else {
            showAlert({
              title: "Error",
              message: "Failed to log out",
              type: "error",
            });
          }
        } catch (err) {
          showAlert({
            title: "Error",
            message: "An error occurred while logging out",
            type: "error",
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleDelete = async (id: number) => {
    showAlert({
      title: "Confirm Deletion",
      message: "Are you sure you want to delete this authentication method?",
      type: "confirm",
      onConfirm: async () => {
        setActionLoading(id);
        try {
          const success = await AuthService.deleteAuthMethod(id);
          if (success) {
            await fetchAuthMethods();
            showAlert({
              title: "Success",
              message: "Authentication method deleted successfully",
              type: "info",
            });
          } else {
            showAlert({
              title: "Error",
              message: "Failed to delete authentication method",
              type: "error",
            });
          }
        } catch (err) {
          showAlert({
            title: "Error",
            message:
              "An error occurred while deleting the authentication method",
            type: "error",
          });
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleUpdate = async (id: number) => {
    showAlert({
      title: "Confirm Update",
      message:
        "Are you sure you want to update this authentication method with the current cookies?",
      type: "confirm",
      onConfirm: async () => {
        setActionLoading(id);
        try {
          const success = await AuthService.updateAuthMethodFromBackground(id);
          if (success) {
            await fetchAuthMethods();
            showAlert({
              title: "Success",
              message: "Authentication method updated successfully",
              type: "info",
            });
          } else {
            showAlert({
              title: "Error",
              message: "Failed to update authentication method",
              type: "error",
            });
          }
        } catch (err) {
          showAlert({
            title: "Error",
            message:
              "An error occurred while updating the authentication method",
            type: "error",
          });
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  return (
    <div className="min-w-[400px] p-4">
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="translate-x-1">
            <LoaderIcon className="mr-2 size-4 animate-spin" />
          </div>
        </div>
      ) : session ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p>
              Welcome,
              <span className="text-lg font-semibold">
                {session.user.email}
              </span>
            </p>
            <Button variant="destructive" size={"xs"} onClick={handleLogout}>
              Logout
            </Button>
          </div>

          <BackgroundFetchedCookiesOrJwtTokenList />

          <AuthMethodsList
            methods={authMethods}
            actionLoading={actionLoading}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>
      ) : (
        <LoginForm
          email={email}
          password={password}
          error={error}
          loading={loading}
          onEmailChange={(e) => setEmail(e.target.value)}
          onPasswordChange={(e) => setPassword(e.target.value)}
          onSubmit={handleLogin}
        />
      )}

      {alert.show && (
        <Alert
          title={alert.title}
          message={alert.message}
          type={alert.type}
          onConfirm={alert.onConfirm}
          onCancel={hideAlert}
          onClose={hideAlert}
        />
      )}
    </div>
  );
}
