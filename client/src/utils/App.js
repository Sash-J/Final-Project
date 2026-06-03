import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import "../App.css";
import ProtectedRoute from "../components/ui/ProtectedRoute";
import { AuthProvider } from "../contexts/AuthContext";
import { ModalProvider } from "../contexts/ModalContext";
import { ProjectProvider } from "../contexts/ProjectContext";

import Footer from "../components/home/Footer";
import Home from "../components/home/Home";
import Navbar from "../components/home/Navbar";
import AdminBudget from "../components/pages/AdminBudget";
import AdminDashboard from "../components/pages/AdminDashboard";

import ClientDashboard from "../components/pages/ClientDashboard";
import CrewDashboard from "../components/pages/CrewDashboard";
import FinancialDashboard from "../components/pages/FinancialDashboard";
import LoginPage from "../components/pages/LoginPage";
import ProjectDetailDashboard from "../components/pages/project/ProjectDetailDashboard";
import RegisterPage from "../components/pages/RegisterPage";
import Schedule from "../components/pages/Schedule";
import UserManagement from "../components/pages/UserManagement";
import Starfield from "../components/ui/Starfield";
import { useAuth } from "../contexts/AuthContext";

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
        path: "admin/projects/:projectId",
        element: (
          <ProtectedRoute roles={["admin", "manager"]}>
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
            roles={["admin", "manager", "production_crew", "client"]}
          >
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
