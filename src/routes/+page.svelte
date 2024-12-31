<script lang="ts">
    import MusicBingoApi from '$lib/api/MusicBingoApi';
    import type { SimplifiedTrack } from '@spotify/web-api-ts-sdk';
    import jsPDF from 'jspdf';
    import QRious from 'qrious';
    let playlistId = '';
    let playlist: any = null;
    let errorMessage = '';
    let isLoading = false;

    function extractPlaylistId(input: string): string {
        const urlPattern = /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)\?/;
        const match = input.match(urlPattern);
        return match ? match[1] : input;
    }

    async function fetchPlaylist() {
        const id = extractPlaylistId(playlistId);
        if (id) {
            isLoading = true;
            try {
                playlist = await MusicBingoApi.getPlaylist(id);
                errorMessage = '';
            } catch (error) {
                console.error('Error fetching playlist:', error);
                errorMessage = 'Error fetching playlist. Please try again.';
                playlist = null;
            } finally {
                isLoading = false;
            }
        } else {
            console.error('Please enter a valid playlist ID or URL');
            errorMessage = 'Please enter a valid playlist ID or URL';
            playlist = null;
        }
    }

    function splitIntoPages(tracks, itemsPerPage) {
        const pages = [];
        for (let i = 0; i < tracks.length; i += itemsPerPage) {
            pages.push(tracks.slice(i, i + itemsPerPage));
        }
        return pages;
    }

    function fitText(doc, text, x, y, maxWidth, maxHeight) {
        let fontSize = 12;
        doc.setFontSize(fontSize);
        while (doc.getTextWidth(text) > maxWidth && fontSize > 6) {
            fontSize -= 1;
            doc.setFontSize(fontSize);
        }
        doc.text(text, x, y, { align: 'center' });
    }

    function generatePDF() {
        if (!playlist) return;

        const doc = new jsPDF();
        const tracks = playlist.tracks.items;
        const cardSize = 70; // Square card size
        const margin = 10;
        const itemsPerPage = Math.floor(doc.internal.pageSize.height / (cardSize + margin)) * Math.floor(doc.internal.pageSize.width / (cardSize + margin));
        const pages = splitIntoPages(tracks, itemsPerPage);

        pages.forEach((pageTracks, pageIndex) => {
            let x = margin;
            let y = margin;

            // Page for Spotify URIs
            pageTracks.forEach((item) => {
                const track = item.track as SimplifiedTrack;
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
                const track = item.track;
                const artist = track.artists[0].name;
                const year = new Date(track.album.release_date).getFullYear();
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
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center bg-white p-6 rounded shadow-md w-full max-w-md">
        <h1 class="text-4xl font-bold mb-4">MusicBingo</h1>
        <input
            type="text"
            bind:value={playlistId}
            placeholder="Enter Spotify Playlist ID or URL"
            class="border p-2 rounded mb-4 w-full"
        />
        <button on:click={fetchPlaylist} class="bg-blue-500 text-white p-2 rounded w-full" disabled={isLoading}>
            {#if isLoading}
                Loading...
            {:else}
                Fetch Playlist
            {/if}
        </button>
        {#if errorMessage}
            <p class="text-red-500 mt-4">{errorMessage}</p>
        {/if}
        {#if playlist}
            <div class="mt-6">
                <h2 class="text-2xl font-bold">{playlist.name}</h2>
                <p class="text-gray-600">by {playlist.owner.display_name}</p>
                <img src={playlist.images[0]?.url} alt="Playlist Image" class="mt-4 rounded shadow-md w-full" />
                <p class="mt-4 text-gray-700">{playlist.description}</p>
                <p class="mt-2 text-gray-500">Followers: {playlist.followers.total}</p>
                <a href={playlist.external_urls.spotify} target="_blank" class="text-blue-500 mt-2 block">Open in Spotify</a>
                <button on:click={generatePDF} class="bg-green-500 text-white p-2 rounded mt-4 w-full">
                    Generate PDF
                </button>
            </div>
        {/if}
    </div>
</div>