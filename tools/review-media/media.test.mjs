import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { concatEdit } from './concat.mjs';
import { edit, probe, record, run, validateTimeline } from './media.mjs';

test('rejects malformed cuts and narration', () => {
  for (const value of [
    {}, { clips: [] }, { clips: [{ path: 'x', start: 2, end: 1 }] },
    { clips: [{ path: 'x', start: NaN, end: 1 }] },
    { clips: [{ path: 'x', start: 0, end: 1 }], narration: {} },
  ]) assert.throws(() => validateTimeline(value));
});

test('drives Concat JSON-RPC, keeps narration on a separate track, and waits for export', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'para-concat-test-'));
  const requests = [];
  const server = createTcpServer(socket => {
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', chunk => {
      buffer += chunk;
      while (true) {
        const newline = buffer.indexOf('\n');
        if (newline < 0) break;
        const request = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        requests.push(request);
        const params = {};
        switch (request.method) {
          case 'auth': break;
          case 'version': params.apiVersion = '0.2'; params.concat = '0.2.7'; break;
          case 'project.create': break;
          case 'media.probe':
            params.kind = request.params.path.endsWith('.wav') ? 'audio' : 'video';
            params.duration = params.kind === 'audio' ? 0.5 : 1;
            break;
          case 'media.import':
            params.createdId = request.params.file.endsWith('.wav') ? 'm-voice' : `m-${requests.length}`;
            break;
          case 'edit.apply': break;
          case 'project.save': break;
          case 'export.run':
            params.job = 'job-1';
            socket.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'export.done', params: { job: 'job-1', output: request.params.output } })}\n`);
            break;
          default: throw new Error(`Unexpected method ${request.method}`);
        }
        socket.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result: params })}\n`);
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=320x240:d=1', '-c:v', 'libx264', path.join(dir, 'red.mp4')]);
    await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=1', '-c:v', 'libx264', path.join(dir, 'blue.mp4')]);
    await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5', path.join(dir, 'voice.wav')]);
    const timeline = path.join(dir, 'concat-timeline.json');
    await writeFile(timeline, JSON.stringify({
      clips: ['red.mp4', 'blue.mp4'],
      narration: 'voice.wav',
    }));
    const rendered = await concatEdit(timeline, {
      location: path.join(dir, 'projects'), name: 'Review', output: path.join(dir, 'final.mp4'),
      port: server.address().port, token: 'temporary-test-token', home: dir,
    });
    assert.equal(rendered.version, '0.2.7');
    assert.equal(rendered.duration, 2);
    assert.deepEqual(requests.map(request => request.method), [
      'auth', 'version', 'media.probe', 'media.probe', 'media.probe', 'project.create',
      'media.import', 'edit.apply', 'media.import', 'edit.apply', 'media.import', 'edit.apply',
      'project.save', 'export.run',
    ]);
    assert.equal(requests[0].params.token, 'temporary-test-token');
    assert.deepEqual(requests.filter(request => request.method === 'edit.apply').map(request => request.params.command), [
      { op: 'addClip', mediaId: 'm-7', trackId: 'T1', start: 0 },
      { op: 'addClip', mediaId: 'm-9', trackId: 'T1', start: 1 },
      { op: 'addClip', mediaId: 'm-voice', trackId: 'T2', start: 0 },
    ]);
    await assert.rejects(concatEdit(timeline, {
      location: dir, name: '../unsafe', output: path.join(dir, 'bad.mp4'), port: server.address().port, token: 'test',
    }), /safe folder name/);
    await assert.rejects(concatEdit(timeline, {
      location: dir, name: 'Review', output: path.join(dir, 'bad.mp4'), port: server.address().port,
      host: '0.0.0.0', token: 'test', home: dir,
    }), /loopback/);
    await assert.rejects(concatEdit(timeline, {
      location: path.dirname(dir), name: 'Review', output: path.join(dir, 'bad.mp4'),
      port: server.address().port, token: 'test', home: dir,
    }), /must be under/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test('records a real browser flow, renders ordered cuts and preserves narration', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'para-media-test-'));
  const server = createServer((_, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end('<button onclick="this.textContent=\'Complete\'">Start</button>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const flow = path.join(dir, 'flow.mjs');
    await writeFile(flow, `export default async ({ page }) => {
      await page.getByRole('button', { name: 'Start' }).click();
      if (await page.getByRole('button').textContent() !== 'Complete') throw new Error('UI did not update');
      await page.waitForTimeout(1000);
    };`);
    const capture = await record(`http://127.0.0.1:${server.address().port}`, flow, path.join(dir, 'capture'));
    const metadata = JSON.parse(await readFile(path.join(capture.output, 'recording.json'), 'utf8'));
    assert.equal(metadata.status, 'captured');
    assert.equal(capture.videos.length, 1);
    assert.ok((await probe(capture.videos[0])).duration >= 1);
    await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=320x240:d=1', '-c:v', 'libx264', path.join(dir, 'red.mp4')]);
    await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=1', '-c:v', 'libx264', path.join(dir, 'blue.mp4')]);
    await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5', path.join(dir, 'voice.wav')]);
    const timeline = path.join(dir, 'timeline.json');
    const clips = [{ path: 'red.mp4', start: 0, end: 1 }, { path: 'blue.mp4', start: 0, end: 1 }];
    await writeFile(timeline, JSON.stringify({ clips, narration: 'voice.wav' }));
    const output = path.join(dir, 'review.mp4');
    const rendered = await edit(timeline, output);
    assert.ok(Math.abs(rendered.duration - 2) < 0.15);
    const info = await probe(output);
    assert.ok(info.streams.some(stream => stream.codec_type === 'audio'));
    assert.ok(info.streams.some(stream => stream.width === 1280 && stream.height === 720));
    for (const [time, dominant] of [['0.5', 0], ['1.5', 2]]) {
      const pixel = path.join(dir, `pixel-${time}.rgb`);
      await run('ffmpeg', ['-v', 'error', '-ss', time, '-i', output, '-frames:v', '1', '-vf', 'scale=1:1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', pixel]);
      const values = await readFile(pixel);
      assert.ok(values[dominant] > 150);
      assert.ok(values[dominant] > values[(dominant + 1) % 3] + 100);
    }
    await assert.rejects(edit(timeline, output), /EEXIST/);
    await writeFile(timeline, JSON.stringify({ clips: [{ path: 'red.mp4', start: 0, end: 2 }] }));
    await assert.rejects(edit(timeline, path.join(dir, 'invalid.mp4')), /exceeds source duration/);
    await writeFile(timeline, JSON.stringify({ clips: [{ path: 'red.mp4', start: 0, end: 0.2 }], narration: 'voice.wav' }));
    await assert.rejects(edit(timeline, path.join(dir, 'truncated.mp4')), /longer than the timeline/);
    const failingFlow = path.join(dir, 'failing-flow.mjs');
    await writeFile(failingFlow, `export default async () => { throw new Error('Scenario failed'); };`);
    await assert.rejects(record(`http://127.0.0.1:${server.address().port}`, failingFlow, path.join(dir, 'failure')), /Scenario failed/);
    const failed = JSON.parse(await readFile(path.join(dir, 'failure', 'recording.json'), 'utf8'));
    assert.equal(failed.status, 'failed');
    assert.equal(failed.videos.length, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
