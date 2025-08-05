import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, readdirSync, rmSync } from 'fs';

export default defineConfig({
  // Root directory where index.html is located
  root: 'src',
  
  // Base public path for production
  base: '/',
  
  // Server configuration for development
  server: {
    port: 3000,
    host: '0.0.0.0',
    cors: true
  },
  

  // Preview server for production builds
  preview: {
    port: 8080,
    host: '0.0.0.0'
  },

  // Plugin configuration
  plugins: [
    // Custom plugin to handle SPA routing in dev
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url;
          
          // Handle SPA routes by serving appropriate HTML files
          if (url === '/' || url === '/index.html') {
            req.url = '/pages/index.html'; // Default to homepage
          } else if (url.startsWith('/staking')) {
            req.url = '/pages/staking-fixed-clean.html';
          } else if (url.startsWith('/exchange')) {
            req.url = '/pages/exchange-fixed.html';
          } else if (url.startsWith('/whitepaper')) {
            req.url = '/pages/whitepaper.html';
          } else if (url.startsWith('/admin')) {
            req.url = '/pages/admin.html';
          }
          
          next();
        });
      }
    },
    // Custom plugin to move HTML files to root during build
    {
      name: 'move-html-to-root',
      writeBundle() {
        const distDir = resolve(process.cwd(), 'dist');
        const pagesDir = resolve(distDir, 'pages');
        
        // Check if pages directory exists
        if (existsSync(pagesDir)) {
          // Move all HTML files from pages/ to root
          const htmlFiles = readdirSync(pagesDir).filter(file => file.endsWith('.html'));
          
          htmlFiles.forEach(file => {
            const sourcePath = resolve(pagesDir, file);
            const targetPath = resolve(distDir, file);
            
            console.log(`Moving ${file} to root...`);
            copyFileSync(sourcePath, targetPath);
          });
          
          // Remove the pages directory since we've moved everything
          console.log('Removing pages directory...');
          rmSync(pagesDir, { recursive: true, force: true });
        }
      }
    }
  ],

  // Asset handling
  assetsInclude: ['**/*.pdf'],

  // Environment variables
  define: {
    __PRANA_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'web3',
      'web3modal',
      '@metamask/detect-provider',
      '@coinbase/wallet-sdk',
      '@walletconnect/web3-provider'
    ]
  },

  // CSS configuration
  css: {
    devSourcemap: true
  },

  // Extend build config with performance settings
  build: {
    // Output directory (relative to project root)
    outDir: '../dist',
    emptyOutDir: true,
    
    // Generate separate chunks for better caching
    rollupOptions: {
      input: {
        // Multiple entry points - all will be output to root level
        'index': resolve('src/pages/index.html'), // Proper homepage
        'staking-fixed-clean': resolve('src/pages/staking-fixed-clean.html'),
        'exchange-fixed': resolve('src/pages/exchange-fixed.html'),
        'whitepaper': resolve('src/pages/whitepaper.html'),
        'admin': resolve('src/pages/admin.html')
      },
      output: {
        // Chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        // Entry file names - keep JS files in assets folder
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          if (assetInfo.name?.match(/\.(png|jpe?g|svg|gif|webp|avif)$/)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    
    // Optimize for modern browsers but support older ones
    target: 'es2015',
    
    // Source maps for debugging
    sourcemap: process.env.NODE_ENV !== 'production',
    
    // Performance warnings
    chunkSizeWarningLimit: 1000
  }
});