import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { QuickAdd } from './QuickAdd.jsx'
import './index.css'
import { cacheOffline } from './lib/offline.js'

// The same page is the quick-add box when Electron opens it as #quick
// (Ctrl+Shift+L, electron/main.cjs), and Layers itself otherwise.
const quick = window.location.hash === '#quick'

// The phone web app keeps an offline copy of itself (public/sw.js).
cacheOffline()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {quick ? <QuickAdd /> : <App />}
  </React.StrictMode>,
)
