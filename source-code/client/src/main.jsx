import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Debug environment variables
console.log('Environment mode:', import.meta.env.MODE)
console.log('API URL:', import.meta.env.VITE_API_URL || 'Not set, using fallback')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
