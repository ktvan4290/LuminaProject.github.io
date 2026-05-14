// SPATUNE Web-Dev — Real-time Spectrum Analyzer
// drawEQ() 안에서 오버레이로 그림 (독립 RAF 루프 없음)

class SpectrumAnalyzer {
  constructor() {
    this._analyser  = null;
    this._dataArray = null;
    this._enabled   = false;
  }

  get enabled() { return this._enabled; }

  // AudioEngine._masterGain 에 탭으로 연결
  attach(audioCtx, tapNode) {
    this.detach();
    this._analyser = audioCtx.createAnalyser();
    this._analyser.fftSize               = 2048;
    this._analyser.smoothingTimeConstant = 0.60;  // 고음역 트랜지언트도 잘 보이도록
    tapNode.connect(this._analyser);
    this._dataArray = new Float32Array(this._analyser.frequencyBinCount);
  }

  detach() {
    if (this._analyser) {
      try { this._analyser.disconnect(); } catch(e) {}
      this._analyser = null;
    }
    this._dataArray = null;
  }

  toggle() {
    this._enabled = !this._enabled;
    return this._enabled;
  }

  enable()  { this._enabled = true;  }
  disable() { this._enabled = false; }

  // drawEQ() 에서 호출 — EQ 커브 위에 스펙트럼 오버레이
  drawOverlay(ctx, W, H, PAD, color) {
    if (!this._enabled || !this._analyser || !this._dataArray) return;

    this._analyser.getFloatFrequencyData(this._dataArray);

    const pw = W - PAD.l - PAD.r;
    const ph = H - PAD.t - PAD.b;
    const DB_MIN = -14, DB_MAX = 14;

    const sampleRate = this._analyser.context.sampleRate;
    const binCount   = this._analyser.frequencyBinCount;
    const hzPerBin   = sampleRate / (binCount * 2);

    const xOfF  = f  => PAD.l + (Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * pw;
    const yOfDb = db => PAD.t + (1 - (db - DB_MIN) / (DB_MAX - DB_MIN)) * ph;
    const toScreenDb = db => db * 0.5 + 9;

    // ── 로그 스케일로 200포인트 샘플링 ───────────────────
    const N = 200;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const f    = 20 * Math.pow(1000, i / (N - 1));   // 20Hz ~ 20kHz 로그
      const bin  = f / hzPerBin;
      const i0   = Math.min(Math.floor(bin), binCount - 2);
      const t    = bin - i0;
      // 선형 보간
      const db   = this._dataArray[i0] * (1 - t) + this._dataArray[i0 + 1] * t;
      pts.push({ x: xOfF(f), y: yOfDb(Math.max(DB_MIN, Math.min(DB_MAX, toScreenDb(db)))) });
    }

    // ── 이동 평균 스무딩 (윈도우 줄여 고음역도 선명하게) ──
    const W_AVG = 3;
    const smoothed = pts.map((p, i) => {
      const s = Math.max(0, i - W_AVG), e = Math.min(pts.length - 1, i + W_AVG);
      const ay = pts.slice(s, e + 1).reduce((sum, q) => sum + q.y, 0) / (e - s + 1);
      return { x: p.x, y: ay };
    });

    // ── 부드러운 베지어 곡선 그리기 ──────────────────────
    const [r, g, b] = _hexRgb(color || '#00D4E8');

    const drawCurve = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const cpX = (pts[i].x + pts[i + 1].x) / 2;
        const cpY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, cpX, cpY);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    };

    ctx.save();

    // 채움 영역
    drawCurve(smoothed);
    ctx.lineTo(smoothed[smoothed.length - 1].x, yOfDb(DB_MIN));
    ctx.lineTo(smoothed[0].x, yOfDb(DB_MIN));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + ph);
    grad.addColorStop(0,   `rgba(${r},${g},${b},0.28)`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},0.08)`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},0.01)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // 외곽선
    drawCurve(smoothed);
    ctx.strokeStyle = `rgba(${r},${g},${b},0.70)`;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    ctx.restore();
  }
}

function _hexRgb(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

const spectrumAnalyzer = new SpectrumAnalyzer();
