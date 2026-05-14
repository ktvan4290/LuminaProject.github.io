# SPATUNE Web Edition

SPATUNE 데스크톱 앱의 간이 웹 버전.  
EQ 프리셋 커브 시각화 + 스테레오 밸런스 확인 + EqualizerAPO 설정 복사.

## GitHub Pages 배포 방법

1. 이 `web/` 폴더를 GitHub 레포지토리에 push
2. 레포 Settings → Pages → Source: `main` 브랜치 `/ (root)` 또는 `/docs` 선택
   - `web/` 폴더를 레포 루트에 올리거나 `docs/`로 이름 변경
3. 배포 완료 → `https://<username>.github.io/<repo>/` 접속

## 기능

| 기능 | 설명 |
|------|------|
| EQ 커브 | 6가지 프리셋 주파수 응답 그래프 |
| 밴드 수치 | 각 프리셋의 주파수/게인/Q 표시 |
| 밸런스 | 좌우 채널 볼륨 비율 시각화 |
| 클립보드 복사 | EqualizerAPO 호환 텍스트 생성 |

## 파일 구조

```
web/
├── index.html
├── css/style.css
├── js/
│   ├── presets.js   # EQ 프리셋 데이터 + 계산
│   └── main.js      # UI 로직
└── README.md
```
