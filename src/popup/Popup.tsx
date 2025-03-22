import React, { useEffect, useState } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  authToken?: string;
}

const Popup: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
  });

  useEffect(() => {
    // Check authentication status on mount
    chrome.storage.local.get('authToken', ({ authToken }) => {
      setAuthState({
        isAuthenticated: !!authToken,
        authToken,
      });
    });
  }, []);

  const handleLogin = async () => {
    // Open the login page in a new tab
    chrome.tabs.create({
      url: 'https://ddddao.xyz/login',
    });
  };

  const handleLogout = async () => {
    // Clear the auth token
    await chrome.storage.local.remove('authToken');
    setAuthState({
      isAuthenticated: false,
    });
  };

  return (
    <div className="w-[300px] p-4">
      <h1 className="mb-4 text-xl font-bold">DDDD DAO Auth Sync</h1>

      {authState.isAuthenticated ? (
        <div>
          <p className="mb-4 text-green-600">✓ Connected to DDDD DAO</p>
          <button
            onClick={handleLogout}
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-gray-600">Not connected to DDDD DAO</p>
          <button
            onClick={handleLogin}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Connect
          </button>
        </div>
      )}
    </div>
  );
};

export default Popup;
