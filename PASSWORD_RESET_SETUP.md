# Password Reset Feature - Setup Guide

## Overview
The Sales Tracker application now includes a complete password reset feature that allows users to reset their passwords via email when they forget them.

## Features Implemented

### Backend
- ✅ Password reset token generation with expiration (1 hour)
- ✅ Rate limiting to prevent spam (5-minute cooldown)
- ✅ Secure token validation
- ✅ Email sending via Gmail/Nodemailer
- ✅ JWT tokens now expire after 1 year (for internal use)

### Frontend
- ✅ Forgot Password page with email submission
- ✅ Reset Password page with token validation
- ✅ Password strength requirements
- ✅ Success/error handling with user feedback
- ✅ "Forgot Password?" link on login page

### Database
- ✅ New `password_reset_tokens` table with proper indexes
- ✅ Tracking of token usage and expiration

## Setup Instructions

### 1. Gmail App Password Setup

To send password reset emails, you need to configure Gmail with an App Password:

1. **Enable 2-Factor Authentication** on your Google Account:
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. **Generate an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" from the dropdown
   - Select your device type
   - Click "Generate"
   - Copy the 16-character password shown (spaces don't matter)

3. **Update Environment Variables**:
   ```bash
   # In sales-tracker-server/.env
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  # Your 16-character app password
   ```

### 2. Frontend URL Configuration

Make sure your frontend URL is correctly set for the reset links:

```bash
# In sales-tracker-server/.env
FRONTEND_URL=http://localhost:3000  # For development
# or
FRONTEND_URL=https://sales-tracker-client.onrender.com  # For production
```

### 3. Database Migration

The migration has already been run, but if you need to run it again:

```bash
cd sales-tracker-server
psql -U postgres -d sales_tracker -f db/migrations/create_password_reset_tokens.sql
```

## How It Works

### User Flow

1. **User Forgets Password**:
   - Click "Forgot your password?" link on login page
   - Enter email address
   - Submit form

2. **Email Sent**:
   - System generates a secure random token
   - Token is stored in database with 1-hour expiration
   - Email sent with reset link containing the token

3. **Password Reset**:
   - User clicks link in email
   - System validates token (not expired, not used)
   - User enters new password (minimum 6 characters)
   - Password is updated and token marked as used

### Security Features

- **Token Expiration**: Tokens expire after 1 hour
- **One-Time Use**: Tokens can only be used once
- **Rate Limiting**: Users must wait 5 minutes between reset requests
- **Email Enumeration Protection**: Same response whether email exists or not
- **Secure Token Generation**: Uses crypto.randomBytes for unpredictable tokens

## API Endpoints

### Request Password Reset
```
POST /api/password-reset/request
Body: { "email": "user@example.com" }
Response: { "message": "If an account exists..." }
```

### Reset Password
```
POST /api/password-reset/reset
Body: { "token": "...", "newPassword": "..." }
Response: { "message": "Password has been successfully reset...", "success": true }
```

### Validate Token
```
GET /api/password-reset/validate/:token
Response: { "valid": true, "email": "...", "name": "..." }
```

## Troubleshooting

### Email Not Sending

1. **Check Gmail Configuration**:
   - Verify GMAIL_USER and GMAIL_APP_PASSWORD in .env
   - Ensure you're using an App Password, not your regular password
   - Check that 2FA is enabled on your Google account

2. **Check Server Logs**:
   ```bash
   npm run dev  # Check console output for email sending errors
   ```

3. **Test Email Service**:
   - The server will log "Password reset email sent to: [email]" on success
   - Check spam/junk folder if email doesn't appear in inbox

### Token Issues

1. **"Invalid or expired token" error**:
   - Token may have expired (1 hour limit)
   - Token may have already been used
   - Request a new password reset

2. **Rate Limiting**:
   - If you see "Please wait a few minutes", wait 5 minutes before requesting another reset

## Testing the Feature

1. **Start the servers**:
   ```bash
   # Terminal 1 - Backend
   cd sales-tracker-server
   npm run dev

   # Terminal 2 - Frontend
   cd sales-tracker-client
   npm run dev
   ```

2. **Test Password Reset**:
   - Navigate to http://localhost:3000/login
   - Click "Forgot your password?"
   - Enter a registered email address
   - Check email for reset link
   - Click link and enter new password
   - Try logging in with new password

## Production Deployment

When deploying to production:

1. **Update Environment Variables** on your hosting platform:
   - Add GMAIL_USER and GMAIL_APP_PASSWORD
   - Ensure FRONTEND_URL points to your production frontend

2. **Run Database Migration** if needed:
   ```sql
   -- The migration SQL is in:
   -- sales-tracker-server/db/migrations/create_password_reset_tokens.sql
   ```

3. **Verify CORS Settings** allow your production frontend URL

## Maintenance

### Clean Up Expired Tokens (Optional)

You can periodically clean up expired tokens to keep the database tidy:

```sql
DELETE FROM password_reset_tokens
WHERE expires_at < NOW()
   OR (used = true AND used_at < NOW() - INTERVAL '7 days');
```

This can be automated with a cron job or scheduled task if desired.

## Files Modified/Created

### Backend
- `/controllers/passwordResetController.js` - Password reset logic
- `/queries/passwordResetQueries.js` - Database queries for tokens
- `/routes/passwordResetRoutes.js` - API routes
- `/services/emailService.js` - Email sending with Nodemailer
- `/db/migrations/create_password_reset_tokens.sql` - Database schema
- `/app.js` - Added password reset routes
- `/controllers/authController.js` - Updated JWT expiration to 365 days

### Frontend
- `/pages/ForgotPassword.jsx` - Forgot password form
- `/pages/ResetPassword.jsx` - Password reset form
- `/styles/ForgotPassword.css` - Forgot password styles
- `/styles/ResetPassword.css` - Reset password styles
- `/services/api.js` - Added password reset API functions
- `/App.jsx` - Added routes for password reset pages
- `/pages/Login.jsx` - Added "Forgot password?" link
- `/styles/Auth.css` - Updated styles for forgot password link

## Support

If you encounter any issues with the password reset feature:

1. Check the server logs for detailed error messages
2. Verify all environment variables are correctly set
3. Ensure the database migration has been run
4. Check that your Gmail App Password is valid and 2FA is enabled

For additional help, refer to the error messages in the browser console or server logs.