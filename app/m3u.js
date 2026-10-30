// Parses an M3U / M3U8 IPTV playlist into a list of channels.
(function (root) {
  function attr(info, name) {
    var m = info.match(new RegExp(name + '="([^"]*)"', 'i'));
    return m ? m[1].trim() : '';
  }

  // The channel name follows the first comma that is outside quotes.
  function nameStart(info) {
    var quoted = false;
    for (var i = 0; i < info.length; i++) {
      var c = info.charAt(i);
      if (c === '"') quoted = !quoted;
      else if (c === ',' && !quoted) return i + 1;
    }
    return -1;
  }

  function parseM3U(text) {
    var lines = String(text).split(/\r?\n/);
    var channels = [];
    var pending = null;
    var groupLine = '';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      if (line.indexOf('#EXTINF') === 0) {
        var start = nameStart(line);
        pending = {
          name: start > 0 ? line.slice(start).trim() : '',
          logo: attr(line, 'tvg-logo'),
          group: attr(line, 'group-title')
        };
        groupLine = '';
      } else if (line.indexOf('#EXTGRP:') === 0) {
        groupLine = line.slice(8).trim();
      } else if (line.charAt(0) !== '#') {
        var ch = pending || { name: '', logo: '', group: '' };
        ch.url = line;
        if (!ch.group) ch.group = groupLine;
        if (!ch.name) ch.name = line;
        if (!ch.group) ch.group = 'Other';
        channels.push(ch);
        pending = null;
        groupLine = '';
      }
    }
    return channels;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { parseM3U: parseM3U };
  else root.parseM3U = parseM3U;
})(this);
