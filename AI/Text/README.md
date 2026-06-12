# AI/Text

텍스트 AI 생성물 탐지 모델과 텍스트 전용 XAI를 관리하는 영역입니다. 한국어와 영어 텍스트를 각각 별도 모델로 분석하고, 결과 화면에서는 문장 단위 근거와 표현 패턴을 함께 보여줍니다.

## 폴더 구조

```text
AI/Text
├── models/
│   └── text_model_bundle/
│       ├── LOG_AID_ko/
│       └── DeBERTa_En/
└── README.md
```

## 현재 연결 상태

- 한국어: `models/text_model_bundle/LOG_AID_ko`
- 영어: `models/text_model_bundle/DeBERTa_En`
- API 연결: `AI/Multimodal/inference/multimodal_inference_server.py`의 `/analyze-text`
- 화면 연결: `UI/src/App.tsx`의 Text 분석 화면

한국어 모델은 4bit 피처 추가 버전의 LOG-AID 번들을 기준으로 정리했습니다. 이전 한국어 모델의 `main.py`, `logistic_regression.pkl`, `standard_scaler.pkl` 구조는 더 이상 사용하지 않습니다.

## 입력 형식

- 직접 입력한 텍스트
- `.txt` 파일 업로드

너무 짧은 문장이나 단어만 입력된 경우에는 신뢰도 있는 판별이 어렵기 때문에, 분석을 진행하지 않고 더 긴 문장을 요청하도록 구성되어 있습니다.

## 출력 형식

- 최종 판정: Real 또는 Fake
- Real/Fake 확률
- 모델별 신호 요약
- 문장 span 단위 설명
- 표현 패턴, 반복, 길이, 문체 일관성 등 텍스트 전용 XAI 신호

## XAI 설명 방식

텍스트 XAI는 이미지나 영상처럼 시각 영역을 강조하는 방식이 아니라, 문장과 표현의 구조를 해석하는 방식으로 구성합니다.

- 문장별 탐지 신호: 어떤 문장이 판단에 더 크게 영향을 주었는지 표시
- 표현 패턴: 반복 표현, 과도하게 정돈된 문체, 근거 문장 부족 여부를 설명
- 관계 지도: 같은 문장 안에서 함께 작용한 표현과 태그를 묶어 설명
- 해석 가이드: XAI 신호가 모델의 보조 설명이며 AI 생성의 직접 증거는 아니라는 점을 함께 안내

## 현재 구현된 기능

- 한국어 LOG-AID 기반 텍스트 탐지
- 영어 DeBERTa 기반 텍스트 탐지
- 짧은 입력 차단
- 텍스트 전용 XAI 화면
- 모델 판정과 결과 문구의 Real/Fake 방향 일치

## 향후 개선 예정

- 긴 문서 입력에 대한 문단별 배치 분석
- 텍스트 출처, 인용, 사실 검증 단서와의 결합
- 한국어/영어 외 다국어 모델 확장

## GitHub 포함/제외 기준

GitHub에는 코드, 설정, 문서만 포함합니다. 실제 모델 가중치와 직렬화 파일은 용량과 보안 관리를 위해 Hugging Face에 별도로 보관합니다.

GitHub에 올리지 않는 항목:

- `*.pkl`, `*.safetensors`, `*.pt`, `*.pth`, `*.bin`, `*.zip`
- `.env`, API key, token, secret
- 실험 데이터셋, 캐시, 로그, 임시 파일
