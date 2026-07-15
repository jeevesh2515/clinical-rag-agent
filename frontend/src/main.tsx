import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { NeonAuthUIProvider } from "@neondatabase/neon-js/react"
import { authClient } from './lib/auth'
import './index.css'
import "@neondatabase/neon-js/ui/css"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <NeonAuthUIProvider authClient={authClient}>
        <App />
      </NeonAuthUIProvider>
    </ThemeProvider>
  </React.StrictMode>
)
