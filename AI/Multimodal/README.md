# AI/Multimodal

UI와 연결되는 통합 추론 API 서버를 제공합니다. Image, Text, Video, Multimodal 분석 요청을 한 서버에서 받아 각 모델 번들을 호출합니다.

## 폴더 구조

```text
Multimodal/
├── inference/multimodal_inference_server.py
├── models/_service_runtime_bundle_v4b.pt
├── models/final8000_fusion_6slot_v1.json
└── README.md
```

## 주요 파일

- `inference/multimodal_inference_server.py`: HTTP API 서버. `/health`, `/analyze-text`, `/analyze-image`, `/analyze-video`, `/analyze`, `/explain`, `/explain-text` 등을 제공합니다.
- `models/_service_runtime_bundle_v4b.pt`: 런타임 feature/head/fusion 번들입니다.
- `models/final8000_fusion_6slot_v1.json`: 현재 웹 판정에 사용하는 최신 final8000 fusion 설정입니다.

## 최신 멀티모달 판정

현재 멀티모달 최종 판정은 `final8000_fusion_6slot_v1` 설정을 사용합니다.

- selected model: `mean4_with_avsync`
- 사용 분기: OpenCLIP, FLAVA, Frequency, AVSync
- validation accuracy: 0.894375
- test accuracy: 0.89125
- test ROC-AUC: 0.9542421875

AVSync는 final5000 재사용분과 final8000 중립 pending분이 섞인 재개 산출물 기반입니다. 공개/운영 품질로 확정하기 전에는 신규 final8000 AVSync 완전 재계산을 권장합니다.

## 공통 추론 흐름

1. 요청 타입에 따라 Text/Image/Video/Multimodal 분기.
2. 입력 파일 또는 URL을 임시 작업 폴더에 준비.
3. 모달리티별 모델 점수 계산.
4. 멀티모달 요청은 OpenCLIP, FLAVA, Frequency, AVSync 중심으로 final8000 fusion 점수 계산.
5. UI가 해석할 수 있는 XAI payload를 함께 반환.

## 현재 구현된 기능

- Text/Image/Video/Multimodal 분석 API
- Multimodal final8000 fusion 설정 연결
- Video 7-model ensemble API
- Image/Text 모델 번들 경로를 `AI/*/models` 구조로 참조

## 주의

XAI 결과는 모델 판단을 설명하기 위한 보조 신호입니다. 최종 사실 확인을 대체하지 않습니다.
