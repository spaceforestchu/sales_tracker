import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordAPI } from '../services/api';
import '../styles/ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await forgotPasswordAPI.requestReset(email);
      setMessage(response.message);
      setSubmitted(true);
    } catch (error) {
      if (error.message?.includes('wait a few minutes')) {
        setError('Too many requests. Please wait a few minutes and try again.');
      } else {
        setError(error.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password">
      <div className="forgot-password__container">
        <div className="forgot-password__card">
          <h1 className="forgot-password__title">Reset Your Password</h1>

          {!submitted ? (
            <>
              <p className="forgot-password__description">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="forgot-password__form">
                <div className="forgot-password__form-group">
                  <label htmlFor="email" className="forgot-password__label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="forgot-password__input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="forgot-password__error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="forgot-password__submit-btn"
                  disabled={loading || !email}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="forgot-password__footer">
                <Link to="/login" className="forgot-password__link">
                  Back to Login
                </Link>
              </div>
            </>
          ) : (
            <div className="forgot-password__success">
              <div className="forgot-password__success-icon">✓</div>
              <h2 className="forgot-password__success-title">Check Your Email</h2>
              <p className="forgot-password__success-message">
                {message}
              </p>
              <p className="forgot-password__success-note">
                If you don't see the email, check your spam folder. The link will expire in 1 hour.
              </p>
              <div className="forgot-password__footer">
                <Link to="/login" className="forgot-password__link">
                  Return to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;