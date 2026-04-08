import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { Toaster } from "sonner";
import './index.css'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Toaster
      richColors={false}
      position="bottom-right"
      gap={8}
      toastOptions={{
        duration: 2500,
        success: {
          duration: 2000,
        },
        error: {
          duration: 3000,
        },
        loading: {
          duration: Infinity,
        },
      }}
    />
    <App />
  </StrictMode>,
)
