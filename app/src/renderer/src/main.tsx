import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('找不到 #root 挂载节点，index.html 可能损坏')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
