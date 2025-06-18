import { createServer } from 'http';
import { parse } from 'url';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Spotify OAuth2 authentication handler
 */
export class SpotifyAuth {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = 'http://localhost:8888/callback';
    this.tokenFile = join(homedir(), '.strudelcover', 'spotify-token.json');
    
    // Ensure config directory exists
    const configDir = join(homedir(), '.strudelcover');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
  }

  /**
   * Get authorization URL
   */
  getAuthUrl() {
    const scopes = [
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'user-library-read',
      'streaming',
      'user-read-playback-state',
      'user-modify-playback-state'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes,
      show_dialog: true
    });

    return `https://accounts.spotify.com/authorize?${params}`;
  }

  /**
   * Start OAuth flow with local server
   */
  async authenticate() {
    return new Promise((resolve, reject) => {
      const server = createServer(async (req, res) => {
        const { pathname, query } = parse(req.url, true);
        
        if (pathname === '/callback') {
          if (query.code) {
            try {
              // Exchange code for token
              const token = await this.exchangeCodeForToken(query.code);
              
              // Save token
              this.saveToken(token);
              
              // Success response
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1 style="color: #1DB954;">✓ Successfully authenticated with Spotify!</h1>
                    <p>You can now close this window and return to StrudelCover.</p>
                    <script>setTimeout(() => window.close(), 3000);</script>
                  </body>
                </html>
              `);
              
              server.close();
              resolve(token);
            } catch (error) {
              res.writeHead(500);
              res.end('Authentication failed: ' + error.message);
              server.close();
              reject(error);
            }
          } else {
            res.writeHead(400);
            res.end('No authorization code received');
            server.close();
            reject(new Error('No authorization code received'));
          }
        }
      });

      server.listen(8888, () => {
        const authUrl = this.getAuthUrl();
        console.log(chalk.green('\n🎵 Opening Spotify login in your browser...'));
        console.log(chalk.dim(`If it doesn't open automatically, visit: ${authUrl}\n`));
        
        // Simple open URL fallback
        const { exec } = await import('child_process');
        const openCommand = process.platform === 'darwin' ? 'open' : 
                           process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${openCommand} "${authUrl}"`);
      });
    });
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: refreshToken,
      expires_at: Date.now() + (data.expires_in * 1000)
    };
  }

  /**
   * Get valid token (refresh if needed)
   */
  async getValidToken() {
    const token = this.loadToken();
    
    if (!token) {
      throw new Error('No Spotify token found. Please run "strudelcover spotify-login" first.');
    }

    // Check if token is expired
    if (Date.now() >= token.expires_at) {
      console.log(chalk.dim('Refreshing Spotify token...'));
      const newToken = await this.refreshToken(token.refresh_token);
      this.saveToken(newToken);
      return newToken.access_token;
    }

    return token.access_token;
  }

  /**
   * Save token to file
   */
  saveToken(token) {
    writeFileSync(this.tokenFile, JSON.stringify(token, null, 2));
  }

  /**
   * Load token from file
   */
  loadToken() {
    if (existsSync(this.tokenFile)) {
      return JSON.parse(readFileSync(this.tokenFile, 'utf-8'));
    }
    return null;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    const token = this.loadToken();
    return token && Date.now() < token.expires_at;
  }

  /**
   * Logout (remove token)
   */
  logout() {
    if (existsSync(this.tokenFile)) {
      const fs = require('fs');
      fs.unlinkSync(this.tokenFile);
      console.log(chalk.green('✓ Logged out from Spotify'));
    }
  }
}