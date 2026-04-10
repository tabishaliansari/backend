import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import useThemeStore from '@/store/themeStore'
import githubOAuthService from '@/api/githubOAuthService'
import GitHubMarkDark from '@/assets/github/github-mark.svg'
import GitHubMarkWhite from '@/assets/github/github-mark-white.svg'
import { toast } from 'sonner'

function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, register, isLoading, error, clearError } = useAuthStore()
  const theme = useThemeStore((state) => state.theme)
  const gitHubLogo = theme === 'dark' ? GitHubMarkDark : GitHubMarkWhite
  const [authMode, setAuthMode] = useState('login')

  // Login form state
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })

  // Signup form state
  const [signupForm, setSignupForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  // Initialize auth mode from query param
  useEffect(() => {
    const modeFromUrl = searchParams.get('mode')
    if (modeFromUrl === 'signup' || modeFromUrl === 'login') {
      setAuthMode(modeFromUrl)
    }
  }, [searchParams])

  // Map error codes to user-friendly messages
  const getErrorMessage = (errorCode) => {
    const errorMessages = {
      OAUTH_ACCOUNT_EXISTS: "An account with this email already exists. Please login with your credentials instead.",
      INVALID_OAUTH_STATE: "Security check failed. Please try GitHub authentication again.",
      OAUTH_INVALID_CODE: "GitHub authentication code expired. Please try again.",
      OAUTH_PROVIDER_ERROR: "Failed to fetch your GitHub profile. Please try again.",
      BAD_REQUEST: "Invalid request. Please try again.",
    }
    return errorMessages[errorCode] || "GitHub authentication failed. Please try again."
  }

  const handleLoginChange = (e) => {
    const { name, value } = e.target
    setLoginForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSignupChange = (e) => {
    const { name, value } = e.target
    setSignupForm(prev => ({ ...prev, [name]: value }))
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    clearError()

    try {
      await login(loginForm)
      toast.success('Login successful!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(error || 'Login failed')
    }
  }

  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    clearError()

    if (signupForm.password !== signupForm.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      await register({
        fullname: `${signupForm.firstName} ${signupForm.lastName}`,
        username: signupForm.username,
        email: signupForm.email,
        password: signupForm.password,
      })
      toast.success('Account created! Please verify your email.')
      navigate('/auth/verify')
    } catch (err) {
      toast.error(error || 'Registration failed')
    }
  }

  const toggleAuthMode = () => {
    clearError()
    setAuthMode(authMode === 'login' ? 'signup' : 'login')
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          {authMode === 'login' ? 'Login' : 'Create Account'}
        </h2>

        {authMode === 'login' ? (
          // Login Form
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* OAuth Error Message */}
            {searchParams.get('error') && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm border border-yellow-200 dark:border-yellow-800">
                <p className="font-medium mb-1">GitHub Authentication Failed</p>
                <p>{getErrorMessage(searchParams.get('error'))}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={loginForm.email}
                onChange={handleLoginChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={loginForm.password}
                onChange={handleLoginChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => githubOAuthService.redirectToGitHub()}
              className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              <img src={gitHubLogo} alt="GitHub" className="w-5 h-5" />
              <span>Continue with GitHub</span>
            </button>
          </form>
        ) : (
          // Signup Form
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={signupForm.firstName}
                  onChange={handleSignupChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={signupForm.lastName}
                  onChange={handleSignupChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={signupForm.username}
                onChange={handleSignupChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="3-13 chars, alphanumeric + _ or -"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={signupForm.email}
                onChange={handleSignupChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={signupForm.password}
                onChange={handleSignupChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={signupForm.confirmPassword}
                onChange={handleSignupChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? 'Creating account...' : 'Sign Up'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => githubOAuthService.redirectToGitHub()}
              className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              <img src={gitHubLogo} alt="GitHub" className="w-5 h-5" />
              <span>Sign up with GitHub</span>
            </button>
          </form>
        )}

        <p className="text-center text-gray-600 dark:text-gray-400 mt-6">
          {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={toggleAuthMode}
            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            {authMode === 'login' ? 'Sign up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  )
}

export default AuthPage
