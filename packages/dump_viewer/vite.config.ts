import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import unocss from 'unocss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), unocss()],
})
