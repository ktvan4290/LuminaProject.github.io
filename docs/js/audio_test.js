// SPATUNE Web — Audio Engine v3

class AudioEngine {
  constructor() {
    this._ctx          = null;
    this._masterGain   = null;
    this._leftGain     = null;   // 밸런스용 L 게인
    this._rightGain    = null;   // 밸런스용 R 게인
    this._source       = null;
    this._eqFilters    = [];
    this._eqEnabled    = true;
    this._playing      = false;
    this._currentMode  = null;
    this._currentBands = [];
    this._fileBuffer   = null;
    this._sweepTimer   = null;
    this._balanceValue = 0;
    this._balTestNodes = [];
    this._audioCache   = {};
    this._preamp       = null;
  }

  // ── 초기화 (사용자 제스처 필요) ─────────────────────────
  _init() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();

      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._volumeValue ?? 0.36;

      // 밸런스: StereoPannerNode (ChannelMerger 불필요)
      this._panner = this._ctx.createStereoPanner();
      this._panner.pan.value = this._balanceValue ?? 0;

      // effects 체인 (처음부터 연결, 기본값은 투명)
      if (typeof effectsEngine !== 'undefined') {
        this._fxEntry = effectsEngine.setupChain(this._ctx, this._masterGain);
      } else {
        this._fxEntry = this._masterGain;
      }

      // masterGain → panner → destination (단순, 확실)
      this._masterGain.connect(this._panner);
      this._panner.connect(this._ctx.destination);

      // 하위 호환용 더미 (밸런스 코드가 참조)
      this._leftGain  = { gain: { value: 1 } };
      this._rightGain = { gain: { value: 1 } };
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  _applyBalanceGain(val) {
    if (this._panner) this._panner.pan.value = Math.max(-1, Math.min(1, val));
  }

  setBalance(val) {
    this._balanceValue = Math.max(-1, Math.min(1, val));
    this._applyBalanceGain(this._balanceValue);
  }

  // ── EQ 체인 ──────────────────────────────────────────────
  _buildEQChain(bands) {
    this._currentBands = bands.map(b => ({ ...b }));

    // 프리앰프: 최대 부스트의 60% 감쇄, 최대 -9dB — APO와 동일 방식, 클리핑 방지
    const maxBoost = bands.reduce((m, b) => b.gain > m ? b.gain : m, 0);
    const preampDb = maxBoost > 0.5 ? -Math.min(maxBoost * 0.6, 9) : 0;
    this._preamp = this._ctx.createGain();
    this._preamp.gain.value = Math.pow(10, preampDb / 20);

    this._eqFilters = bands.map(b => {
      const f = this._ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = b.fc;
      f.gain.value = this._eqEnabled ? b.gain : 0;
      f.Q.value = b.q;
      return f;
    });
    const entry = this._fxEntry || this._masterGain;
    if (this._eqFilters.length === 0) {
      this._preamp.connect(entry);
      return this._preamp;
    }
    for (let i = 0; i < this._eqFilters.length - 1; i++)
      this._eqFilters[i].connect(this._eqFilters[i + 1]);
    this._eqFilters[this._eqFilters.length - 1].connect(entry);
    this._preamp.connect(this._eqFilters[0]);
    return this._preamp;
  }

  // ── 재생 중 프리셋 변경 (소스 유지, 필터 체인만 교체) ────
  liveUpdateEQ(bands) {
    if (!this._ctx || !this._source) return;

    try { this._source.disconnect(); } catch(e) {}
    if (this._preamp) { try { this._preamp.disconnect(); } catch(e) {} this._preamp = null; }
    this._eqFilters.forEach(f => { try { f.disconnect(); } catch(e) {} });
    this._eqFilters = [];

    // 새 체인 구성 후 소스 연결 (소스는 계속 재생 중)
    const entry = this._buildEQChain(bands);
    this._source.connect(entry);
  }

  // ── EQ ON/OFF (재시작 없이 게인 램프) ────────────────────
  toggleEQ() {
    this._eqEnabled = !this._eqEnabled;
    if (this._ctx && this._eqFilters.length > 0) {
      const t = this._ctx.currentTime;
      this._eqFilters.forEach((f, i) => {
        const target = this._eqEnabled ? (this._currentBands[i]?.gain ?? 0) : 0;
        f.gain.setTargetAtTime(target, t, 0.03);
      });
    }
    return this._eqEnabled;
  }

  // ── 핑크 노이즈 (기능 유지) ──────────────────────────────
  _makeNoiseBuf(sec) {
    const n = this._ctx.sampleRate * sec;
    const buf = this._ctx.createBuffer(1, n, this._ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < n; i++) {
      const w = Math.random()*2-1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
    return buf;
  }

  playPinkNoise(bands) {
    this._init(); this.stop();
    this._currentMode = 'noise'; this._currentBands = bands;
    const src = this._ctx.createBufferSource();
    src.buffer = this._makeNoiseBuf(3); src.loop = true;
    src.connect(this._buildEQChain(bands));
    src.start(); this._source = src; this._playing = true;
  }

  // ── 주파수 스윕 ──────────────────────────────────────────
  playSweep(bands, dur = 8) {
    this._init(); this.stop();
    this._currentMode = 'sweep'; this._currentBands = bands;
    const osc = this._ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(20, this._ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20000, this._ctx.currentTime + dur);
    const env = this._ctx.createGain();
    env.gain.setValueAtTime(0, this._ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.6, this._ctx.currentTime + 0.05);
    env.gain.setValueAtTime(0.6, this._ctx.currentTime + dur - 0.1);
    env.gain.linearRampToValueAtTime(0, this._ctx.currentTime + dur);
    osc.connect(env);
    env.connect(this._buildEQChain(bands));
    osc.start(); osc.stop(this._ctx.currentTime + dur);
    this._source = osc; this._playing = true;
    this._sweepTimer = setTimeout(() => {
      this._playing = false; this._currentMode = null;
      if (window._onSweepEnd) window._onSweepEnd();
    }, dur * 1000 + 150);
  }

  // ── 밸런스 테스트: 음성 파일을 해당 채널로 재생 ─────────
  // channel: 'left' | 'right' | 'both'
  async playBalanceTest(channel) {
    this._init(); this.stop();
    this._currentMode  = 'balance_' + channel;
    this._currentBands = [];
    this._playing = true;

    const keyMap = { left: 'leftSound', right: 'rightSound', both: 'centerSound' };
    const key    = keyMap[channel];

    // 캐시 없으면 디코딩
    if (!this._audioCache[key]) {
      const dataUrl = (typeof AUDIO_DATA !== 'undefined') ? AUDIO_DATA[key] : null;
      if (!dataUrl) {
        console.warn('audio_data.js 없음 — make_audio.py 실행 필요');
        this._playing = false; this._currentMode = null;
        return;
      }
      // data URL → ArrayBuffer → AudioBuffer
      const resp      = await fetch(dataUrl);
      const arrayBuf  = await resp.arrayBuffer();
      this._audioCache[key] = await this._ctx.decodeAudioData(arrayBuf);
    }

    const audioBuf = this._audioCache[key];
    const src = this._ctx.createBufferSource();
    src.buffer = audioBuf;

    // 채널 라우팅 — StereoPanner 사용 (ChannelMerger 제거)
    const balPanner = this._ctx.createStereoPanner();
    balPanner.pan.value = channel === 'left' ? -1 : channel === 'right' ? 1 : 0;

    src.connect(balPanner);
    balPanner.connect(this._masterGain);

    this._balTestNodes = [balPanner];

    src.start();
    this._source = src;
    this._playing = true;

    // 재생 끝나면 자동 정지
    src.onended = () => {
      this._playing = false;
      this._currentMode = null;
      if (window._onBalanceTestEnd) window._onBalanceTestEnd();
    };
  }

  // ── 음원 파일 재생 ────────────────────────────────────────
  async loadFile(file) {
    this._init();
    const ab = await file.arrayBuffer();
    this._fileBuffer = await this._ctx.decodeAudioData(ab);
    return true;
  }

  async loadFromUrl(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = async () => {
        if (xhr.status !== 200 && xhr.status !== 0) {
          reject(new Error(`HTTP ${xhr.status}`)); return;
        }
        try {
          this._init();
          this._fileBuffer = await this._ctx.decodeAudioData(xhr.response);
          resolve(true);
        } catch(e) { reject(e); }
      };
      xhr.onerror = () => reject(new Error('파일 로드 실패'));
      xhr.send();
    });
  }

  playFile(bands) {
    this._init();
    if (!this._fileBuffer) return false;
    this.stop();
    this._currentMode = 'file'; this._currentBands = bands;
    const src = this._ctx.createBufferSource();
    src.buffer = this._fileBuffer;
    src.connect(this._buildEQChain(bands));
    src.start(); this._source = src; this._playing = true;
    src.onended = () => {
      this._playing = false; this._currentMode = null;
      if (window._onFileEnd) window._onFileEnd();
    };
    return true;
  }

  // ── 정지 ─────────────────────────────────────────────────
  stop() {
    if (this._sweepTimer) { clearTimeout(this._sweepTimer); this._sweepTimer = null; }
    if (this._source) {
      try { this._source.stop(); } catch(e) {}
      try { this._source.disconnect(); } catch(e) {}
      this._source = null;
    }
    if (this._preamp) { try { this._preamp.disconnect(); } catch(e) {} this._preamp = null; }
    this._balTestNodes.forEach(n => { try { n.disconnect(); } catch(e) {} });
    this._balTestNodes = [];
    this._eqFilters.forEach(f => { try { f.disconnect(); } catch(e) {} });
    this._eqFilters = [];
    this._playing = false;
    this._currentMode = null;
  }

  get isPlaying()   { return this._playing; }
  get eqEnabled()   { return this._eqEnabled; }
  get hasFile()     { return !!this._fileBuffer; }
  get currentMode() { return this._currentMode; }
}

const audioEngine = new AudioEngine();
