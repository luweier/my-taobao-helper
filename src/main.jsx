import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') || document.body.insertBefore(document.createElement('div'), document.body.children[1]).setAttribute('id','root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
