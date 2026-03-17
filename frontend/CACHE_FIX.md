# Fix for Cache/MIME Type Errors

If you see errors like:
- `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"`
- `registerSW.js:1 Uncaught SyntaxError: Unexpected token '<'`
- `manifest.json:1 Failed to load resource: the server responded with a status of 404`

## Quick Fix

### Option 1: Hard Refresh (Fastest)
1. Press `Ctrl + F5` (Windows/Linux) or `Cmd + Shift + R` (Mac)
2. If that doesn't work, try opening DevTools (F12) → Right click on Refresh button → "Empty Cache and Hard Reload"

### Option 2: Clear Service Worker
1. Open DevTools (F12)
2. Go to Application tab → Service Workers
3. Click "Unregister" on any WorkSafety service workers
4. Reload the page

### Option 3: Full Cache Clear (Windows)
Run in PowerShell:
```powershell
.\clear-cache-restart.ps1
```

Or run in CMD:
```cmd
clear-cache-restart.bat
```

### Option 4: Manual Steps
1. Stop the development server (Ctrl+C)
2. Delete the `.vite` folder in frontend directory
3. Delete the `dist` folder if it exists
4. Clear browser cache:
   - Chrome: `chrome://settings/clearBrowserData` → Select "Cached images and files"
   - Edge: `edge://settings/clearBrowserData` → Select "Cached images and files"
5. Restart the server: `npm run dev`

## Preventing This Issue

The issue usually happens when:
- The code is modified and rebuilt while the server is running
- The browser has cached old JavaScript files with different hashes
- The Service Worker is trying to load old cached files

To prevent:
1. Always stop the server before making major changes
2. Use the cache clearing scripts after pulling new code
3. Disable Service Worker in development if needed (comment out VitePWA plugin in vite.config.ts)
