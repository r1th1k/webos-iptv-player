// Runs JS expressions inside the app on the TV through ares-inspect (Chrome DevTools protocol).
// Usage: TV_DEVICE=mytv node tools/tv-eval.js "<expr>" ["<expr>" ...]
const { spawn } = require('node:child_process');

const exprs = process.argv.slice(2);
const insp = spawn('ares-inspect', ['-d', process.env.TV_DEVICE || 'mytv', '-a', 'com.rithik.iptv', '--open', 'false']);
let buf = '';
const timer = setTimeout(() => { console.error('timeout'); insp.kill(); process.exit(1); }, 40000);

insp.stdout.on('data', async (d) => {
  buf += d;
  const m = buf.match(/ws=([^\s]+)/);
  if (!m) return;
  insp.stdout.removeAllListeners('data');
  const ws = new WebSocket('ws://' + m[1]);
  let id = 0;
  const pending = {};
  ws.onmessage = (ev) => { const r = JSON.parse(ev.data); if (pending[r.id]) pending[r.id](r); };
  const send = (method, params) => new Promise((res) => { pending[++id] = res; ws.send(JSON.stringify({ id, method, params })); });
  ws.onopen = async () => {
    for (const e of exprs) {
      const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
      console.log('> ' + e + '\n' + JSON.stringify(r.result && (r.result.result.value ?? r.result.result.description) , null, 0));
    }
    clearTimeout(timer); ws.close(); insp.kill(); process.exit(0);
  };
});
