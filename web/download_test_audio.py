"""
SPATUNE 테스트 음원 다운로더
sinan.ussakli.net 에서 THX 테스트 파일 MP3 다운로드
(FLAC은 Demolandia 광고 차단 문제로 MP3 대체)
"""
import urllib.request
import os

BASE = "https://sinan.ussakli.net/basstest/"
SAVE_DIR = os.path.join(os.path.dirname(__file__), "audio", "test_tracks")
os.makedirs(SAVE_DIR, exist_ok=True)

TRACKS = {
    "THX - Always Coca-Cola.mp3":       "THX%20-%20Always%20Coca-Cola(Commercial).mp3",
    "THX - Audience Is Listening.mp3":  "THX%20-%20The%20Audience%20Is%20Listening.mp3",
    "THX - Orchestral Test.mp3":        "THX%20-%20Orchestral%20Sound%20Test.mp3",
    "THX - Ultimate Subwoofer.mp3":     "THX%20-%20Bass%20Test%20-%20Ultimate%20Subwoofer%20Test.mp3",
    "THX - Dolby Sound Effects.mp3":    "THX%20-%20Dolby%20Sound%20Effects.mp3",
    "THX - Air Raid Surround.mp3":      "THX%20-%20Air%20Raid%20Surround%20Sound%20Test.mp3",
    "THX - Jurassic Lunch.mp3":         "THX%20-%20Jurassic%20Lunch%20(Major%20Bass).mp3",
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
}

print(f"저장 위치: {SAVE_DIR}\n")
for save_name, url_name in TRACKS.items():
    url  = BASE + url_name
    dest = os.path.join(SAVE_DIR, save_name)
    if os.path.exists(dest):
        print(f"이미 있음: {save_name}")
        continue
    try:
        req = urllib.request.Request(url, headers=headers)
        print(f"다운로드 중: {save_name} ...", end=" ", flush=True)
        with urllib.request.urlopen(req, timeout=30) as r, open(dest, "wb") as f:
            f.write(r.read())
        size_kb = os.path.getsize(dest) // 1024
        print(f"완료 ({size_kb} KB)")
    except Exception as e:
        print(f"실패: {e}")

print("\n완료! SoundTuning/web/audio/test_tracks/ 에서 확인하세요.")
