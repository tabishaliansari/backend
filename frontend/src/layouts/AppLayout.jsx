import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  Menu,
  X,
  LogOut,
  Settings,
  LayoutDashboard,
} from 'lucide-react'
import useAuthStore from '@/store/authStore'
import ThemeToggleButton from '@/Components/Theme/ThemeToggleButton'
import { toast } from 'sonner'

function AppLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ]

  useEffect(() => {
    // Close mobile menu on route change
    setMobileMenuOpen(false)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      navigate('/auth')
    } catch (err) {
      toast.error('Logout failed')
    }
  }

  const handleNavigation = (path) => {
    navigate(path)
    setMobileMenuOpen(false)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between h-16 px-4 md:px-6">
          {/* Brand */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              GraphLM
            </h1>
          </div>

          {/* Desktop Navigation & User Menu */}
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex gap-6">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <ThemeToggleButton />

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.firstName || user?.username || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-red-600 dark:text-red-400"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-4">
            <ThemeToggleButton />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <nav className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className="flex items-center gap-3 w-full px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                )
              })}

              <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>

              <div className="px-4 py-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.firstName || user?.username || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
