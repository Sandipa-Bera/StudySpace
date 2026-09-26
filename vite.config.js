import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// Custom plugin to automatically inject a deterministic version into sw.js
function pwaVersionPlugin() {
  return {
    name: 'pwa-version-injector',
    writeBundle(options, bundle) {
      const swPath = path.resolve(options.dir, 'sw.js');
      if (fs.existsSync(swPath)) {
        // Generate a deterministic version based on output bundle filenames (which are content-hashed by Vite)
        const hashes = Object.keys(bundle).join('');
        let hash = 0;
        for (let i = 0; i < hashes.length; i++) {
          hash = ((hash << 5) - hash) + hashes.charCodeAt(i);
          hash |= 0;
        }
        const version = 'v' + Math.abs(hash).toString(16);
        
        let swContent = fs.readFileSync(swPath, 'utf-8');
        // Replace the placeholder or hardcoded version in the built sw.js
        swContent = swContent.replace(/const CACHE_NAME = 'studyspace-[^']+';/, `const CACHE_NAME = 'studyspace-${version}';`);
        fs.writeFileSync(swPath, swContent);
        console.log(`\n[PWA] Automatically injected cache version ${version} into sw.js`);
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pwaVersionPlugin()],
})
