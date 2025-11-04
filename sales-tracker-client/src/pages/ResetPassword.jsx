import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { forgotPasswordAPI } from '../services/api';
import '../styles/ResetPassword.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError('No reset token provided');
      setValidating(false);
      return;
    }

    try {
      const response = await forgotPasswordAPI.validateToken(token);
      if (response.valid) {
        setTokenValid(true);
        setUserInfo(response);
      } else {
        setError('Invalid or expired reset token');
      }
    } catch (error) {
      setError(error.message || 'Invalid or expired reset token');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await forgotPasswordAPI.resetPassword(token, password);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setError(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="reset-password">
        <div className="reset-password__container">
          <div className="reset-password__card">
            <div className="reset-password__loading">
              Validating reset token...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid && !success) {
    return (
      <div className="reset-password">
        <div className="reset-password__container">
          <div className="reset-password__card">
            <div className="reset-password__error-container">
              <h1 className="reset-password__title">Invalid Reset Link</h1>
              <p className="reset-password__error-message">
                {error || 'This password reset link is invalid or has expired.'}
              </p>
              <p className="reset-password__error-note">
                Password reset links expire after 1 hour for security reasons.
              </p>
              <Link to="/forgot-password" className="reset-password__link">
                Request New Reset Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-password">
        <div className="reset-password__container">
          <div className="reset-password__card">
            <div className="reset-password__success">
              <div className="reset-password__success-icon">✓</div>
              <h1 className="reset-password__title">Password Reset Successful!</h1>
              <p className="reset-password__success-message">
                Your password has been successfully reset.
              </p>
              <p className="reset-password__success-note">
                Redirecting to login page...
              </p>
              <Link to="/login" className="reset-password__link">
                Go to Login Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password">
      <div className="reset-password__container">
        <div className="reset-password__card">
          <h1 className="reset-password__title">Create New Password</h1>

          {userInfo && (
            <p className="reset-password__user-info">
              Resetting password for: <strong>{userInfo.email}</strong>
            </p>
          )}

          <form onSubmit={handleSubmit} className="reset-password__form">
            <div className="reset-password__form-group">
              <label htmlFor="password" className="reset-password__label">
                New Password
              </label>
              <div className="reset-password__input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="reset-password__input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
            </div>

            <div className="reset-password__form-group">
              <label htmlFor="confirmPassword" className="reset-password__label">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                className="reset-password__input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className="reset-password__checkbox-group">
              <input
                type="checkbox"
                id="showPassword"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <label htmlFor="showPassword">Show password</label>
            </div>

            {error && (
              <div className="reset-password__error">
                {error}
              </div>
            )}

            <div className="reset-password__requirements">
              <p className="reset-password__requirement-title">Password must:</p>
              <ul className="reset-password__requirement-list">
                <li className={password.length >= 6 ? 'met' : ''}>
                  Be at least 6 characters long
                </li>
                <li className={password === confirmPassword && password ? 'met' : ''}>
                  Match confirmation password
                </li>
              </ul>
            </div>

            <button
              type="submit"
              className="reset-password__submit-btn"
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>

          <div className="reset-password__footer">
            <Link to="/login" className="reset-password__link">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;