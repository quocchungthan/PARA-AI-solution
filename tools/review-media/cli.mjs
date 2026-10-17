import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { access } from 'node:fs/promises';
import { concatEdit } from './concat.mjs';
import { edit, record, run } from './media.mjs';

const usage = 'Commands: doctor | record --url URL --flow FILE --out NEW_DIR [--headed] | edit --timeline FILE --out NEW_MP4 | concat --timeline FILE --location DIR --name NAME --out NEW_MP4';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: 'string' }, flow: { type: 'string' }, out: { type: 'string' },
      timeline: { type: 'string' }, headed: { type: 'boolean', default: false },
      location: { type: 'string' }, name: { type: 'string' }, host: { type: 'string' },
      port: { type: 'string' },
    },
  });
  if (positionals.length !== 1) throw new Error(usage);
  let result;
  switch (positionals[0]) {
    case 'doctor': {
      const checks = [];
      for (const command of ['ffmpeg', 'ffprobe']) {
        try {
          checks.push({ tool: command, ok: true, version: (await run(command, ['-version'])).split('\n')[0] });
        } catch (error) {
          checks.push({ tool: command, ok: false, error: error.message });
        }
      }
      try {
        await access(chromium.executablePath());
        const browser = await chromium.launch({ headless: true });
        await browser.close();
        checks.push({ tool: 'chromium', ok: true });
      } catch (error) {
        checks.push({ tool: 'chromium', ok: false, error: error.message });
      }
      result = { checks };
      if (checks.some(check => !check.ok)) process.exitCode = 1;
      break;
    }
    case 'record':
      if (!values.url || !values.flow || !values.out) throw new Error(usage);
      result = await record(values.url, values.flow, values.out, values);
      break;
    case 'edit':
      if (!values.timeline || !values.out) throw new Error(usage);
      result = await edit(values.timeline, values.out);
      break;
    case 'concat':
      if (!values.timeline || !values.location || !values.name || !values.out) throw new Error(usage);
      result = await concatEdit(values.timeline, {
        location: values.location,
        name: values.name,
        output: values.out,
        host: values.host ?? '127.0.0.1',
        port: values.port === undefined ? Number(process.env.CONCAT_API_PORT ?? 7420) : Number(values.port),
        token: process.env.CONCAT_API_TOKEN,
      });
      break;
    default:
      throw new Error(usage);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
