import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited ${code}:\n${stderr}`));
    });
  });
}

async function localFile(file, base) {
  if (typeof file !== 'string' || !file.trim()) throw new Error('Expected a local file path.');
  const resolved = await realpath(path.resolve(base, file));
  if (!(await stat(resolved)).isFile()) throw new Error(`Not a file: ${resolved}`);
  return resolved;
}

export async function probe(file) {
  const info = JSON.parse(await run('ffprobe', [
    '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_format', '-show_streams',
    '-of', 'json', file,
  ]));
  const duration = Number(info.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid media duration: ${file}`);
  return { duration, streams: info.streams };
}

export function validateTimeline(value) {
  if (!value || !Array.isArray(value.clips) || value.clips.length === 0) {
    throw new Error('Timeline requires a non-empty clips array.');
  }
  for (const clip of value.clips) {
    if (!clip || typeof clip.path !== 'string' || !clip.path.trim()
        || !Number.isFinite(clip.start) || !Number.isFinite(clip.end)
        || clip.start < 0 || clip.end <= clip.start) {
      throw new Error('Each clip requires path and finite seconds with 0 <= start < end.');
    }
  }
  if (value.narration !== undefined
      && (typeof value.narration !== 'string' || !value.narration.trim())) {
    throw new Error('narration must be a local audio file path.');
  }
  return value;
}

export async function edit(timelineFile, output) {
  const timelinePath = path.resolve(timelineFile);
  const timeline = validateTimeline(JSON.parse(await readFile(timelinePath, 'utf8')));
  const base = path.dirname(timelinePath);
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n'];
  const filters = [];
  let duration = 0;
  for (const [index, clip] of timeline.clips.entries()) {
    const file = await localFile(clip.path, base);
    const info = await probe(file);
    if (!info.streams.some(stream => stream.codec_type === 'video')) {
      throw new Error(`Clip has no video: ${file}`);
    }
    if (clip.end > info.duration + 0.05) throw new Error(`Clip end exceeds source duration: ${file}`);
    args.push('-protocol_whitelist', 'file,pipe', '-i', file);
    filters.push(`[${index}:v]trim=start=${clip.start}:end=${clip.end},setpts=PTS-STARTPTS,`
      + 'scale=1280:720:force_original_aspect_ratio=decrease,'
      + `pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${index}]`);
    duration += clip.end - clip.start;
  }
  filters.push(timeline.clips.map((_, index) => `[v${index}]`).join('')
    + `concat=n=${timeline.clips.length}:v=1:a=0[video]`);
  if (timeline.narration !== undefined) {
    const audio = await localFile(timeline.narration, base);
    const info = await probe(audio);
    if (!info.streams.some(stream => stream.codec_type === 'audio')) {
      throw new Error(`Narration has no audio: ${audio}`);
    }
    if (info.duration > duration + 0.05) {
      throw new Error('Narration is longer than the timeline; extend the clips instead of truncating speech.');
    }
    args.push('-protocol_whitelist', 'file,pipe', '-i', audio);
    filters.push(`[${timeline.clips.length}:a]asetpts=PTS-STARTPTS,apad,atrim=duration=${duration}[audio]`);
  }
  args.push('-filter_complex', filters.join(';'), '-map', '[video]');
  if (timeline.narration !== undefined) args.push('-map', '[audio]', '-c:a', 'aac');
  else args.push('-an');
  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-movflags', '+faststart');
  const destination = path.resolve(output);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = await mkdtemp(path.join(tmpdir(), 'para-media-'));
  try {
    const rendered = path.join(temporary, 'review.mp4');
    await run('ffmpeg', [...args, rendered]);
    const info = await probe(rendered);
    if (Math.abs(info.duration - duration) > 0.15) {
      throw new Error(`Render duration mismatch: expected ${duration}, got ${info.duration}.`);
    }
    await copyFile(rendered, destination, constants.COPYFILE_EXCL);
    return { output: destination, duration: info.duration, narration: timeline.narration !== undefined };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function record(url, flowFile, output, { headed = false } = {}) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('Use an HTTP(S) URL without embedded credentials.');
  }
  const flowPath = await localFile(flowFile, process.cwd());
  const { default: flow } = await import(pathToFileURL(flowPath).href);
  if (typeof flow !== 'function') throw new Error('Flow module must export a default async function.');
  const dir = path.resolve(output);
  await mkdir(path.dirname(dir), { recursive: true });
  await mkdir(dir); // Refuse reuse: do not mix evidence from separate runs.
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !headed });
  const videos = [];
  let context;
  let failure;
  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir, size: { width: 1280, height: 720 } },
    });
    context.on('page', page => { videos.push(page.video()); });
    const page = await context.newPage();
    await page.goto(target.href);
    await flow({ page, context, outputDir: dir });
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (context) await context.close();
    } finally {
      await browser.close();
    }
  }
  const files = await Promise.all(videos.map(video => video.path()));
  if (!files.length && !failure) throw new Error('No page recording was produced.');
  await writeFile(path.join(dir, 'recording.json'), JSON.stringify({
    status: failure ? 'failed' : 'captured',
    videos: files,
    viewport: { width: 1280, height: 720 },
    error: failure ? failure.message : null,
  }, null, 2) + '\n');
  if (failure) throw failure;
  return { output: dir, videos: files };
}
