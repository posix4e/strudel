import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';

/**
 * Spotify client for track access using Client Credentials flow
 */
export class SpotifyClient {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = 'https://api.spotify.com/v1';
    this.tokenUrl = 'https://accounts.spotify.com/api/token';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token using client credentials flow
   */
  async getAccessToken() {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log(chalk.dim('Getting Spotify access token...'));

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Set expiry to 5 minutes before actual expiry
    this.tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);
    
    return this.accessToken;
  }

  /**
   * Extract track ID from Spotify URL or URI
   */
  extractTrackId(trackIdOrUrl) {
    // Handle URLs like https://open.spotify.com/track/3cjvqsvvU80g7WJPMVh8iq
    const urlMatch = trackIdOrUrl.match(/track\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // Handle URIs like spotify:track:3cjvqsvvU80g7WJPMVh8iq
    const uriMatch = trackIdOrUrl.match(/spotify:track:([a-zA-Z0-9]+)/);
    if (uriMatch) {
      return uriMatch[1];
    }
    
    // Assume it's already a track ID
    return trackIdOrUrl;
  }

  /**
   * Get track info from Spotify
   */
  async getTrackInfo(trackIdOrUrl) {
    const trackId = this.extractTrackId(trackIdOrUrl);
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get track info: ${error}`);
    }

    const track = await response.json();
    
    return {
      id: track.id,
      title: track.name,
      artist: track.artists[0].name,
      artists: track.artists.map(a => a.name),
      album: track.album.name,
      duration: track.duration_ms / 1000, // Convert to seconds
      popularity: track.popularity,
      preview_url: track.preview_url,
      uri: track.uri,
      external_url: track.external_urls.spotify
    };
  }

  /**
   * Get audio features for a track
   */
  async getAudioFeatures(trackId) {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/audio-features/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get audio features: ${error}`);
    }

    return response.json();
  }

  /**
   * Download track preview (30-second clip)
   */
  async downloadTrack(trackIdOrUrl, outputDir) {
    console.log(chalk.dim('Fetching Spotify track...'));
    
    const trackId = this.extractTrackId(trackIdOrUrl);
    const track = await this.getTrackInfo(trackId);
    
    console.log(chalk.green(`Found: ${track.title} by ${track.artist}`));
    
    if (!track.preview_url) {
      // Try to get the full track via YouTube search as fallback
      console.log(chalk.yellow('⚠️  No Spotify preview available - searching YouTube...'));
      
      const searchQuery = `${track.artist} ${track.title} official audio`;
      console.log(chalk.dim(`Searching for: ${searchQuery}`));
      
      // Use yt-dlp to search and download
      const outputPath = join(outputDir, 'spotify-youtube-fallback.%(ext)s');
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        // Search YouTube and download the first result
        const { stdout } = await execAsync(
          `yt-dlp -x --audio-format mp3 -o "${outputPath}" "ytsearch:${searchQuery}"`
        );
        
        // Get the actual filename
        const match = stdout.match(/\[ExtractAudio\] Destination: (.+)/) || 
                     stdout.match(/\[download\] (.+) has already been downloaded/) ||
                     stdout.match(/\[download\] Destination: (.+)/);
        
        if (match) {
          const audioPath = match[1].trim();
          console.log(chalk.green('✓ Found and downloaded via YouTube'));
          
          // Still save the Spotify metadata
          const metadataPath = join(outputDir, 'spotify-metadata.json');
          writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
          
          return audioPath;
        }
      } catch (err) {
        console.error(chalk.red('YouTube fallback failed:', err.message));
      }
      
      throw new Error('No preview available and YouTube fallback failed');
    }
    
    // Get audio features
    const features = await this.getAudioFeatures(trackId);
    
    // Save metadata
    const metadata = {
      ...track,
      audio_features: {
        tempo: features.tempo,
        key: features.key,
        mode: features.mode,
        time_signature: features.time_signature,
        energy: features.energy,
        danceability: features.danceability,
        valence: features.valence,
        acousticness: features.acousticness,
        instrumentalness: features.instrumentalness,
        liveness: features.liveness,
        speechiness: features.speechiness
      }
    };
    
    const metadataPath = join(outputDir, 'spotify-metadata.json');
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(chalk.dim('Downloading preview...'));
    
    // Download the preview
    const audioResponse = await fetch(track.preview_url);
    if (!audioResponse.ok) {
      throw new Error('Failed to download preview');
    }
    
    const buffer = await audioResponse.arrayBuffer();
    const outputPath = join(outputDir, 'spotify-preview.mp3');
    writeFileSync(outputPath, Buffer.from(buffer));
    
    console.log(chalk.green('✓ Preview downloaded (30 seconds)'));
    
    // Create enhanced metadata for analysis
    const enhancedPath = join(outputDir, 'spotify-enhanced.json');
    const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    writeFileSync(enhancedPath, JSON.stringify({
      tempo: features.tempo,
      key: keyNames[features.key] + (features.mode === 1 ? ' major' : ' minor'),
      energy: features.energy,
      duration: 30, // Preview is always 30 seconds
      time_signature: features.time_signature
    }, null, 2));
    
    return outputPath;
  }
}