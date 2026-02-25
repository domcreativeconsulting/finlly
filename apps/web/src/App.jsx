import { config } from './config/env.js'

export default function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>🎉 Finlly Web App</h1>
      <p>Welcome to the Finlly application!</p>
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <h3>Configuration</h3>
        <p><strong>API URL:</strong> {config.VITE_API_URL}</p>
      </div>
    </div>
  )
}
