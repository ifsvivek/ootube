<script>
	import { onMount } from 'svelte';
	let query = '';
	let title = '';
	let audioRef;
	let playing = false;
	let loading = false;
	let currentTime = 0;
	let duration = 0;
	let volume = 1;
	let error = '';

	let visualizer;
	let audioContext;
	let analyser;
	let dataArray;
	let animationFrame;

	onMount(() => {
		visualizer = document.getElementById('visualizer');
		return () => {
			if (animationFrame) cancelAnimationFrame(animationFrame);
			if (audioContext) audioContext.close();
		};
	});

	$: bgStyle = `background: linear-gradient(135deg, 
        hsl(${(currentTime * 10) % 360}, 70%, 50%), 
        hsl(${(currentTime * 10 + 60) % 360}, 70%, 50%))`;

	async function loadMusic() {
		try {
			error = '';
			loading = true;
			playing = false;
			title = '';

			if (!query.trim()) {
				error = 'Please enter a YouTube URL or video ID';
				return;
			}

			if (audioRef) {
				audioRef.pause();
				audioRef.currentTime = 0;
			}

			// First get the audio URL and title
			const response = await fetch(`/api/stream?video=${encodeURIComponent(query)}`);
			if (!response.ok) {
				throw new Error('Failed to load audio');
			}

			const data = await response.json();
			title = data.title;

			// Create audio element with proxied URL
			const audio = new Audio(`/api/proxy?url=${encodeURIComponent(data.url)}`);
			
			await new Promise((resolve, reject) => {
				audio.addEventListener('canplay', resolve);
				audio.addEventListener('error', reject);
				setTimeout(() => reject(new Error('Loading timeout')), 10000);
			});

			audioRef = audio;
			audioRef.addEventListener('timeupdate', updateProgress);
			audioRef.addEventListener('loadedmetadata', updateProgress);
			
			playAudio();

			if (audioRef) {
				setupVisualizer();
			}

		} catch (err) {
			error = 'Failed to load audio. Please try again.';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function playAudio() {
		if (audioRef) {
			audioRef.play();
			playing = true;
		}
	}

	function pauseAudio() {
		if (audioRef) {
			audioRef.pause();
			playing = false;
		}
	}

	function stopAudio() {
		if (audioRef) {
			audioRef.pause();
			audioRef.currentTime = 0;
			playing = false;
		}
	}

	function updateProgress() {
		currentTime = audioRef.currentTime;
		duration = audioRef.duration;
	}

	function seek(event) {
		if (duration && audioRef) {
			const rect = event.target.getBoundingClientRect();
			const offsetX = event.clientX - rect.left;
			const seekTime = (offsetX / rect.width) * duration;
			audioRef.currentTime = seekTime;
		}
	}

	function formatTime(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function setupVisualizer() {
		if (!audioContext) {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			const bufferLength = analyser.frequencyBinCount;
			dataArray = new Uint8Array(bufferLength);
		}

		const source = audioContext.createMediaElementSource(audioRef);
		source.connect(analyser);
		analyser.connect(audioContext.destination);
		
		function draw() {
			if (!visualizer) return;
			const ctx = visualizer.getContext('2d');
			const width = visualizer.width;
			const height = visualizer.height;
			
			analyser.getByteFrequencyData(dataArray);
			
			ctx.clearRect(0, 0, width, height);
			ctx.fillStyle = 'rgb(0, 0, 0, 0)';
			ctx.fillRect(0, 0, width, height);
			
			const barWidth = (width / dataArray.length) * 2.5;
			let x = 0;
			
			for (let i = 0; i < dataArray.length; i++) {
				const barHeight = (dataArray[i] / 255) * height;
				const hue = (i / dataArray.length) * 360 + currentTime * 10;
				
				ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
				ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
				x += barWidth;
			}
			
			animationFrame = requestAnimationFrame(draw);
		}
		
		draw();
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
	<div class="max-w-4xl mx-auto">
		<!-- Search Bar -->
		<div class="mb-8 bg-gray-800 rounded-full p-2 flex items-center">
			<input
				type="text"
				bind:value={query}
				placeholder="Enter YouTube URL or video ID"
				class="w-full bg-transparent px-4 py-2 outline-none"
				disabled={loading}
			/>
			<button
				on:click={loadMusic}
				class="ml-2 px-6 py-2 bg-blue-600 rounded-full hover:bg-blue-700 
					   transition-colors duration-200 disabled:bg-gray-600"
				disabled={loading}
			>
				{loading ? 'Loading...' : 'Play'}
			</button>
		</div>

		<!-- Player Card -->
		<div class="bg-gray-800 rounded-2xl p-6 shadow-2xl">
			<!-- Visualizer -->
			<canvas
				id="visualizer"
				class="w-full h-48 mb-6 rounded-lg bg-black/20"
				width="800"
				height="200"
			/>

			<!-- Now Playing -->
			{#if title}
				<div class="flex items-center mb-6">
					<div class="w-16 h-16 bg-gray-700 rounded-lg mr-4 flex-shrink-0 
							  flex items-center justify-center">
						<svg class="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
							<path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
						</svg>
					</div>
					<div class="flex-1 min-w-0">
						<h2 class="text-lg font-semibold truncate">{title}</h2>
						<p class="text-gray-400 text-sm">Now Playing</p>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="text-red-400 text-center mb-4">{error}</div>
			{/if}

			<!-- Progress Bar -->
			{#if audioRef}
				<div class="mb-4">
					<div class="relative h-1 bg-gray-700 rounded-full cursor-pointer" on:click={seek}>
						<div
							class="absolute h-full bg-blue-500 rounded-full"
							style="width: {duration ? (currentTime / duration) * 100 : 0}%"
						/>
					</div>
					<div class="flex justify-between text-sm text-gray-400 mt-1">
						<span>{formatTime(currentTime)}</span>
						<span>{formatTime(duration)}</span>
					</div>
				</div>

				<!-- Controls -->
				<div class="flex items-center justify-center space-x-6">
					<button
						class="p-3 rounded-full hover:bg-gray-700 transition-colors"
						on:click={stopAudio}
					>
						<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
							<path d="M5 4h10a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/>
						</svg>
					</button>

					{#if !playing}
						<button
							class="p-4 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
							on:click={playAudio}
						>
							<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
								<path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/>
							</svg>
						</button>
					{:else}
						<button
							class="p-4 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
							on:click={pauseAudio}
						>
							<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
								<path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 011-1h.01a1 1 0 110 2H8a1 1 0 01-1-1zm3 0a1 1 0 011-1h.01a1 1 0 110 2H11a1 1 0 01-1-1z"/>
							</svg>
						</button>
					{/if}

					<!-- Volume Control -->
					<div class="flex items-center">
						<svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
							<path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"/>
						</svg>
						<input
							type="range"
							bind:value={volume}
							min="0"
							max="1"
							step="0.01"
							class="ml-2 w-20"
							on:input={() => audioRef && (audioRef.volume = volume)}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
