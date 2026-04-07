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
