import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ChatPage from "./components/ChatPage.jsx";
import Header from "./components/Header.jsx";
import LoginPage from "./components/LoginPage.jsx";
import NotFoundPage from "./components/NotFoundPage.jsx";
import SignupPage from "./components/SignupPage.jsx";
import { useAuthStore } from "./store/auth.js";

// Styles are imported next to the theme provider: in browser-mode tests,
// imports from index.jsx do not reach the page.
// The query client is created in init.jsx so the socket handlers can write
// to the same cache the UI reads.
const App = ({ queryClient }) => {
  const token = useAuthStore((state) => state.token);

  return (
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Notifications position="bottom-right" />
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={token ? <ChatPage /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            {/* A signed-in user must not overwrite a live session by
                registering a new account. */}
            <Route path="/signup" element={token ? <Navigate to="/" replace /> : <SignupPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  );
};

export default App;
