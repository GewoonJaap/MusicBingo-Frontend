<script lang="ts">
	import MusicBingoApi from '$lib/api/MusicBingoApi';
	import type {
		SimplifiedTrack,
		PlaylistTrack,
		SimplifiedAlbum,
		Artist,
		Album
	} from '@spotify/web-api-ts-sdk';
	import jsPDF from 'jspdf';
	import QRious from 'qrious';
	import { setupLocale } from '$lib/locale/i18';
	import { _ } from 'svelte-i18n';
	import SEO from '$lib/components/SEO/index.svelte';

	setupLocale();

	const SEOTags = {
		metadescription:
			'MusicBingo: Scan QR codes 🎵, listen to songs, and guess the track using hints like artist, year, and title. Play with friends and test your music knowledge!',
		slug: '',
		title: 'MusicBingo: Scan, Listen, Guess!'
	};

	interface MusicDetails {
		name: string;
		creator: string;
		followers: number;
		image: string;
		tracks: (PlaylistTrack | { track: SimplifiedTrack; album: Album })[];
		release_date?: string; // Optional for albums
	}

	let playlistId = '';
	let musicDetails: MusicDetails | null = null;
	let errorMessage = '';
	let isLoading = false;
	let isShuffled = false;

	function extractId(input: string): string {
		const urlPattern = /https:\/\/open\.spotify\.com\/(playlist|album|artist)\/([a-zA-Z0-9]+)\?/;
		const match = input.match(urlPattern);
		return match ? match[2] : input;
	}

	async function fetchDetails(): Promise<MusicDetails | null> {
		const id = extractId(playlistId);
		if (id) {
			isLoading = true;
			try {
				let details: MusicDetails;
				if (playlistId.includes('playlist')) {
					const playlist = await MusicBingoApi.getPlaylist(id);
					details = {
						name: playlist.name,
						creator: playlist.owner.display_name,
						followers: playlist.followers.total,
						image: playlist.images[0]?.url,
						tracks: playlist.tracks.items
					};
				} else if (playlistId.includes('album')) {
					const album = await MusicBingoApi.getAlbum(id);
					details = {
						name: album.name,
						creator: album.artists[0].name,
						followers: 0, // Albums don't have followers
						image: album.images[0]?.url,
						tracks: album.tracks.items.map((track) => ({ track, album })),
						release_date: album.release_date
					};
				} else if (playlistId.includes('artist')) {
					const artist = await MusicBingoApi.getArtist(id);
					const albums = await MusicBingoApi.getArtistAlbums(id);
					const allTracks = await Promise.all(
						albums.map((album) => MusicBingoApi.getAlbum(album.id))
					);
					details = {
						name: artist.name,
						creator: artist.name,
						followers: artist.followers.total,
						image: artist.images[0]?.url,
						tracks: allTracks.flatMap((album) =>
							album.tracks.items.map((track) => ({ track, album }))
						)
					};
				}
				errorMessage = '';
				return details;
			} catch (error) {
				console.error('Error fetching details:', error);
				errorMessage = 'Error fetching details. Please try again.';
				return null;
			} finally {
				isLoading = false;
			}
		} else {
			console.error('Please enter a valid playlist, album, or artist ID or URL');
			errorMessage = 'Please enter a valid playlist, album, or artist ID or URL';
			return null;
		}
	}

	function splitIntoPages(
		tracks: (PlaylistTrack | { track: SimplifiedTrack; album: Album })[],
		itemsPerPage: number
	): (PlaylistTrack | { track: SimplifiedTrack; album: Album })[][] {
		const pages: (PlaylistTrack | { track: SimplifiedTrack; album: Album })[][] = [];
		for (let i = 0; i < tracks.length; i += itemsPerPage) {
			pages.push(tracks.slice(i, i + itemsPerPage));
		}
		return pages;
	}

	function fitText(
		doc: jsPDF,
		text: string,
		x: number,
		y: number,
		maxWidth: number,
		maxHeight: number
	): void {
		let fontSize = 12;
		doc.setFontSize(fontSize);
		while (doc.getTextWidth(text) > maxWidth && fontSize > 6) {
			fontSize -= 1;
			doc.setFontSize(fontSize);
		}
		doc.text(text, x, y, { align: 'center' });
	}

	function shuffleTracks(tracks: any[]): any[] {
		for (let i = tracks.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[tracks[i], tracks[j]] = [tracks[j], tracks[i]];
		}
		return tracks;
	}

	function toggleShuffle() {
		if (musicDetails) {
			musicDetails.tracks = shuffleTracks([...musicDetails.tracks]);
			isShuffled = !isShuffled;
		}
	}

	function generatePDF(details: MusicDetails): void {
		const doc = new jsPDF();
		const tracks = isShuffled ? shuffleTracks([...details.tracks]) : details.tracks;
		const cardSize = 70; // Square card size
		const margin = 10;
		const itemsPerPage =
			Math.floor(doc.internal.pageSize.height / (cardSize + margin)) *
			Math.floor(doc.internal.pageSize.width / (cardSize + margin));
		const pages = splitIntoPages(tracks, itemsPerPage);

		pages.forEach((pageTracks, pageIndex) => {
			let x = margin;
			let y = margin;

			// Page for Spotify URIs
			pageTracks.forEach((item) => {
				const track = 'track' in item ? (item.track as SimplifiedTrack) : item;
				const spotifyURI = `https://open.spotify.com/track/${track.id}`;

				const qr = new QRious({
					value: spotifyURI,
					size: cardSize - 20
				});

				doc.rect(x, y, cardSize, cardSize);
				doc.addImage(qr.toDataURL(), 'PNG', x + 10, y + 10, cardSize - 20, cardSize - 20);

				x += cardSize + margin;
				if (x + cardSize + margin > doc.internal.pageSize.width) {
					x = margin;
					y += cardSize + margin;
				}
			});

			doc.addPage();
			x = margin;
			y = margin;

			// Page for Artist, Year, Track Name
			pageTracks.forEach((item) => {
				const track = 'track' in item ? (item.track as SimplifiedTrack) : item;
				const artist = track.artists[0].name;
				const year =
					'album' in item && item.album.release_date
						? new Date(item.album.release_date).getFullYear()
						: track.album?.release_date
							? new Date(track.album.release_date).getFullYear()
							: 'Unknown';
				const trackName = track.name;

				doc.rect(x, y, cardSize, cardSize);
				doc.setFontSize(18); // Increase font size for artist name
				fitText(doc, artist, x + cardSize / 2, y + 10, cardSize - 10, 10);
				doc.setFontSize(12); // Reset font size for year and track name
				fitText(doc, `${year}`, x + cardSize / 2, y + cardSize / 2, cardSize - 10, 10);
				fitText(doc, trackName, x + cardSize / 2, y + cardSize - 10, cardSize - 10, 10);

				x += cardSize + margin;
				if (x + cardSize + margin > doc.internal.pageSize.width) {
					x = margin;
					y += cardSize + margin;
				}
			});

			if (pageIndex < pages.length - 1) {
				doc.addPage();
			}
		});

		doc.save('playlist.pdf');
	}

	async function handleFetchDetails(): Promise<void> {
		const details = await fetchDetails();
		if (details) {
			musicDetails = details;
		}
	}

	async function handleGeneratePDF(): Promise<void> {
		const details = await fetchDetails();
		if (details) {
			generatePDF(details);
		}
	}
</script>

<SEO {...SEOTags} />
<div class="flex min-h-screen items-center justify-center bg-gray-100">
	<div class="w-full max-w-md rounded bg-white p-6 text-center shadow-md">
		<h1 class="title">{$_('TITLE')}</h1>
		<p class="description">{$_('DESCRIPTION')}</p>
		<input type="text" bind:value={playlistId} placeholder={$_('PLACEHOLDER')} class="input" />
		<button on:click={handleFetchDetails} class="button" disabled={isLoading}>
			{#if isLoading}
				{$_('LOADING')}
			{:else}
				{$_('FETCH_DETAILS')}
			{/if}
		</button>
		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}
		{#if musicDetails}
			<div class="details">
				<h2>{musicDetails.name}</h2>
				<p>{$_('BY')} {musicDetails.creator}</p>
				{#if musicDetails.followers > 0}
					<p>{$_('FOLLOWERS')}: {musicDetails.followers}</p>
				{/if}
				<img src={musicDetails.image} alt="Image" class="mt-4 w-full rounded shadow-md" />
				<a
					href={`https://open.spotify.com/${playlistId.includes('playlist') ? 'playlist' : playlistId.includes('album') ? 'album' : 'artist'}/${extractId(playlistId)}`}
					target="_blank"
					class="mt-2 block text-blue-500">{$_('OPEN_IN_SPOTIFY')}</a
				>
				<div class="mt-4">
					<label for="shuffle">{$_('SHUFFLE_TRACKS')}</label>
					<button on:click={toggleShuffle} class="button mt-2">
						{isShuffled ? $_('UNSHUFFLE') : $_('SHUFFLE')}
					</button>
				</div>
				<button on:click={handleGeneratePDF} class="button mt-4">
					{$_('GENERATE_PDF')}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.title {
		font-size: 2.5rem;
		font-weight: bold;
		color: #1db954; /* Spotify Green */
	}
	.description {
		font-size: 1.125rem;
		color: #555;
		margin-bottom: 1.5rem;
	}
	.input {
		border: 2px solid #1db954;
		padding: 0.5rem;
		border-radius: 0.375rem;
		width: 100%;
		margin-bottom: 1rem;
	}
	.button {
		background-color: #1db954;
		color: white;
		padding: 0.75rem;
		border-radius: 0.375rem;
		width: 100%;
		font-size: 1rem;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.3s;
	}
	.button:hover {
		background-color: #1aa34a;
	}
	.error {
		color: #e3342f;
		margin-top: 1rem;
	}
	.details {
		margin-top: 1.5rem;
	}
	.details img {
		border-radius: 0.375rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}
	.details h2 {
		font-size: 1.5rem;
		font-weight: bold;
		margin-top: 1rem;
	}
	.details p {
		color: #555;
	}
	.details a {
		color: #1db954;
		text-decoration: none;
		font-weight: bold;
	}
	.details a:hover {
		text-decoration: underline;
	}
</style>
