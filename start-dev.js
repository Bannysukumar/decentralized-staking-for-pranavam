#!/usr/bin/env node

/**
 * Development Server Starter
 * Provides local development environment with hot reload and debugging
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';
import url from 'url';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';

// ES module equivalents of __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DevServer {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.host = process.env.HOST || '0.0.0.0';
        this.srcDir = path.join(__dirname, 'src');
        this.publicDir = path.join(__dirname, 'public'); // Legacy fallback
        this.watchers = [];
        
        // MIME types for modules
        this.mimeTypes = {
            '.js': 'application/javascript',
            '.mjs': 'application/javascript',
            '.json': 'application/json',
            '.html': 'text/html',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };
    }

    /**
     * Start the development server
     */
    async start() {
        console.log('🚀 Starting PRANA Development Server...');
        console.log('=====================================');
        
        // Check if directories exist
        this.checkDirectories();
        
        // Start HTTP server
        this.startHttpServer();
        
        // Set up file watchers for hot reload
        await this.setupFileWatchers();
        
        // Open browser
        this.openBrowser();
        
        console.log(`\n✅ Server running at:`);
        console.log(`   🌐 Local:    http://localhost:${this.port}`);
        console.log(`   📱 Network:  http://${this.getNetworkIP()}:${this.port}`);
        
        // Show all available network interfaces
        const networkIPs = this.getAllNetworkIPs();
        if (networkIPs.length > 1) {
            console.log(`\n🔗 Available on network interfaces:`);
            networkIPs.forEach(ip => {
                console.log(`   📡 http://${ip}:${this.port}`);
            });
        }
        console.log(`\n📂 Serving files from:`);
        console.log(`   📁 Source:   ${this.srcDir} (primary)`);
        console.log(`   📁 Public:   ${this.publicDir} (fallback)`);
        console.log(`\n🔧 Development Features:`);
        console.log(`   ✓ Hot reload enabled`);
        console.log(`   ✓ ES6 modules support`);
        console.log(`   ✓ CORS headers`);
        console.log(`   ✓ Debug logging`);
        console.log(`\n📋 Available pages:`);
        console.log(`   🏠 Home:     http://localhost:${this.port}/`);
        console.log(`   💰 Staking:  http://localhost:${this.port}/staking`);
        console.log(`   🔄 Exchange: http://localhost:${this.port}/exchange`);
        console.log(`   📄 Whitepaper: http://localhost:${this.port}/whitepaper`);
        console.log(`   ⚙️  Admin:    http://localhost:${this.port}/admin`);
        console.log(`\n💡 Access from other devices using any network IP above`);
        console.log(`\n⌨️  Press Ctrl+C to stop the server`);
    }

    /**
     * Check if required directories exist
     */
    checkDirectories() {
        const requiredDirs = [this.srcDir]; // Only src is required now
        const missingDirs = requiredDirs.filter(dir => !fs.existsSync(dir));
        
        if (missingDirs.length > 0) {
            console.error('❌ Missing directories:');
            missingDirs.forEach(dir => console.error(`   📁 ${dir}`));
            console.log('\n💡 Run this from the project root directory');
            process.exit(1);
        }
    }

    /**
     * Start HTTP server
     */
    startHttpServer() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.port, this.host, (err) => {
            if (err) {
                console.error('❌ Failed to start server:', err);
                process.exit(1);
            }
        });

        // Handle server errors
        this.server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${this.port} is already in use`);
                console.log('💡 Try a different port: PORT=3001 npm run dev');
            } else {
                console.error('❌ Server error:', err);
            }
            process.exit(1);
        });
    }

    /**
     * Handle HTTP requests
     */
    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        let pathname = parsedUrl.pathname;
        
        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Log request
        console.log(`${new Date().toLocaleTimeString()} ${req.method} ${pathname}`);

        try {
            // Route handling
            if (pathname === '/' || pathname === '/index.html') {
                pathname = '/pages/index.html';
            } else if (pathname === '/staking' || pathname === '/staking/' || pathname === '/staking.html') {
                console.log('💰 Staking route hit! Serving staking-fixed-clean.html');
                pathname = '/pages/staking-fixed-clean.html';
            } else if (pathname === '/exchange' || pathname === '/exchange/' || pathname === '/exchange.html') {
                console.log('💰 Exchange route hit! Serving exchange-fixed.html');
                pathname = '/pages/exchange-fixed.html';
            } else if (pathname === '/whitepaper' || pathname === '/whitepaper/' || pathname === '/whitepaper.html') {
                pathname = '/pages/whitepaper.html';
            } else if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html') {
                console.log('🔧 Admin route hit! Original pathname:', pathname);
                pathname = '/pages/admin.html';
                console.log('🔧 Mapped to pathname:', pathname);
            } else if (pathname === '/test' || pathname === '/test.html') {
                console.log('🧪 Test route hit!');
                pathname = '/pages/test.html';
            }

            // Determine file path - serve from src first, fallback to public
            let filePath;
            
            // Always try src directory first
            filePath = path.join(this.srcDir, pathname);
            console.log('🔧 Trying src path:', filePath, 'exists:', fs.existsSync(filePath));
            
            // If not found in src, try public as fallback
            if (!fs.existsSync(filePath)) {
                filePath = path.join(this.publicDir, pathname);
                console.log('🔧 Trying public path:', filePath, 'exists:', fs.existsSync(filePath));
            }

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                console.log('🔧 File not found, sending 404 for:', pathname);
                this.send404(res, pathname);
                return;
            }

            // Get file stats
            const stats = fs.statSync(filePath);
            
            if (stats.isDirectory()) {
                // Try to serve index.html from directory
                const indexPath = path.join(filePath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    filePath = indexPath;
                } else {
                    this.sendDirectoryListing(res, filePath, pathname);
                    return;
                }
            }

            // Determine content type
            const ext = path.extname(filePath).toLowerCase();
            const contentType = this.mimeTypes[ext] || 'application/octet-stream';

            // Special handling for JavaScript modules
            if (ext === '.js' || ext === '.mjs') {
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            } else {
                res.setHeader('Content-Type', contentType);
            }

            // Read and serve file
            const content = fs.readFileSync(filePath);
            
            // Inject hot reload script for HTML files
            if (ext === '.html') {
                const modifiedContent = this.injectHotReload(content.toString());
                res.writeHead(200);
                res.end(modifiedContent);
            } else {
                res.writeHead(200);
                res.end(content);
            }

        } catch (error) {
            console.error('❌ Error serving file:', error);
            this.send500(res, error);
        }
    }

    /**
     * Inject hot reload script into HTML
     */
    injectHotReload(html) {
        const hotReloadScript = `
        <script>
            // Hot reload functionality
            let ws;
            let reconnectInterval;
            
            function connectWebSocket() {
                // Use current host for WebSocket connection
                const wsHost = window.location.hostname;
                const wsPort = ${this.port + 1};
                ws = new WebSocket('ws://' + wsHost + ':' + wsPort);
                
                ws.onopen = function() {
                    console.log('🔄 Hot reload connected to ' + wsHost + ':' + wsPort);
                    if (reconnectInterval) {
                        clearInterval(reconnectInterval);
                        reconnectInterval = null;
                    }
                };
                
                ws.onmessage = function(event) {
                    if (event.data === 'reload') {
                        console.log('🔄 Reloading page...');
                        window.location.reload();
                    }
                };
                
                ws.onclose = function() {
                    console.log('🔄 Hot reload disconnected, attempting to reconnect...');
                    if (!reconnectInterval) {
                        reconnectInterval = setInterval(connectWebSocket, 2000);
                    }
                };
                
                ws.onerror = function(error) {
                    console.log('🔄 Hot reload error:', error);
                };
            }
            
            // Enable debug mode
            window.PRANA_DEBUG = true;
            localStorage.setItem('prana_debug', 'true');
            
            // Connect WebSocket for hot reload
            connectWebSocket();
        </script>
        `;
        
        // Inject before closing body tag
        return html.replace('</body>', hotReloadScript + '</body>');
    }

    /**
     * Send 404 response
     */
    send404(res, pathname) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Page Not Found</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .container { max-width: 600px; margin: 0 auto; }
                .error-code { font-size: 72px; color: #FF9933; margin: 0; }
                .error-message { font-size: 24px; color: #333; margin: 20px 0; }
                .suggestions { text-align: left; margin: 30px 0; }
                .suggestions ul { list-style: none; padding: 0; }
                .suggestions li { margin: 10px 0; }
                .suggestions a { color: #FF9933; text-decoration: none; }
                .suggestions a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="error-code">404</h1>
                <h2 class="error-message">Page Not Found</h2>
                <p>The page <code>${pathname}</code> could not be found.</p>
                
                <div class="suggestions">
                    <h3>Available pages:</h3>
                    <ul>
                        <li>🏠 <a href="/">Home Page</a></li>
                        <li>💰 <a href="/staking.html">Staking Page</a></li>
                        <li>🔄 <a href="/exchange.html">Exchange Page</a></li>
                        <li>📄 <a href="/whitepaper.html">Whitepaper</a></li>
                    </ul>
                </div>
            </div>
        </body>
        </html>
        `;
        
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    /**
     * Send 500 response
     */
    send500(res, error) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>500 - Server Error</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error-code { font-size: 72px; color: #f44336; margin: 0; }
                .error-message { font-size: 24px; color: #333; margin: 20px 0; }
                .error-details { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: left; }
            </style>
        </head>
        <body>
            <h1 class="error-code">500</h1>
            <h2 class="error-message">Server Error</h2>
            <div class="error-details">
                <pre>${error.message}</pre>
            </div>
        </body>
        </html>
        `;
        
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    /**
     * Send directory listing
     */
    sendDirectoryListing(res, dirPath, pathname) {
        const files = fs.readdirSync(dirPath);
        const fileList = files.map(file => {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            const isDir = stats.isDirectory();
            const size = isDir ? '-' : this.formatFileSize(stats.size);
            const modified = stats.mtime.toLocaleDateString();
            
            return {
                name: file,
                isDirectory: isDir,
                size,
                modified,
                url: pathname + (pathname.endsWith('/') ? '' : '/') + file
            };
        });

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Directory: ${pathname}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .header { border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
                .file-list { border-collapse: collapse; width: 100%; }
                .file-list th, .file-list td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
                .file-list th { background: #f5f5f5; }
                .directory { color: #FF9933; }
                .file { color: #333; }
                a { text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📁 Directory: ${pathname}</h1>
                <p><a href="../">⬆️ Parent Directory</a></p>
            </div>
            
            <table class="file-list">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Size</th>
                        <th>Modified</th>
                    </tr>
                </thead>
                <tbody>
                    ${fileList.map(file => `
                        <tr>
                            <td>
                                <a href="${file.url}" class="${file.isDirectory ? 'directory' : 'file'}">
                                    ${file.isDirectory ? '📁' : '📄'} ${file.name}
                                </a>
                            </td>
                            <td>${file.size}</td>
                            <td>${file.modified}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
        `;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    /**
     * Set up file watchers for hot reload
     */
    async setupFileWatchers() {
        // Set up WebSocket server for hot reload
        await this.setupWebSocketServer();
        
        const watchPaths = [this.srcDir]; // Only watch src now
        
        watchPaths.forEach(watchPath => {
            if (fs.existsSync(watchPath)) {
                const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
                    if (filename && (filename.endsWith('.html') || filename.endsWith('.js') || filename.endsWith('.css'))) {
                        console.log(`🔄 File changed: ${filename}`);
                        this.notifyReload();
                    }
                });
                
                this.watchers.push(watcher);
                console.log(`👀 Watching: ${watchPath}`);
            }
        });
    }

    /**
     * Set up WebSocket server for hot reload
     */
    async setupWebSocketServer() {
        try {
            // Use createRequire for WebSocket in ES modules
            const { createRequire } = await import('module');
            const require = createRequire(import.meta.url);
            const { WebSocketServer } = require('ws');
            
            this.wsServer = new WebSocketServer({ 
                port: this.port + 1,
                host: '0.0.0.0',
                perMessageDeflate: false // Improve performance
            });
            this.wsClients = new Set();
            
            console.log(`🔄 Hot reload server started on port ${this.port + 1}`);
            
            this.wsServer.on('connection', (ws) => {
                this.wsClients.add(ws);
                
                ws.on('close', () => {
                    this.wsClients.delete(ws);
                });
            });
            
        } catch (error) {
            console.log('⚠️  Hot reload not available (WebSocket dependency issue)');
            console.log(`   Error: ${error.message}`);
            console.log('   File watching will continue but auto-reload is disabled');
            this.wsServer = null;
        }
    }

    /**
     * Notify all clients to reload
     */
    notifyReload() {
        if (this.wsClients) {
            this.wsClients.forEach(client => {
                try {
                    if (client.readyState === 1) { // WebSocket.OPEN
                        client.send('reload');
                    }
                } catch (error) {
                    // Remove dead clients
                    this.wsClients.delete(client);
                }
            });
        }
    }

    /**
     * Get network IP address
     */
    getNetworkIP() {
        const nets = networkInterfaces();
        
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
        
        return 'localhost';
    }

    /**
     * Get all available network IP addresses
     */
    getAllNetworkIPs() {
        const nets = networkInterfaces();
        const networkIPs = [];
        
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    networkIPs.push(net.address);
                }
            }
        }
        
        return networkIPs.length > 0 ? networkIPs : ['localhost'];
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Open browser
     */
    openBrowser() {
        const open = (url) => {
            try {
                switch (process.platform) {
                    case 'darwin':
                        spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
                        break;
                    case 'win32':
                        spawn('cmd', ['/c', 'start', url], { stdio: 'ignore', detached: true }).unref();
                        break;
                    default:
                        spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
                }
            } catch (error) {
                console.log('⚠️  Could not open browser automatically');
                console.log(`   Please visit: ${url}`);
            }
        };

        // Wait a bit for server to start, then open browser
        setTimeout(() => {
            const url = `http://localhost:${this.port}`;
            console.log(`\n🌐 Opening browser: ${url}`);
            try {
                open(url);
            } catch (error) {
                console.log('⚠️  Could not open browser automatically');
            }
        }, 1500);
    }

    /**
     * Stop the server
     */
    stop() {
        console.log('\n🛑 Stopping development server...');
        
        // Close file watchers
        this.watchers.forEach(watcher => watcher.close());
        
        // Close WebSocket server
        if (this.wsServer) {
            this.wsServer.close();
        }
        
        // Close HTTP server
        if (this.server) {
            this.server.close();
        }
        
        console.log('✅ Server stopped');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    if (global.devServer) {
        global.devServer.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (global.devServer) {
        global.devServer.stop();
    }
    process.exit(0);
});

// Start the development server
global.devServer = new DevServer();
global.devServer.start().catch(error => {
    console.error('❌ Failed to start development server:', error);
    process.exit(1);
});

export { DevServer };