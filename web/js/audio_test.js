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
    this._balanceValue = 0;      // 슬라이더 값 저장 (init 전에도 유지)
    this._balTestNodes = [];
    this._audioCache   = {};     // 디코딩된 밸런스 테스트 버퍼 캐시
  }

  // ── 초기화 (사용자 제스처 필요) ─────────────────────────
  _init() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();

      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._volumeValue ?? 0.36; // 슬라이더 기본값 40% 반영

      // L/R 개별 게인으로 밸런스 제어 (StereoPannerNode 대신 — 더 확실)
      this._leftGain  = this._ctx.createGain();
      this._rightGain = this._ctx.createGain();
      const merger = this._ctx.createChannelMerger(2);

      // masterGain(모노) → 복제 → 각 채널 → merger → destination
      this._masterGain.connect(this._leftGain);
      this._masterGain.connect(this._rightGain);
      this._leftGain.connect(merger,  0, 0);   // 왼쪽 채널
      this._rightGain.connect(merger, 0, 1);   // 오른쪽 채널
      merger.connect(this._ctx.destination);

      // 저장된 밸런스 값 적용
      this._applyBalanceGain(this._balanceValue);
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  // ── 밸런스 게인 계산 ─────────────────────────────────────
  _applyBalanceGain(val) {
    if (!this._leftGain) return;
    // val: -1=완전 왼쪽, 0=중앙, +1=완전 오른쪽
    const left  = val <= 0 ? 1.0 : 1.0 - val;
    const right = val >= 0 ? 1.0 : 1.0 + val;
    this._leftGain.gain.value  = left;
    this._rightGain.gain.value = right;
  }

  // 슬라이더에서 호출 — 소리 없이 값만 저장/적용
  setBalance(val) {
    this._balanceValue = Math.max(-1, Math.min(1, val));
    this._applyBalanceGain(this._balanceValue); // init 됐으면 즉시, 아니면 저장만
  }

  // ── EQ 체인 ──────────────────────────────────────────────
  _buildEQChain(bands) {
    this._currentBands = bands.map(b => ({ ...b }));
    this._eqFilters = bands.map(b => {
      const f = this._ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = b.fc;
      f.gain.value = this._eqEnabled ? b.gain : 0;
      f.Q.value = b.q;
      return f;
    });
    if (this._eqFilters.length === 0) return this._masterGain;
    for (let i = 0; i < this._eqFilters.length - 1; i++)
      this._eqFilters[i].connect(this._eqFilters[i + 1]);
    this._eqFilters[this._eqFilters.length - 1].connect(this._masterGain);
    return this._eqFilters[0];
  }

  // ── 재생 중 프리셋 변경 (소스 유지, 필터 체인만 교체) ────
  liveUpdateEQ(bands) {
    if (!this._ctx || !this._source) return;

    // 소스를 기존 체인에서 분리
    try { this._source.disconnect(); } catch(e) {}

    // 기존 필터 분리 및 제거
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

    // 채널 라우팅 — 음성이 지정된 채널로만 출력
    const leftGain  = this._ctx.createGain();
    const rightGain = this._ctx.createGain();
    const merger    = this._ctx.createChannelMerger(2);

    leftGain.gain.value  = channel === 'right' ? 0 : 1;
    rightGain.gain.value = channel === 'left'  ? 0 : 1;

    src.connect(leftGain);
    src.connect(rightGain);
    leftGain.connect(merger,  0, 0);
    rightGain.connect(merger, 0, 1);
    merger.connect(this._ctx.destination);  // 밸런스 우회 (순수 채널 테스트)

    this._balTestNodes = [leftGain, rightGain, merger];

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
    this._init();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const ab = await resp.arrayBuffer();
    this._fileBuffer = await this._ctx.decodeAudioData(ab);
    return true;
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
