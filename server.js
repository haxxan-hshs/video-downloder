import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

// Temp directory — no spaces to avoid path issues
const tempDir = path.join(os.tmpdir(), 'nexusdownloader');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const ytdlpBin = path.resolve('./yt-dlp.exe');

// ffmpeg path — winget installed location
const ffmpegPath = 'C:\\Users\\HASSAN\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';

// Check cookies in both locations: ./cookies/cookies.txt and ./cookies.txt
const cookiesFile = fs.existsSync(path.resolve('./cookies/cookies.txt'))
  ? path.resolve('./cookies/cookies.txt')
  : path.resolve('./cookies.txt');

console.log(`✅ Temp dir: ${tempDir}`);
console.log(`✅ yt-dlp binary: ${ytdlpBin}`);

// ─── Helper: build yt-dlp format string ───────────────────────────────────────
function buildFormatArg(quality, format) {
  const isAudio = format === 'mp3' || quality === 'Audio';
  if (isAudio) return 'bestaudio/best';

  switch (quality) {
    case '4K':    return 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best';
    case '1080p': return 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best';
    case '720p':  return 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best';
    case '480p':  return 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best';
    default:      return 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
  }
}

// ─── Helper: run yt-dlp and collect stdout ────────────────────────────────────
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    console.log(`[CMD] yt-dlp ${args.join(' ')}`);
    const proc = spawn(ytdlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
      process.stdout.write(d);
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
      process.stderr.write(d);
    });

    proc.on('error', (err) => reject(new Error(`Failed to start yt-dlp: ${err.message}`)));

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `yt-dlp exited with code ${code}`));
      }
    });
  });
}

// ─── Helper: get video info ───────────────────────────────────────────────────
async function getVideoInfo(url) {
  const args = [
    url,
    '--dump-json',
    '--no-warnings',
    '--no-check-certificate',
    '--socket-timeout', '30',
    '--ffmpeg-location', ffmpegPath,
  ];

  // Try cookies file first, then fallback to browser cookies
  if (fs.existsSync(cookiesFile)) {
    args.push('--cookies', cookiesFile);
    console.log('[INFO] Using cookies.txt');
  } else {
    // Try to use Chrome browser cookies directly
    args.push('--cookies-from-browser', 'chrome');
    console.log('[INFO] Using Chrome browser cookies');
  }

  const { stdout } = await runYtDlp(args);

  // stdout may have multiple JSON lines (playlist) — take first
  const firstLine = stdout.trim().split('\n')[0];
  return JSON.parse(firstLine);
}

// ─── Main download endpoint ───────────────────────────────────────────────────
app.get('/api/download', async (req, res) => {
  const { url, quality = '1080p', format = 'mp4' } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const isAudio = format === 'mp3' || quality === 'Audio';
  const outputExt = isAudio ? 'mp3' : (format === 'mkv' ? 'mkv' : 'mp4');
  const formatArg = buildFormatArg(quality, format);

  const sessionId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const outputTemplate = path.join(tempDir, `${sessionId}.%(ext)s`);

  // Helper to clean up temp files for this session
  const cleanup = () => {
    try {
      fs.readdirSync(tempDir)
        .filter(f => f.startsWith(sessionId))
        .forEach(f => {
          try { fs.unlinkSync(path.join(tempDir, f)); } catch (_) {}
        });
    } catch (_) {}
  };

  // Helper to send a user-friendly error
  const sendError = (statusCode, message) => {
    cleanup();
    if (!res.headersSent) {
      res.status(statusCode).json({ error: message });
    }
  };

  try {
    // ── Step 1: Get video metadata ──────────────────────────────────────────
    console.log(`[INFO] Getting info for: ${url}`);
    let info;
    try {
      info = await getVideoInfo(url);
    } catch (infoErr) {
      const msg = String(infoErr.message || infoErr);
      console.error('[ERROR] Info fetch failed:', msg);

      if (msg.includes('Sign in') || msg.includes('age') || msg.includes('login')) {
        return sendError(403, 'This video requires login/age verification. Add a cookies.txt file to the project folder.');
      }
      if (msg.includes('private') || msg.includes('unavailable') || msg.includes('removed')) {
        return sendError(403, 'This video is private or has been removed.');
      }
      if (msg.includes('Unsupported URL') || msg.includes('not a valid URL')) {
        return sendError(400, 'Invalid or unsupported URL. Please paste a direct video link.');
      }
      // For any other info error, still try to download (some sites skip --dump-json)
      info = { title: 'Video_Download' };
    }

    // Sanitize filename
    let title = (info.title || 'Video_Download').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() || 'Video_Download';
    const downloadFilename = `${title}.${outputExt}`;

    console.log(`[INFO] Downloading: "${downloadFilename}" | Format: ${formatArg}`);

    // ── Step 2: Build download args ─────────────────────────────────────────
    const dlArgs = [
      url,
      '--format', formatArg,
      '--output', outputTemplate,
      '--no-warnings',
      '--no-check-certificate',
      '--socket-timeout', '60',
      '--retries', '5',
      '--fragment-retries', '5',
      '--concurrent-fragments', '4',
      '--ffmpeg-location', ffmpegPath,
    ];

    // Merge output format
    if (!isAudio) {
      dlArgs.push('--merge-output-format', outputExt);
    }

    // Audio extraction
    if (isAudio) {
      dlArgs.push(
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0'
      );
    }

    // Cookies: file first, then Chrome browser cookies as fallback
    if (fs.existsSync(cookiesFile)) {
      dlArgs.push('--cookies', cookiesFile);
      console.log('[INFO] Download using cookies.txt');
    } else {
      dlArgs.push('--cookies-from-browser', 'chrome');
      console.log('[INFO] Download using Chrome browser cookies');
    }

    // ── Step 3: Run download ────────────────────────────────────────────────
    await runYtDlp(dlArgs);

    // ── Step 4: Find the downloaded file ───────────────────────────────────
    const files = fs.readdirSync(tempDir).filter(f => f.startsWith(sessionId));

    if (files.length === 0) {
      return sendError(500, 'Download completed but file was not found. Please try again.');
    }

    // Prefer the correct extension, fallback to first file found
    const targetFile =
      files.find(f => f.endsWith(`.${outputExt}`)) ||
      files.find(f => f.endsWith('.mp4')) ||
      files.find(f => f.endsWith('.mkv')) ||
      files.find(f => f.endsWith('.webm')) ||
      files[0];

    const actualFilePath = path.join(tempDir, targetFile);
    const fileSize = fs.statSync(actualFilePath).size;

    console.log(`[INFO] Sending file: ${actualFilePath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // ── Step 5: Stream file to client ───────────────────────────────────────
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');

    const fileStream = fs.createReadStream(actualFilePath);

    fileStream.on('error', (err) => {
      console.error('[ERROR] File stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file.' });
      }
    });

    fileStream.on('close', () => {
      console.log(`[INFO] File sent successfully: ${downloadFilename}`);
      cleanup();
    });

    // If client disconnects, kill stream and cleanup
    req.on('close', () => {
      fileStream.destroy();
      cleanup();
    });

    fileStream.pipe(res);

  } catch (error) {
    const msg = String(error.message || error);
    console.error('[ERROR] Download failed:', msg);

    let userMsg = 'Download failed. Please check the URL and try again.';

    if (msg.includes('Sign in') || msg.includes('age') || msg.includes('login')) {
      userMsg = 'This video requires login or age verification. Add a cookies.txt file to the project folder.';
    } else if (msg.includes('private') || msg.includes('unavailable') || msg.includes('removed')) {
      userMsg = 'This video is private or unavailable.';
    } else if (msg.includes('Unsupported URL') || msg.includes('not a valid URL')) {
      userMsg = 'Invalid or unsupported URL.';
    } else if (msg.includes('ffmpeg') || msg.includes('ffprobe')) {
      userMsg = 'ffmpeg is not installed. Please install ffmpeg and add it to PATH, then restart the server.';
    } else if (msg.includes('HTTP Error 429') || msg.includes('Too Many Requests')) {
      userMsg = 'Rate limited by the platform. Please wait a few minutes and try again.';
    } else if (msg.includes('HTTP Error 403')) {
      userMsg = 'Access denied by the platform. Try adding cookies.txt for authentication.';
    }

    sendError(500, userMsg);
  }
});

// ─── Info endpoint (for frontend to show video title before download) ─────────
app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const info = await getVideoInfo(url);
    res.json({
      title: info.title || 'Unknown',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      uploader: info.uploader || info.channel || '',
      platform: info.extractor_key || '',
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ytdlp: fs.existsSync(ytdlpBin),
    cookies: fs.existsSync(cookiesFile),
    tempDir,
  });
});

// ─── Cleanup old temp files every 10 minutes ─────────────────────────────────
setInterval(() => {
  try {
    const now = Date.now();
    fs.readdirSync(tempDir).forEach(file => {
      const fp = path.join(tempDir, file);
      try {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > 3600000) {
          fs.unlinkSync(fp);
          console.log(`[CLEANUP] Deleted: ${file}`);
        }
      } catch (_) {}
    });
  } catch (_) {}
}, 600000);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Backend running on http://localhost:${PORT}`);
  console.log(`📁 Temp dir: ${tempDir}`);
  console.log(`🔧 yt-dlp: ${ytdlpBin}`);
  console.log(`🍪 Cookies: ${fs.existsSync(cookiesFile) ? 'Found ✅' : 'Not found (public videos only)'}\n`);
});
