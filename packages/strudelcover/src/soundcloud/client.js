import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * SoundCloud client for track access
 * Uses public API (no auth required for public tracks)
 */
export class SoundCloudClient {
  constructor() {
    // Public client IDs that might work
    this.clientIds = [
      'iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX',
      'CW62xLA9h8wXrXC1WIaSX9OWA6novAIE',
      'z8LRYFPM4UK5MMLaBe9vixfph5kqNA25',
      'fDoItMDbsbZz8dY16ZzARCZmzgHBPotA'
    ];
    this.clientId = this.clientIds[0];
    this.baseUrl = 'https://api-v2.soundcloud.com';
  }

  /**
   * Resolve a SoundCloud URL to get track info
   */
  async resolveUrl(url) {
    // Try each client ID until one works
    for (const clientId of this.clientIds) {
      const resolveUrl = `${this.baseUrl}/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`;
      
      try {
        const response = await fetch(resolveUrl);
        if (response.ok) {
          this.clientId = clientId; // Remember working client ID
          return response.json();
        }
      } catch (error) {
        // Try next client ID
        continue;
      }
    }
    
    // Try to get a new client ID from the page
    console.log(chalk.dim('Trying to fetch new client ID...'));
    const newClientId = await this.getClientId();
    if (newClientId) {
      this.clientId = newClientId;
      this.clientIds.push(newClientId);
      
      // Retry with new client ID
      const retryUrl = `${this.baseUrl}/resolve?url=${encodeURIComponent(url)}&client_id=${this.clientId}`;
      const retryResponse = await fetch(retryUrl);
      if (retryResponse.ok) {
        return retryResponse.json();
      }
    }
    
    throw new Error('Failed to resolve SoundCloud URL - all client IDs failed');
  }

  /**
   * Get a fresh client ID from SoundCloud's public pages
   */
  async getClientId() {
    try {
      // Fetch SoundCloud homepage
      const response = await fetch('https://soundcloud.com');
      const html = await response.text();
      
      // Look for script tags that might contain client_id
      const scriptMatches = html.match(/<script[^>]*src="([^"]*\.js)"/g);
      if (!scriptMatches) return null;
      
      for (const scriptTag of scriptMatches) {
        const srcMatch = scriptTag.match(/src="([^"]*)"/);
        if (!srcMatch) continue;
        
        const scriptUrl = srcMatch[1];
        if (!scriptUrl.includes('soundcloud')) continue;
        
        try {
          const scriptResponse = await fetch(scriptUrl.startsWith('http') ? scriptUrl : `https://soundcloud.com${scriptUrl}`);
          const scriptContent = await scriptResponse.text();
          
          // Look for client_id in the script
          const clientIdMatch = scriptContent.match(/client_id=([a-zA-Z0-9]+)/);
          if (clientIdMatch) {
            console.log(chalk.dim('Found new SoundCloud client ID'));
            return clientIdMatch[1];
          }
        } catch (e) {
          // Continue searching
        }
      }
    } catch (error) {
      console.log(chalk.dim('Could not fetch new client ID'));
    }
    return null;
  }

  /**
   * Get track info from track ID or URL
   */
  async getTrackInfo(trackIdOrUrl) {
    let track;
    
    if (trackIdOrUrl.includes('soundcloud.com')) {
      track = await this.resolveUrl(trackIdOrUrl);
    } else {
      // Direct track ID
      const trackUrl = `${this.baseUrl}/tracks/${trackIdOrUrl}?client_id=${this.clientId}`;
      const response = await fetch(trackUrl);
      if (!response.ok) {
        throw new Error('Failed to get track info');
      }
      track = await response.json();
    }
    
    return {
      id: track.id,
      title: track.title,
      artist: track.user.username,
      duration: track.duration / 1000, // Convert to seconds
      genre: track.genre,
      bpm: track.bpm,
      key: track.key_signature,
      description: track.description,
      waveform_url: track.waveform_url,
      artwork_url: track.artwork_url,
      stream_url: track.stream_url,
      download_url: track.download_url,
      downloadable: track.downloadable,
      streamable: track.streamable
    };
  }

  /**
   * Get streaming URL for a track
   */
  async getStreamUrl(trackData) {
    // If track has media transcodings (newer API)
    if (trackData.media?.transcodings?.length > 0) {
      // Prefer progressive (direct MP3) over HLS
      const transcoding = trackData.media.transcodings.find(t => 
        t.format.protocol === 'progressive'
      ) || trackData.media.transcodings[0];
      
      if (transcoding) {
        const streamUrl = `${transcoding.url}?client_id=${this.clientId}`;
        const response = await fetch(streamUrl);
        if (response.ok) {
          const data = await response.json();
          return data.url;
        }
      }
    }
    
    // Fallback to stream_url if available
    if (trackData.stream_url) {
      return `${trackData.stream_url}?client_id=${this.clientId}`;
    }
    
    // Try constructing a stream URL
    if (trackData.id) {
      return `https://api.soundcloud.com/tracks/${trackData.id}/stream?client_id=${this.clientId}`;
    }
    
    return null;
  }

  /**
   * Download track audio
   */
  async downloadTrack(trackIdOrUrl, outputDir) {
    console.log(chalk.dim('Fetching SoundCloud track...'));
    
    // Get full track data from resolve
    const trackData = await this.resolveUrl(trackIdOrUrl);
    console.log(chalk.green(`Found: ${trackData.title} by ${trackData.user.username}`));
    
    // Create simplified track info
    const track = {
      id: trackData.id,
      title: trackData.title,
      artist: trackData.user.username,
      duration: trackData.duration / 1000,
      genre: trackData.genre,
      bpm: trackData.bpm,
      key: trackData.key_signature
    };
    
    // Save metadata
    const metadataPath = join(outputDir, 'soundcloud-metadata.json');
    writeFileSync(metadataPath, JSON.stringify(track, null, 2));
    
    // Get stream URL - pass the full track data
    const streamUrl = await this.getStreamUrl(trackData);
    if (!streamUrl) {
      throw new Error('Track is not streamable');
    }
    
    console.log(chalk.dim('Downloading audio...'));
    
    // Download the audio
    const audioResponse = await fetch(streamUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio');
    }
    
    const buffer = await audioResponse.arrayBuffer();
    const outputPath = join(outputDir, 'soundcloud-audio.mp3');
    writeFileSync(outputPath, Buffer.from(buffer));
    
    console.log(chalk.green('✓ Audio downloaded'));
    
    // If we have BPM/key info, create enhanced metadata
    if (track.bpm || track.key) {
      const enhancedPath = join(outputDir, 'soundcloud-enhanced.json');
      writeFileSync(enhancedPath, JSON.stringify({
        tempo: track.bpm || null,
        key: track.key || null,
        genre: track.genre,
        duration: track.duration,
        waveform_url: track.waveform_url
      }, null, 2));
    }
    
    return outputPath;
  }

  /**
   * Search for tracks
   */
  async searchTracks(query, limit = 10) {
    const searchUrl = `${this.baseUrl}/search/tracks?q=${encodeURIComponent(query)}&client_id=${this.clientId}&limit=${limit}`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error('Search failed');
    }
    
    const data = await response.json();
    return data.collection;
  }

  /**
   * Get tracks by genre
   */
  async getTracksByGenre(genre, limit = 10) {
    const chartsUrl = `${this.baseUrl}/charts?kind=top&genre=soundcloud:genres:${genre}&client_id=${this.clientId}&limit=${limit}`;
    
    const response = await fetch(chartsUrl);
    if (!response.ok) {
      throw new Error('Failed to get genre tracks');
    }
    
    const data = await response.json();
    return data.collection.map(item => item.track);
  }
}