# AWS Amplify Deployment Guide

## Overview

Your PRANA DeFi platform is now configured for AWS Amplify deployment with **minimal changes** from your current development setup. The migration uses Vite as the build tool while maintaining the same local development experience.

## ✅ What Was Changed

### 1. Added Vite Build System
- **`vite.config.js`** - Vite configuration for building and serving
- **`src/index.html`** - Main entry point (required by Vite)
- **Package.json scripts** updated:
  - `npm run dev` → Uses Vite dev server (port 3000)
  - `npm run build` → Creates production build in `dist/`
  - `npm run preview` → Preview production build

### 2. Amplify Configuration
- **`amplify.yml`** - Build configuration for Amplify
- **`src/_redirects`** - SPA routing rules updated for Amplify

### 3. Static API Configuration
- **`src/config/api-config.js`** - Replaces `/api/config` endpoint
- No serverless functions needed - everything is client-side

### 4. Maintained Compatibility
- ✅ All existing files work unchanged
- ✅ Same network configuration system
- ✅ Same Web3/DeFi functionality
- ✅ Hot reload in development

## 🚀 Local Development

### Current Commands (No Change)
```bash
# Development server (now uses Vite)
npm run dev              # http://localhost:3000

# Build for production
npm run build           # Outputs to dist/

# Preview production build
npm run preview         # http://localhost:8080

# Legacy development server (if needed)
npm run dev:legacy      # Your original Express server
```

### Same Development Experience
- Hot reload works the same
- Same file structure in `src/`
- Same routes: `/staking`, `/exchange`, `/admin`, etc.
- Network configuration unchanged

## 📁 Project Structure

```
unified-platform/
├── src/                     # Source files (unchanged)
│   ├── pages/              # HTML pages
│   ├── styles/             # CSS files
│   ├── services/           # Web3 services
│   ├── config/             # Network & contract config
│   │   ├── network-config.js    # Single source of truth
│   │   └── api-config.js        # New: replaces /api/config
│   └── _redirects          # Updated: Amplify routing
├── dist/                   # Built files (auto-generated)
├── vite.config.js         # New: Vite configuration
├── amplify.yml            # New: Amplify build config  
└── package.json           # Updated: Vite scripts
```

## 🌐 AWS Amplify Deployment

### Step 1: Create Amplify App

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click **"New app"** → **"Host web app"**
3. Connect your GitHub repository
4. Select branch (main/master)

### Step 2: Build Settings

Amplify will auto-detect the `amplify.yml` file. The configuration:

```yaml
# Automatically detected from amplify.yml
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
```

### Step 3: Environment Variables (Optional)

In Amplify Console → App Settings → Environment Variables:

```
NODE_ENV = production
VITE_APP_NAME = PRANA
VITE_BUILD_TARGET = amplify
```

### Step 4: Deploy

1. Click **"Save and deploy"**
2. Wait for build to complete (~5-10 minutes)
3. Your app will be available at: `https://[app-id].amplifyapp.com`

## 🔧 Build Process

### What Happens During Build

1. **Install Dependencies**: `npm ci`
2. **Build with Vite**: `npm run build`
3. **Output Structure**:
   ```
   dist/
   ├── pages/
   │   ├── staking-fixed-clean.html    # Main staking page
   │   ├── exchange-fixed.html         # Exchange page
   │   ├── admin.html                  # Admin page
   │   └── whitepaper.html            # Whitepaper
   ├── assets/
   │   ├── js/        # Bundled JavaScript
   │   ├── css/       # Bundled CSS
   │   └── images/    # Optimized images
   └── _redirects     # SPA routing rules
   ```

### SPA Routing

Routes are handled by `_redirects`:
```
/staking  → /staking-fixed-clean.html
/exchange → /exchange-fixed.html
/admin    → /admin.html
/         → /staking-fixed-clean.html (default)
```

## 🚦 Testing

### Before Deployment
```bash
# Test build locally
npm run build
npm run preview

# Verify pages work:
# http://localhost:8080/staking
# http://localhost:8080/exchange
# http://localhost:8080/admin
```

### After Deployment
- Test all routes on your Amplify URL
- Verify Web3 wallet connections work
- Check contract interactions on both testnet/mainnet
- Test responsive design on mobile

## 🔍 Troubleshooting

### Build Failures

**Node modules issues:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Vite build errors:**
- Check `vite.config.js` for syntax errors
- Ensure all imported files exist in `src/`

### Routing Issues

**404 on direct URL access:**
- Verify `_redirects` file is in `src/` directory
- Check Amplify Console → Rewrites and redirects

**API calls failing:**
- API endpoint `/api/config` has been replaced with static configuration
- Update any remaining API calls to use `src/config/api-config.js`

### Web3/Wallet Issues

**MetaMask not connecting:**
- Verify HTTPS in production (Amplify provides this automatically)
- Check browser console for CSP errors

**Wrong network:**
- Confirm contract addresses in `src/config/network-config.js`
- Test both BSC Mainnet (56) and Testnet (97)

## 🔄 Development Workflow

### Daily Development
```bash
# 1. Start development
npm run dev

# 2. Make changes to files in src/

# 3. Test locally
npm run build && npm run preview  

# 4. Push to GitHub
git add .
git commit -m "feature: updated staking interface"
git push origin main

# 5. Amplify auto-deploys from GitHub
```

### Maintenance
- **Dependencies**: Update with `npm update`
- **Security**: Run `npm audit fix` regularly  
- **Performance**: Monitor build sizes in Amplify console

## 📊 Performance

### Optimizations Applied
- ✅ Code splitting by page
- ✅ CSS/JS minification
- ✅ Image optimization
- ✅ Tree shaking for Web3 libraries
- ✅ Gzip compression

### Expected Build Sizes
- **Total bundle**: ~600KB gzipped
- **Initial load**: ~200KB (main page)
- **Web3 libraries**: ~400KB (loaded on demand)

## 🚀 Go Live Checklist

- [ ] Test build locally: `npm run build && npm run preview`
- [ ] Verify all pages load correctly
- [ ] Test wallet connections (MetaMask, WalletConnect)
- [ ] Test contract interactions on testnet
- [ ] Update DNS settings (if using custom domain)
- [ ] Set up monitoring/analytics
- [ ] Update README with new Amplify URL

## 💡 Next Steps

1. **Custom Domain**: Add your domain in Amplify Console
2. **CI/CD**: Set up branch-based deployments (staging/production)
3. **Monitoring**: Add CloudWatch logs and performance monitoring
4. **CDN**: Amplify includes CloudFront CDN automatically
5. **Security**: Review CSP headers and security settings

Your PRANA platform is now ready for production deployment on AWS Amplify! 🎉