<script lang="ts">
    import MusicBingoApi from '$lib/api/MusicBingoApi';
    import jsPDF from 'jspdf';
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

    function generatePDF() {
        if (!playlist) return;

        const doc = new jsPDF();
        const tracks = playlist.tracks.items;
        const cardWidth = 90;
        const cardHeight = 50;
        const margin = 10;
        let x = margin;
        let y = margin;

        // Page 1: Spotify URIs
        tracks.forEach((item, index) => {
            const track = item.track;
            const spotifyURI = track.uri;

            doc.rect(x, y, cardWidth, cardHeight);
            doc.text(`Spotify URI: ${spotifyURI}`, x + 5, y + 25);

            x += cardWidth + margin;
            if (x + cardWidth + margin > doc.internal.pageSize.width) {
                x = margin;
                y += cardHeight + margin;
                if (y + cardHeight + margin > doc.internal.pageSize.height) {
                    doc.addPage();
                    y = margin;
                }
            }
        });

        doc.addPage();
        x = margin;
        y = margin;

        // Page 2: Artist, Year, Track Name
        tracks.forEach((item, index) => {
            const track = item.track;
            const artist = track.artists[0].name;
            const year = new Date(track.album.release_date).getFullYear();
            const trackName = track.name;

            doc.rect(x, y, cardWidth, cardHeight);
            doc.text(`Artist: ${artist}`, x + 5, y + 15);
            doc.text(`Year: ${year}`, x + 5, y + 25);
            doc.text(`Track: ${trackName}`, x + 5, y + 35);

            x += cardWidth + margin;
            if (x + cardWidth + margin > doc.internal.pageSize.width) {
                x = margin;
                y += cardHeight + margin;
                if (y + cardHeight + margin > doc.internal.pageSize.height) {
                    doc.addPage();
                    y = margin;
                }
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