# 🚀 PRANA Amplify Deployment Checklist

## 📦 Zip Contents

Your `prana-amplify-ready.zip` (863KB) contains:

### ✅ Included (Essential Files)
- **Source code**: `src/` directory with all pages, styles, services
- **Amplify config**: `amplify.yml`, `_redirects`
- **Vite config**: `vite.config.js` for building
- **Dependencies**: `package.json` (dependencies will be installed during build)
- **Contract artifacts**: Compiled contracts and ABIs
- **Network config**: Centralized configuration system

### ❌ Excluded (Unnecessary for Deployment)
- `node_modules/` (will be installed during build)
- `dist/` (will be generated during build)
- Development server files (`server.js`, `start-dev.js`)
- Log files, cache files, IDE settings
- Large documentation files
- Git history

## 🎯 Pre-Deployment Checklist

### Before Uploading to Amplify

- [ ] **Test locally**: `npm install && npm run build && npm run preview`
- [ ] **Verify routes**: Test `/staking`, `/exchange`, `/admin`, `/whitepaper`
- [ ] **Check contracts**: Confirm addresses in `src/config/network-config.js`
- [ ] **Update domains**: Update any hardcoded URLs if using custom domain

### Contract Address Verification

Current addresses in the zip:

**BSC Mainnet (56):**
- PRANA Token: `0x1d603926ef339545537bacb1ee5c051ea05d70cb`
- PRANA Exchange: `0x8a0388ce345f5cd82c49ae646ac40d3180a28616`
- PRANA Staking: `0x5dad2def2d09b03e53b54aa246894e6671261fae`
- USDT Token: `0x55d398326f99059fF775485246999027B3197955`

**BSC Testnet (97):**
- PRANA Token: `0xCD48C2c97FDF976fA1c33bFb134D449451606e72`
- PRANA Exchange: `0x5D9Ff05ee7DAdb85FbB9F858d8A81F1EAA94779a`
- PRANA Staking: `0xD961aF894d6f6a1BF1510E9b67e29dbe163b3e13`
- USDT Token: `0x6196d187e4B68a3C5Cb8907EAd6FdD26e6C754D9`

## 🌐 Amplify Deployment Steps

### 1. Create Amplify App
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click **"New app"** → **"Host web app"**
3. Choose **"Deploy without Git provider"** (for zip upload)

### 2. Upload Zip File
1. Select **"Drag and drop"**
2. Upload `prana-amplify-ready.zip`
3. App name: `prana-defi-platform`

### 3. Build Settings (Auto-detected)
Amplify will automatically detect:
```yaml
version: 1
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

### 4. Deploy
1. Click **"Save and deploy"**
2. Wait for build (5-10 minutes)
3. Your app will be at: `https://[random-id].amplifyapp.com`

## 🧪 Post-Deployment Testing

### Critical Tests
- [ ] **Homepage loads**: Visit your Amplify URL
- [ ] **Routing works**: Test `/staking`, `/exchange`, `/admin`
- [ ] **Wallet connection**: Test MetaMask connection
- [ ] **Network switching**: Switch between BSC Mainnet/Testnet
- [ ] **Contract interaction**: Test staking/exchange functions
- [ ] **Mobile responsive**: Test on mobile devices
- [ ] **HTTPS security**: Verify SSL certificate

### Performance Verification
- [ ] **Load time < 3s**: Initial page load
- [ ] **Bundle size**: Check Network tab in DevTools
- [ ] **Console errors**: No critical JavaScript errors

## ⚙️ Optional Configurations

### Custom Domain (Optional)
1. In Amplify Console → Domain management
2. Add custom domain
3. Configure DNS records

### Environment Variables (Optional)
In Amplify Console → Environment variables:
```
NODE_ENV = production
VITE_APP_NAME = PRANA
```

### Branch-based Deployments (Optional)
1. Connect to Git repository
2. Set up staging/production branches
3. Configure different builds per branch

## 🔧 Troubleshooting

### Build Failures
**"Module not found" errors:**
```bash
# Check if all imports are correct
# Verify file paths in src/
```

**Vite build errors:**
- Check `vite.config.js` syntax
- Ensure all HTML files exist in `src/pages/`

### Runtime Issues
**Wallet not connecting:**
- Verify HTTPS (Amplify provides automatically)
- Check browser console for errors

**Wrong contract addresses:**
- Update `src/config/network-config.js`
- Redeploy

**404 on direct URLs:**
- Verify `_redirects` file is in `src/`
- Check Amplify rewrites configuration

### Performance Issues
**Large bundle size:**
- Check Web3 library imports
- Consider code splitting if needed

**Slow loading:**
- Verify Amplify CDN is working
- Check images are optimized

## 📊 Expected Results

After successful deployment:

- **Build time**: 5-10 minutes
- **Total size**: ~2-3MB deployed
- **Load time**: <3 seconds initial
- **Uptime**: 99.9% (Amplify SLA)
- **Global CDN**: Automatic via CloudFront

## 🎉 Success Indicators

✅ **Build completed successfully**  
✅ **All pages load without errors**  
✅ **Wallet connections work**  
✅ **Contract interactions function**  
✅ **Mobile responsive design**  
✅ **HTTPS enabled automatically**  
✅ **Global CDN distribution**  

## 📞 Support Resources

If you encounter issues:
1. **Amplify Console**: Check build logs
2. **Browser DevTools**: Check console errors
3. **Network tab**: Verify resource loading
4. **AWS Support**: For infrastructure issues

---

**Your PRANA DeFi platform is ready for production deployment!** 🚀

The zip file contains everything needed for a successful Amplify deployment with minimal configuration required.