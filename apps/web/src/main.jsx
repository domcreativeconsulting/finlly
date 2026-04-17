import { setAccessToken } from './services/api.js';
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { cleanupLegacyCaches } from './utils/offlineCacheManager.js'
import './index.css'

cleanupLegacyCaches()

// Restaura token do localStorage para que o interceptor de requests
// envie Authorization mesmo após refresh da página.
try {
  const savedToken = localStorage.getItem('accessToken');
  if (savedToken) {
    setAccessToken(savedToken);
  }
} catch (err) {
  // ignore: localStorage indisponível
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
