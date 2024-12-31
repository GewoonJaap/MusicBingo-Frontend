import type { Album, Playlist, SimplifiedAlbum, Track } from '@spotify/web-api-ts-sdk';

const BASE_URL = 'https://musicbingo-backend.gewoonjaap.workers.dev/api/card';

class MusicBingoApi {
	async getPlaylist(playlistId: string): Promise<Playlist> {
		if (!playlistId) {
			throw new Error('No playlistId provided');
		}
		const response = await fetch(`${BASE_URL}/playlist/${playlistId}`);
		if (!response.ok) {
			throw new Error(`Error fetching playlist: ${response.statusText}`);
		}
		return response.json();
	}

	async getArtist(artistId: string): Promise<SimplifiedAlbum[]> {
		if (!artistId) {
			throw new Error('No artistId provided');
		}
		const response = await fetch(`${BASE_URL}/artist/${artistId}`);
		if (!response.ok) {
			throw new Error(`Error fetching artist: ${response.statusText}`);
		}
		return response.json();
	}

	async getAlbum(albumId: string): Promise<Album> {
		if (!albumId) {
			throw new Error('No albumId provided');
		}
		const response = await fetch(`${BASE_URL}/album/${albumId}`);
		if (!response.ok) {
			throw new Error(`Error fetching album: ${response.statusText}`);
		}
		return response.json();
	}

	async getTrack(trackId: string): Promise<Track> {
		if (!trackId) {
			throw new Error('No trackId provided');
		}
		const response = await fetch(`${BASE_URL}/track/${trackId}`);
		if (!response.ok) {
			throw new Error(`Error fetching track: ${response.statusText}`);
		}
		return response.json();
	}
}

export default new MusicBingoApi();
