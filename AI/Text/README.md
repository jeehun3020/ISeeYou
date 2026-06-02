# AI/Text

텍스트가 AI로 생성됐을 가능성을 한국어/영어 모델로 판별하고, 문장과 표현 단위의 설명 가능한 신호를 제공합니다.

## 폴더 구조

```text
Text/
├── models/text_model_bundle/LOG_AID_ko/
├── models/text_model_bundle/DeBERTa_En/
└── README.md
```

## 최신 모델

- 한국어: `LOG_AID_ko/text_detector_ko.py`, `log_aid_classifier.pkl`, `log_aid_scaler.pkl`
- 영어: `DeBERTa_En/text_detector_en.py`, `adapter_model.safetensors`, tokenizer 파일
- 실제 API 연결은 `AI/Multimodal/inference/multimodal_inference_server.py`의 `/analyze-text`에서 처리합니다.

한국어 모델은 `4bit용Ko.zip`에서 받은 4bit LOG-AID 번들만 사용합니다. 이전 한국어 모델의 `main.py`, `logistic_regression.pkl`, `standard_scaler.pkl`는 현재 모델 폴더에서 제거했습니다.

## 입력 데이터 형식

- 직접 입력 문자열
- `.txt` 파일 업로드

## 출력 결과 형식

- `fakeProbability`, `realProbability`
- 판정 라벨
- 문장/표현 단위 XAI 신호
- 문장 길이가 너무 짧은 입력은 판별하지 않고 더 긴 문장을 요청합니다.

## 현재 구현된 기능

- 한국어 LOG-AID 4bit 연결
- 영어 DeBERTa 연결
- Text 전용 XAI 화면
- 결과 문구와 실제 판정 라벨 정합성 보정

## 향후 개선 예정

- Text 전용 독립 CLI
- 더 긴 문서 단위 배치 분석
- 한국어 4bit 모델의 완전한 운영 성능 검증
