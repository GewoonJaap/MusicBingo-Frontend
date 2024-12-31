<script lang="ts">
	import MusicBingoApi from '$lib/api/MusicBingoApi';
	import type { SimplifiedTrack } from '@spotify/web-api-ts-sdk';
	import jsPDF from 'jspdf';
	import QRious from 'qrious';

	interface MusicDetails {
		name: string;
		creator: string;
		followers: number;
		image: string;
		tracks: SimplifiedTrack[];
		release_date?: string; // Optional for albums
	}

	let playlistId = '';
	let musicDetails: MusicDetails | null = null;
	let errorMessage = '';
	let isLoading = false;

	function extractId(input: string): string {
		const urlPattern = /https:\/\/open\.spotify\.com\/(playlist|album)\/([a-zA-Z0-9]+)\?/;
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
						tracks: album.tracks.items.map((track) => ({ track })),
						release_date: album.release_date
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
			console.error('Please enter a valid playlist or album ID or URL');
			errorMessage = 'Please enter a valid playlist or album ID or URL';
			return null;
		}
	}

	function splitIntoPages(tracks: SimplifiedTrack[], itemsPerPage: number): SimplifiedTrack[][] {
		const pages: SimplifiedTrack[][] = [];
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

	function generatePDF(details: MusicDetails): void {
		const doc = new jsPDF();
		const tracks = details.tracks;
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
				const track = item.track as unknown as SimplifiedTrack;
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
				const track = item.track as unknown as SimplifiedTrack;
				const artist = track.artists[0].name;
				const year = details.release_date
					? new Date(details.release_date).getFullYear()
					: new Date(track.album.release_date).getFullYear();
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

<div class="flex min-h-screen items-center justify-center bg-gray-100">
	<div class="w-full max-w-md rounded bg-white p-6 text-center shadow-md">
		<h1 class="mb-4 text-4xl font-bold">MusicBingo</h1>
		<input
			type="text"
			bind:value={playlistId}
			placeholder="Enter Spotify Playlist or Album ID or URL"
			class="mb-4 w-full rounded border p-2"
		/>
		<button
			on:click={handleFetchDetails}
			class="w-full rounded bg-blue-500 p-2 text-white"
			disabled={isLoading}
		>
			{#if isLoading}
				Loading...
			{:else}
				Fetch Details
			{/if}
		</button>
		{#if errorMessage}
			<p class="mt-4 text-red-500">{errorMessage}</p>
		{/if}
		{#if musicDetails}
			<div class="mt-6">
				<h2 class="text-2xl font-bold">{musicDetails.name}</h2>
				<p class="text-gray-600">by {musicDetails.creator}</p>
				<img src={musicDetails.image} alt="Image" class="mt-4 w-full rounded shadow-md" />
				{#if musicDetails.followers > 0}
					<p class="mt-2 text-gray-500">Followers: {musicDetails.followers}</p>
				{/if}
				<a
					href={`https://open.spotify.com/${playlistId.includes('playlist') ? 'playlist' : 'album'}/${extractId(playlistId)}`}
					target="_blank"
					class="mt-2 block text-blue-500">Open in Spotify</a
				>
				<button
					on:click={handleGeneratePDF}
					class="mt-4 w-full rounded bg-green-500 p-2 text-white"
				>
					Generate PDF
				</button>
			</div>
		{/if}
	</div>
</div>
