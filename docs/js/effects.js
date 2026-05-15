// SPATUNE — Effects Engine
// setupChain()이 _init()에서 호출되어 처음부터 연결됨
// 모든 효과 기본값 = 투명(bypass) → disconnect 불필요

class EffectsEngine {
  constructor() {
    this._ctx   = null;
    this._N     = null;
    this._entry = null;
  }

  // ── 합성 임펄스 응답 생성 (기타 리버브 이펙터 방식) ──────
  // duration : 잔향 길이(초), decay : 감쇄 속도 (클수록 짧은 룸)
  _makeIR(audioCtx, duration, decay) {
    const sr  = audioCtx.sampleRate;
    const len = Math.floor(sr * duration);
    const ir  = audioCtx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let maxAbs = 1e-9;
      for (let i = 0; i < len; i++) {
        // 지수 감쇄 × 스테레오 독립 노이즈 (채널별 다른 씨드 → 자연스러운 좌우)
        d[i] = (Math.random() * 2 - 1) * Math.exp(-decay * i / sr);
        if (Math.abs(d[i]) > maxAbs) maxAbs = Math.abs(d[i]);
      }
      // 피크 정규화
      for (let i = 0; i < len; i++) d[i] /= maxAbs * 2;
    }
    return ir;
  }

  setupChain(audioCtx, masterGain) {
    this._ctx = audioCtx;
    const C = audioCtx;

    // ── 베이스 부스트 ──────────────────────────────────────
    const bass = C.createBiquadFilter();
    bass.type = 'lowshelf'; bass.frequency.value = 200; bass.gain.value = 0;

    // ── 선명도: highshelf 5500Hz (에어감·밝기) ────────────
    const clarity = C.createBiquadFilter();
    clarity.type = 'highshelf'; clarity.frequency.value = 5500; clarity.gain.value = 0;

    // ── 보컬강화: 2500Hz 프레즌스 + 250Hz 바디 ───────────
    const vocal1 = C.createBiquadFilter();
    vocal1.type = 'peaking'; vocal1.frequency.value = 2500;
    vocal1.Q.value = 1.2; vocal1.gain.value = 0;

    const vocal2 = C.createBiquadFilter();
    vocal2.type = 'peaking'; vocal2.frequency.value = 250;
    vocal2.Q.value = 2.5; vocal2.gain.value = 0;

    // ── 공간감: ConvolverNode 리버브 (2s 홀 IR) ───────────
    // 기타 이펙터 리버브와 동일 원리 — IR = 지수 감쇄 노이즈
    const convolver = C.createConvolver();
    convolver.buffer = this._makeIR(C, 3.0, 1.5);  // 3초 잔향, 넓은 홀 캐릭터

    const dryGain = C.createGain(); dryGain.gain.value = 1;
    const wetGain = C.createGain(); wetGain.gain.value = 0;
    const ambiOut = C.createGain();

    // ── 다이나믹 + makeup gain ─────────────────────────────
    const comp = C.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 20;
    comp.ratio.value     = 1;
    comp.attack.value    = 0.002;
    comp.release.value   = 0.10;

    const dynamicsGain = C.createGain(); dynamicsGain.gain.value = 1;

    // ── 음량 정규화 ────────────────────────────────────────
    const normGain = C.createGain(); normGain.gain.value = 1;

    // ── 체인 연결 ──────────────────────────────────────────
    bass.connect(clarity);
    clarity.connect(vocal1);
    vocal1.connect(vocal2);

    // dry path
    vocal2.connect(dryGain);
    dryGain.connect(ambiOut);

    // wet path (reverb)
    vocal2.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(ambiOut);

    ambiOut.connect(comp);
    comp.connect(dynamicsGain);
    dynamicsGain.connect(normGain);
    normGain.connect(masterGain);

    this._N     = { bass, clarity, vocal1, vocal2, wetGain, dryGain, comp, dynamicsGain, normGain };
    this._entry = bass;
    return bass;
  }

  // ── 세터 ────────────────────────────────────────────────
  setBass(v) {
    if (!this._N) return;
    this._N.bass.gain.setTargetAtTime(v * 5, this._ctx.currentTime, 0.02);
  }

  setClarity(v) {
    if (!this._N) return;
    this._N.clarity.gain.setTargetAtTime(v * 2.5, this._ctx.currentTime, 0.02);
  }

  setVocal(v) {
    if (!this._N) return;
    const t = this._ctx.currentTime;
    this._N.vocal1.gain.setTargetAtTime(v * 3.5, t, 0.02);
    this._N.vocal2.gain.setTargetAtTime(v * 1.5, t, 0.02);
  }

  // 2차 함수: v=1→8%, v=2→32%, v=3→72% — 슬라이더 끝으로 갈수록 극적으로
  setAmbiance(v) {
    if (!this._N) return;
    const wet = (v / 3) * (v / 3) * 0.72;
    this._N.wetGain.gain.setTargetAtTime(wet, this._ctx.currentTime, 0.05);
  }

  setDynamics(v) {
    if (!this._N) return;
    const t = this._ctx.currentTime;
    this._N.comp.threshold.setTargetAtTime(-12 - v * 10, t, 0.02);
    this._N.comp.ratio.setTargetAtTime(1 + v * 6, t, 0.02);
    this._N.comp.release.setTargetAtTime(0.05 + (1 - v / 3) * 0.1, t, 0.02);
    this._N.dynamicsGain.gain.setTargetAtTime(1 + v * 0.5, t, 0.02);
  }

  setNormalize(on) {
    if (!this._N) return;
    this._N.normGain.gain.setTargetAtTime(on ? 2.0 : 1.0, this._ctx.currentTime, 0.05);
  }

  get isReady() { return !!this._N; }
}

const effectsEngine = new EffectsEngine();
