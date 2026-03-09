const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const splashDir = path.join(publicDir, 'splash');

// Create directories if they don't exist
if (!fs.existsSync(splashDir)) {
  fs.mkdirSync(splashDir, { recursive: true });
}

// SVG content for the icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1BC5BD;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0B7A90;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="110" ry="110" fill="url(#grad1)"/>
  <path d="M256 110c-65 0-118 38-118 85v55c0 85 75 162 118 162s118-77 118-162v-55c0-47-53-85-118-85zm52 132l-66 66-34-34 12-12 22 22 54-54 12 12z" fill="white"/>
</svg>`;

// SVG content for favicon
const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1BC5BD;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0B7A90;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" ry="6" fill="url(#grad1)"/>
  <path d="M16 7c-4 0-7.5 2.3-7.5 5.2v3.4c0 5.2 4.6 9.9 7.5 9.9s7.5-4.7 7.5-9.9v-3.4c0-2.9-3.5-5.2-7.5-5.2zm3.3 8l-4.1 4.1-2.1-2.1.7-.7 1.4 1.4 3.4-3.4.7.7z" fill="white"/>
</svg>`;

// Generate icon function
async function generateIcon(size, filename, svg = svgIcon) {
  const buffer = Buffer.from(svg);
  await sharp(buffer)
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, filename));
  console.log(`Generated: ${filename}`);
}

// Generate splash screen function
async function generateSplashScreen(width, height, filename) {
  // Create a buffer with the gradient background
  const gradient = sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: { r: 15, g: 23, b: 41, alpha: 1 }
    }
  });

  // Create icon overlay
  const iconSize = Math.min(width, height) * 0.25;
  const iconBuffer = await sharp(Buffer.from(svgIcon))
    .resize(Math.round(iconSize), Math.round(iconSize))
    .png()
    .toBuffer();

  // Composite icon onto background
  await gradient
    .composite([{
      input: iconBuffer,
      gravity: 'center'
    }])
    .png()
    .toFile(path.join(splashDir, filename));
  
  console.log(`Generated splash: ${filename}`);
}

// Main function
async function main() {
  console.log('Generating PWA icons...');
  
  // Generate standard icons
  await generateIcon(192, 'pwa-192x192.png');
  await generateIcon(512, 'pwa-512x512.png');
  await generateIcon(144, 'pwa-144x144.png');
  await generateIcon(180, 'apple-touch-icon.png');
  await generateIcon(32, 'favicon.ico', svgFavicon);
  await generateIcon(196, 'mask-icon.png');
  
  // Generate splash screens for iOS devices
  console.log('Generating iOS splash screens...');
  
  // iPhone 16 Pro Max
  await generateSplashScreen(1320, 2868, 'iPhone_16_Pro_Max_portrait.png');
  // iPhone 16 Pro
  await generateSplashScreen(1206, 2622, 'iPhone_16_Pro_portrait.png');
  // iPhone 16 Plus / 15 Pro Max / 15 Plus / 14 Pro Max
  await generateSplashScreen(1290, 2796, 'iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png');
  // iPhone 16 / 15 Pro / 15 / 14 Pro
  await generateSplashScreen(1179, 2556, 'iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png');
  // iPhone 14 / 13 Pro / 13 / 12 Pro / 12
  await generateSplashScreen(1170, 2532, 'iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png');
  // iPhone 13 mini / 12 mini / 11 Pro / XS / X
  await generateSplashScreen(1125, 2436, 'iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png');
  // iPhone 11 Pro Max / XS Max
  await generateSplashScreen(1242, 2688, 'iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png');
  // iPhone 11 / XR
  await generateSplashScreen(828, 1792, 'iPhone_11__iPhone_XR_portrait.png');
  // iPhone 8 Plus / 7 Plus / 6s Plus / 6 Plus
  await generateSplashScreen(1242, 2208, 'iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png');
  // iPhone 8 / 7 / 6s / 6 / SE (4.7")
  await generateSplashScreen(750, 1334, 'iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png');
  // iPhone SE (4") / iPod touch
  await generateSplashScreen(640, 1136, '4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png');
  
  // Generate screenshots (placeholders - you should replace with actual screenshots)
  console.log('Generating placeholder screenshots...');
  
  // Narrow screenshot (mobile)
  const narrowScreenshot = sharp({
    create: {
      width: 750,
      height: 1334,
      channels: 4,
      background: { r: 15, g: 23, b: 41, alpha: 1 }
    }
  });
  await narrowScreenshot.png().toFile(path.join(publicDir, 'screenshot-narrow.png'));
  console.log('Generated: screenshot-narrow.png');
  
  // Wide screenshot (tablet/desktop)
  const wideScreenshot = sharp({
    create: {
      width: 1280,
      height: 800,
      channels: 4,
      background: { r: 15, g: 23, b: 41, alpha: 1 }
    }
  });
  await wideScreenshot.png().toFile(path.join(publicDir, 'screenshot-wide.png'));
  console.log('Generated: screenshot-wide.png');
  
  console.log('\nAll icons generated successfully!');
}

main().catch(console.error);
