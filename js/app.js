// Global variables
const { createFFmpeg, fetchFile } = FFmpeg;
let ffmpeg = null;
let ffmpegLoaded = false;
let currentVideoFile = null;
let currentVideoURL = null;
let processedVideoURL = null;
let videoOperations = {
    trim: null,
    effect: null,
    resize: null,
    format: 'mp4',
    mute: false,
    volume: 100
};

// Initialize FFmpeg with proper error handling
async function initFFmpeg() {
    if (!ffmpeg) {
        try {
            // Create FFmpeg instance
            ffmpeg = createFFmpeg({
                log: true,
                corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
            });
            
            // Load FFmpeg
            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
                ffmpegLoaded = true;
                console.log('FFmpeg loaded successfully');
            }
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            throw error;
        }
    }
    
    return ffmpeg;
}

// Auto-load FFmpeg on page load
async function autoLoadFFmpeg() {
    const status = document.getElementById('ffmpegStatus');
    
    try {
        status.textContent = 'Loading video processor... This may take a moment on first visit.';
        status.style.color = '#3498db';
        
        await initFFmpeg();
        
        status.textContent = 'Video processor ready! You can now upload and edit videos.';
        status.style.color = '#27ae60';
        
        // Enable upload area
        uploadArea.style.opacity = '1';
        uploadArea.style.pointerEvents = 'auto';
        
    } catch (error) {
        console.error('Failed to auto-load FFmpeg:', error);
        status.textContent = 'Failed to load video processor. Please refresh the page and try again.';
        status.style.color = '#e74c3c';
        
        // Show a retry button
        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'Retry';
        retryBtn.className = 'btn btn-primary';
        retryBtn.style.marginTop = '10px';
        retryBtn.onclick = () => {
            retryBtn.remove();
            autoLoadFFmpeg();
        };
        status.parentElement.appendChild(retryBtn);
    }
}

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const editorSection = document.getElementById('editorSection');
const videoPlayer = document.getElementById('videoPlayer');
const videoName = document.getElementById('videoName');
const videoDuration = document.getElementById('videoDuration');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const processingModal = document.getElementById('processingModal');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');
const outputSection = document.getElementById('outputSection');
const outputVideo = document.getElementById('outputVideo');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

// Event Listeners
uploadArea.addEventListener('click', () => {
    if (ffmpegLoaded) {
        videoInput.click();
    } else {
        showNotification('Please wait for the video processor to load', 'error');
    }
});
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
videoInput.addEventListener('change', handleFileSelect);

// Button event listeners
document.getElementById('trimBtn').addEventListener('click', handleTrim);
document.getElementById('resizeBtn').addEventListener('click', handleResize);
document.getElementById('convertBtn').addEventListener('click', handleConvert);
document.getElementById('muteBtn').addEventListener('click', handleMute);
document.getElementById('exportBtn').addEventListener('click', handleExport);
document.getElementById('resetBtn').addEventListener('click', handleReset);
document.getElementById('downloadBtn').addEventListener('click', handleDownload);
document.getElementById('newVideoBtn').addEventListener('click', handleNewVideo);

// Volume control
volumeSlider.addEventListener('input', (e) => {
    videoOperations.volume = e.target.value;
    volumeValue.textContent = `${e.target.value}%`;
});

// Effect buttons
document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
        if (videoOperations.effect === e.target.dataset.effect) {
            videoOperations.effect = null;
        } else {
            e.target.classList.add('active');
            videoOperations.effect = e.target.dataset.effect;
        }
    });
});

// File handling functions
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (!ffmpegLoaded) {
        showNotification('Please wait for the video processor to load', 'error');
        return;
    }
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('video/')) {
        handleVideoFile(files[0]);
    } else {
        showNotification('Please drop a video file', 'error');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
        handleVideoFile(file);
    } else {
        showNotification('Please select a video file', 'error');
    }
}

async function handleVideoFile(file) {
    currentVideoFile = file;
    currentVideoURL = URL.createObjectURL(file);
    
    // Display video
    videoPlayer.src = currentVideoURL;
    videoName.textContent = file.name;
    
    // Show editor section
    uploadArea.style.display = 'none';
    editorSection.style.display = 'block';
    
    // Get video duration when metadata is loaded
    videoPlayer.addEventListener('loadedmetadata', () => {
        const duration = videoPlayer.duration;
        videoDuration.textContent = formatTime(duration);
        endTimeInput.value = Math.floor(duration);
        endTimeInput.max = duration;
        startTimeInput.max = duration;
    });
}

// Video processing functions
function handleTrim() {
    const startTime = parseFloat(startTimeInput.value);
    const endTime = parseFloat(endTimeInput.value);
    
    if (startTime >= 0 && endTime > startTime) {
        videoOperations.trim = { start: startTime, end: endTime };
        showNotification('Trim settings applied');
    } else {
        showNotification('Invalid trim times', 'error');
    }
}

function handleResize() {
    const resizeValue = document.getElementById('resizeSelect').value;
    if (resizeValue) {
        videoOperations.resize = resizeValue;
        showNotification('Resize settings applied');
    }
}

function handleConvert() {
    const format = document.getElementById('formatSelect').value;
    videoOperations.format = format;
    showNotification(`Format set to ${format.toUpperCase()}`);
}

function handleMute() {
    videoOperations.mute = !videoOperations.mute;
    document.getElementById('muteBtn').textContent = videoOperations.mute ? 'Add Audio' : 'Remove Audio';
    showNotification(videoOperations.mute ? 'Audio will be removed' : 'Audio will be kept');
}

async function handleExport() {
    showProcessingModal();
    
    try {
        // Initialize FFmpeg if not already done
        updateProgress(5, 'Initializing FFmpeg...');
        await initFFmpeg();
        
        // Set progress callback
        ffmpeg.setProgress(({ ratio }) => {
            const percentage = Math.round(ratio * 100);
            updateProgress(percentage, `Processing: ${percentage}%`);
        });
        
        updateProgress(10, 'Loading video file...');
        
        // Get the file extension
        const inputExt = currentVideoFile.name.split('.').pop().toLowerCase();
        const inputFileName = `input.${inputExt}`;
        
        // Write input file to FFmpeg filesystem
        ffmpeg.FS('writeFile', inputFileName, await fetchFile(currentVideoFile));
        
        updateProgress(20, 'Preparing FFmpeg command...');
        
        // Build FFmpeg command
        const outputFileName = `output.${videoOperations.format}`;
        const args = buildFFmpegArgs(inputFileName, outputFileName);
        
        console.log('FFmpeg command:', '-i', inputFileName, ...args);
        updateProgress(30, 'Processing video...');
        
        // Execute FFmpeg command
        await ffmpeg.run('-i', inputFileName, ...args);
        
        updateProgress(90, 'Finalizing...');
        
        // Read output file
        const data = ffmpeg.FS('readFile', outputFileName);
        const blob = new Blob([data.buffer], { type: `video/${videoOperations.format}` });
        processedVideoURL = URL.createObjectURL(blob);
        
        // Clean up
        try {
            ffmpeg.FS('unlink', inputFileName);
            ffmpeg.FS('unlink', outputFileName);
        } catch (cleanupError) {
            console.warn('Cleanup error:', cleanupError);
        }
        
        updateProgress(100, 'Complete!');
        
        // Show output
        setTimeout(() => {
            hideProcessingModal();
            showOutput();
        }, 500);
        
    } catch (error) {
        console.error('Export error:', error);
        hideProcessingModal();
        
        // Provide more specific error messages
        let errorMessage = 'Error processing video: ';
        if (error.message.includes('SharedArrayBuffer')) {
            errorMessage += 'Your browser requires specific headers for video processing. Please ensure CORS headers are properly set.';
        } else if (error.message.includes('memory')) {
            errorMessage += 'Out of memory. Try processing a smaller video or reducing quality settings.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

function buildFFmpegArgs(inputFile, outputFile) {
    const args = [];
    
    // Trim
    if (videoOperations.trim) {
        args.push('-ss', videoOperations.trim.start.toString());
        args.push('-t', (videoOperations.trim.end - videoOperations.trim.start).toString());
    }
    
    // Video filters
    const filters = [];
    
    // Effects
    if (videoOperations.effect) {
        switch (videoOperations.effect) {
            case 'grayscale':
                filters.push('hue=s=0');
                break;
            case 'blur':
                filters.push('boxblur=5:1');
                break;
            case 'sharpen':
                filters.push('unsharp=5:5:1.0:5:5:0.0');
                break;
            case 'vintage':
                filters.push('curves=vintage');
                break;
        }
    }
    
    // Resize
    if (videoOperations.resize) {
        const [width, height] = videoOperations.resize.split('x');
        filters.push(`scale=${width}:${height}`);
    }
    
    if (filters.length > 0) {
        args.push('-vf', filters.join(','));
    }
    
    // Audio
    if (videoOperations.mute) {
        args.push('-an');
    } else if (videoOperations.volume !== 100) {
        args.push('-af', `volume=${videoOperations.volume / 100}`);
    }
    
    // Format specific settings
    if (videoOperations.format === 'gif') {
        // GIF specific settings
        args.push('-pix_fmt', 'rgb24');
        args.push('-r', '10');
    } else if (videoOperations.format === 'webm') {
        // WebM settings
        args.push('-c:v', 'libvpx');
        args.push('-crf', '10');
        args.push('-b:v', '1M');
        if (!videoOperations.mute) {
            args.push('-c:a', 'libvorbis');
        }
    } else {
        // Default settings for MP4, MOV, AVI
        args.push('-c:v', 'libx264');
        args.push('-preset', 'medium');
        args.push('-crf', '23');
        args.push('-pix_fmt', 'yuv420p');
        if (!videoOperations.mute) {
            args.push('-c:a', 'aac');
            args.push('-b:a', '128k');
        }
    }
    
    // Add format flag for certain formats
    if (videoOperations.format === 'mov') {
        args.push('-f', 'mov');
    } else if (videoOperations.format === 'avi') {
        args.push('-f', 'avi');
    }
    
    args.push(outputFile);
    
    return args;
}

function handleReset() {
    videoOperations = {
        trim: null,
        effect: null,
        resize: null,
        format: 'mp4',
        mute: false,
        volume: 100
    };
    
    // Reset UI
    startTimeInput.value = 0;
    if (videoPlayer.duration) {
        endTimeInput.value = Math.floor(videoPlayer.duration);
    }
    document.getElementById('resizeSelect').value = '';
    document.getElementById('formatSelect').value = 'mp4';
    document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
    volumeSlider.value = 100;
    volumeValue.textContent = '100%';
    document.getElementById('muteBtn').textContent = 'Remove Audio';
    
    showNotification('All settings reset');
}

function handleDownload() {
    if (processedVideoURL) {
        const a = document.createElement('a');
        a.href = processedVideoURL;
        a.download = `edited_video_${Date.now()}.${videoOperations.format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

function handleNewVideo() {
    // Reset everything
    handleReset();
    currentVideoFile = null;
    if (currentVideoURL) URL.revokeObjectURL(currentVideoURL);
    if (processedVideoURL) URL.revokeObjectURL(processedVideoURL);
    
    // Reset UI
    uploadArea.style.display = 'block';
    editorSection.style.display = 'none';
    outputSection.style.display = 'none';
    videoInput.value = '';
}

// Helper functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showProcessingModal() {
    processingModal.style.display = 'flex';
    progressBarFill.style.width = '0%';
    progressText.textContent = 'Initializing FFmpeg...';
}

function hideProcessingModal() {
    processingModal.style.display = 'none';
}

function updateProgress(percentage, text) {
    progressBarFill.style.width = `${percentage}%`;
    progressText.textContent = text;
}

function showOutput() {
    outputVideo.src = processedVideoURL;
    outputSection.style.display = 'block';
    editorSection.style.display = 'none';
}

function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background-color: ${type === 'error' ? '#e74c3c' : '#27ae60'};
        color: white;
        border-radius: 5px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { 
            transform: translateX(100%);
            opacity: 0;
        }
        to { 
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from { 
            transform: translateX(0);
            opacity: 1;
        }
        to { 
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Check browser compatibility and auto-load FFmpeg on page load
window.addEventListener('load', () => {
    // Check for required features
    if (!window.SharedArrayBuffer) {
        const status = document.getElementById('ffmpegStatus');
        status.textContent = 'Note: Your browser may have limited support. For best results, use Chrome or Firefox.';
        status.style.color = '#e67e22';
    }
    
    // Disable upload area initially
    uploadArea.style.opacity = '0.5';
    uploadArea.style.pointerEvents = 'none';
    
    // Auto-load FFmpeg
    autoLoadFFmpeg();
});
