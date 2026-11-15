import React, { Suspense, lazy } from "react";
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
import GlobalToaster from "./components/toast/GlobalToaster";
import Starfield from "./components/Starfield/Starfield";
import DashboardSkeleton from "./components/Skeleton/DashboardSkeleton";
import { useAuth } from "./features/auth/context/AuthContext";

// Trick #5: Route-level code splitting so landing/auth do not download heavy admin/PDF/chart chunks
const AdminBudget = lazy(() => import("./features/budget/pages/AdminBudget"));
const ClientBudgetVault = lazy(() => import("./features/budget/pages/ClientBudgetVault"));
const AdminDashboard = lazy(() => import("./features/dashboard/pages/AdminDashboard"));
const ClientDashboard = lazy(() => import("./features/dashboard/pages/ClientDashboard"));
const CrewDashboard = lazy(() => import("./features/dashboard/pages/CrewDashboard"));
const FinanceWorkspace = lazy(() => import("./features/finance/FinanceWorkspace"));
const LoginPage = lazy(() => import("./features/auth/pages/LoginPage"));
const ProjectDetailDashboard = lazy(() => import("./features/projects/pages/ProjectDetailDashboard"));
const RegisterPage = lazy(() => import("./features/auth/pages/RegisterPage"));
const Schedule = lazy(() => import("./features/schedule/pages/Schedule"));
const UserManagement = lazy(() => import("./features/users/pages/UserManagement"));

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
        <Suspense
          fallback={
            <div className="route-suspense-shell" aria-busy="true">
              <DashboardSkeleton />
            </div>
          }
        >
          <Outlet />
        </Suspense>
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
          <ProtectedRoute roles={["crew", "department head"]}>
            <CrewDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin-budget",
        element: (
          <ProtectedRoute permissions={["budget.view"]}>
            <AdminBudget />
          </ProtectedRoute>
        ),
      },
      {
        path: "budget",
        element: (
          <ProtectedRoute permissions={["budget.view"]}>
            <ClientBudgetVault />
          </ProtectedRoute>
        ),
      },
      {
        path: "budgets",
        element: (
          <ProtectedRoute permissions={["budget.view"]}>
            <ClientBudgetVault />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute permissions={["project.view"]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/projects/:projectId",
        element: (
          <ProtectedRoute permissions={["project.view"]}>
            <ProjectDetailDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "users",
        element: (
          <ProtectedRoute permissions={["user.view"]}>
            <UserManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: "schedule",
        element: (
          <ProtectedRoute permissions={["schedule.view"]}>
            <Schedule />
          </ProtectedRoute>
        ),
      },
      {
        path: "finance",
        element: (
          <ProtectedRoute permissions={["finance.view"]}>
            <FinanceWorkspace />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

function App() {
  return (
    <>
      <GlobalToaster />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
