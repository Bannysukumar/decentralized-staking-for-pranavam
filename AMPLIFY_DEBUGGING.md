# 🔍 AMPLIFY ROUTING DEBUG GUIDE

## 📦 **Try This Build**: `prana-amplify-minimal-redirects.zip`

The issue might be Amplify-specific routing conflicts. Since `/admin` and `/whitepaper` work but `/staking` and `/exchange` don't, there's likely something special about those route names.

## 🧪 **Debugging Steps**:

### 1. **Test the Minimal Redirects** (`prana-amplify-minimal-redirects.zip`)
```
/staking /staking-fixed-clean.html 200
/exchange /exchange-fixed.html 200
/whitepaper /whitepaper.html 200
/admin /admin.html 200
/ /index.html 200
```

### 2. **If Still Broken - Manual Amplify Console Fix**:
1. Go to Amplify Console → Your App → "Rewrites and redirects"
2. **Delete ALL existing rules**
3. **Add these rules manually ONE BY ONE**:

| Source | Target | Type |
|--------|--------|------|
| `/staking` | `/staking-fixed-clean.html` | 200 (Rewrite) |
| `/exchange` | `/exchange-fixed.html` | 200 (Rewrite) |
| `/whitepaper` | `/whitepaper.html` | 200 (Rewrite) |
| `/admin` | `/admin.html` | 200 (Rewrite) |
| `/` | `/index.html` | 200 (Rewrite) |

### 3. **Debug with Direct File Access**:
Try accessing files directly to confirm they exist:
- `your-domain.com/staking-fixed-clean.html` (should show staking page)
- `your-domain.com/exchange-fixed.html` (should show exchange page)
- `your-domain.com/index.html` (should show homepage)

### 4. **Alternative Route Names** (if staking/exchange are reserved):
If those specific route names are problematic, try:
- `/stake` → `/staking-fixed-clean.html`
- `/trade` → `/exchange-fixed.html`

## 🚨 **Potential Issues**:

### A. **Reserved Route Names**
Amplify might treat `/staking` or `/exchange` as special/reserved routes.

### B. **File Extension Issues**
Some CDNs have issues with HTML files without `.html` extension.

### C. **Order Dependency**
Amplify processes redirects in order - root `/` might be catching everything.

### D. **Cache Issues**
Even after deleting the app, browser/CDN cache might persist.

## 🔧 **Emergency Workaround**:

If redirects don't work at all, modify the navigation links to use direct file paths:

**In all HTML files, change navigation links to**:
```html
<a href="/staking-fixed-clean.html" class="nav-link">Staking</a>
<a href="/exchange-fixed.html" class="nav-link">Exchange</a>
<a href="/whitepaper.html" class="nav-link">Whitepaper</a>
<a href="/admin.html" class="nav-link">Admin</a>
```

## 📋 **What to Test**:

1. **Upload `prana-amplify-minimal-redirects.zip`**
2. **Test these URLs immediately after deployment**:
   - `/` (should be homepage with overview)
   - `/staking` (should be staking page with "PRANA Staking" title)
   - `/exchange` (should be exchange page with "PRANA Exchange" title)
   - `/admin` (should be admin page)
3. **Check browser developer tools → Network tab** to see what files are actually being served

## 💡 **Next Steps**:
Let me know the results of testing the minimal redirects and direct file access!