# AI 오피스

자동화 군단 본부 — 일꾼 상태·업무 보드를 한 화면에서 보는 웹 프로그램.  
화면은 `status.json` / `board.json`만 읽어서 **토큰 0**.

## 실행

```bash
cd /workspace/ai-office
python3 server.py
```

브라우저에서 http://localhost:8800  
ChatGPT 로그인 버튼 → OAuth 미설정이면 **데모 로그인**으로 입장.

## 일꾼 상태 바꾸기

```bash
python3 update_status.py planner working "바이럴 릴스 분석 중"
python3 update_status.py planner idle
python3 update_status.py --list
python3 update_status.py --channel youtube shorts=5 posts=0
python3 update_status.py --revenue youtube=12000 coupang=3500
python3 update_status.py --free-jobs +1
```

5초 안에 화면에 반영됩니다.

## 업무 보드판

```bash
python3 update_board.py list
python3 update_board.py add doing youtube "경제 쇼츠 3편 렌더"
python3 update_board.py move c-xxxxxxxx review
python3 update_board.py done c-xxxxxxxx
python3 update_board.py remove c-xxxxxxxx
```

칸: `todo` | `doing` | `review` | `done`

## 일꾼 (최종)

팀장 · 기획자 · 마케터 · 블로그 자동발행 · 유튜브 자동발행 ·  
스레드 쿠팡파트너스 · 인스타 쿠팡파트너스 · 아트 인스타그램 · 태계

## 파일

| 파일 | 역할 |
|------|------|
| `index.html` `style.css` `app.js` | UI |
| `server.py` | 포트 8800 서빙 |
| `status.json` | 일꾼·채널·수익 |
| `board.json` | 칸반 카드 |
| `update_status.py` | 상태 CLI |
| `update_board.py` | 보드 CLI |
| `config.json` | OpenAI OAuth 자리 (비어 있으면 데모) |

## GitHub Pages (모바일)
- 공개 주소: https://atrox42.github.io/ai-office/  (repo: https://github.com/atrox42/ai-office)
- `sync_pages.sh`: status.json/board.json이 바뀌었을 때만 커밋·푸시 (LLM 없음).
- 백그라운드 루프: `nohup bash -c 'while true; do ./sync_pages.sh; sleep 180; done' > logs/sync.log 2>&1 &`
- 즉시 반영: `AI_OFFICE_SYNC=1 python3 update_status.py ...` / `update_board.py ...`
- Pages 반영엔 push 후 ~1분 걸림. 공개 저장소이므로 비밀 정보 넣지 말 것.
