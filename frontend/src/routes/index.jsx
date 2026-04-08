import { useEffect } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useNavigate,
  Outlet,
} from 'react-router-dom'
import { setNavigator } from '@/utils/navigation'
import AppLayout from '@/layouts/AppLayout'
import AuthPage from '@/pages/AuthPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'
import Landing from '@/pages/Landing'
import Dashboard from '@/pages/Dashboard'
import Chat from '@/pages/Chat'
import NotFoundPage from '@/pages/NotFoundPage'
import ProtectedRoute from '@/Components/Auth/ProtectedRoute'

// Root component that initializes navigator
function Root() {
  const navigate = useNavigate()

  useEffect(() => {
    setNavigator(navigate)
  }, [navigate])

  return <Outlet />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        path: '',
        element: <Landing />,
      },
      {
        path: 'auth',
        element: <AuthPage />,
      },
      {
        path: 'auth/verify',
        element: <VerifyEmailPage />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            path: '',
            element: <Dashboard />,
          },
          {
            path: 'c/:id',
            element: <Chat />,
          },
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            path: '',
            element: <Navigate to="/dashboard" replace />,
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])

export default function Router() {
  return <RouterProvider router={router} />
}
