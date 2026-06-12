# 모델 아티팩트 관리

I SEE YOU는 GitHub에는 코드, 설정, 문서만 올리고 실제 모델 가중치와 대용량 데이터는 별도 저장소에서 관리합니다. 현재 팀원 공유용 모델 파일은 Hugging Face 저장소를 기준으로 배치합니다.

- Hugging Face: https://huggingface.co/yoonjeongah/ISeeYou-model-weights
- GitHub: https://github.com/jjyoon012-git/ISeeYou

## GitHub에 포함하는 것

- 프론트엔드 UI 코드
- 백엔드/API 코드
- 추론 코드와 전처리/후처리 코드
- 모델 로딩 설정 파일
- README와 실행 문서
- 작은 크기의 JSON 설정 파일

## GitHub에 포함하지 않는 것

다음 항목은 `.gitignore`로 제외합니다.

- 모델 가중치: `*.pt`, `*.pth`, `*.ckpt`, `*.safetensors`, `*.onnx`, `*.bin`
- 직렬화 모델/스케일러: `*.pkl`, `*.joblib`
- 압축 파일: `*.zip`, `*.tar`, `*.7z`
- 환경/인증 파일: `.env*`, `*.pem`, `*.key`, `*.cert`
- 데이터셋, 로그, 캐시, 임시 파일
- 관리자 DB와 업로드 스토리지
- `node_modules`, `dist`, 빌드 결과물

## 현재 로컬 모델 기준

| 영역 | 로컬 기준 경로 | 비고 |
|---|---|---|
| Image | `AI/Image/models/image_model_bundle/versionv12/` | 이미지 분석은 v12 계열을 기준으로 통합 |
| Text-KO | `AI/Text/models/text_model_bundle/LOG_AID_ko/` | 4bit 피처 추가 LOG-AID 번들 |
| Text-EN | `AI/Text/models/text_model_bundle/DeBERTa_En/` | 영어 DeBERTa 계열 |
| Video | `AI/Video/models/video/` | 영상 앙상블 모델 |
| Multimodal | `AI/Multimodal/models/` | 6종 멀티모달 분석 및 fusion 설정 |
| Extension | `Extension/versionv*/`, `Extension/video/` | 크롬 확장용 경량 런타임/모델 연결 |

## 팀원 실행 시 모델 배치 순서

1. GitHub에서 ISeeYou 코드를 클론합니다.
2. Hugging Face 저장소에서 필요한 모델 파일을 내려받습니다.
3. README에 적힌 로컬 경로에 모델 파일을 배치합니다.
4. 백엔드 서버를 먼저 실행하고, 그 다음 UI 또는 확장 프로그램을 실행합니다.

## 유지보수 원칙

- 새 모델을 교체할 때는 파일명을 README와 manifest에 함께 반영합니다.
- 모델 파일은 GitHub에 직접 올리지 않습니다.
- 정확도, AUC, F1 등 성능 수치는 검증 데이터 기준과 함께 문서화합니다.
- 임시 실험 결과는 최종 런타임과 구분해서 `_legacy_candidates` 또는 별도 실험 폴더에 둡니다.
