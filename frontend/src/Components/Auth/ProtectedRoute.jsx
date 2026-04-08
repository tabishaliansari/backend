import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader } from 'lucide-react'
import useAuthStore from '@/store/authStore'

export default function ProtectedRoute({ children }) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const { isAuthenticated, isInitialized, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!isInitialized) return

    if (!isAuthenticated) {
      navigate('/auth', { replace: true })
      return
    }

    setIsLoading(false)
  }, [isAuthenticated, isInitialized, navigate])

  if (isLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return children
}
