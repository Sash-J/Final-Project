import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
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
import Footer from "./components/ui/Footer";
import Starfield from "./components/ui/Starfield";

function AppContent() {
  const location = useLocation();
  const hideFooter = ["/login", "/register"].includes(location.pathname);

  return (
    <div className="App">
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["client"]}>
                <ClientDashboard />
              </ProtectedRoute>
            }
          />


          <Route
            path="/crew-dashboard"
            element={
              <ProtectedRoute roles={["production_crew"]}>
                <CrewDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-budget"
            element={
              <ProtectedRoute roles={["admin", "manager"]}>
                <AdminBudget />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={["admin"]}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute roles={["admin", "manager", "production_crew", "client"]}>
                <Schedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute roles={["admin", "manager", "client"]}>
                <FinancialDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
      {!hideFooter && <Footer />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <Router>
          <Starfield />
          <AppContent />
        </Router>
      </ModalProvider>
    </AuthProvider>
  );
}

export default App;
