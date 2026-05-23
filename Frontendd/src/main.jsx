import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { API_BASE_URL } from "./config";

// Global fetch interceptor to automatically include credentials (cookies) for all API requests
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input ? input.url : null);
  if (url && (url.startsWith(API_BASE_URL) || url.includes('/api/'))) {
    init = init || {};
    init.credentials = 'include';
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  </StrictMode>,
);
