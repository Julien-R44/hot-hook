import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import unocss from 'unocss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), unocss(), viteSingleFile()],
  build: { outDir: 'build', emptyOutDir: true },
})
