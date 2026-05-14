# SPATUNE — Web Edition

실시간 EQ 커브 시각화 + 스펙트럼 분석기 + 스테레오 밸런스 테스트 + EqualizerAPO 내보내기.

## GitHub Pages 배포

1. 이 `web/` 폴더 안의 파일을 GitHub 레포지토리 **루트**에 업로드
2. Settings → Pages → Branch: `main`, Folder: `/ (root)` → Save
3. `https://<username>.github.io/<repo>/` 접속

## 기능

| 기능 | 설명 |
|------|------|
| **EQ 커브** | 15밴드 프리셋 주파수 응답 그래프 (배경에 카테고리 내 전체 프리셋 표시) |
| **실시간 스펙트럼** | 재생 중인 음원의 주파수 스펙트럼을 EQ 커브 위에 실시간 오버레이 |
| **프리셋 4종류** | 스피커 / 헤드셋 / 사운드바 / 기기별 (B&W, Sony, Bose, Soundis MV6 등) |
| **커스텀 EQ** | 15밴드 슬라이더 + 그래프 드래그 직접 조절 |
| **음원 재생** | 파일 선택 / 핑크 노이즈 / 주파수 스윕 (스페이스바로 재생·정지) |
| **스테레오 밸런스** | L/R 슬라이더 + 시각 바 + 채널별 테스트 음원 |
| **APO 내보내기** | EqualizerAPO 호환 텍스트 클립보드 복사 |
| **테마** | DARK / LIGHT / TACT (아크나이츠 스타일) |

## 파일 구조

```
web/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── presets.js       # EQ 프리셋 데이터 (15밴드 × 4카테고리)
│   ├── audio_test.js    # Web Audio 엔진 (EQ 필터, 밸런스, 스펙트럼)
│   ├── spectrum.js      # 실시간 스펙트럼 분석기
│   ├── audio_data.js    # 밸런스 테스트 음원 (base64 내장)
│   └── main.js          # UI 렌더링 및 이벤트 처리
├── audio/
│   ├── leftSound.wav    # 밸런스 테스트 (L)
│   ├── rightSound.wav   # 밸런스 테스트 (R)
│   ├── centerSound.wav  # 밸런스 테스트 (Center)
│   └── test_tracks/     # 테스트 음원 (THX 7개)
└── README.md
```
