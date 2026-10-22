(() => {
  'use strict';

  const SIZE_MIN = 25;
  const SIZE_MAX = 500;
  const SIZE_STEP = 5;
  const AUTO_CLEAR_OPTIONS = [0, 30, 60, 120, 300];
  const BACKGROUNDS = { dark: 'bgDark', black: 'bgBlack', green: 'bgGreen', transparent: 'bgTransparent' };
  const MAX_VISIBLE_ENTRIES = 100;
  const RESTART_DELAY_MIN = 250;
  const RESTART_DELAY_MAX = 8000;
  const TRANSLATE_TIMEOUT = 15000;
  const AVAILABILITY_TIMEOUT = 3000;
  const TRANSLATOR_READY_TIMEOUT = 5000;
  const NOTICE_DURATION = 6000;
  const STORAGE_KEY = 'speech-subtitles/settings';

  const DEFAULTS = {
    source: 'ja',
    target: 'none',
    showOriginal: false,
    size: 500,
    autoClear: 60,
    autoSave: true,
    background: 'dark',
    engine: 'builtin', // 優先する翻訳: 'builtin' | 'gas'
    gasUrl: '',
  };

  // URL パラメータ名 → 設定キー（OBS のブラウザソースなどで固定設定にするため）
  // gasUrl は認識したテキストの送信先になるため、リンク経由で書き換えられないよう含めない
  const URL_PARAMS = {
    source: 'source',
    target: 'target',
    original: 'showOriginal',
    size: 'size',
    clear: 'autoClear',
    save: 'autoSave',
    bg: 'background',
  };

  const $ = (id) => document.getElementById(id);
  const ui = {
    toggle: $('toggle'),
    clear: $('clear'),
    download: $('download'),
    statusText: $('statusText'),
    source: $('source'),
    target: $('target'),
    translateStatus: $('translateStatus'),
    openSettings: $('openSettings'),
    showOriginal: $('showOriginal'),
    size: $('size'),
    sizeValue: $('sizeValue'),
    autoClear: $('autoClear'),
    autoSave: $('autoSave'),
    background: $('background'),
    screen: $('screen'),
    lines: $('lines'),
    interim: $('interim'),
    notice: $('notice'),
    dialog: $('settingsDialog'),
    dialogForm: $('settingsForm'),
    builtinStatus: $('builtinStatus'),
    gasUrl: $('gasUrl'),
    gasTest: $('gasTest'),
    gasResult: $('gasResult'),
    cancelSettings: $('cancelSettings'),
  };

  const params = new URLSearchParams(location.search);
  const uiLang = resolveUiLang();
  const t = (key) => MESSAGES[uiLang][key] ?? key;
  const settings = loadSettings();

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let startedAt = 0;
  let restartDelay = RESTART_DELAY_MIN;
  let restartTimer = 0;
  let silenceTimer = 0;
  let noticeTimer = 0;
  let wakeLock = null;

  /** 言語ペア → ブラウザ内蔵翻訳の利用可否 / Translator インスタンス（いずれも Promise） */
  const availabilityCache = new Map();
  const translatorCache = new Map();
  let downloadProgress = null;
  let lastUnavailableNotice = '';

  /** 前回の保存/リセット以降に確定した発話（ダウンロード対象） */
  let transcript = [];
  let unsaved = false;

  // ---------------------------------------------------------------------------
  // 設定
  // ---------------------------------------------------------------------------

  function resolveUiLang() {
    const requested = params.get('ui');
    if (requested in MESSAGES) return requested;
    return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  function findLanguage(code) {
    return LANGUAGES.find((lang) => lang.code === code);
  }

  function toBoolean(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
    return fallback;
  }

  function sanitize(s) {
    const size = Math.round(Number(s.size) / SIZE_STEP) * SIZE_STEP;
    const autoClear = Number(s.autoClear);
    return {
      source: findLanguage(s.source) ? s.source : DEFAULTS.source,
      target: s.target === 'none' || findLanguage(s.target) ? s.target : DEFAULTS.target,
      showOriginal: toBoolean(s.showOriginal, DEFAULTS.showOriginal),
      size: Number.isFinite(size) ? Math.min(SIZE_MAX, Math.max(SIZE_MIN, size)) : DEFAULTS.size,
      autoClear: AUTO_CLEAR_OPTIONS.includes(autoClear) ? autoClear : DEFAULTS.autoClear,
      autoSave: toBoolean(s.autoSave, DEFAULTS.autoSave),
      background: s.background in BACKGROUNDS ? s.background : DEFAULTS.background,
      engine: s.engine === 'gas' ? 'gas' : 'builtin',
      gasUrl: sanitizeUrl(s.gasUrl),
    };
  }

  function sanitizeUrl(value) {
    try {
      const url = new URL(String(value).trim());
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function loadSettings() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      // 保存データが壊れている/ストレージが使えない場合は既定値を使う
    }
    const fromUrl = {};
    for (const [param, key] of Object.entries(URL_PARAMS)) {
      if (params.has(param)) fromUrl[key] = params.get(param);
    }
    return sanitize({ ...DEFAULTS, ...stored, ...fromUrl });
  }

  function updateSettings(patch) {
    Object.assign(settings, sanitize({ ...settings, ...patch }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // プライベートモードなどで保存できなくても動作は続ける
    }
    applySettings();
  }

  function applySettings() {
    document.body.dataset.bg = settings.background;
    document.body.classList.toggle('show-original', settings.showOriginal);
    ui.screen.style.setProperty('--font-scale', settings.size / 100);
    ui.sizeValue.textContent = `${settings.size}%`;
    ui.showOriginal.disabled = settings.target === 'none';
  }

  // ---------------------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------------------

  function init() {
    document.documentElement.lang = uiLang;
    document.title = t('pageTitle');
    for (const el of document.querySelectorAll('[data-i18n]')) {
      el.textContent = t(el.dataset.i18n);
    }
    for (const el of document.querySelectorAll('[data-i18n-label]')) {
      el.title = t(el.dataset.i18nLabel);
      el.setAttribute('aria-label', el.title);
    }

    fillSelect(ui.source, LANGUAGES.map((lang) => [lang.code, lang[uiLang]]));
    fillSelect(ui.target, [['none', t('none')], ...LANGUAGES.map((lang) => [lang.code, lang[uiLang]])]);
    fillSelect(ui.autoClear, AUTO_CLEAR_OPTIONS.map((sec) => [sec, sec ? `${sec}${t('seconds')}` : t('off')]));
    fillSelect(ui.background, Object.entries(BACKGROUNDS).map(([value, key]) => [value, t(key)]));

    ui.source.value = settings.source;
    ui.target.value = settings.target;
    ui.showOriginal.checked = settings.showOriginal;
    ui.size.value = settings.size;
    ui.autoClear.value = settings.autoClear;
    ui.autoSave.checked = settings.autoSave;
    ui.background.value = settings.background;
    applySettings();
    bindEvents();
    updateControls();
    refreshTranslateStatus();

    if (!Recognition) {
      ui.toggle.disabled = true;
      notify(t('unsupported'), 0);
    }
  }

  function fillSelect(select, options) {
    select.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
  }

  function bindEvents() {
    ui.toggle.addEventListener('click', () => (listening ? stop() : start()));
    ui.download.addEventListener('click', saveTranscript);
    ui.clear.addEventListener('click', () => {
      if (unsaved && !confirm(t('confirmClear'))) return;
      clearScreen();
      resetTranscript();
    });

    ui.source.addEventListener('change', () => {
      updateSettings({ source: ui.source.value });
      prepareTranslation();
      // 認識言語は開始時にしか反映されないため、いったん止めて onend で再開させる
      if (listening) recognition.stop();
    });
    ui.target.addEventListener('change', () => {
      updateSettings({ target: ui.target.value });
      prepareTranslation();
    });
    ui.showOriginal.addEventListener('change', () => updateSettings({ showOriginal: ui.showOriginal.checked }));
    ui.size.addEventListener('input', () => updateSettings({ size: ui.size.value }));
    ui.autoClear.addEventListener('change', () => {
      updateSettings({ autoClear: ui.autoClear.value });
      resetSilenceTimer();
    });
    ui.autoSave.addEventListener('change', () => updateSettings({ autoSave: ui.autoSave.checked }));
    ui.background.addEventListener('change', () => updateSettings({ background: ui.background.value }));

    ui.openSettings.addEventListener('click', openSettingsDialog);
    ui.cancelSettings.addEventListener('click', () => ui.dialog.close());
    ui.gasUrl.addEventListener('input', () => setGasResult(''));
    ui.gasTest.addEventListener('click', testGas);
    ui.dialogForm.addEventListener('submit', (event) => {
      const value = ui.gasUrl.value.trim();
      if (value && !sanitizeUrl(value)) {
        event.preventDefault();
        setGasResult(t('gasInvalidUrl'), 'error');
        return;
      }
      updateSettings({ gasUrl: value, engine: ui.dialogForm.elements.engine.value });
      prepareTranslation();
    });

    document.addEventListener('visibilitychange', () => {
      if (listening && document.visibilityState === 'visible') requestWakeLock();
    });
    window.addEventListener('beforeunload', (event) => {
      if (unsaved) event.preventDefault();
    });
  }

  // ---------------------------------------------------------------------------
  // 音声認識
  // ---------------------------------------------------------------------------

  function createRecognition() {
    const r = new Recognition();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = handleResult;
    r.onerror = handleError;
    r.onend = handleEnd;
    return r;
  }

  function start() {
    if (!Recognition || listening) return;
    recognition ??= createRecognition();
    listening = true;
    restartDelay = RESTART_DELAY_MIN;
    startRecognition();
    // ユーザー操作の直後に呼び、内蔵翻訳のモデルが必要ならここでダウンロードを始める
    prepareTranslation();
    resetSilenceTimer();
    requestWakeLock();
    updateControls();
  }

  function stop() {
    listening = false;
    clearTimeout(restartTimer);
    clearTimeout(silenceTimer);
    recognition?.stop();
    releaseWakeLock();
    updateControls();
  }

  function startRecognition() {
    recognition.lang = findLanguage(settings.source).speech;
    startedAt = Date.now();
    try {
      recognition.start();
    } catch (err) {
      // 前のセッションがまだ終わっていない場合。onend で再開される。
      console.warn(err);
    }
  }

  function handleResult(event) {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        const text = result[0].transcript.trim();
        if (text) addEntry(text);
      } else {
        interim += result[0].transcript;
      }
    }
    setInterim(interim.trim());
    resetSilenceTimer();
  }

  function handleError(event) {
    switch (event.error) {
      case 'no-speech':
      case 'aborted':
        return; // onend で自動的に再開する
      case 'network':
        notify(t('errorNetwork'));
        return;
      case 'not-allowed':
      case 'service-not-allowed':
        stop();
        notify(t('errorNotAllowed'), 0);
        return;
      case 'audio-capture':
        stop();
        notify(t('errorAudioCapture'), 0);
        return;
      case 'language-not-supported':
        stop();
        notify(t('errorLanguage'), 0);
        return;
      default:
        notify(t('errorUnknown') + event.error);
    }
  }

  function handleEnd() {
    setInterim('');
    if (!listening) return;
    // 開始直後に終わるような失敗が続く場合は間隔を空けて再試行する
    restartDelay = Date.now() - startedAt < 1000
      ? Math.min(restartDelay * 2, RESTART_DELAY_MAX)
      : RESTART_DELAY_MIN;
    restartTimer = setTimeout(startRecognition, restartDelay);
  }

  async function requestWakeLock() {
    try {
      wakeLock = await navigator.wakeLock?.request('screen');
    } catch {
      // 非対応・権限なしの場合は何もしない
    }
  }

  function releaseWakeLock() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  // ---------------------------------------------------------------------------
  // 字幕の表示
  // ---------------------------------------------------------------------------

  function addEntry(text) {
    const needsTranslation = settings.target !== 'none' && settings.target !== settings.source;
    const entry = {
      time: new Date(),
      text,
      source: settings.source,
      target: needsTranslation ? settings.target : null,
      translation: '',
      el: null,
    };

    const el = document.createElement('div');
    el.className = 'entry';
    const original = document.createElement('p');
    original.className = 'entry__original';
    original.lang = entry.source;
    original.textContent = text;
    const translation = document.createElement('p');
    translation.className = 'entry__translation';
    if (entry.target) translation.lang = entry.target;
    el.append(original, translation);
    entry.el = el;
    setEntryState(entry, needsTranslation ? 'pending' : 'plain');

    ui.lines.append(el);
    while (ui.lines.childElementCount > MAX_VISIBLE_ENTRIES) ui.lines.firstElementChild.remove();
    transcript.push(entry);
    unsaved = true;
    updateControls();
    scrollToBottom();

    if (needsTranslation) translateEntry(entry);
  }

  function setEntryState(entry, state, translation = '') {
    entry.translation = translation;
    entry.el.dataset.state = state;
    entry.el.lastElementChild.textContent = translation;
  }

  async function translateEntry(entry) {
    try {
      setEntryState(entry, 'done', await translateText(entry.text, entry.source, entry.target));
    } catch (err) {
      if (err instanceof TranslationUnavailableError) {
        setEntryState(entry, 'plain');
        // 発話のたびに同じ通知が出ないよう、言語ペアごとに 1 回だけ知らせる
        const key = pairKey(entry.source, entry.target);
        if (lastUnavailableNotice !== key) notify(t('translateUnavailable'));
        lastUnavailableNotice = key;
      } else {
        console.error('Translation failed:', err);
        setEntryState(entry, 'error');
        notify(t('translateFailed'));
      }
    }
    scrollToBottom();
  }

  function setInterim(text) {
    if (ui.interim.textContent === text) return;
    ui.interim.lang = settings.source;
    ui.interim.textContent = text;
    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      ui.screen.scrollTo({ top: ui.screen.scrollHeight, behavior: 'smooth' });
    });
  }

  function clearScreen() {
    ui.lines.replaceChildren();
    updateControls();
  }

  function resetSilenceTimer() {
    clearTimeout(silenceTimer);
    if (!listening || !settings.autoClear) return;
    silenceTimer = setTimeout(() => {
      if (settings.autoSave && unsaved) {
        saveTranscript();
        resetTranscript();
      }
      clearScreen();
    }, settings.autoClear * 1000);
  }

  // ---------------------------------------------------------------------------
  // 翻訳（ブラウザ内蔵の Translator API と利用者の GAS を、設定した優先順で使う）
  // ---------------------------------------------------------------------------

  class TranslationUnavailableError extends Error {}

  const pairKey = (source, target) => `${source}>${target}`;
  const translatorCode = (code) => findLanguage(code).translator ?? code;
  const hasBuiltinTranslator = () => 'Translator' in self;
  const engineOrder = () => (settings.engine === 'gas' ? ['gas', 'builtin'] : ['builtin', 'gas']);

  /** 優先順に並べた、いま使える翻訳エンジン */
  async function usableEngines(source, target) {
    const builtinUsable = (await builtinAvailability(source, target)) !== 'unavailable';
    return engineOrder().filter((engine) => (engine === 'gas' ? Boolean(settings.gasUrl) : builtinUsable));
  }

  async function translateText(text, source, target) {
    const engines = await usableEngines(source, target);
    if (!engines.length) throw new TranslationUnavailableError();
    let lastError;
    for (const engine of engines) {
      try {
        return engine === 'gas'
          ? await translateWithGas(settings.gasUrl, text, source, target)
          : await translateWithBuiltin(text, source, target);
      } catch (err) {
        // 失敗したら次のエンジンで試す
        console.warn(`Translation with ${engine} failed:`, err);
        lastError = err;
      }
    }
    throw lastError;
  }

  async function translateWithBuiltin(text, source, target) {
    // モデルのダウンロード中などで待たされる場合は、待ち続けずに次のエンジンへ回す
    const translator = await withTimeout(getTranslator(source, target), TRANSLATOR_READY_TIMEOUT);
    return withTimeout(translator.translate(text), TRANSLATE_TIMEOUT);
  }

  /** 'available' | 'downloadable' | 'downloading' | 'unavailable' */
  function builtinAvailability(source, target) {
    if (!hasBuiltinTranslator()) return Promise.resolve('unavailable');
    const key = pairKey(source, target);
    if (!availabilityCache.has(key)) {
      const options = { sourceLanguage: translatorCode(source), targetLanguage: translatorCode(target) };
      // 環境によっては応答が返らないことがあるため、一定時間で「使えない」とみなす
      const availability = withTimeout(Translator.availability(options), AVAILABILITY_TIMEOUT);
      availabilityCache.set(key, availability.catch(() => 'unavailable'));
    }
    return availabilityCache.get(key);
  }

  function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function getTranslator(source, target) {
    const key = pairKey(source, target);
    if (!translatorCache.has(key)) {
      const promise = Translator.create({
        sourceLanguage: translatorCode(source),
        targetLanguage: translatorCode(target),
        monitor(m) {
          m.addEventListener('downloadprogress', (event) => {
            downloadProgress = event.loaded;
            refreshTranslateStatus();
          });
        },
      })
        .then((translator) => {
          availabilityCache.set(key, Promise.resolve('available'));
          return translator;
        })
        .catch((err) => {
          translatorCache.delete(key);
          throw err;
        })
        .finally(() => {
          downloadProgress = null;
          refreshTranslateStatus();
        });
      translatorCache.set(key, promise);
    }
    return translatorCache.get(key);
  }

  /** 翻訳モデルのダウンロードにはユーザー操作が必要なため、操作のハンドラーから呼ぶ */
  async function prepareTranslation() {
    const { source, target } = settings;
    refreshTranslateStatus();
    if (target === 'none' || target === source) return;
    // GAS を優先して使える状態なら、内蔵翻訳のモデルは取得しない
    if ((await usableEngines(source, target))[0] !== 'builtin') return;
    const availability = await builtinAvailability(source, target);
    if (availability === 'downloadable' || availability === 'downloading') {
      getTranslator(source, target).catch((err) => console.warn('Could not prepare translator:', err));
    }
  }

  async function translateWithGas(gasUrl, text, source, target) {
    const url = new URL(gasUrl);
    url.search = new URLSearchParams({ text, source, target });
    const response = await fetch(url, { signal: AbortSignal.timeout(TRANSLATE_TIMEOUT) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = (await response.text()).trim();
    if (!result || /^<(!doctype|html)/i.test(result)) throw new Error('Unexpected response');
    return result;
  }

  async function refreshTranslateStatus() {
    const { source, target } = settings;
    let state = '';
    let label = '';
    if (target !== 'none' && target !== source) {
      const [engine] = await usableEngines(source, target);
      if (settings.source !== source || settings.target !== target) return; // 待つ間に変更された
      if (engine === 'builtin' && downloadProgress !== null) {
        state = 'downloading';
        label = `${t('engineDownloading')} ${Math.round(downloadProgress * 100)}%`;
      } else if (engine === 'builtin') {
        state = 'builtin';
        label = t('engineBuiltin');
      } else if (engine === 'gas') {
        state = 'gas';
        label = t('engineGas');
      } else {
        state = 'none';
        label = t('engineNone');
      }
    }
    ui.translateStatus.dataset.state = state;
    ui.translateStatus.textContent = label;
  }

  // ---------------------------------------------------------------------------
  // 翻訳の設定ダイアログ
  // ---------------------------------------------------------------------------

  async function openSettingsDialog() {
    ui.gasUrl.value = settings.gasUrl;
    ui.dialogForm.elements.engine.value = settings.engine;
    setGasResult('');
    ui.builtinStatus.textContent = '…';
    ui.dialog.showModal();
    ui.builtinStatus.textContent = await describeBuiltin();
  }

  async function describeBuiltin() {
    const { source, target } = settings;
    if (!hasBuiltinTranslator()) return t('builtinUnsupported');
    if (target === 'none' || target === source) return t('builtinNotNeeded');
    const availability = await builtinAvailability(source, target);
    if (availability === 'available') return t('builtinAvailable');
    if (availability === 'unavailable') return t('builtinUnavailable');
    return t('builtinDownloadable');
  }

  async function testGas() {
    const gasUrl = sanitizeUrl(ui.gasUrl.value);
    if (!gasUrl) {
      setGasResult(t('gasInvalidUrl'), 'error');
      return;
    }
    // ソース言語と別の言語で試す（日本語 UI なら日本語 → 英語）
    const [source, target, sample] = uiLang === 'ja' ? ['ja', 'en', 'こんにちは'] : ['en', 'ja', 'Hello'];
    ui.gasTest.disabled = true;
    setGasResult(t('gasTesting'));
    try {
      setGasResult(`${t('gasTestOk')}${sample} → ${await translateWithGas(gasUrl, sample, source, target)}`, 'ok');
    } catch (err) {
      setGasResult(t('gasTestFailed') + err.message, 'error');
    } finally {
      ui.gasTest.disabled = false;
    }
  }

  function setGasResult(message, state = '') {
    ui.gasResult.textContent = message;
    ui.gasResult.dataset.state = state;
  }

  // ---------------------------------------------------------------------------
  // 保存
  // ---------------------------------------------------------------------------

  function saveTranscript() {
    if (!transcript.length) return;
    const indent = ' '.repeat(11); // "[hh:mm:ss] " の幅
    const body = transcript
      .map((entry) => {
        const line = `[${formatTime(entry.time)}] ${entry.text}`;
        return entry.translation ? `${line}\n${indent}${entry.translation}` : line;
      })
      .join('\n');

    const blob = new Blob([body + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_${formatStamp(transcript[0].time)}.txt`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);

    unsaved = false;
    updateControls();
  }

  function resetTranscript() {
    transcript = [];
    unsaved = false;
    updateControls();
  }

  const pad = (n) => String(n).padStart(2, '0');

  function formatTime(d) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function formatStamp(d) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-`
      + `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  // ---------------------------------------------------------------------------
  // UI 状態
  // ---------------------------------------------------------------------------

  function updateControls() {
    document.body.classList.toggle('is-listening', listening);
    ui.toggle.textContent = t(listening ? 'stop' : 'start');
    ui.toggle.setAttribute('aria-pressed', listening);
    ui.statusText.textContent = t(listening ? 'statusListening' : 'statusIdle');
    ui.download.disabled = transcript.length === 0;
    ui.clear.disabled = transcript.length === 0 && ui.lines.childElementCount === 0;
  }

  /** duration = 0 のときは自動で閉じない */
  function notify(message, duration = NOTICE_DURATION) {
    clearTimeout(noticeTimer);
    ui.notice.textContent = message;
    ui.notice.hidden = false;
    if (duration) noticeTimer = setTimeout(() => (ui.notice.hidden = true), duration);
  }

  init();
})();
