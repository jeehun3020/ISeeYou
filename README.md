# I SEE YOU

**I SEE YOU: 보이지 않는 AI 흔적을 근거로 확인합니다.**

I SEE YOU는 텍스트, 이미지, 비디오, 멀티모달 입력을 분석해 AI 생성 가능성과 진위 판별 결과를 제공하는 설명 가능한 AI 콘텐츠 검증 시스템입니다. 단순히 Real/Fake 점수만 보여주는 것이 아니라, 모델이 어떤 입력 단서와 어떤 관계를 근거로 판단했는지 XAI 화면에서 함께 보여주는 것을 목표로 합니다.

> 주의: 본 시스템의 결과는 보조 판단 도구입니다. 최종 사실 확인, 법적 판단, 플랫폼 제재 판단을 대체하지 않습니다.

## 핵심 기능

| 영역 | 기능 |
|---|---|
| Text AI | 한국어 LOG-AID 계열 모델과 영어 DeBERTa 계열 모델을 사용해 AI 생성 텍스트 가능성을 분석합니다. 짧은 단어/문장은 판별하지 않고 더 긴 입력을 요청합니다. |
| Image AI | 전체 이미지의 RGB, FFT 주파수, 얼굴 단서를 함께 참고해 AI 생성 이미지 가능성을 분석합니다. 결과 화면은 얼굴 crop이 아니라 전체 원본 이미지 기준으로 표시합니다. |
| Video AI | 7개 비디오 프레임 모델 앙상블로 영상 생성 가능성을 분석합니다. 자막/워터마크 shortcut을 줄이기 위해 상단/하단 텍스트성 영역을 마스킹한 입력도 XAI에 표시합니다. |
| Multimodal AI | OpenCLIP, FLAVA, BLIP+NLI, AVSync, Frequency Fusion, SceneGraph GCN 계열 단서를 융합해 모달 간 정합성을 분석합니다. |
| Chrome Extension | 웹페이지/유튜브 환경에서 썸네일, 업로드 데모, 전체 영상 분석 흐름을 실시간 인터랙션 형태로 확인합니다. |
| Admin Dashboard | 사용자 분석 기록, 이벤트 로그, 리뷰/오류 분석, 통계 그래프를 확인합니다. |

## 프로젝트 구조

```text
ISeeYou/
├─ UI/                         # 사용자 웹 프론트엔드, Vite + React
├─ AI/
│  ├─ Image/                   # 이미지 모델 코드, 전처리, 설명 문서
│  ├─ Text/                    # 한국어/영어 텍스트 모델 연결 코드
│  ├─ Video/                   # 비디오 모델 관련 문서와 가중치 배치 위치
│  └─ Multimodal/              # 통합 추론 서버, 멀티모달 XAI, fusion 런타임
├─ Extension/                  # Chrome 확장 프로그램 및 로컬 확장 서버
├─ Admin/                      # 관리자 백엔드/프론트엔드
├─ MODEL_ARTIFACTS.md          # GitHub에 올리지 않는 모델 파일 관리 안내
├─ CLEANUP_NOTES.md            # 정리 기준과 archive 후보 기록
└─ README.md
```

## 실행 순서 요약

팀원이 새 PC에서 실행할 때는 아래 순서로 진행합니다.

1. GitHub에서 코드 받기
2. Hugging Face에서 모델 가중치 받기
3. 모델 파일을 로컬 경로에 배치하기
4. AI 백엔드 실행
5. 사용자 웹 실행
6. Chrome 확장 프로그램 실행
7. 필요하면 관리자 서버 실행

## 1. 코드 받기

```powershell
git clone https://github.com/jjyoon012-git/ISeeYou.git
cd ISeeYou
```

이미 받은 폴더가 있다면:

```powershell
cd <ISeeYou 프로젝트 루트>
git pull
```

`<ISeeYou 프로젝트 루트>`는 각자 clone한 로컬 폴더를 뜻합니다. 예를 들어 Windows에서는 `C:\Users\<사용자명>\Desktop\ISeeYou`일 수 있고, macOS에서는 `~/Projects/ISeeYou`일 수 있습니다.

## 2. 모델 가중치 받기

모델 가중치와 대용량 바이너리는 GitHub에 올리지 않습니다. 아래 Hugging Face 저장소에서 받습니다.

- Hugging Face: [yoonjeongah/ISeeYou-model-weights](https://huggingface.co/yoonjeongah/ISeeYou-model-weights)

```powershell
python -m pip install -U huggingface_hub
hf download yoonjeongah/ISeeYou-model-weights --repo-type model --local-dir .\_model_artifacts
```

모델 파일은 `.gitignore` 대상입니다. `.pt`, `.pth`, `.pkl`, `.bin`, `.zip`, `.env`, DB, 로그, 데이터셋은 GitHub에 커밋하지 않습니다.

## 3. 모델 파일 배치

다운로드한 `_model_artifacts` 안의 파일을 코드가 참조하는 위치로 복사합니다.

```powershell
cd <ISeeYou 프로젝트 루트>

# Text
New-Item -ItemType Directory -Force -Path "AI\Text\models\text_model_bundle" | Out-Null
Copy-Item "_model_artifacts\web\Text\LOG_AID_ko" "AI\Text\models\text_model_bundle\LOG_AID_ko" -Recurse -Force
Copy-Item "_model_artifacts\web\Text\DeBERTa_En" "AI\Text\models\text_model_bundle\DeBERTa_En" -Recurse -Force

# Image
New-Item -ItemType Directory -Force -Path "AI\Image\models\image_model_bundle\versionv12\weights" | Out-Null
Copy-Item "_model_artifacts\web\Image\versionv12\weights\best.pt" "AI\Image\models\image_model_bundle\versionv12\weights\best.pt" -Force

# Video
New-Item -ItemType Directory -Force -Path "AI\Video\models\video" | Out-Null
Copy-Item "_model_artifacts\web\Video\*" "AI\Video\models\video" -Recurse -Force

# Multimodal
New-Item -ItemType Directory -Force -Path "AI\Multimodal\models" | Out-Null
Copy-Item "_model_artifacts\web\Multimodal\_service_runtime_bundle_v4b.pt" "AI\Multimodal\models\_service_runtime_bundle_v4b.pt" -Force
Copy-Item "_model_artifacts\web\Multimodal\final8000_fusion_6slot_v1.json" "AI\Multimodal\models\final8000_fusion_6slot_v1.json" -Force
```

가중치 파일명이나 HF 구조가 바뀐 경우에는 `MODEL_ARTIFACTS.md`와 HF의 `model_manifest.json`을 먼저 확인하세요.

## 4. AI 백엔드 실행

```powershell
cd <ISeeYou 프로젝트 루트>
python AI\Multimodal\inference\multimodal_inference_server.py
```

기본 주소:

```text
http://127.0.0.1:8001
```

정상 확인:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health
```

## 5. 사용자 웹 실행

```powershell
cd <ISeeYou 프로젝트 루트>\UI
npm install
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

접속:

```text
http://127.0.0.1:5174
```

빌드 확인:

```powershell
cd <ISeeYou 프로젝트 루트>\UI
npm run build
```

`UI/vite.config.mjs`는 `/api/*` 요청을 관리자 저장 서버 `http://127.0.0.1:8787`로, `/multimodal-api/*` 요청을 AI 백엔드 `http://127.0.0.1:8001`로 전달합니다.

## 6. Chrome 확장 프로그램 실행

확장 프로그램 원본은 [ryujihos0105/isy-extention](https://github.com/ryujihos0105/isy-extention)을 기준으로 동기화했습니다.

### 확장 서버 실행

```powershell
cd <ISeeYou 프로젝트 루트>\Extension
python server.py
```

모델 없이 UI 흐름만 확인하려면:

```powershell
cd <ISeeYou 프로젝트 루트>\Extension
python mock_server.py
```

### Chrome에 로드

1. Chrome에서 `chrome://extensions` 열기
2. 개발자 모드 켜기
3. `압축해제된 확장 프로그램 로드` 클릭
4. 아래 폴더 선택

```text
<ISeeYou 프로젝트 루트>\Extension\extension
```

이미 로드한 뒤 코드가 바뀌었다면 확장 프로그램 화면에서 새로고침하고, 테스트 페이지도 다시 새로고침하세요.

## 7. 관리자 서버 실행

관리자는 사용자 분석 기록과 이벤트 로그를 확인하는 별도 대시보드입니다.

### 관리자 백엔드

```powershell
cd <ISeeYou 프로젝트 루트>\Admin\Backend
python storage_gateway_server.py
```

기본 주소:

```text
http://127.0.0.1:8787
```

정상 확인:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/api/health
```

### 관리자 프론트엔드

```powershell
cd <ISeeYou 프로젝트 루트>\Admin\Frontend\Admin
npm install
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

접속:

```text
http://127.0.0.1:5175
```

관리자 계정은 로컬 DB에 생성해야 합니다. 자세한 내용은 `Admin/README.md`를 확인하세요.

## XAI 화면 구성

| 화면 | 설명 방식 |
|---|---|
| Text | 문장 길이, 반복 표현, 문체 신호, 단어/문장 하이라이트, 관계 그래프를 통해 왜 AI 생성 신호가 강한지 설명합니다. |
| Image | 전체 이미지 위에 핵심 영역과 주파수 단서를 표시합니다. 얼굴 crop만 보여주지 않고 전체 원본 이미지 맥락을 유지합니다. |
| Video | 5초 이후 대표 프레임을 우선 사용하고, 자막/플랫폼 UI를 마스킹한 모델 입력 프레임을 함께 보여줍니다. |
| Multimodal | 모달별 사용 여부, 프레임 구간, 얼굴-입술, 입술-음성, 장면-텍스트, 주파수 관계를 정합/불일치 관점에서 설명합니다. |

## 현재 구현 상태

- 사용자 웹: Main, Text, Image, Video, Multimodal 분석 화면 구현
- XAI: 텍스트 전용 XAI, 이미지/비디오/멀티모달 결과 화면, 관계 기반 설명 카드 구현
- 백엔드: 단일 통합 추론 서버에서 Text/Image/Video/Multimodal API 제공
- 확장 프로그램: 데모 업로드, 썸네일 실시간 탐지, 전체 영상 분석 흐름 구현
- 관리자: 분석 목록, 이벤트 로그, 통계, 리뷰/오류 분석, 기록 삭제 기능 구현

## GitHub에 포함하지 않는 것

아래 항목은 보안/용량/재현성 문제 때문에 GitHub에 올리지 않습니다.

- `.env`, 토큰, 쿠키, 인증서, private key
- 모델 가중치: `.pt`, `.pth`, `.pkl`, `.bin`, `.safetensors`, `.onnx`
- 데이터셋, 수집 영상, 이미지, 학습 로그
- 로컬 DB와 관리자 저장소
- `node_modules`, `dist`, 캐시, 임시 파일

민감정보 파일이 필요하면 각자 로컬에서 생성하고, 공유가 필요한 모델은 Hugging Face를 사용하세요.

## 개발 메모

- 사용자 웹 포트: `5174`
- 관리자 웹 포트: `5175`
- 관리자 저장 서버 포트: `8787`
- AI 추론 서버 포트: `8001`
- 확장 서버 포트: 기본 `8000`

문제가 생기면 먼저 각 서버의 포트가 살아 있는지 확인하세요.

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/api/health
```
