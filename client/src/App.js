import React from "react";
import { 
  createBrowserRouter, 
  RouterProvider, 
  Outlet, 
  useLocation 
} from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./contexts/AuthContext";
import { ModalProvider } from "./contexts/ModalContext";
import ProtectedRoute from "./components/ui/ProtectedRoute";

import Navbar from "./components/ui/Navbar";
import Home from "./components/pages/Home";
import AdminBudget from "./components/pages/AdminBudget";
import AdminDashboard from "./components/pages/AdminDashboard";
import LoginPage from "./components/pages/LoginPage";
import RegisterPage from "./components/pages/RegisterPage";
import UserManagement from "./components/pages/UserManagement";
import ClientDashboard from "./components/pages/ClientDashboard";
import CrewDashboard from "./components/pages/CrewDashboard";
import Schedule from "./components/pages/Schedule";
import FinancialDashboard from "./components/pages/FinancialDashboard";
import BudgetPredictor from "./components/pages/BudgetPredictor";
import Footer from "./components/ui/Footer";
import Starfield from "./components/ui/Starfield";
import { useAuth } from "./contexts/AuthContext";

/**
 * RootLayout handles the persistent UI elements and layout
 * shared across all routes in the application.
 * Note: It must be a child of AppProviders to access Auth/Modal context.
 */
function RootLayout() {
  const location = useLocation();
  const { isTransiting } = useAuth();
  const hideFooter = ["/login", "/register"].includes(location.pathname);

  return (
    <div className="App">
      <div className={`transition-overlay ${isTransiting ? "active" : ""}`} />
      <Navbar />
      <div className={`main-content ${isTransiting ? "fading-out" : ""}`}>
        {/* Outlet renders the matched child routes */}
        <Outlet />
      </div>
      {!hideFooter && <Footer />}
    </div>
  );
}

/**
 * AppProviders correctly nests our contexts inside the Data Router context.
 * This allows hooks like useNavigate (used in AuthProvider) to work correctly.
 */
function AppProviders() {
  return (
    <AuthProvider>
      <ModalProvider>
        <Starfield />
        <RootLayout />
      </ModalProvider>
    </AuthProvider>
  );
}

// Define the application router configuration with AppProviders at the root
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppProviders />,
    children: [
      { path: "", element: <Home /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute roles={["client"]}>
            <ClientDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "crew-dashboard",
        element: (
          <ProtectedRoute roles={["production_crew"]}>
            <CrewDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin-budget",
        element: (
          <ProtectedRoute roles={["admin", "manager"]}>
            <AdminBudget />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute roles={["admin", "manager"]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "users",
        element: (
          <ProtectedRoute roles={["admin"]}>
            <UserManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: "schedule",
        element: (
          <ProtectedRoute roles={["admin", "manager", "production_crew", "client"]}>
            <Schedule />
          </ProtectedRoute>
        ),
      },
      {
        path: "finance",
        element: (
          <ProtectedRoute roles={["admin", "manager"]}>
            <FinancialDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "budget-predictor",
        element: (
          <ProtectedRoute roles={["admin", "manager"]}>
            <BudgetPredictor />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
