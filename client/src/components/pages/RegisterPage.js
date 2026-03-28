import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './RegisterPage.css';

const API = 'http://localhost:5000';

const RegisterPage = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Field States
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        role: 'client',
        full_name: '',
        telephone: '',
        address: ''
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const nextStep = () => {
        if (step === 1) {
            const { username, password, confirmPassword } = formData;
            if (!username || !password) {
                setError('Username and password are required');
                return;
            }

            // Username Validation: A-Z, a-z, _ only
            if (!/^[a-zA-Z_]+$/.test(username)) {
                setError('Username can only contain letters and underscores (no spaces or numbers)');
                return;
            }

            // Password Validation: Max 8 characters
            if (password.length > 8) {
                setError('Password must be at most 8 characters');
                return;
            }

            // Password Validation: Upper and Lower required
            if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
                setError('Password must contain both uppercase and lowercase letters');
                return;
            }

            // Password Validation: Max 4 numbers
            const numCount = (password.match(/[0-9]/g) || []).length;
            if (numCount > 4) {
                setError('Password can contain at most 4 numbers');
                return;
            }

            // Password Validation: Max 1 special character
            const specialCount = (password.match(/[^a-zA-Z0-9\s]/g) || []).length;
            if (specialCount > 1) {
                setError('Password can contain at most 1 special character');
                return;
            }

            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
        } else if (step === 2) {
            if (!formData.full_name || !formData.telephone) {
                setError('Full Name and Telephone are required');
                return;
            }
        }
        setError('');
        setStep(step + 1);
    };

    const prevStep = () => {
        setError('');
        setStep(step - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const response = await fetch(`${API}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message);
                setTimeout(() => navigate('/login'), 3000);
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            setError('Server error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="step-content">
                        <h3>Step 1: Account Credentials</h3>
                        <div className="form-group">
                            <label>Username</label>
                            <input 
                                name="username" 
                                type="text" 
                                value={formData.username} 
                                onChange={handleChange} 
                                required 
                                maxLength={30}
                                placeholder="Choose a username" 
                            />
                        </div>
                        <div className="form-group password-group">
                            <label>Password</label>
                            <div className="password-input-wrapper">
                                <input 
                                    name="password" 
                                    type={showPassword ? "text" : "password"} 
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    required 
                                    placeholder="Choose a password" 
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? "Hide Password" : "Show Password"}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="form-group password-group">
                            <label>Confirm Password</label>
                            <div className="password-input-wrapper">
                                <input 
                                    name="confirmPassword" 
                                    type={showConfirmPassword ? "text" : "password"} 
                                    value={formData.confirmPassword} 
                                    onChange={handleChange} 
                                    required 
                                    placeholder="Confirm your password" 
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    title={showConfirmPassword ? "Hide Password" : "Show Password"}
                                >
                                    {showConfirmPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button type="button" className="register-btn next-btn" onClick={nextStep}>Next: Personal Details</button>
                    </div>
                );
            case 2:
                return (
                    <div className="step-content animate-in">
                        <h3>Step 2: Personal Details</h3>
                        <div className="form-group">
                            <label>Full Name</label>
                            <input 
                                name="full_name" 
                                type="text" 
                                value={formData.full_name} 
                                onChange={handleChange} 
                                required 
                                maxLength={100}
                                placeholder="Enter your full name" 
                            />
                        </div>
                        <div className="form-group">
                            <label>Telephone</label>
                            <input 
                                name="telephone" 
                                type="tel" 
                                value={formData.telephone} 
                                onChange={handleChange} 
                                required 
                                maxLength={20}
                                placeholder="Enter your phone number" 
                            />
                        </div>
                        <div className="btn-row">
                            <button type="button" className="prev-btn" onClick={prevStep}>Back</button>
                            <button type="button" className="register-btn next-btn" onClick={nextStep}>Next: Contact Info</button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="step-content animate-in">
                        <h3>Step 3: Contact Information</h3>
                        <div className="form-group">
                            <label>Physical Address</label>
                            <textarea 
                                name="address" 
                                value={formData.address} 
                                onChange={handleChange} 
                                required 
                                maxLength={500}
                                placeholder="Enter your full address" 
                                rows="4"
                            ></textarea>
                        </div>
                        <div className="btn-row">
                            <button type="button" className="prev-btn" onClick={prevStep}>Back</button>
                            <button type="submit" className="register-btn submit-btn" disabled={loading}>
                                {loading ? 'Creating Account...' : 'Finish Registration'}
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="register-container">
            <div className="register-card">
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${(step / 3) * 100}%` }}></div>
                </div>
                <h2>{step === 3 ? 'FINALIZE' : 'JOIN US'}</h2>
                <div className="step-indicator">Step {step} of 3</div>

                <form onSubmit={handleSubmit}>
                    {renderStep()}
                <div className="status-msg-container" style={{ minHeight: '40px' }}>
                    {message && <p className="success-msg">{message}</p>}
                    {error && <p className="error-msg">{error}</p>}
                </div>
                </form>

                <div className="register-footer">
                    <p>Already have an account? <Link to="/login">Login here</Link></p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
