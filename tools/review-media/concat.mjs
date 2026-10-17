import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { access, realpath, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

class ConcatSocket {
  constructor(socket) {
    this.socket = socket;
    this.buffer = '';
    this.nextId = 1;
    this.pending = new Map();
    this.completed = new Map();
    this.exportWaiters = new Map();
    socket.setEncoding('utf8');
    socket.on('data', chunk => this.receive(chunk));
    socket.on('error', error => this.fail(error));
    socket.on('close', () => this.fail(new Error('Concat closed the JSON-RPC connection.')));
  }

  receive(chunk) {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        this.fail(new Error(`Invalid JSON-RPC from Concat: ${error.message}`));
        this.socket.destroy();
        return;
      }
      if (message.id !== undefined && this.pending.has(message.id)) {
        const { resolve, reject, timer } = this.pending.get(message.id);
        clearTimeout(timer);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`Concat ${message.error.data?.code ?? message.error.code}: ${message.error.message}`));
        else resolve(message.result);
      } else if (message.id === undefined && ['export.done', 'export.failed'].includes(message.method)) {
        const job = message.params?.job;
        if (this.exportWaiters.has(job)) {
          this.exportWaiters.get(job)(message);
          this.exportWaiters.delete(job);
        } else if (job) {
          this.completed.set(job, message);
          if (this.completed.size > 32) this.completed.delete(this.completed.keys().next().value);
        }
      }
    }
  }

  fail(error) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
    for (const resolve of this.exportWaiters.values()) resolve({ method: 'export.failed', params: { error: { message: error.message } } });
    this.exportWaiters.clear();
  }

  call(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Concat JSON-RPC ${method} timed out.`));
        this.socket.destroy();
      }, 120_000);
      this.pending.set(id, { resolve, reject, timer });
      const request = { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) };
      this.socket.write(`${JSON.stringify(request)}\n`);
    });
  }

  waitForExport(job) {
    if (this.completed.has(job)) {
      const event = this.completed.get(job);
      this.completed.delete(job);
      return Promise.resolve(event);
    }
    return new Promise(resolve => this.exportWaiters.set(job, resolve));
  }
}

async function localFile(file, base) {
  if (typeof file !== 'string' || !file.trim()) throw new Error('Expected a local media path.');
  const resolved = await realpath(path.resolve(base, file));
  if (!(await stat(resolved)).isFile()) throw new Error(`Not a file: ${resolved}`);
  return resolved;
}

function underRoot(file, root) {
  const relative = path.relative(root, file);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function localPath(file, base, root, label) {
  if (typeof file !== 'string' || !file.trim() || !path.isAbsolute(file)) {
    throw new Error(`${label} must be an absolute path.`);
  }
  const resolved = path.resolve(base, file);
  if (!underRoot(resolved, root)) throw new Error(`${label} must be under ${root}.`);
  return resolved;
}

export async function concatEdit(timelineFile, {
  location, name, output, host = '127.0.0.1', port = 7420, token, home = homedir(),
}) {
  if (!location || !name || !output) throw new Error('Concat requires project location, name, and export output.');
  if (!/^[A-Za-z0-9][A-Za-z0-9 _.()-]*$/.test(name) || name.endsWith('.')) {
    throw new Error('Concat project name must be a safe folder name using letters, numbers, spaces, dots, underscores, parentheses or hyphens.');
  }
  if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
    throw new Error('Concat API may only be used over loopback.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Concat port must be an integer from 1 to 65535.');
  if (!token) throw new Error('Set CONCAT_API_TOKEN to the Concat Remote token; credentials are never read from project files.');
  const root = path.resolve(home);
  const projectLocation = localPath(location, process.cwd(), root, 'Project location');
  const outputPath = localPath(output, process.cwd(), root, 'Export path');
  if (path.extname(outputPath).toLowerCase() !== '.mp4') throw new Error('Concat export path must end in .mp4.');
  try {
    await access(outputPath);
    throw new Error(`Concat export already exists: ${outputPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const timelinePath = path.resolve(timelineFile);
  const timeline = JSON.parse(await readFile(timelinePath, 'utf8'));
  if (!Array.isArray(timeline.clips) || timeline.clips.length === 0) {
    throw new Error('Timeline requires at least one video clip.');
  }
  if (timeline.clips.some(clip => typeof clip !== 'string') || timeline.clips.some(clip => !clip.trim())) {
    throw new Error('Concat timeline clips must be local video file paths; use edit for trimmed clips.');
  }
  const socket = createConnection({ host, port });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const api = new ConcatSocket(socket);
  try {
    const auth = await api.call('auth', { token });
    if (auth === undefined) throw new Error('Concat authentication returned no result.');
    const version = await api.call('version');
    if (version?.apiVersion !== '0.2') {
      throw new Error(`Unsupported Concat API version ${version?.apiVersion ?? 'unknown'}; expected 0.2.`);
    }
    const base = path.dirname(timelinePath);
    const projectPath = path.join(projectLocation, name);
    const clips = [];
    let cursor = 0;
    for (const clip of timeline.clips) {
      const file = await localFile(clip, base);
      if (!underRoot(file, root)) throw new Error(`Video clip must be under ${root}: ${file}`);
      const media = await api.call('media.probe', { path: file });
      if (media.kind !== 'video' || !Number.isFinite(media.duration) || media.duration <= 0) {
        throw new Error(`Concat media.probe did not return a valid video: ${file}`);
      }
      clips.push({ file, duration: media.duration });
      cursor += media.duration;
    }
    let voice;
    if (timeline.narration) {
      const file = await localFile(timeline.narration, base);
      if (!underRoot(file, root)) throw new Error(`Narration must be under ${root}: ${file}`);
      const media = await api.call('media.probe', { path: file });
      if (media.kind !== 'audio' || !Number.isFinite(media.duration) || media.duration <= 0) {
        throw new Error(`Concat media.probe did not return valid narration audio: ${file}`);
      }
      if (media.duration > cursor + 0.05) {
        throw new Error('Narration is longer than the video timeline; refusing to truncate speech.');
      }
      voice = file;
    }
    await api.call('project.create', { location: projectLocation, name });
    let position = 0;
    for (const clip of clips) {
      const imported = await api.call('media.import', { path: projectPath, file: clip.file });
      if (!imported.createdId) throw new Error(`Concat did not return a media id for ${clip.file}.`);
      await api.call('edit.apply', {
        path: projectPath,
        command: { op: 'addClip', mediaId: imported.createdId, trackId: 'T1', start: position },
      });
      position += clip.duration;
    }
    if (voice) {
      const imported = await api.call('media.import', { path: projectPath, file: voice });
      if (!imported.createdId) throw new Error('Concat did not return a media id for narration.');
      await api.call('edit.apply', {
        path: projectPath,
        command: { op: 'addClip', mediaId: imported.createdId, trackId: 'T2', start: 0 },
      });
    }
    await api.call('project.save', { path: projectPath });
    const started = await api.call('export.run', { path: projectPath, output: outputPath });
    if (!started?.job) throw new Error('Concat export.run returned no job id.');
    const event = await api.waitForExport(started.job);
    if (event.method !== 'export.done') {
      throw new Error(`Concat export failed: ${event.params?.error?.message ?? 'unknown error'}`);
    }
    return { project: projectPath, output: event.params.output, duration: cursor, version: version.concat };
  } finally {
    socket.end();
  }
}
