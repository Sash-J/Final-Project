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

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const nextStep = () => {
        if (step === 1) {
            if (!formData.username || !formData.password) {
                setError('Username and password are required');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
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
                            <input name="username" type="text" value={formData.username} onChange={handleChange} required placeholder="Choose a username" />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input name="password" type="password" value={formData.password} onChange={handleChange} required placeholder="Choose a password" />
                        </div>
                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required placeholder="Confirm your password" />
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
                            <input name="full_name" type="text" value={formData.full_name} onChange={handleChange} required placeholder="Enter your full name" />
                        </div>
                        <div className="form-group">
                            <label>Telephone</label>
                            <input name="telephone" type="tel" value={formData.telephone} onChange={handleChange} required placeholder="Enter your phone number" />
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
                            <textarea name="address" value={formData.address} onChange={handleChange} required placeholder="Enter your full address" rows="4"></textarea>
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
                    {message && <p className="success-msg">{message}</p>}
                    {error && <p className="error-msg">{error}</p>}
                </form>

                <div className="register-footer">
                    <p>Already have an account? <Link to="/login">Login here</Link></p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
