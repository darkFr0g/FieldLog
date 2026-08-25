/* Cipher — NATO phonetic & binary translator.
   Everything runs client-side. Paste text / NATO / binary and it auto-detects;
   or read a screenshot via OCR (Tesseract.js, lazy-loaded from CDN and cached
   by the service worker for offline reuse).
*/
(function () {
  'use strict';

  /* ---------------- NATO tables ---------------- */

  var NATO = {
    a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
    g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima',
    m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
    s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey',
    x: 'X-ray', y: 'Yankee', z: 'Zulu',
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
  };

  var NATO_DECODE = {};
  Object.keys(NATO).forEach(function (k) {
    NATO_DECODE[NATO[k].toLowerCase()] = k;
  });
  // Accepted spelling variants (ICAO/ITU radio pronunciations included).
  var VARIANTS = {
    alfa: 'a', juliet: 'j', xray: 'x', 'x-ray': 'x',
    tree: '3', fower: '4', fife: '5', niner: '9'
  };
  Object.keys(VARIANTS).forEach(function (k) { NATO_DECODE[k] = VARIANTS[k]; });

  /* ---------------- Converters ---------------- */

  function toNato(text) {
    var out = [];
    text.split(/\s+/).forEach(function (word, i) {
      if (!word) return;
      if (out.length) out.push('/'); // word separator, spoken "slash"
      word.split('').forEach(function (ch) {
        var lc = ch.toLowerCase();
        out.push(NATO[lc] ? NATO[lc] : ch);
      });
    });
    return out.join(' ');
  }

  function fromNato(text) {
    var out = '';
    text.split(/\s+/).forEach(function (tok) {
      if (!tok) return;
      if (tok === '/' || tok === '//' || tok === '|') { out += ' '; return; }
      var clean = tok.toLowerCase().replace(/[.,;:!?"'()]+$/, '').replace(/^[.,;:!?"'()]+/, '');
      var k = NATO_DECODE[clean];
      if (k) out += (/[a-z]/.test(k) ? k.toUpperCase() : k);
      else out += tok; // unknown token: pass through untouched
    });
    return out;
  }

  function utf8Bytes(text) {
    if (window.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(text));
    // very old fallback
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else bytes.push(63); // '?'
    }
    return bytes;
  }

  function toBinary(text) {
    return utf8Bytes(text).map(function (b) {
      var s = b.toString(2);
      while (s.length < 8) s = '0' + s;
      return s;
    }).join(' ');
  }

  function fromBinary(text) {
    var bits = text.replace(/[^01]/g, '');
    var n = Math.floor(bits.length / 8);
    var arr = new Uint8Array(n);
    for (var i = 0; i < n; i++) arr[i] = parseInt(bits.substr(i * 8, 8), 2);
    try {
      return new TextDecoder('utf-8').decode(arr);
    } catch (e) {
      var s = '';
      for (var j = 0; j < n; j++) s += String.fromCharCode(arr[j]);
      return s;
    }
  }

  /* ---------------- Detection ---------------- */

  function detect(s) {
    var compact = s.replace(/[\s.,;:\-\/|]+/g, '');
    if (compact.length >= 8 && /^[01]+$/.test(compact)) return 'binary';

    var tokens = s.toLowerCase().split(/[^a-z0-9\-]+/).filter(function (t) { return t; });
    if (tokens.length >= 2) {
      var hits = 0;
      tokens.forEach(function (t) { if (NATO_DECODE[t]) hits++; });
      if (hits >= 2 && hits / tokens.length >= 0.6) return 'nato';
    }
    return 'text';
  }

  /* ---------------- UI ---------------- */

  var inp = document.getElementById('inp');
  var out = document.getElementById('out');
  var detected = document.getElementById('detected');
  var mode = 'auto';
  var copyPayloads = []; // card index -> text to copy

  var MODE_NAMES = { text: 'Plain text', nato: 'NATO', binary: 'Binary' };

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function card(idx, title, body, mono, meta) {
    return '<div class="card">' +
      '<div class="card-hd"><span><b>' + title + '</b>' +
      (meta ? '<span class="meta">' + meta + '</span>' : '') +
      '</span><button class="copy" data-copy="' + idx + '" type="button">Copy</button></div>' +
      '<div class="card-bd' + (mono ? ' mono' : '') + '">' + esc(body) + '</div>' +
      '</div>';
  }

  function render() {
    var raw = inp.value;
    copyPayloads = [];

    if (!raw.trim()) {
      detected.textContent = '';
      out.innerHTML = '<div class="empty">' +
        '<div class="empty-icon">01</div>' +
        '<p>Nothing to translate yet.</p>' +
        '<p class="empty-hint">Try pasting <em>Bravo Romeo Oscar November X-ray</em><br>or <em>01101000 01101001</em></p>' +
        '</div>';
      return;
    }

    var m = (mode === 'auto') ? detect(raw) : mode;
    detected.textContent = (mode === 'auto') ? ('Detected: ' + MODE_NAMES[m]) : '';

    // Normalize to plain text first, then show the other representations.
    var plain;
    if (m === 'binary') plain = fromBinary(raw);
    else if (m === 'nato') plain = fromNato(raw);
    else plain = raw;

    var html = '';
    if (m !== 'text') {
      copyPayloads.push(plain);
      html += card(copyPayloads.length - 1, 'Text', plain, false,
        plain.length + ' chars');
    }
    if (m !== 'nato') {
      var nato = toNato(plain);
      copyPayloads.push(nato);
      html += card(copyPayloads.length - 1, 'NATO', nato, false, null);
    }
    if (m !== 'binary') {
      var bin = toBinary(plain);
      copyPayloads.push(bin);
      html += card(copyPayloads.length - 1, 'Binary', bin, true,
        utf8Bytes(plain).length + ' bytes');
    }
    out.innerHTML = html;
  }

  inp.addEventListener('input', render);

  /* Mode chips */
  var chips = document.querySelectorAll('.chip');
  Array.prototype.forEach.call(chips, function (chip) {
    chip.addEventListener('click', function () {
      mode = chip.getAttribute('data-mode');
      Array.prototype.forEach.call(chips, function (c) { c.classList.remove('chip-on'); });
      chip.classList.add('chip-on');
      render();
    });
  });

  /* Copy (event delegation) */
  out.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.copy') : null;
    if (!btn) return;
    var text = copyPayloads[parseInt(btn.getAttribute('data-copy'), 10)] || '';
    copyText(text, btn);
  });

  function copyText(text, btn) {
    function done() {
      toast('Copied');
      if (btn) { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1200); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
    } else {
      legacyCopy(text); done();
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* Paste button */
  document.getElementById('btn-paste').addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (t) {
        if (t) { inp.value = t; render(); }
        else toast('Clipboard is empty');
      }, function () {
        toast('Tap the box and paste manually');
        inp.focus();
      });
    } else {
      toast('Tap the box and paste manually');
      inp.focus();
    }
  });

  /* Clear */
  document.getElementById('btn-clear').addEventListener('click', function () {
    inp.value = '';
    render();
    inp.focus();
  });

  /* Toast */
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
  }

  /* ---------------- Screenshot OCR ---------------- */

  var ocrStatus = document.getElementById('ocr-status');
  var fileInput = document.getElementById('file-ocr');
  var TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  document.getElementById('btn-ocr').addEventListener('click', function () {
    fileInput.click();
  });
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) runOCR(fileInput.files[0]);
    fileInput.value = '';
  });

  // Paste an image anywhere on the page (e.g. screenshot copied on iPhone).
  document.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        e.preventDefault();
        runOCR(items[i].getAsFile());
        return;
      }
    }
  });

  // Drag & drop (desktop).
  var veil = document.getElementById('drop-veil');
  var dragDepth = 0;
  document.addEventListener('dragenter', function (e) {
    e.preventDefault();
    dragDepth++;
    veil.hidden = false;
  });
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('dragleave', function (e) {
    e.preventDefault();
    dragDepth--;
    if (dragDepth <= 0) { dragDepth = 0; veil.hidden = true; }
  });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    dragDepth = 0;
    veil.hidden = true;
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.indexOf('image/') === 0) runOCR(f);
  });

  function loadTesseract(cb, fail) {
    if (window.Tesseract) { cb(); return; }
    var s = document.createElement('script');
    s.src = TESSERACT_SRC;
    s.onload = cb;
    s.onerror = fail;
    document.head.appendChild(s);
  }

  var ocrBusy = false;
  function runOCR(file) {
    if (!file || ocrBusy) return;
    ocrBusy = true;
    ocrStatus.hidden = false;
    ocrStatus.innerHTML = 'Loading text reader…<div class="bar"><i></i></div>';
    var barFill = ocrStatus.querySelector('.bar > i');

    loadTesseract(function () {
      ocrStatus.firstChild.nodeValue = 'Reading screenshot…';
      window.Tesseract.recognize(file, 'eng', {
        logger: function (m) {
          if (m.status === 'recognizing text' && barFill) {
            barFill.style.width = Math.round(m.progress * 100) + '%';
          }
        }
      }).then(function (result) {
        ocrBusy = false;
        ocrStatus.hidden = true;
        var text = (result && result.data && result.data.text || '').trim();
        if (!text) { toast('No text found in that image'); return; }
        inp.value = text;
        render();
        toast('Screenshot read');
      }, function () {
        ocrBusy = false;
        ocrStatus.hidden = true;
        toast('Could not read that image');
      });
    }, function () {
      ocrBusy = false;
      ocrStatus.hidden = true;
      toast('Text reader needs internet the first time');
    });
  }

  /* ---------------- Service worker ---------------- */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }

  render();
})();
