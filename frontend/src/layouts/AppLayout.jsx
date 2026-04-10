import { Outlet } from 'react-router-dom'
import AppHeader from '@/Components/Layout/Header'
import AppFooter from '@/Components/Layout/Footer'

function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <AppHeader />

      <main className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>

      <AppFooter />
    </div>
  )
}

export default AppLayout
