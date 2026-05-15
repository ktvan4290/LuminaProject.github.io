// SPATUNE Web — main.js

// ── 테마 관리 ──────────────────────────────────────────────
function getCanvasColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    bg:        s.getPropertyValue('--canvas-bg').trim()    || '#080A0D',
    grid:      s.getPropertyValue('--canvas-grid').trim()  || '#111A24',
    zero:      s.getPropertyValue('--canvas-zero').trim()  || '#2A3B4D',
    label:     s.getPropertyValue('--canvas-label').trim() || '#406070',
    cyan:      s.getPropertyValue('--cyan').trim()         || '#00D4E8',
    text3:     s.getPropertyValue('--text3').trim()        || '#406070',
  };
}

function setTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('spatune-theme', name);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === name);
  });
  drawEQ();
}

function initTheme() {
  const saved = localStorage.getItem('spatune-theme') || 'dark';
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === saved);
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });
}

const FREQ_COUNT = 600;
const graphFreqs = (() => {
  const a=[], lo=Math.log10(20), hi=Math.log10(20000);
  for (let i=0; i<FREQ_COUNT; i++)
    a.push(Math.pow(10, lo + i*(hi-lo)/(FREQ_COUNT-1)));
  return a;
})();

let currentPreset = SPEAKER_PRESETS.speakers.presets[0];
let dragBandIdx = -1, dragStartY = 0, dragStartGain = 0;

// ── DOM refs ──────────────────────────────────────────────
const canvas      = document.getElementById('eqCanvas');
const ctx         = canvas.getContext('2d');
const copyBtn     = document.getElementById('copyBtn');
const copyStatus  = document.getElementById('copyStatus');
const btnNoise    = document.getElementById('btnNoise');
const btnSweep    = document.getElementById('btnSweep');
const btnStop     = document.getElementById('btnStop');
const eqToggle    = document.getElementById('eqToggle');
const testStatus  = document.getElementById('testStatus');
const fileInput   = document.getElementById('fileInput');
const btnPlayFile = document.getElementById('btnPlayFile');
const volumeSlider= document.getElementById('volumeSlider');
const volumeLabel = document.getElementById('volumeLabel');
const rightPanel  = document.getElementById('rightPanel');

// ── 그래프 좌표 ───────────────────────────────────────────
const PAD = {t:20, r:14, b:32, l:44};
function getPlotDims() {
  return { W:canvas.width, H:canvas.height,
    pw:canvas.width-PAD.l-PAD.r, ph:canvas.height-PAD.t-PAD.b };
}
const xOf = f => {
  const {pw} = getPlotDims();
  return PAD.l + (Math.log10(f)-Math.log10(20))/(Math.log10(20000)-Math.log10(20))*pw;
};
const yOf = (db,ph) => {
  const DB_MIN=-14, DB_MAX=14;
  return PAD.t + (1-(db-DB_MIN)/(DB_MAX-DB_MIN))*ph;
};

// ── 볼륨 슬라이더 ─────────────────────────────────────────
function applyVolume(v) {
  const gain = v / 100 * 0.9;
  audioEngine._volumeValue = gain;
  volumeLabel.textContent = v + '%';
  if (audioEngine._masterGain) audioEngine._masterGain.gain.value = gain;
}
volumeSlider.addEventListener('input', () => applyVolume(parseInt(volumeSlider.value)));
applyVolume(parseInt(volumeSlider.value)); // 페이지 로드 시 초기값 적용

// ── 스피커 타입 탭 ────────────────────────────────────────
function renderSpeakerTabs() {
  const bar = document.getElementById('speakerTypeBar');
  bar.innerHTML = '';
  Object.entries(SPEAKER_PRESETS).forEach(([key, info]) => {
    const btn = document.createElement('button');
    btn.className = 'stype-btn' + (key === currentSpeakerType ? ' active' : '');
    btn.innerHTML = `${info.icon}<span>${info.label}</span>`;
    btn.addEventListener('click', () => {
      currentSpeakerType = key;
      currentPreset = getCurrentPresets()[0];
      renderSpeakerTabs();
      renderPresetList();
      renderRightPanel();
      drawEQ();
    });
    bar.appendChild(btn);
  });
}

// ── 프리셋 목록 ───────────────────────────────────────────
function renderPresetList() {
  const list = document.getElementById('presetList');
  list.innerHTML = '';
  getCurrentPresets().forEach(p => {
    const li = document.createElement('li');
    li.className = 'preset-item' + (p === currentPreset ? ' active' : '');
    li.innerHTML = `
      <span class="preset-dot" style="background:${p.color}"></span>
      <div class="preset-info">
        <div class="preset-name">${p.name}${p.isCustom?'<span class="custom-badge">15밴드</span>':''}</div>
        <div class="preset-desc">${p.desc}</div>
      </div>`;
    li.addEventListener('click', () => {
      currentPreset = p;
      renderPresetList();
      renderRightPanel();
      drawEQ();
      // 재생 중이면 EQ 체인 즉시 교체 (소스 끊김 없음)
      if (audioEngine.isPlaying) {
        audioEngine.liveUpdateEQ(p.isCustom ? customPreset.bands : p.bands);
        setTestStatus(`프리셋 변경: ${p.name}`);
      }
    });
    list.appendChild(li);
  });
}

// ── 오른쪽 패널 라우팅 ────────────────────────────────────
function renderRightPanel() {
  currentPreset.isCustom ? renderCustomSliders() : renderBandTable();
}

function renderBandTable() {
  rightPanel.innerHTML = '';
  const hdr = document.createElement('div');
  hdr.className = 'panel-header'; hdr.textContent = 'EQ BANDS';
  rightPanel.appendChild(hdr);
  const wrap = document.createElement('div');
  wrap.className = 'band-wrap';
  if (!currentPreset.bands.length) {
    wrap.innerHTML = '<table class="band-table"><tbody><tr><td colspan="3" class="no-bands">보정 없음 (평탄)</td></tr></tbody></table>';
  } else {
    const rows = currentPreset.bands.map(b => {
      const fc = b.fc>=1000?`${(b.fc/1000).toFixed(1)}kHz`:`${b.fc}Hz`;
      const s  = b.gain>=0?'+':'';
      const c  = b.gain>0?'#00D4E8':b.gain<0?'#FF6B35':'#406070';
      return `<tr><td class="band-fc">${fc}</td>
        <td class="band-gain" style="color:${c}">${s}${b.gain.toFixed(1)} dB</td>
        <td class="band-q">${b.q.toFixed(2)}</td></tr>`;
    }).join('');
    wrap.innerHTML = `<table class="band-table"><tbody>
      <tr class="band-header"><th>주파수</th><th>게인</th><th>Q</th></tr>
      ${rows}</tbody></table>`;
  }
  rightPanel.appendChild(wrap);
  renderBalanceSection(rightPanel);
}

// ── 커스텀 EQ 15밴드 슬라이더 ────────────────────────────
function renderCustomSliders() {
  rightPanel.innerHTML = '';

  const hdr = document.createElement('div');
  hdr.className = 'panel-header';
  hdr.innerHTML = 'CUSTOM EQ <span class="hdr-hint">그래프 드래그 or 슬라이더</span>';
  rightPanel.appendChild(hdr);

  // 초기화 버튼
  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn-reset-custom';
  resetBtn.textContent = '초기화 (전체 0dB)';
  resetBtn.addEventListener('click', () => {
    customPreset.bands.forEach(b => b.gain = 0);
    renderCustomSliders();
    drawEQ();
  });
  rightPanel.appendChild(resetBtn);

  // 15밴드 슬라이더 컨테이너
  const wrap = document.createElement('div');
  wrap.className = 'custom-eq-wrap';

  customPreset.bands.forEach((b, i) => {
    const fc = b.fc>=1000 ? `${(b.fc/1000).toFixed(0)}k` : `${b.fc}`;
    const g  = b.gain;
    const col= g>0?'#00D4E8':g<0?'#FF6B35':'#606870';

    const col_el = document.createElement('div');
    col_el.className = 'ceq-col';
    col_el.innerHTML = `
      <div class="ceq-val" id="cv${i}" style="color:${col}">${g>=0?'+':''}${g.toFixed(1)}</div>
      <div class="ceq-track">
        <input type="range" class="ceq-slider" id="cs${i}"
               min="-12" max="12" step="0.5" value="${g}">
      </div>
      <div class="ceq-fc">${fc}</div>`;
    wrap.appendChild(col_el);
  });
  rightPanel.appendChild(wrap);

  // 슬라이더 이벤트
  customPreset.bands.forEach((b, i) => {
    document.getElementById(`cs${i}`).addEventListener('input', e => {
      b.gain = parseFloat(e.target.value);
      const g = b.gain;
      const c = g>0?'#00D4E8':g<0?'#FF6B35':'#606870';
      const vl = document.getElementById(`cv${i}`);
      vl.style.color = c;
      vl.textContent = (g>=0?'+':'')+g.toFixed(1);
      drawEQ();
      // 재생 중이면 즉시 EQ 반영
      if (audioEngine.isPlaying && currentPreset.isCustom) {
        audioEngine.liveUpdateEQ(customPreset.bands);
      }
    });
  });

  renderBalanceSection(rightPanel);
}

// ── 밸런스 섹션 ───────────────────────────────────────────
function renderBalanceSection(parent) {
  const sec = document.createElement('div');
  sec.className = 'balance-section';
  sec.innerHTML = `
    <div class="balance-header">
      STEREO BALANCE
      <button class="btn-bal-reset" id="btnBalReset" title="중앙으로">⟳</button>
    </div>
    <div class="balance-slider-row">
      <span class="bal-ch">L</span>
      <input type="range" id="balSlider" min="-100" max="100" value="0">
      <span class="bal-ch">R</span>
    </div>
    <div class="balance-viz">
      <span class="bal-ch-label">L</span>
      <div class="bal-bar-wrap"><div class="bal-bar-l" id="balLeft"  style="width:100%"></div></div>
      <div class="bal-bar-wrap"><div class="bal-bar-r" id="balRight" style="width:100%"></div></div>
      <span class="bal-ch-label">R</span>
    </div>
    <div id="balLabel">중앙</div>
    <div class="bal-test-row">
      <button class="btn btn-sm" id="btnBalL">◀ Left</button>
      <button class="btn btn-sm" id="btnBalBoth">Center</button>
      <button class="btn btn-sm" id="btnBalR">Right ▶</button>
    </div>`;
  parent.appendChild(sec);

  document.getElementById('balSlider').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    updateBalanceUI(v);
    audioEngine.setBalance(v/100);
  });
  document.getElementById('btnBalReset').addEventListener('click', () => {
    document.getElementById('balSlider').value = 0;
    updateBalanceUI(0);
    audioEngine.setBalance(0);
  });
  document.getElementById('btnBalL').addEventListener('click', async () => {
    if (audioEngine.isPlaying && audioEngine.currentMode==='balance_left') {
      audioEngine.stop(); setTestStatus('정지'); updateTestUI(); return;
    }
    setTestStatus('◀ Left Sound 준비 중...');
    await audioEngine.playBalanceTest('left');
    setTestStatus('◀ Left Sound — 왼쪽 채널');
    updateTestUI();
    window._onBalanceTestEnd = () => { setTestStatus('완료'); updateTestUI(); };
  });
  document.getElementById('btnBalR').addEventListener('click', async () => {
    if (audioEngine.isPlaying && audioEngine.currentMode==='balance_right') {
      audioEngine.stop(); setTestStatus('정지'); updateTestUI(); return;
    }
    setTestStatus('▶ Right Sound 준비 중...');
    await audioEngine.playBalanceTest('right');
    setTestStatus('▶ Right Sound — 오른쪽 채널');
    updateTestUI();
    window._onBalanceTestEnd = () => { setTestStatus('완료'); updateTestUI(); };
  });
  document.getElementById('btnBalBoth').addEventListener('click', async () => {
    if (audioEngine.isPlaying && audioEngine.currentMode==='balance_both') {
      audioEngine.stop(); setTestStatus('정지'); updateTestUI(); return;
    }
    setTestStatus('Center Sound 준비 중...');
    await audioEngine.playBalanceTest('both');
    setTestStatus('◀▶ Center Sound — 양쪽 채널');
    updateTestUI();
    window._onBalanceTestEnd = () => { setTestStatus('완료'); updateTestUI(); };
  });
}

function updateBalanceUI(val) {
  const lbl=document.getElementById('balLabel');
  const bl=document.getElementById('balLeft');
  const br=document.getElementById('balRight');
  if (!lbl) return;
  lbl.textContent = val===0?'중앙':val<0?`L ${Math.abs(val)}%`:`R ${val}%`;
  lbl.style.color = val===0?'#C0CED8':val<0?'#4AE8A0':'#FFD700';
  if (bl) bl.style.width = (val<=0?100:100-val)+'%';
  if (br) br.style.width = (val>=0?100:100+val)+'%';
}

// ── EQ 커브 그리기 ────────────────────────────────────────
function drawEQ() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const {W,H,pw,ph} = getPlotDims();
  const DB_MIN=-14, DB_MAX=14;
  const C = getCanvasColors();

  ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);

  // 수평 그리드
  [-12,-9,-6,-3,0,3,6,9,12].forEach(db=>{
    ctx.beginPath();
    ctx.strokeStyle = db===0 ? C.zero : C.grid;
    ctx.lineWidth   = db===0 ? 1.5 : 1;
    ctx.setLineDash(db===0 ? [] : [4,4]);
    ctx.moveTo(PAD.l,yOf(db,ph)); ctx.lineTo(PAD.l+pw,yOf(db,ph));
    ctx.stroke(); ctx.setLineDash([]);
    if (db%6===0){
      ctx.fillStyle=C.label; ctx.font='10px "Segoe UI",sans-serif';
      ctx.textAlign='right';
      ctx.fillText(db+'dB', PAD.l-5, yOf(db,ph)+3.5);
    }
  });

  // 수직 그리드
  [20,50,100,200,500,1000,2000,5000,10000,20000].forEach(f=>{
    ctx.beginPath(); ctx.strokeStyle=C.grid; ctx.lineWidth=1;
    ctx.moveTo(xOf(f),PAD.t); ctx.lineTo(xOf(f),PAD.t+ph); ctx.stroke();
    ctx.fillStyle=C.label; ctx.font='10px "Segoe UI",sans-serif';
    ctx.textAlign='center';
    ctx.fillText(f>=1000?(f/1000)+'k':String(f), xOf(f), H-6);
  });

  // 배경 프리셋
  getCurrentPresets().forEach(p=>{
    if (p===currentPreset || !p.bands.length) return;
    const resp=calcResponse(p,graphFreqs);
    ctx.beginPath();
    graphFreqs.forEach((f,i)=>{
      const x=xOf(f), y=yOf(Math.max(DB_MIN,Math.min(DB_MAX,resp[i])),ph);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.strokeStyle=p.color+'1A'; ctx.lineWidth=1; ctx.stroke();
  });

  // ── 실시간 스펙트럼 (EQ 커브 아래에 그려 구분됨) ─────────
  if (typeof spectrumAnalyzer !== 'undefined') {
    spectrumAnalyzer.drawOverlay(ctx, W, H, PAD, currentPreset.color || '#00D4E8');
  }

  // 현재 프리셋 커브
  const resp=calcResponse(currentPreset,graphFreqs);
  if (currentPreset.bands.length>0){
    ctx.beginPath();
    graphFreqs.forEach((f,i)=>{
      const x=xOf(f), y=yOf(Math.max(DB_MIN,Math.min(DB_MAX,resp[i])),ph);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.lineTo(xOf(graphFreqs[graphFreqs.length-1]),yOf(0,ph));
    ctx.lineTo(xOf(graphFreqs[0]),yOf(0,ph));
    ctx.closePath();
    ctx.fillStyle=currentPreset.color+'14'; ctx.fill();
  }
  ctx.beginPath();
  graphFreqs.forEach((f,i)=>{
    const db=currentPreset.bands.length>0?Math.max(DB_MIN,Math.min(DB_MAX,resp[i])):0;
    i===0?ctx.moveTo(xOf(f),yOf(db,ph)):ctx.lineTo(xOf(f),yOf(db,ph));
  });
  ctx.strokeStyle=currentPreset.color; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.stroke();

  // 마커 — 모든 프리셋 공통으로 |gain| >= 0.5 인 밴드만 표시
  const markSrc = currentPreset.isCustom ? customPreset.bands : currentPreset.bands;
  const marks = markSrc.filter(b => Math.abs(b.gain) >= 0.5);

  marks.forEach(b=>{
    const x=xOf(b.fc), y=yOf(Math.max(DB_MIN,Math.min(DB_MAX,b.gain)),ph);
    ctx.beginPath(); ctx.setLineDash([3,3]);
    ctx.strokeStyle=currentPreset.color+'40'; ctx.lineWidth=1;
    ctx.moveTo(x,yOf(0,ph)); ctx.lineTo(x,y);
    ctx.stroke(); ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(x,y,currentPreset.isCustom?7:5,0,Math.PI*2);
    ctx.fillStyle=currentPreset.color+(currentPreset.isCustom?'BB':'');
    ctx.fill(); ctx.strokeStyle='#080A0D'; ctx.lineWidth=1.5; ctx.stroke();

    if (!currentPreset.isCustom){
      const fc=b.fc>=1000?`${(b.fc/1000).toFixed(1)}k`:`${b.fc}`;
      const s=b.gain>=0?'+':''; const above=b.gain>=0;
      ctx.fillStyle=currentPreset.color; ctx.font='bold 11px "Segoe UI",sans-serif';
      ctx.textAlign='center';
      ctx.fillText(fc, x, above?y-16:y+20);
      ctx.fillText(s+b.gain.toFixed(1)+'dB', x, above?y-4:y+32);
    }
  });

  if (currentPreset.isCustom){
    ctx.fillStyle=C.label; ctx.font='11px "Segoe UI",sans-serif'; ctx.textAlign='center';
    ctx.fillText('밴드를 드래그해서 게인 조절', W/2, PAD.t+14);
  }

}

// ── 커스텀 EQ 드래그 ──────────────────────────────────────
function getBandAt(mx, my) {
  if (!currentPreset.isCustom) return -1;
  const {ph} = getPlotDims();
  for (let i=0; i<customPreset.bands.length; i++){
    const b=customPreset.bands[i];
    const x=xOf(b.fc), y=yOf(Math.max(-14,Math.min(14,b.gain)),ph);
    if (Math.abs(mx-x)<12 && Math.abs(my-y)<12) return i;
  }
  return -1;
}

canvas.addEventListener('mousedown', e=>{
  if (!currentPreset.isCustom) return;
  const r=canvas.getBoundingClientRect();
  const idx=getBandAt(e.clientX-r.left, e.clientY-r.top);
  if (idx>=0){ dragBandIdx=idx; dragStartY=e.clientY-r.top; dragStartGain=customPreset.bands[idx].gain; canvas.style.cursor='ns-resize'; e.preventDefault(); }
});
canvas.addEventListener('mousemove', e=>{
  if (!currentPreset.isCustom) return;
  const r=canvas.getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top;
  if (dragBandIdx>=0){
    const {ph}=getPlotDims();
    const delta=-(my-dragStartY)*(28/ph);
    customPreset.bands[dragBandIdx].gain=Math.max(-12,Math.min(12,Math.round((dragStartGain+delta)*2)/2));
    syncCustomSlider(dragBandIdx); drawEQ();
    if (audioEngine.isPlaying && currentPreset.isCustom) {
      audioEngine.liveUpdateEQ(customPreset.bands);
    }
  } else { canvas.style.cursor=getBandAt(mx,my)>=0?'ns-resize':'default'; }
});
canvas.addEventListener('mouseup', ()=>{ dragBandIdx=-1; canvas.style.cursor='default'; });
canvas.addEventListener('mouseleave', ()=>{ dragBandIdx=-1; });

function syncCustomSlider(i){
  const sl=document.getElementById(`cs${i}`), vl=document.getElementById(`cv${i}`);
  if (!sl) return;
  const g=customPreset.bands[i].gain;
  sl.value=g;
  const c=g>0?'#00D4E8':g<0?'#FF6B35':'#606870';
  if (vl){ vl.style.color=c; vl.textContent=(g>=0?'+':'')+g.toFixed(1); }
}

// ── 테스트 상태 ───────────────────────────────────────────
function setTestStatus(msg, ok=true){
  testStatus.textContent=msg; testStatus.style.color=ok?'#00D4E8':'#FF6B35';
}
function updateTestUI(){
  const m=audioEngine.currentMode;
  btnStop.disabled=!audioEngine.isPlaying;
  btnNoise.style.color    = m==='noise'?'#00D4E8':'';
  btnSweep.style.color    = m==='sweep'?'#00D4E8':'';
  btnPlayFile.style.color = m==='file' ?'#00D4E8':'';
  ['left','right','both'].forEach(ch=>{
    const el=document.getElementById(`btnBal${ch.charAt(0).toUpperCase()+ch.slice(1)}`);
    if(el) el.style.color = m==='balance_'+ch?'#FFD700':'';
  });
  eqToggle.textContent=`EQ ${audioEngine.eqEnabled?'ON ✓':'OFF ✗'}`;
  eqToggle.style.color=audioEngine.eqEnabled?'#00D4E8':'#FF6B35';
}

// ── 테스트 버튼 ───────────────────────────────────────────
btnNoise.addEventListener('click',()=>{
  if (audioEngine.isPlaying && audioEngine.currentMode==='noise'){
    audioEngine.stop(); setTestStatus('정지'); updateTestUI(); return;
  }
  audioEngine.playPinkNoise(currentPreset.bands);
  setTestStatus('♪ 핑크 노이즈 재생 중'); updateTestUI();
});
btnSweep.addEventListener('click',()=>{
  if (audioEngine.isPlaying && audioEngine.currentMode==='sweep'){
    audioEngine.stop(); setTestStatus('정지'); updateTestUI(); return;
  }
  audioEngine.playSweep(currentPreset.bands,8);
  setTestStatus('♪ 주파수 스윕 20Hz→20kHz'); updateTestUI();
  window._onSweepEnd=()=>{ setTestStatus('스윕 완료'); updateTestUI(); };
});
btnStop.addEventListener('click',()=>{
  audioEngine.stop(); setTestStatus('정지'); updateTestUI();
});
eqToggle.addEventListener('click',()=>{
  const on=audioEngine.toggleEQ();
  updateTestUI();
  setTestStatus(on?'EQ ON — 보정 적용됨':'EQ OFF — 원음 비교 중', on);
});

// ── 음원 파일 ─────────────────────────────────────────────
const fileLabel = document.getElementById('fileLabel');
fileInput.addEventListener('change', async e=>{
  const file=e.target.files[0]; if(!file) return;
  setTestStatus('파일 로딩 중...');
  try {
    await audioEngine.loadFile(file);
    btnPlayFile.disabled=false;
    if(fileLabel) fileLabel.textContent = file.name;
    setTestStatus(`로드됨: ${file.name}`);
  } catch(err){ setTestStatus('파일 로드 실패 (mp3/wav/ogg 지원)',false); }
});
btnPlayFile.addEventListener('click',()=>{
  if (audioEngine.isPlaying && audioEngine.currentMode==='file'){
    audioEngine.stop(); setTestStatus('정지'); updateTestUI(); return;
  }
  if (!audioEngine.hasFile) return;
  const ok=audioEngine.playFile(currentPreset.bands);
  if(ok){ setTestStatus('♪ 음원 재생 중'); updateTestUI(); window._onFileEnd=()=>{ setTestStatus('재생 완료'); updateTestUI(); }; }
});

// ── 클립보드 ─────────────────────────────────────────────
copyBtn.addEventListener('click',()=>{
  navigator.clipboard.writeText(toAPOText(currentPreset)).then(()=>{
    copyStatus.textContent='복사됨 ✓'; copyStatus.style.color='#00D4E8';
    setTimeout(()=>{ copyStatus.textContent=''; },2500);
  }).catch(()=>{ copyStatus.textContent='복사 실패'; copyStatus.style.color='#FF6B35'; });
});

// ── 기본 음원 로드 (Coca-Cola) ────────────────────────────
const DEFAULT_AUDIO = 'audio/test_tracks/THX - Always Coca-Cola.mp3';
(async () => {
  try {
    await audioEngine.loadFromUrl(DEFAULT_AUDIO);
    btnPlayFile.disabled = false;
    if (fileLabel) fileLabel.textContent = 'Always Coca-Cola';
    setTestStatus('기본 음원 로드 완료 — ▶ 재생 버튼 또는 스페이스바로 재생');
  } catch(e) {
    setTestStatus(`기본 음원 로드 실패: ${e.message}`, false);
  }
})();

// ── 효과 패널 연동 ────────────────────────────────────────
// effects 체인은 audio_test.js _init()에서 setupChain()으로 이미 연결됨
// 슬라이더가 직접 세터 호출

function _bindFx(id, valId, setter) {
  const slider = document.getElementById(id);
  const label  = document.getElementById(valId);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    if (label) label.textContent = v.toFixed(1);
    audioEngine._init();   // AudioContext + effects chain 초기화 (이미 있으면 no-op)
    setter(v);
  });
}

_bindFx('fxBass',     'fxValBass',     v => effectsEngine.setBass(v));
_bindFx('fxClarity',  'fxValClarity',  v => effectsEngine.setClarity(v));
_bindFx('fxVocal',    'fxValVocal',    v => effectsEngine.setVocal(v));
_bindFx('fxAmbiance', 'fxValAmbiance', v => effectsEngine.setAmbiance(v));
_bindFx('fxDynamics', 'fxValDynamics', v => effectsEngine.setDynamics(v));

document.getElementById('fxNormalize')?.addEventListener('change', e => {
  effectsEngine.setNormalize(e.target.checked);
});
document.getElementById('fxReset')?.addEventListener('click', () => {
  ['fxBass','fxClarity','fxVocal','fxAmbiance','fxDynamics'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = 0;
  });
  ['fxValBass','fxValClarity','fxValVocal','fxValAmbiance','fxValDynamics'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '0';
  });
  const norm = document.getElementById('fxNormalize');
  if (norm) norm.checked = false;
  effectsEngine.setBass(0); effectsEngine.setClarity(0);
  effectsEngine.setVocal(0); effectsEngine.setAmbiance(0);
  effectsEngine.setDynamics(0); effectsEngine.setNormalize(false);
});

// ── 스펙트럼 토글 ─────────────────────────────────────────
const spectrumToggle = document.getElementById('spectrumToggle');
let _spectrumRafId = null;

function _spectrumLoop() {
  if (audioEngine._ctx && audioEngine._masterGain && !spectrumAnalyzer._analyser) {
    spectrumAnalyzer.attach(audioEngine._ctx, audioEngine._masterGain);
  }
  drawEQ();
  if (spectrumAnalyzer.enabled) _spectrumRafId = requestAnimationFrame(_spectrumLoop);
}

if (spectrumToggle) {
  spectrumToggle.addEventListener('click', () => {
    const on = spectrumAnalyzer.toggle();
    spectrumToggle.textContent = on ? '📊 스펙트럼 ON' : '📊 스펙트럼';
    spectrumToggle.style.color = on ? 'var(--cyan)' : '';
    spectrumToggle.style.borderColor = on ? 'var(--cyan)' : '';
    if (on) {
      if (!_spectrumRafId) _spectrumRafId = requestAnimationFrame(_spectrumLoop);
    } else {
      if (_spectrumRafId) { cancelAnimationFrame(_spectrumRafId); _spectrumRafId = null; }
      drawEQ();
    }
  });
}

// ── 스페이스바 재생/정지 ──────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.code !== 'Space') return;
  // 입력창·버튼에서는 동작 안 함
  if (e.target.matches('input, textarea, button, select')) return;
  e.preventDefault();

  if (audioEngine.isPlaying) {
    audioEngine.stop();
    setTestStatus('⏸ 정지 (스페이스바)');
    updateTestUI();
  } else if (audioEngine.hasFile) {
    audioEngine.playFile(currentPreset.isCustom ? customPreset.bands : currentPreset.bands);
    setTestStatus('▶ 재생 중 (스페이스바)');
    updateTestUI();
    window._onFileEnd = () => { setTestStatus('재생 완료'); updateTestUI(); };
  } else {
    audioEngine.playPinkNoise(currentPreset.isCustom ? customPreset.bands : currentPreset.bands);
    setTestStatus('♪ 핑크 노이즈 (스페이스바)');
    updateTestUI();
  }
});

// ── 모바일 탭 (바텀시트) ──────────────────────────────────
const _mainEl = document.querySelector('.main');
let _activeTab = null;

function _closeMobPanel() {
  _activeTab = null;
  _mainEl.removeAttribute('data-tab');
  document.querySelectorAll('.mob-tab').forEach(b => b.classList.remove('active'));
  requestAnimationFrame(drawEQ);
}

document.querySelectorAll('.mob-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (_activeTab === tab) {
      _closeMobPanel();
    } else {
      _activeTab = tab;
      _mainEl.setAttribute('data-tab', tab);
      document.querySelectorAll('.mob-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      requestAnimationFrame(drawEQ);
    }
  });
});

// 패널 바깥 누르면 닫힘
document.getElementById('mobOverlay')?.addEventListener('click', _closeMobPanel);

// ── 리사이즈 & 초기화 ─────────────────────────────────────
new ResizeObserver(()=>drawEQ()).observe(canvas);
window.addEventListener('resize', ()=>requestAnimationFrame(drawEQ));
initTheme();
renderSpeakerTabs();
renderPresetList();
renderRightPanel();
updateBalanceUI(0);
updateTestUI();
requestAnimationFrame(drawEQ);
