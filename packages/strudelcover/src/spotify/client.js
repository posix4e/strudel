import { SpotifyAuth } from './auth.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * Spotify API client for track access and audio features
 */
export class SpotifyClient {
  constructor() {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Spotify credentials not configured. Run "strudelcover spotify-login" first.');
    }
    
    this.auth = new SpotifyAuth(clientId, clientSecret);
    this.baseUrl = 'https://api.spotify.com/v1';
  }

  /**
   * Make authenticated request to Spotify API
   */
  async apiRequest(endpoint, options = {}) {
    const token = await this.auth.getValidToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Spotify API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get track information
   */
  async getTrackInfo(trackId) {
    const track = await this.apiRequest(`/tracks/${trackId}`);
    
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name),
      album: track.album.name,
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
      uri: track.uri,
      popularity: track.popularity
    };
  }

  /**
   * Get audio features for a track
   */
  async getAudioFeatures(trackId) {
    return await this.apiRequest(`/audio-features/${trackId}`);
  }

  /**
   * Get detailed audio analysis
   */
  async getAudioAnalysis(trackId) {
    return await this.apiRequest(`/audio-analysis/${trackId}`);
  }

  /**
   * Search for tracks
   */
  async searchTracks(query, limit = 10) {
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit.toString()
    });
    
    const results = await this.apiRequest(`/search?${params}`);
    return results.tracks.items;
  }

  /**
   * Download track preview or use audio analysis
   */
  async downloadTrack(trackId, outputDir) {
    console.log(chalk.dim('Fetching track information...'));
    
    // Get track info and audio features
    const [track, features, analysis] = await Promise.all([
      this.getTrackInfo(trackId),
      this.getAudioFeatures(trackId),
      this.getAudioAnalysis(trackId).catch(() => null)
    ]);
    
    console.log(chalk.green(`Found: ${track.name} by ${track.artists.join(', ')}`));
    
    // Save Spotify analysis data for better pattern generation
    const metadataPath = join(outputDir, 'spotify-metadata.json');
    writeFileSync(metadataPath, JSON.stringify({
      track,
      features,
      analysis: analysis ? {
        bars: analysis.bars?.length,
        beats: analysis.beats?.length,
        sections: analysis.sections?.slice(0, 10), // First 10 sections
        segments: analysis.segments?.length,
        tempo: analysis.track?.tempo,
        key: analysis.track?.key,
        mode: analysis.track?.mode,
        time_signature: analysis.track?.time_signature
      } : null
    }, null, 2));
    
    // Check if preview is available
    if (track.preview_url) {
      console.log(chalk.dim('Downloading 30-second preview...'));
      
      const response = await fetch(track.preview_url);
      if (!response.ok) {
        throw new Error('Failed to download preview');
      }
      
      const buffer = await response.arrayBuffer();
      const outputPath = join(outputDir, 'spotify-preview.mp3');
      writeFileSync(outputPath, Buffer.from(buffer));
      
      console.log(chalk.green('✓ Preview downloaded'));
      return outputPath;
    } else {
      // Generate a synthetic audio placeholder based on features
      console.log(chalk.yellow('No preview available. Using audio features for generation...'));
      
      // Create a metadata file that the analyzer can use
      const synthPath = join(outputDir, 'spotify-synthetic.json');
      writeFileSync(synthPath, JSON.stringify({
        synthetic: true,
        duration: track.duration_ms / 1000,
        tempo: features.tempo,
        key: features.key,
        mode: features.mode,
        time_signature: features.time_signature,
        energy: features.energy,
        danceability: features.danceability,
        valence: features.valence,
        acousticness: features.acousticness,
        instrumentalness: features.instrumentalness,
        loudness: features.loudness,
        sections: analysis?.sections || []
      }, null, 2));
      
      return synthPath;
    }
  }

  /**
   * Get user's top tracks
   */
  async getTopTracks(limit = 20) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      time_range: 'medium_term'
    });
    
    const results = await this.apiRequest(`/me/top/tracks?${params}`);
    return results.items;
  }

  /**
   * Get user's recently played tracks
   */
  async getRecentlyPlayed(limit = 20) {
    const params = new URLSearchParams({
      limit: limit.toString()
    });
    
    const results = await this.apiRequest(`/me/player/recently-played?${params}`);
    return results.items.map(item => item.track);
  }

  /**
   * Create a curated StrudelCover playlist
   */
  async createStrudelPlaylist(userId, trackUris) {
    // Create playlist
    const playlist = await this.apiRequest(`/users/${userId}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'StrudelCover Creations',
        description: 'AI-generated Strudel patterns from my favorite tracks',
        public: false
      })
    });
    
    // Add tracks
    if (trackUris.length > 0) {
      await this.apiRequest(`/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        body: JSON.stringify({
          uris: trackUris
        })
      });
    }
    
    return playlist;
  }
}