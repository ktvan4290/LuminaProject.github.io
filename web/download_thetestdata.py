"""
thetestdata.com FLAC 샘플 전체 다운로드 + 메타데이터 분석
"""
import urllib.request, os, struct

BASE    = "https://thetestdata.com/assets/audio/flac/"
SAVE    = os.path.join(os.path.dirname(__file__), "audio", "thetestdata")
os.makedirs(SAVE, exist_ok=True)

FILES   = [f"thetestdata-sample-flac-{i}.flac" for i in range(1, 17)]
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0"}

def download(name):
    dest = os.path.join(SAVE, name)
    if os.path.exists(dest) and os.path.getsize(dest) > 10000:
        return dest
    req = urllib.request.Request(BASE + name, headers=HEADERS)
    print(f"  다운로드: {name} ...", end=" ", flush=True)
    try:
        with urllib.request.urlopen(req, timeout=30) as r, open(dest, "wb") as f:
            f.write(r.read())
        print(f"완료 ({os.path.getsize(dest)//1024//1024} MB)")
        return dest
    except Exception as e:
        print(f"실패: {e}")
        return None

def parse_flac_info(path):
    """FLAC 스트림인포 블록에서 samplerate, channels, bits, total_samples 읽기"""
    try:
        with open(path, "rb") as f:
            if f.read(4) != b"fLaC":
                return None
            while True:
                hdr = f.read(4)
                if len(hdr) < 4:
                    break
                block_type = hdr[0] & 0x7F
                last = (hdr[0] & 0x80) != 0
                length = struct.unpack(">I", b"\x00" + hdr[1:4])[0]
                data = f.read(length)
                if block_type == 0:  # STREAMINFO
                    sr  = (struct.unpack(">I", data[10:14])[0] >> 12) & 0xFFFFF
                    ch  = ((data[12] >> 1) & 0x7) + 1
                    bps = ((data[12] & 0x1) << 4 | (data[13] >> 4)) + 1
                    ts  = struct.unpack(">Q", b"\x00\x00" + data[13:19])[0] & 0xFFFFFFFFF
                    ts  = (data[13] & 0x0F) << 32 | struct.unpack(">I", data[14:18])[0]
                    dur = ts / sr if sr else 0
                    return {"sr": sr, "ch": ch, "bps": bps, "dur": dur}
                if last:
                    break
    except Exception:
        pass
    return None

def get_tags(path):
    """mutagen으로 FLAC 태그 읽기"""
    try:
        from mutagen.flac import FLAC
        audio = FLAC(path)
        tags = audio.tags
        if not tags:
            return {}
        result = {}
        for key in ("title", "artist", "album", "genre", "comment", "description"):
            val = tags.get(key)
            if val:
                result[key] = str(val[0])
        return result
    except Exception:
        return {}

print("="*60)
print("thetestdata.com FLAC 샘플 분석")
print("="*60)

for name in FILES:
    num = name.split("-")[-1].split(".")[0]
    path = download(name)
    if not path:
        continue

    info = parse_flac_info(path)
    tags = get_tags(path)

    dur_str = ""
    spec_str = ""
    if info:
        m, s = divmod(int(info["dur"]), 60)
        dur_str = f"{m}:{s:02d}"
        spec_str = f"{info['sr']//1000}kHz / {info['bps']}bit / {'스테레오' if info['ch']==2 else str(info['ch'])+'ch'}"

    print(f"\n[Sample {num}]")
    print(f"  길이: {dur_str}  |  {spec_str}")
    if tags:
        for k, v in tags.items():
            print(f"  {k}: {v}")
    else:
        print("  태그 없음 (직접 들어봐야 확인 가능)")

print("\n\n저장 위치:", SAVE)
