import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import "./styles/App.css";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import { AuthProvider } from "./features/auth/context/AuthContext";
import { ModalProvider } from "./context/ModalContext";
import { ProjectProvider } from "./features/projects/context/ProjectContext";

import Footer from "./components/Layout/Footer";
import Home from "./components/Layout/Home";
import Navbar from "./components/Layout/Navbar";
import AdminBudget from "./features/budget/pages/AdminBudget";
import AdminDashboard from "./features/dashboard/pages/AdminDashboard";

import ClientDashboard from "./features/dashboard/pages/ClientDashboard";
import CrewDashboard from "./features/dashboard/pages/CrewDashboard";
import FinancialDashboard from "./features/dashboard/pages/FinancialDashboard";
import LoginPage from "./features/auth/pages/LoginPage";
import ProjectDetailDashboard from "./features/projects/pages/ProjectDetailDashboard";
import RegisterPage from "./features/auth/pages/RegisterPage";
import Schedule from "./features/schedule/pages/Schedule";
import UserManagement from "./features/users/pages/UserManagement";
import Starfield from "./components/Starfield/Starfield";
import { useAuth } from "./features/auth/context/AuthContext";

//RootLayout handles the persistent UI elements and layout
//Code helping from OpenAI and Google
function RootLayout() {
  const location = useLocation();
  const { isTransiting } = useAuth();
  const hideFooter = ["/login", "/register", "/"].includes(location.pathname);

  return (
    <div className="App">
      <Starfield />
      <div className={`transition-overlay ${isTransiting ? "active" : ""}`} />
      {location.pathname !== "/" && <Navbar />}
      <div className={`main-content ${isTransiting ? "fading-out" : ""}`}>
        <Outlet />
      </div>
      {!hideFooter && <Footer />}
    </div>
  );
}

//Code helping from OpenAI and Google

function AppProviders() {
  return (
    <AuthProvider>
      <ModalProvider>
        <ProjectProvider>
          <RootLayout />
        </ProjectProvider>
      </ModalProvider>
    </AuthProvider>
  );
}

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
          <ProtectedRoute roles={["admin", "manager", "director", "accountant"]}>
            <AdminBudget />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute roles={["admin", "manager", "director", "accountant"]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/projects/:projectId",
        element: (
          <ProtectedRoute roles={["admin", "manager", "director", "accountant"]}>
            <ProjectDetailDashboard />
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
          <ProtectedRoute
            roles={["admin", "manager", "director", "accountant", "coordinator", "production_crew", "production crew", "client"]}
          >
            <Schedule />
          </ProtectedRoute>
        ),
      },
      {
        path: "finance",
        element: (
          <ProtectedRoute roles={["admin", "manager", "director", "accountant"]}>
            <FinancialDashboard />
          </ProtectedRoute>
        ),
      },


    ],
  },
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
