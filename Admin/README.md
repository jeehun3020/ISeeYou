# ISeeYou Admin Console

ISeeYou 관리자 콘솔은 사용자 화면에서 발생한 분석 요청과 모델 판정 결과를 저장하고, 관리자가 결과를 직접 검수하여 모델 오류를 분석할 수 있는 운영 화면입니다.

## 구조

```text
Admin/
├── Backend/                 # 저장/관리 API 서버
│   ├── create_admin.py       # 관리자 계정 생성 스크립트
│   ├── storage_gateway_server.py
│   ├── storage_models.py
│   ├── storage_db.py
│   ├── storage_config.py
│   ├── storage_security.py
│   ├── requirements.txt
│   └── .env.example
└── Frontend/
    └── Admin/               # Vite + React 관리자 화면
```

## 주요 기능

- 사용자 분석 기록 목록 확인
- 분석 입력 파일/URL 미리보기
- 모델 판정 결과, Real/Fake 점수, 처리 로그 확인
- 분석 기록 삭제
- 사용자 이벤트 로그 수집 및 운영 대시보드 표시
- 관리자 검수 저장
  - 관리자 판정: Real / Fake / 판단 보류
  - 자동 오류 분류: 일치 / 오탐 / 미탐 / 확인 필요
  - 검수 메모
  - 재학습 데이터 후보 표시

## 실행 순서

아래 명령은 `<ISeeYou 프로젝트 루트>` 기준입니다.

### 1. 관리자 백엔드 준비

```powershell
cd Admin\Backend
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

`.env`는 로컬 환경에 맞게 작성합니다. 실제 `.env`, 로컬 DB, 저장된 분석 파일은 GitHub에 올리지 않습니다.

관리자 계정 생성:

```powershell
python create_admin.py
```

관리자 API 서버 실행:

```powershell
python storage_gateway_server.py
```

기본 API 주소:

```text
http://127.0.0.1:8787
```

### 2. 관리자 프론트엔드 실행

```powershell
cd Admin\Frontend\Admin
npm install
npm run dev
```

기본 관리자 화면 주소:

```text
http://127.0.0.1:5175
```

## 사용자 UI와 연결

사용자 UI의 Vite proxy는 분석 요청을 관리자 백엔드로 보냅니다. 관리자 백엔드는 입력 파일과 결과 JSON을 저장하고, 실제 추론 요청은 모델 서버로 전달합니다.

```text
User UI -> Admin Backend(storage gateway) -> AI inference server
```

## 검수/오류 분석 기준

- 모델 판정과 관리자 판정이 같으면 `일치`
- 모델이 Fake, 관리자가 Real로 검수하면 `오탐`
- 모델이 Real, 관리자가 Fake로 검수하면 `미탐`
- 관리자 판정을 아직 선택하지 않으면 `판단 보류`

검수 결과는 대시보드의 검수 완료 수, 정답률, 오탐/미탐 수, 재학습 후보 수에 반영됩니다.

## GitHub 제외 대상

다음 파일은 로컬 실행 산출물이므로 GitHub에 포함하지 않습니다.

- `Admin/Backend/.env`
- `Admin/Backend/*.db`
- `Admin/Backend/storage/`
- `node_modules/`
- `dist/`
- 로그 파일
