import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  Camera,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'
import { toast } from 'sonner'
import useAuthStore from '@/store/authStore'
import { useThemeStore } from '@/store'

const getDisplayName = (user) => user?.firstName || user?.username || 'User'
const DEFAULT_AVATAR_URL = 'https://placehold.co/600x400'

const getAvatarFallback = (user) => {
  const name = getDisplayName(user)
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { theme, resolvedTheme, setTheme } = useThemeStore()

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [themeSubmenuOpen, setThemeSubmenuOpen] = useState(false)
  const menuRootRef = useRef(null)

  const avatarUrl = user?.avatar?.url || DEFAULT_AVATAR_URL
  console.log(avatarUrl);
  const displayName = useMemo(() => getDisplayName(user), [user])
  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]
  const selectedThemeValue = ['light', 'dark', 'system'].includes(theme)
    ? theme
    : 'light'
  const selectedThemeLabel = selectedThemeValue

  useEffect(() => {
    setUserMenuOpen(false)
    setSettingsMenuOpen(false)
    setThemeSubmenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRootRef.current && !menuRootRef.current.contains(event.target)) {
        setUserMenuOpen(false)
        setSettingsMenuOpen(false)
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
    setSettingsMenuOpen(false)
    setThemeSubmenuOpen(false)
  }

  const handleChangeAvatar = () => {
    toast.info('Change avatar coming soon')
  }

  const handleManageAccount = () => {
    toast.info('Manage account coming soon')
  }

  const profileCardClassName =
    resolvedTheme === 'dark'
      ? 'overflow-hidden rounded-4xl border border-gray-200 dark:border-gray-700 bg-[#22262d] text-white shadow-2xl'
      : 'overflow-hidden rounded-4xl border border-gray-200 bg-white text-gray-900 shadow-2xl'

  const profileEmailClassName =
    resolvedTheme === 'dark'
      ? 'text-center text-sm font-medium text-gray-100/90 truncate'
      : 'text-center text-sm font-medium text-gray-600 truncate'

  const profileNameClassName =
    resolvedTheme === 'dark'
      ? 'mt-5 text-3xl text-center font-light text-gray-100'
      : 'mt-5 text-3xl text-center font-light text-gray-900'

  const manageAccountClassName =
    resolvedTheme === 'dark'
      ? 'mt-5 w-full rounded-full border border-gray-500/70 px-4 py-3 text-center text-sm font-semibold text-blue-200 transition-colors hover:bg-white/5'
      : 'mt-5 w-full rounded-full border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50'

  const logoutButtonClassName =
    resolvedTheme === 'dark'
      ? 'mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1c2026] px-4 py-3 text-left text-gray-100 transition-colors hover:bg-[#2a2f37]'
      : 'mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-gray-100 px-4 py-3 text-left text-gray-900 transition-colors hover:bg-gray-200'

  const avatarTooltipClassName =
    resolvedTheme === 'dark'
      ? 'pointer-events-none absolute top-2 left-1/2 hidden w-max -translate-x-1/2 rounded-full bg-black px-3 py-1 text-xs text-white shadow-lg peer-hover:block'
      : 'pointer-events-none absolute top-2 left-1/2 hidden w-max -translate-x-1/2 rounded-full bg-gray-900 px-3 py-1 text-xs text-white shadow-lg peer-hover:block'

  const themeOptionClassName = (isSelected) =>
    isSelected
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'

  const settingsMenuClassName =
    resolvedTheme === 'dark'
      ? 'absolute right-0 top-full mt-3 w-64 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50 p-2'
      : 'absolute right-0 top-full mt-3 w-64 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 p-2'

  const themeSubmenuClassName =
    resolvedTheme === 'dark'
      ? 'absolute right-full top-0 mr-3 w-52 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50 p-2'
      : 'absolute right-full top-0 mr-3 w-52 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl z-50 p-2'

  const UserProfileCard = ({ compact = false }) => (
    <div
      className={`${profileCardClassName} ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className={profileEmailClassName}>
        {user?.email || 'No email available'}
      </div>

      <div className={`${compact ? 'mt-4' : 'mt-5'} flex justify-center`}>
        <div className="relative w-fit">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={displayName}
              onError={(event) => {
                if (event.currentTarget.src !== DEFAULT_AVATAR_URL) {
                  event.currentTarget.src = DEFAULT_AVATAR_URL
                }
              }}
              className={`${compact ? 'h-28 w-28' : 'h-32 w-32'} rounded-full object-cover ring-4 ring-blue-500/40`}
            />

            <button
              type="button"
              onClick={handleChangeAvatar}
              className="peer absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border border-gray-900/50 bg-gray-950 text-white shadow-lg transition-transform hover:scale-105"
              aria-label="Change avatar"
            >
              <Camera className="h-4 w-4" />
            </button>

            <div className={avatarTooltipClassName}>
              change avatar
            </div>
          </div>
        </div>
      </div>

      <p className={`${compact ? 'mt-4 text-2xl' : profileNameClassName}`}>
        Hi, {displayName}!
      </p>

      <button
        type="button"
        onClick={handleManageAccount}
        className={manageAccountClassName}
      >
        Manage your account
      </button>

      <button
        onClick={handleLogout}
        className={logoutButtonClassName}
      >
        <LogOut className="h-5 w-5" />
        <span className="text-sm font-medium">Logout</span>
      </button>
    </div>
  )

  return (
    <header
      className="bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700 shrink-0"
      ref={menuRootRef}
    >
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center"
        >
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            GraphLM
          </h1>
        </button>

        <div className="hidden md:flex items-center gap-4">
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

          <div className="relative flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false)
                  setThemeSubmenuOpen(false)
                  setSettingsMenuOpen((current) => !current)
                }}
                className="flex min-w-40 items-center justify-between gap-3 rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-haspopup="menu"
                aria-expanded={settingsMenuOpen}
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {settingsMenuOpen && (
                <div className={settingsMenuClassName}>
                  <button
                    type="button"
                    onClick={() => setThemeSubmenuOpen((current) => !current)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors ${themeOptionClassName(false)}`}
                    aria-haspopup="menu"
                    aria-expanded={themeSubmenuOpen}
                  >
                    <span className="flex items-center gap-3">
                      <Monitor className="h-4 w-4" />
                      <span>Theme</span>
                    </span>
                    <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <span className="capitalize">{selectedThemeLabel}</span>
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </span>
                  </button>

                  {themeSubmenuOpen && (
                    <div className={themeSubmenuClassName}>
                      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Theme
                      </div>

                      {themeOptions.map((option) => {
                        const Icon = option.icon
                        const isSelected = selectedThemeValue === option.value

                        return (
                          <button
                            key={option.value}
                            onClick={() => handleThemeChange(option.value)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors ${themeOptionClassName(isSelected)}`}
                          >
                            <span className="flex items-center gap-3">
                              <Icon className="h-4 w-4" />
                              <span>{option.label}</span>
                            </span>
                            {isSelected && <Check className="h-4 w-4" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSettingsMenuOpen(false)
                setUserMenuOpen((current) => !current)
              }}
              className="flex items-center gap-3 rounded-full px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <img
                src={avatarUrl}
                alt={displayName}
                onError={(event) => {
                  if (event.currentTarget.src !== DEFAULT_AVATAR_URL) {
                    event.currentTarget.src = DEFAULT_AVATAR_URL
                  }
                }}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-blue-100 dark:ring-blue-900"
              />

              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-3 w-92 z-50">
                <UserProfileCard />
              </div>
            )}
          </div>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(false)
              setThemeSubmenuOpen(false)
              setSettingsMenuOpen((current) => !current)
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setUserMenuOpen((current) => !current)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label="Account menu"
          >
            <img
              src={avatarUrl}
              alt={displayName}
              onError={(event) => {
                if (event.currentTarget.src !== DEFAULT_AVATAR_URL) {
                  event.currentTarget.src = DEFAULT_AVATAR_URL
                }
              }}
              className="h-6 w-6 rounded-full object-cover"
            />
          </button>

        </div>
      </div>

      {(userMenuOpen || settingsMenuOpen) && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4 space-y-4">
          {userMenuOpen && (
            <UserProfileCard compact />
          )}

          {settingsMenuOpen && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                Theme
              </p>

              <button
                type="button"
                onClick={() => setThemeSubmenuOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-haspopup="menu"
                aria-expanded={themeSubmenuOpen}
              >
                <span className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span>Theme</span>
                </span>
                <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <span className="capitalize">{selectedThemeLabel}</span>
                  <ChevronDown className="h-4 w-4" />
                </span>
              </button>

              {themeSubmenuOpen && (
                <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
                  {themeOptions.map((option) => {
                    const Icon = option.icon
                    const isSelected = selectedThemeValue === option.value

                    return (
                      <button
                        key={option.value}
                        onClick={() => handleThemeChange(option.value)}
                        className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${themeOptionClassName(isSelected)}`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </span>
                        {isSelected && <Check className="h-4 w-4" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  )
}

export default AppHeader