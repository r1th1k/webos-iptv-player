const test = require('node:test');
const assert = require('node:assert');
const { parseM3U } = require('../app/m3u.js');

test('reads name, logo, group and url', () => {
  const list = parseM3U([
    '#EXTM3U',
    '#EXTINF:-1 tvg-id="a" tvg-logo="http://x/a.png" group-title="News",Channel A',
    'http://s/a.m3u8',
  ].join('\n'));
  assert.deepStrictEqual(list, [{ name: 'Channel A', logo: 'http://x/a.png', group: 'News', url: 'http://s/a.m3u8' }]);
});

test('keeps commas inside quoted attributes and in the name', () => {
  const list = parseM3U('#EXTINF:-1 group-title="Movies, HD",Film, The Channel\r\nhttp://s/f.ts\r\n');
  assert.strictEqual(list[0].group, 'Movies, HD');
  assert.strictEqual(list[0].name, 'Film, The Channel');
});

test('uses #EXTGRP when there is no group-title, and skips other tags', () => {
  const list = parseM3U('#EXTM3U\n#EXTINF:-1,B\n#EXTGRP:Sports\n#EXTVLCOPT:http-user-agent=x\nhttp://s/b\n');
  assert.strictEqual(list[0].group, 'Sports');
  assert.strictEqual(list[0].url, 'http://s/b');
});

test('a bare url gets the url as name and the Other group', () => {
  const list = parseM3U('http://s/c.m3u8\n');
  assert.deepStrictEqual(list, [{ name: 'http://s/c.m3u8', logo: '', group: 'Other', url: 'http://s/c.m3u8' }]);
});

test('an empty or invalid playlist gives no channels', () => {
  assert.deepStrictEqual(parseM3U(''), []);
  assert.deepStrictEqual(parseM3U('<html>not found</html>'.replace(/.*/, '#comment')), []);
});
