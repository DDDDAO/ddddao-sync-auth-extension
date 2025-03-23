import { useState, useEffect } from "react";
import { AuthService } from "../services/auth";
import { DDCookie, Session } from "../types/auth";
import { Alert } from "../components/alert";

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
        setSession(sessionData);
        setEmail("");
        setPassword("");
        fetchAuthMethods();
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

  const handleRefresh = () => {
    setLoading(true);
    fetchAuthMethods().finally(() => setLoading(false));
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : session ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              Welcome, {session.user.email}
            </h2>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-md font-medium">Authentication Methods</h3>
            {authMethods.length === 0 ? (
              <p className="text-gray-500">No authentication methods found.</p>
            ) : (
              <div className="space-y-2">
                {authMethods.map((method) => (
                  <div
                    key={method.id}
                    className="p-3 border rounded-lg bg-white shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">ID: {method.id}</p>
                        <p className="text-sm text-gray-600">
                          Created: {new Date(method.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          Updated: {new Date(method.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUpdate(method.id)}
                          disabled={actionLoading === method.id}
                          className="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:bg-blue-300"
                        >
                          {actionLoading === method.id ? (
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            "Update"
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(method.id)}
                          disabled={actionLoading === method.id}
                          className="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:bg-red-300"
                        >
                          {actionLoading === method.id ? (
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            "Delete"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Login</h2>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                "Login"
              )}
            </button>
          </form>
        </div>
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
