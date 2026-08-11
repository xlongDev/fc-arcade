import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { startAutoBackup } from './data/autoBackup'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// 自动备份守护：订阅设置，按「定时 + 退出时」两种触发下载 .fcab。失败静默。
if (typeof window !== 'undefined') startAutoBackup()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
