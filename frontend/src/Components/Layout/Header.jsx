import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  User as UserIcon
} from 'lucide-react'
import { toast } from 'sonner'
import useAuthStore from '@/store/authStore'
import { useThemeStore } from '@/store'
import AvatarUploadModal from '../Common/Modals/AvatarUploadModal'
import SettingsModal from '../Common/Modals/SettingsModal'
import GraphLMLogo from '../Common/GraphLMLogo'

const getDisplayName = (user) => user?.firstName || user?.username || 'User'
const DEFAULT_AVATAR_URL = 'https://placehold.co/600x400'

function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { theme, resolvedTheme, setTheme } = useThemeStore()

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeSubmenuOpen, setThemeSubmenuOpen] = useState(false)
  const menuRootRef = useRef(null)

  const avatarUrl = user?.avatar?.url || DEFAULT_AVATAR_URL
  const displayName = useMemo(() => getDisplayName(user), [user])

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]
  const selectedThemeValue = ['light', 'dark', 'system'].includes(theme) ? theme : 'light'

  useEffect(() => {
    setUserMenuOpen(false)
    setThemeSubmenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRootRef.current && !menuRootRef.current.contains(event.target)) {
        setUserMenuOpen(false)
        setThemeSubmenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      navigate('/auth')
    } catch (error) {
      toast.error('Logout failed')
    }
  }

  const handleThemeChange = (nextTheme) => {
    setTheme(nextTheme)
    setThemeSubmenuOpen(false)
  }

  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  const handleManageAccount = () => {
    setAvatarModalOpen(true)
    setUserMenuOpen(false)
  }

  const handleSettings = () => {
    setSettingsModalOpen(true)
    setUserMenuOpen(false)
  }

  return (
    <header
      className="bg-(--bg-surface) border-b border-(--border-subtle) shrink-0 text-(--text-primary)"
      ref={menuRootRef}
    >
      <div className="h-14 px-6 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center"
        >
          <GraphLMLogo variant="full" height={26} />
        </button>

        <div className="flex items-center gap-4 relative">
          <button
            onClick={() => {
              setThemeSubmenuOpen(false)
              setUserMenuOpen(!userMenuOpen)
            }}
            className="flex items-center justify-center rounded-full ring-1 ring-(--border-default) hover:ring-(--accent-cyan) transition-all p-0.5"
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
          >
            <img
              src={avatarUrl}
              alt={displayName}
              onError={(e) => { if (e.currentTarget.src !== DEFAULT_AVATAR_URL) e.currentTarget.src = DEFAULT_AVATAR_URL }}
              className="h-8 w-8 rounded-full object-cover"
            />
          </button>

          {/* Dropdown Menu (Opens Downward) */}
          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 rounded border border-(--border-strong) py-1 z-50 bg-(--bg-elevated) text-(--text-primary) shadow-xl">

              {/* Email Display */}
              <div className="px-4 py-3 text-xs truncate border-b border-(--border-subtle) text-(--text-muted)" style={{ fontFamily: 'var(--font-mono)' }}>
                {user?.email || 'No email available'}
              </div>

              {/* Settings */}
              <button
                onClick={handleSettings}
                onMouseEnter={() => setThemeSubmenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary)"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>

              {/* Profile */}
              <button
                onClick={handleManageAccount}
                onMouseEnter={() => setThemeSubmenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary)"
              >
                <UserIcon className="w-4 h-4" />
                Profile
              </button>

              {/* Theme Submenu */}
              <div className="relative group">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary)"
                  onClick={() => setThemeSubmenuOpen(!themeSubmenuOpen)}
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="w-4 h-4" />
                    Theme
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {themeSubmenuOpen && (
                  <div
                    className="absolute top-0 right-full mr-1 w-36 rounded border border-(--border-strong) py-1 z-50 bg-(--bg-elevated) shadow-xl"
                    onMouseLeave={() => setThemeSubmenuOpen(false)}
                  >
                    {themeOptions.map((option) => {
                      const Icon = option.icon
                      const isSelected = selectedThemeValue === option.value
                      return (
                        <button
                          key={option.value}
                          onClick={() => handleThemeChange(option.value)}
                          className="w-full flex items-center justify-between px-4 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary)"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4" />
                            {option.label}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-(--accent-cyan)" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="border-t my-1 border-(--border-subtle)" />

              {/* Logout */}
              <button
                onClick={handleLogout}
                onMouseEnter={() => setThemeSubmenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--accent-red) transition-colors hover:bg-(--accent-red-dim)"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      <AvatarUploadModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        avatarUrl={avatarUrl}
        displayName={displayName}
      />
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </header>
  )
}

export default AppHeader
