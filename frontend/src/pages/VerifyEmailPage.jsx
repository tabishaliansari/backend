import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, CheckCircle, AlertCircle } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import authService from '@/api/authService'
import { toast } from 'sonner'

function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [verificationStatus, setVerificationStatus] = useState('pending') // pending | success | error
  const [email, setEmail] = useState('')
  const [showResend, setShowResend] = useState(false)
  const { isAuthenticated } = useAuthStore()

  const token = searchParams.get('token')

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated) {
      navigate('/dashboard')
      return
    }

    // If token is provided, automatically verify
    if (token) {
      verifyEmail(token)
    }
  }, [token, isAuthenticated, navigate])

  const verifyEmail = async (emailToken) => {
    try {
      setVerificationStatus('pending')
      await authService.verifyEmail(emailToken)
      setVerificationStatus('success')
      toast.success('Email verified successfully!')
      setTimeout(() => navigate('/auth'), 2000)
    } catch (err) {
      setVerificationStatus('error')
      toast.error('Email verification failed')
    }
  }

  const handleResendEmail = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Please enter your email')
      return
    }

    try {
      await authService.resendEmailVerification(email)
      toast.success('Verification email sent! Check your inbox.')
      setShowResend(false)
    } catch (err) {
      toast.error('Failed to resend verification email')
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center">
          {verificationStatus === 'pending' && (
            <>
              <Mail className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Verify Your Email
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                We've sent a verification link to your email address. Please check your inbox and verify your email.
              </p>

              <button
                onClick={() => setShowResend(!showResend)}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-4"
              >
                {showResend ? 'Hide' : 'Didn\'t receive email?'}
              </button>

              {showResend && (
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
                    Resend Verification Email
                  </button>
                </form>
              )}
            </>
          )}

          {verificationStatus === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Email Verified!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your email has been verified successfully. You can now login to your account.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Go to Login
              </button>
            </>
          )}

          {verificationStatus === 'error' && (
            <>
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Verification Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The verification link is invalid or has expired. Please try again.
              </p>

              <button
                onClick={() => setShowResend(!showResend)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors mb-3"
              >
                Resend Verification Email
              </button>

              {showResend && (
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
                    Resend
                  </button>
                </form>
              )}

              <button
                onClick={() => navigate('/auth')}
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

export default VerifyEmailPage
