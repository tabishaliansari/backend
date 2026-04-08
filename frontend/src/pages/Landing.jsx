import { useNavigate } from 'react-router-dom'

function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center px-4">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            GraphLM
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Chat with your knowledge graphs
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/auth')}
            className="w-64 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => navigate('/auth')}
            className="w-64 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 font-semibold py-3 px-6 rounded-lg border border-blue-200 dark:border-blue-600 transition-colors"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  )
}

export default Landing
