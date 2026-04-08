import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, CheckCircle, AlertCircle } from 'lucide-react'
import authService from '@/api/authService'
import { toast } from 'sonner'

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email')
      return
    }

    try {
      setStatus('loading')
      setError('')
      await authService.forgotPassword(email)
      setStatus('success')
      toast.success('Reset email sent! Check your inbox.')
    } catch (err) {
      setStatus('error')
      const errorMessage =
        err.response?.data?.message || 'Failed to send reset email. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center">
          {(status === 'idle' || status === 'loading') && (
            <>
              <Mail className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Reset Your Password
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={status === 'loading'}
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
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
                Email Sent!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We've sent a password reset link to {email}. Please check your inbox and follow
                the link to reset your password.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                The link will expire in 20 minutes.
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
                Something Went Wrong
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>

              <button
                onClick={() => {
                  setStatus('idle')
                  setError('')
                  setEmail('')
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors mb-3"
              >
                Try Again
              </button>

              <button
                onClick={() => navigate('/auth?mode=login')}
                className="w-full text-blue-600 dark:text-blue-400 hover:underline font-semibold py-2 px-4"
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

export default ForgotPasswordPage
