import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { preventZoom } from './lib/prevent-zoom'

preventZoom()

createRoot(document.getElementById('root')!).render(
  <App />
)
