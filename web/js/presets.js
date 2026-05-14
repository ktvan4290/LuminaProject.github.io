// SPATUNE Web — EQ Presets v4
// 출처: Harman Research (2018/2019), oratory1990, AutoEQ, IEF, RTINGS

// ── 공용 주파수 배열 (1/3옥타브) ─────────────────────────
const CUSTOM_FREQS = [25,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000,16000];
const Q15 = 1.5;

function makeBands(gains) {
  return CUSTOM_FREQS.map((fc, i) => ({ fc, gain: gains[i], q: Q15 }));
}

const customPreset = {
  name:"Custom", desc:"직접 설정하는 15밴드 EQ. 그래프 드래그 또는 슬라이더로 조절.",
  color:"#A0FFB0", isCustom:true,
  bands: CUSTOM_FREQS.map(fc => ({ fc, gain:0, q: Q15 }))
};

// ═══════════════════════════════════════════════════════
//  2채널 스피커
// ═══════════════════════════════════════════════════════
const SPEAKER_PRESETS_LIST = [
  { name:"Flat", desc:"보정 없음. 스피커 고유의 주파수 응답 그대로.", color:"#8A9EAE", bands:[] },
  {
    name:"Harman 2018",
    desc:"Harman International 연구. 전 세계 청취자 64%가 선호한 과학적 기준 커브.",
    color:"#00D4E8",
    bands: makeBands([ 3.5, 4.0, 4.0, 3.5, 2.0, 1.0, 0.5, 0.0, 0.0,-0.5,-1.0,-2.0,-2.5,-3.5,-5.0])
  },
  {
    name:"Warm Reference",
    desc:"스튜디오 엔지니어 기준. 중저역 풍성함과 고역 에어감의 균형.",
    color:"#E8A840",
    bands: makeBands([ 1.5, 2.0, 2.5, 3.0, 3.5, 3.0, 1.5, 0.0,-1.0,-1.5,-0.5, 0.5, 1.5, 2.0, 1.0])
  },
  {
    name:"Jazz & Soul",
    desc:"어쿠스틱 악기 온기 + 공기감. 재즈, 블루스, 소울, 보사노바.",
    color:"#44CCA0",
    bands: makeBands([ 0.5, 1.5, 2.5, 3.0, 2.5, 2.0, 0.5,-0.5,-1.0,-0.5, 0.0, 1.0, 2.0, 3.0, 2.5])
  },
  {
    name:"Rock",
    desc:"킥·스네어 펀치감 + 기타 프레즌스. 록, 메탈, 얼터너티브.",
    color:"#FF5A35",
    bands: makeBands([ 2.0, 3.5, 5.0, 4.0, 2.0, 0.5,-0.5,-2.0,-2.5,-1.5, 0.5, 3.0, 3.5, 2.5, 2.0])
  },
  {
    name:"Orchestral",
    desc:"넓은 스테이지와 자연스러운 잔향. 클래식, 오케스트라, 피아노 독주.",
    color:"#AA80FF",
    bands: makeBands([ 0.5, 1.0, 1.5, 2.0, 1.5, 1.0, 0.5, 0.0,-0.5,-1.0,-0.5, 1.0, 2.0, 3.0, 2.5])
  },
  {
    name:"Electronic",
    desc:"서브베이스 확장 + 선명한 고역. EDM, 테크노, 신스팝, 트랜스.",
    color:"#00EEBB",
    bands: makeBands([ 7.0, 6.5, 5.0, 3.5, 1.5,-0.5,-1.5,-2.0,-1.0, 0.0, 1.0, 2.0, 3.0, 3.5, 2.5])
  },
  {
    name:"Cinema",
    desc:"저역 임팩트 + 대화 선명도. 액션·스릴러 영화 감상에 최적.",
    color:"#7090FF",
    bands: makeBands([ 5.0, 5.5, 5.5, 4.5, 2.5, 0.0,-1.5,-2.0,-1.0, 1.0, 3.0, 3.5, 2.5, 1.5, 0.0])
  },
  customPreset,
];

// ═══════════════════════════════════════════════════════
//  헤드셋 — 장르·용도별
// ═══════════════════════════════════════════════════════
const HEADSET_PRESETS_LIST = [
  { name:"Flat", desc:"보정 없음. 헤드셋 고유 음색 그대로.", color:"#8A9EAE", bands:[] },
  {
    name:"Harman IEM",
    desc:"Harman 2019 인이어 타겟. 과학적으로 검증된 중립·자연스러운 기준 커브.",
    color:"#00D4E8",
    bands: makeBands([ 7.0, 7.5, 8.0, 7.0, 5.0, 3.0, 1.5, 0.5, 0.0,-0.5, 0.5, 2.0,-1.0,-2.5,-5.0])
  },
  {
    name:"Studio Monitor",
    desc:"스튜디오 레퍼런스 모니터링 느낌. 정확하고 분석적인 사운드.",
    color:"#C8D8E0",
    bands: makeBands([-1.5,-1.0, 0.5, 1.5, 1.0, 0.5, 0.0, 0.0, 0.0,-0.5, 0.0, 1.0, 1.5, 2.0, 1.5])
  },
  {
    name:"FPS Gaming",
    desc:"발소리·총성 위치 파악 극대화. 저역 럼블 제거, 공간 명료도 강화.",
    color:"#FFD040",
    bands: makeBands([-6.0,-5.5,-5.0,-4.0,-2.5,-1.5,-0.5, 0.0, 1.5, 2.5, 3.0, 5.5, 4.5, 3.0, 1.5])
  },
  {
    name:"Bass Head",
    desc:"서브베이스 극한 확장. 트랩, 힙합, EDM 베이스 극대화.",
    color:"#9966FF",
    bands: makeBands([ 9.0, 8.5, 7.0, 5.5, 3.5, 1.5, 0.0,-1.0,-2.0,-1.0, 0.0, 1.0, 2.0, 1.5, 0.5])
  },
  {
    name:"Vocal Clarity",
    desc:"말소리 명료도 극대화. 팟캐스트, 오디오북, 화상회의.",
    color:"#FF9F43",
    bands: makeBands([-5.0,-5.0,-4.5,-3.5,-2.5,-2.0,-1.0, 0.0, 1.5, 2.5, 2.0, 4.0, 3.0, 2.0, 0.5])
  },
  {
    name:"Hi-Fi Detail",
    desc:"디테일과 해상도 중심. 오디오파일 정밀 감상용.",
    color:"#88DDFF",
    bands: makeBands([ 1.0, 2.0, 2.5, 2.5, 1.5, 0.5, 0.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.5, 3.0, 2.5])
  },
  {
    name:"Late Night",
    desc:"저역 대폭 감소 + 대화음 강조. 조용한 환경에서도 선명하게.",
    color:"#4488BB",
    bands: makeBands([-11.0,-9.5,-8.0,-6.0,-4.0,-2.0,-0.5, 0.5, 2.5, 3.5, 3.0, 4.5, 2.5, 0.5,-1.5])
  },
  customPreset,
];

// ═══════════════════════════════════════════════════════
//  사운드바
// ═══════════════════════════════════════════════════════
const SOUNDBAR_PRESETS_LIST = [
  { name:"Flat", desc:"보정 없음. 사운드바 본연의 응답.", color:"#8A9EAE", bands:[] },
  {
    name:"Cinema",
    desc:"저역 임팩트 + 대화 선명도. 넓은 공간 영화·드라마 감상.",
    color:"#7090FF",
    bands: makeBands([ 5.5, 6.0, 6.0, 5.0, 3.0, 0.5,-1.5,-2.0,-1.0, 1.0, 3.0, 4.0, 3.0, 1.5, 0.0])
  },
  {
    name:"Music",
    desc:"사운드바 음악 감상 최적화. 좁은 방에서도 풍성하고 균형 있게.",
    color:"#44CCA0",
    bands: makeBands([ 3.5, 4.0, 4.5, 4.0, 3.0, 1.5, 0.0,-1.0,-0.5, 0.0, 0.5, 1.5, 2.5, 2.5, 1.0])
  },
  {
    name:"News & Talk",
    desc:"방송 대화·뉴스 최대 명료도. TV 시청 및 뉴스 청취.",
    color:"#FF9F43",
    bands: makeBands([-6.0,-6.0,-5.5,-4.5,-3.5,-2.0,-1.0, 0.0, 1.5, 3.5, 4.0, 5.5, 3.5, 1.5, 0.0])
  },
  {
    name:"Sports",
    desc:"해설 명료도 + 현장 함성. 스포츠 중계 실황 최적.",
    color:"#FFD700",
    bands: makeBands([ 2.0, 2.5, 3.0, 3.0, 2.0, 0.5,-1.0,-0.5, 1.5, 2.0, 2.5, 4.0, 3.0, 2.0, 1.0])
  },
  {
    name:"Gaming",
    desc:"환경음 몰입감 + 대화 선명도. RPG, 어드벤처, FPS 게임.",
    color:"#00EEBB",
    bands: makeBands([ 4.5, 5.0, 5.0, 4.0, 2.5, 0.5,-1.0,-1.5,-0.5, 1.0, 2.0, 3.5, 4.0, 3.0, 1.5])
  },
  {
    name:"Night Mode",
    desc:"저역 대폭 감소 + 대화 집중. 늦은 밤 이웃 방해 없이.",
    color:"#6680AA",
    bands: makeBands([-11.0,-10.0,-8.0,-6.0,-4.5,-3.0,-1.5,-0.5, 1.0, 3.0, 4.5, 6.0, 3.5, 1.5,-0.5])
  },
  customPreset,
];

// ═══════════════════════════════════════════════════════
//  헤드폰 기기별 추천 (Harman 타겟 보정 커브)
//  각 헤드폰의 실측 주파수 응답 편차를 보정하여
//  Harman 타겟에 최대한 가깝게 조정
// ═══════════════════════════════════════════════════════
const DEVICE_PRESETS_LIST = [
  {
    name:"B&W PX7 S3",
    desc:"Bowers & Wilkins PX7 S3. 과도한 100~160Hz 저역 감소, 고역 확장 보정.",
    color:"#AABBCC",
    bands: makeBands([ 0.0,-1.0,-2.5,-4.0,-4.5,-3.0,-1.0, 0.5, 1.0, 2.0, 2.5, 3.0, 4.0, 5.5, 3.5])
  },
  {
    name:"Sony XM5",
    desc:"WH-1000XM5. 강한 100Hz 베이스 블룸 감소, 중역 복원, 6kHz 시빌런스 제거.",
    color:"#FF6040",
    bands: makeBands([-1.5,-3.0,-5.0,-5.5,-4.5,-2.5, 1.0, 2.5, 2.0, 1.5, 1.0, 0.5,-3.0, 2.0, 1.5])
  },
  {
    name:"Sony XM6",
    desc:"WH-1000XM6. XM5보다 개선된 튜닝, 가벼운 저역 보정으로 Harman 타겟 접근.",
    color:"#FF4060",
    bands: makeBands([-0.5,-1.5,-3.0,-3.5,-3.0,-1.5, 0.5, 1.5, 1.5, 1.0, 0.5, 1.0, 0.5, 2.5, 1.5])
  },
  {
    name:"Bose QC Ultra",
    desc:"Bose QuietComfort Ultra. 따뜻한 저역 감소, 중역 복원, 어두운 고역 개방.",
    color:"#2288CC",
    bands: makeBands([-0.5,-1.5,-3.0,-4.0,-3.5,-2.0, 0.0, 1.5, 1.5, 1.0, 1.0, 2.0, 3.0, 4.0, 2.0])
  },
  {
    name:"Bose 700",
    desc:"Bose Headphones 700. QC보다 중립적. 상단 중역 과잉 억제, 고역 에어 확보.",
    color:"#44AADD",
    bands: makeBands([ 0.0,-1.0,-2.0,-2.5,-2.0,-1.0, 0.0, 0.5, 0.5, 0.0,-1.0,-1.5, 1.0, 3.0, 1.5])
  },
  customPreset,
];

// ── 스피커 타입 맵 ───────────────────────────────────────
const SPEAKER_PRESETS = {
  speakers: { label:"스피커",   icon:"🔊", presets: SPEAKER_PRESETS_LIST  },
  headset:  { label:"헤드셋",   icon:"🎧", presets: HEADSET_PRESETS_LIST  },
  soundbar: { label:"사운드바", icon:"📻", presets: SOUNDBAR_PRESETS_LIST },
  devices:  { label:"기기별",   icon:"🎯", presets: DEVICE_PRESETS_LIST   },
};

let currentSpeakerType = 'speakers';
function getCurrentPresets() {
  return SPEAKER_PRESETS[currentSpeakerType].presets;
}

// ── EQ 수학 ──────────────────────────────────────────────
function peqResponse(freqs, fc, gain, q) {
  const A = Math.pow(10, gain/40), w0 = 2*Math.PI*fc;
  return freqs.map(f => {
    const w  = 2*Math.PI*f;
    const nR = w0*w0-w*w, nI = A*(w0/q)*w;
    const dR = w0*w0-w*w, dI = (w0/q)/A*w;
    return 20*Math.log10(Math.max(Math.sqrt(nR*nR+nI*nI)/Math.sqrt(dR*dR+dI*dI+1e-30),1e-12));
  });
}
function calcResponse(preset, freqs) {
  const total = new Array(freqs.length).fill(0);
  const src   = preset.isCustom ? customPreset.bands : preset.bands;
  for (const b of src) {
    if (Math.abs(b.gain) < 0.05) continue;
    const r = peqResponse(freqs, b.fc, b.gain, b.q);
    r.forEach((v,i) => { total[i] += v; });
  }
  return total;
}
function toAPOText(preset) {
  const src    = preset.isCustom ? customPreset.bands : preset.bands;
  const active = src.filter(b => Math.abs(b.gain) >= 0.1);
  if (!active.length) return `# SPATUNE — ${preset.name}\n\nPreamp: 0 dB\n`;
  const lines = [`# SPATUNE — ${preset.name}`, `# ${preset.desc}`, ``, `Preamp: -6 dB`, ``];
  active.forEach((b,i) => {
    const s = b.gain>=0?'+':'';
    lines.push(`Filter ${String(i+1).padStart(2)}: ON PK Fc ${b.fc.toFixed(1)} Hz Gain ${s}${b.gain.toFixed(2)} dB Q ${b.q.toFixed(3)}`);
  });
  return lines.join('\n');
}
