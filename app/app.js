// IPTV player for webOS: loads an M3U playlist and plays its channels
// with the TV's own video player. Controlled with the remote only.
(function () {
  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 461, BACKSPACE: 8, ESC: 27,
    CH_UP: 33, CH_DOWN: 34, RED: 403
  };
  var STORE_URL = 'iptv.url';
  var STORE_LAST = 'iptv.last';
  var ROW_HEIGHT = 84;

  // Playlists on the setup screen, so they need no typing.
  var PRESETS = [
    { name: 'All channels', note: 'iptv-org, every country (large list, slow to load)', url: 'https://iptv-org.github.io/iptv/index.m3u' },
    { name: 'Tamil', note: 'iptv-org, Tamil language channels', url: 'https://iptv-org.github.io/iptv/languages/tam.m3u' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var video = $('video');

  var channels = [];
  var groups = ['All'];
  var groupIndex = 0;
  var visible = [];      // channels in the current group
  var sel = 0;           // selected index in `visible`
  var playing = null;    // channel object now playing
  var mode = 'setup';    // 'setup' | 'list' | 'play'
  var setupSel = 0;      // selected preset; PRESETS.length means the URL field
  var hls = null;
  var bannerTimer = null;

  function load(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
  function save(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  function show(el, on) { el.classList.toggle('hidden', !on); }

  function setStatus(text) {
    $('status').textContent = text || '';
    show($('status'), !!text);
  }

  function showBanner(text) {
    $('banner').textContent = text;
    show($('banner'), true);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { show($('banner'), false); }, 3000);
  }

  function setMode(m) {
    mode = m;
    show($('setup'), m === 'setup');
    show($('list'), m === 'list');
    if (m === 'setup') {
      var saved = load(STORE_URL);
      var p = presetIndex(saved);
      $('urlInput').value = p < 0 ? saved : '';
      setSetupSel(p < 0 && saved ? PRESETS.length : Math.max(0, p));
    } else {
      $('urlInput').blur();
    }
    if (m === 'list') renderList();
  }

  // ---- setup screen ----

  function presetIndex(url) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].url === url) return i;
    return -1;
  }

  function renderPresets() {
    $('presets').innerHTML = PRESETS.map(function (p, i) {
      return '<div class="preset' + (i === setupSel ? ' sel' : '') + '" data-i="' + i + '">' +
        escapeHtml(p.name) + '<small>' + escapeHtml(p.note) + '</small></div>';
    }).join('');
  }

  function setSetupSel(i) {
    setupSel = Math.min(Math.max(0, i), PRESETS.length);
    renderPresets();
    var input = $('urlInput');
    if (setupSel === PRESETS.length) input.focus();
    else input.blur();
  }

  function submitSetup() {
    if (setupSel < PRESETS.length) {
      loadPlaylist(PRESETS[setupSel].url);
    } else {
      var url = $('urlInput').value.trim();
      if (url) loadPlaylist(url);
    }
  }

  // The Magic Remote pointer can click a playlist too.
  $('presets').addEventListener('click', function (e) {
    var el = e.target.closest('.preset');
    if (!el) return;
    setSetupSel(+el.getAttribute('data-i'));
    submitSetup();
  });

  function exitApp() {
    if (window.PalmSystem && window.PalmSystem.platformBack) window.PalmSystem.platformBack();
    else window.close();
  }

  // ---- playlist ----

  function loadPlaylist(url) {
    var msg = $('setupMsg');
    msg.className = 'msg';
    msg.textContent = 'Loading playlist...';

    fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var list = parseM3U(text);
        if (!list.length) throw new Error('No channels found in this playlist');
        save(STORE_URL, url);
        msg.textContent = '';
        setChannels(list);

        var last = load(STORE_LAST);
        var lastCh = channels.filter(function (c) { return c.url === last; })[0];
        if (lastCh) {
          selectChannel(lastCh);
          play(lastCh);
          setMode('play');
        } else {
          setMode('list');
        }
      })
      .catch(function (err) {
        msg.className = 'msg error';
        msg.textContent = 'Could not load the playlist: ' + err.message;
        if (mode !== 'setup') setMode('setup');
      });
  }

  function setChannels(list) {
    channels = list;
    var seen = {};
    groups = ['All'];
    list.forEach(function (c) {
      if (!seen[c.group]) { seen[c.group] = true; groups.push(c.group); }
    });
    // A single group adds nothing over "All".
    if (groups.length === 2) groups = ['All'];
    setGroup(0);
  }

  function setGroup(i) {
    groupIndex = (i + groups.length) % groups.length;
    var g = groups[groupIndex];
    visible = g === 'All' ? channels : channels.filter(function (c) { return c.group === g; });
    sel = 0;
    if (playing) {
      var p = visible.indexOf(playing);
      if (p >= 0) sel = p;
    }
  }

  function selectChannel(ch) {
    var i = visible.indexOf(ch);
    if (i < 0) { setGroup(0); i = visible.indexOf(ch); }
    sel = Math.max(0, i);
  }

  // ---- list rendering (only the rows on screen, so big playlists stay light) ----

  function renderList() {
    $('groupName').textContent = groups[groupIndex] + '  (' + visible.length + ')';
    var rows = $('rows');
    var count = Math.max(1, Math.floor(rows.clientHeight / ROW_HEIGHT));
    var top = Math.min(Math.max(0, sel - Math.floor(count / 2)), Math.max(0, visible.length - count));

    var html = '';
    for (var i = top; i < Math.min(visible.length, top + count); i++) {
      var c = visible[i];
      var cls = 'row' + (i === sel ? ' sel' : '') + (c === playing ? ' playing' : '');
      html += '<div class="' + cls + '"><span class="num">' + (i + 1) + '</span>' +
        (c.logo ? '<img src="' + escapeAttr(c.logo) + '" onerror="this.style.visibility=\'hidden\'">' : '<span class="logo-gap"></span>') +
        '<span class="name">' + escapeHtml(c.name) + '</span></div>';
    }
    rows.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  // ---- playback ----

  function stopHls() {
    if (hls) { hls.destroy(); hls = null; }
  }

  function play(ch) {
    playing = ch;
    save(STORE_LAST, ch.url);
    stopHls();
    setStatus('Loading ' + ch.name + '...');
    video.dataset.fallback = '';
    video.src = ch.url;
    video.play().catch(function () {});
    showBanner((visible.indexOf(ch) + 1) + '  ' + ch.name);
  }

  // The TV player handles HLS and MPEG-TS itself. If it fails on an HLS
  // stream, try once more with hls.js before an error shows.
  video.addEventListener('error', function () {
    if (!playing) return;
    var isHls = /\.m3u8(\?|$)/i.test(playing.url);
    if (isHls && !video.dataset.fallback && window.Hls && Hls.isSupported()) {
      video.dataset.fallback = '1';
      video.removeAttribute('src');
      hls = new Hls();
      hls.on(Hls.Events.ERROR, function (e, data) {
        if (data.fatal) { stopHls(); setStatus('Cannot play this channel'); }
      });
      hls.loadSource(playing.url);
      hls.attachMedia(video);
      video.play().catch(function () {});
      return;
    }
    setStatus('Cannot play this channel');
  });
  video.addEventListener('playing', function () { setStatus(''); });
  video.addEventListener('waiting', function () { if (playing) setStatus('Buffering...'); });

  function zap(step) {
    if (!visible.length) return;
    sel = (sel + step + visible.length) % visible.length;
    play(visible[sel]);
  }

  // ---- remote keys ----

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;

    if (mode === 'setup') {
      if (k === KEY.ENTER) {
        submitSetup();
        e.preventDefault();
      } else if (k === KEY.UP) {
        setSetupSel(setupSel - 1);
        e.preventDefault();
      } else if (k === KEY.DOWN) {
        setSetupSel(setupSel + 1);
        e.preventDefault();
      } else if (k === KEY.BACK || k === KEY.ESC) {
        if (channels.length) setMode(playing ? 'play' : 'list');
        else exitApp();
        e.preventDefault();
      }
      return;
    }

    if (k === KEY.RED) { setMode('setup'); e.preventDefault(); return; }

    if (mode === 'list') {
      if (k === KEY.UP) sel = (sel - 1 + visible.length) % visible.length;
      else if (k === KEY.DOWN) sel = (sel + 1) % visible.length;
      else if (k === KEY.CH_UP) sel = Math.max(0, sel - 10);
      else if (k === KEY.CH_DOWN) sel = Math.min(visible.length - 1, sel + 10);
      else if (k === KEY.LEFT) setGroup(groupIndex - 1);
      else if (k === KEY.RIGHT) setGroup(groupIndex + 1);
      else if (k === KEY.ENTER) {
        if (visible[sel]) { play(visible[sel]); setMode('play'); }
        e.preventDefault();
        return;
      } else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
        if (playing) setMode('play');
        else exitApp();
        e.preventDefault();
        return;
      } else return;
      e.preventDefault();
      renderList();
      return;
    }

    // mode === 'play'
    if (k === KEY.UP || k === KEY.CH_UP) zap(-1);
    else if (k === KEY.DOWN || k === KEY.CH_DOWN) zap(1);
    else if (k === KEY.ENTER || k === KEY.LEFT || k === KEY.RIGHT ||
             k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) setMode('list');
    else return;
    e.preventDefault();
  });

  // Stop the stream when the app goes to the background, so it does not use RAM or data.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopHls();
      video.removeAttribute('src');
      video.load();
    } else if (playing) {
      play(playing);
    }
  });

  // ---- start ----

  function launchParams() {
    try {
      var p = window.PalmSystem && window.PalmSystem.launchParams;
      return p ? JSON.parse(p) : {};
    } catch (e) { return {}; }
  }

  var startUrl = launchParams().playlist || load(STORE_URL);
  setMode('setup');
  if (startUrl) loadPlaylist(startUrl);
})();
