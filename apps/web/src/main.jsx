import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { config } from './config/env.js'

console.log('✅ Web app initialized')
console.log('API URL:', config.VITE_API_URL)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
