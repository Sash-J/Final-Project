import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ui/ProtectedRoute';

import Navbar from './components/ui/Navbar';
import Home from './components/pages/Home';
import AdminBudget from './components/pages/AdminBudget';
import LoginPage from './components/pages/LoginPage';
// import AdminPanel from './components/pages/AdminPanel'; // Merged into AdminBudget
// import BudgetEntryForm from './components/pages/BudgetEntryForm'; // Merged into AdminBudget
import RegisterPage from './components/pages/RegisterPage';
import UserManagement from './components/pages/UserManagement';
import Footer from './components/ui/Footer';

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="App">
                    <Navbar />
                    <div className="main-content">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            
                            <Route 
                                path="/admin-budget" 
                                element={
                                    <ProtectedRoute roles={['admin', 'manager']}>
                                        <AdminBudget />
                                    </ProtectedRoute>
                                } 
                            />
                            <Route 
                                path="/users" 
                                element={
                                    <ProtectedRoute roles={['admin']}>
                                        <UserManagement />
                                    </ProtectedRoute>
                                } 
                            />
                        </Routes>
                    </div>
                    <Footer />
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;