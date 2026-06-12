# I SEE YOU Chrome Extension

I SEE YOU 크롬 확장 프로그램은 웹페이지, 유튜브 썸네일, 영상 콘텐츠를 브라우저 안에서 빠르게 확인하기 위한 실시간 분석 인터페이스입니다. 이 폴더는 `ryujihos0105/isy-extention` 저장소의 최신 변경사항을 ISeeYou 본 프로젝트 구조에 맞게 통합한 버전입니다.

## 역할

- 현재 페이지의 이미지와 영상 후보 수집
- 유튜브 썸네일 및 영상 URL 분석 요청
- 데모 업로드 페이지 제공
- 로컬 FastAPI 서버와 통신해 Real/Fake 결과 표시
- 분석 결과를 배지, 패널, 오버레이 형태로 표시

## 폴더 구조

```text
Extension
├── extension/              # Chrome에서 로드하는 실제 확장 프로그램
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── content.css
│   ├── lib/
│   └── popup/
├── demo_platform/          # 업로드/브라우징/시청 데모 페이지
├── server.py               # 실제 분석 서버
├── mock_server.py          # UI 확인용 Mock 서버
├── video_inference.py      # 영상 추론 연결
├── versionv3/              # 이미지 모델 v3 런타임 코드
├── versionv12/             # 이미지 모델 v12 런타임 코드
└── requirements.txt
```

## 실행 순서

### 1. 의존성 설치

```bash
cd Extension
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 서버 실행

실제 모델 연결 서버:

```bash
python server.py
```

UI만 확인할 때:

```bash
python mock_server.py
```

### 3. 크롬 확장 로드

1. Chrome 주소창에 `chrome://extensions` 입력
2. 개발자 모드 활성화
3. `압축해제된 확장 프로그램 로드` 클릭
4. `Extension/extension` 폴더 선택
5. 코드 수정 후에는 확장 프로그램을 새로고침

## 모델 파일 배치

모델 가중치는 GitHub에 포함하지 않습니다. Hugging Face에서 내려받아 로컬에 배치해야 합니다.

- 이미지 v12: `Extension/versionv12/weights/`
- 이미지 v3: `Extension/versionv3/weights/`
- 영상 모델: `Extension/video/` 또는 `server.py`에서 지정한 로컬 경로

실제 배치 경로는 최상위 `README.md`와 `MODEL_ARTIFACTS.md`를 함께 확인하세요.

## 현재 구현된 기능

- 확장 팝업 UI
- 페이지 내 미디어 후보 탐지
- 유튜브 썸네일/영상 분석 흐름
- 업로드 데모 페이지
- Mock 서버와 실제 서버 분리
- v3/v12 이미지 런타임 코드 통합

## 주의사항

- `.env`, API key, token, DB, 모델 가중치는 GitHub에 올리지 않습니다.
- 유튜브 URL 분석은 플랫폼 정책과 네트워크 상태에 따라 실패할 수 있습니다.
- 확장 프로그램은 서버가 먼저 켜져 있어야 정상적으로 결과를 받을 수 있습니다.
