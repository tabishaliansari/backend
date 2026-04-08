import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, CheckCircle, AlertCircle } from 'lucide-react'
import authService from '@/api/authService'
import { toast } from 'sonner'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [error, setError] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [email, setEmail] = useState('')

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Invalid reset link. No token provided.')
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!password.trim()) {
      setError('Please enter a password')
      return
    }
    if (!confirmPassword.trim()) {
      setError('Please confirm your password')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    try {
      setStatus('loading')
      setError('')
      await authService.resetPassword(token, password)
      setStatus('success')
      toast.success('Password reset successfully!')
      setTimeout(() => navigate('/auth?mode=login'), 2000)
    } catch (err) {
      setStatus('error')
      const errorMessage = err.response?.data?.message || 'Failed to reset password. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
      // Show resend option if token is invalid or expired
      if (errorMessage.includes('token') || errorMessage.includes('expired')) {
        setShowResend(true)
      }
    }
  }

  const handleResendEmail = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Please enter your email')
      return
    }

    try {
      await authService.forgotPassword(email)
      toast.success('Reset email sent! Check your inbox.')
      setShowResend(false)
      setEmail('')
    } catch (err) {
      toast.error('Failed to send reset email')
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center">
          {(status === 'idle' || status === 'loading') && (
            <>
              <Lock className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Set New Password
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={status === 'loading'}
                  />
                </div>

                <div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={status === 'loading'}
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading' || !token}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {status === 'loading' ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>

              <button
                onClick={() => navigate('/auth?mode=login')}
                className="w-full text-blue-600 dark:text-blue-400 hover:underline font-semibold py-2 px-4 mt-4"
              >
                Back to Login
              </button>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Password Reset!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your password has been reset successfully. You can now login with your new password.
              </p>

              <button
                onClick={() => navigate('/auth?mode=login')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Go to Login
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Reset Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>

              {!showResend && (
                <button
                  onClick={() => {
                    setStatus('idle')
                    setError('')
                    setPassword('')
                    setConfirmPassword('')
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors mb-3"
                >
                  Try Again
                </button>
              )}

              {showResend && (
                <>
                  <form onSubmit={handleResendEmail} className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      Resend Reset Email
                    </button>
                  </form>
                </>
              )}

              <button
                onClick={() => navigate('/auth?mode=login')}
                className="w-full text-blue-600 dark:text-blue-400 hover:underline font-semibold py-2 px-4 mt-3"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
