"""
LOG-AID 한국어 AI 텍스트 판별 모듈 (랜덤 포레스트 / 4bit 버전)
모델: Qwen2.5-7B base/instruct + Random Forest

필수 라이브러리:
    pip install torch transformers scikit-learn joblib numpy accelerate bitsandbytes

필수 파일 (classifier_dir 폴더 안에 배치):
    log_aid_classifier.pkl   ← 랜덤 포레스트 분류기 (4bit 기준 학습)
    log_aid_scaler.pkl       ← StandardScaler (4bit 기준 학습)

하드웨어 요구사항:
    - 4bit 양자화: GPU VRAM 10GB 이상 필요
    - 최초 실행 시 Hugging Face에서 모델 자동 다운로드 (~14GB × 2)

사용 예시:
    from LOG_AID import TextDetectorKO

    detector = TextDetectorKO(classifier_dir=".")
    result = detector.predict("판별할 텍스트")
    print(result)
"""

import gc
import os
import numpy as np
import joblib
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


class TextDetectorKO:

    FEATURE_NAMES = [
        'mean_surprisal_base',
        'mean_surprisal_instruct',
        'mean_jsd',
        'entropy_diff',
        'mean_entropy_base',
        'mean_log_rank',
    ]

    FEATURE_MESSAGES = {
        'mean_surprisal_instruct': (
            "지시어 정렬 구조 내부에서 기계적으로 생성된 전형적인 문맥 연결 패턴이 검출되었습니다.",
            "지시어 최적화 모델의 문맥 전개 리듬이 인간 고유의 자연스러운 서술 기법과 높은 정합성을 보입니다.",
        ),
        'mean_log_rank': (
            "AI 모델이 주로 의존하는 정형화된 고빈도 단어 조합의 규칙성이 식별되었습니다.",
            "AI 알고리즘의 예측 범위를 벗어나는 인간 특유의 창의적 어휘 선택이 두드러집니다.",
        ),
        'mean_jsd': (
            "기본·지시어 모델 간 확률 분포 차이가 생성형 AI 고유의 비틀림 임계 영역에 진입했습니다.",
            "두 모델 간 확률 변동폭이 안정적으로 수렴하며 인간 집필 문서의 통계적 지문과 일치합니다.",
        ),
        'mean_surprisal_base': (
            "기본 모델의 서프라이설 분포가 높아 AI 생성 징후를 나타냅니다.",
            "기본 모델의 서프라이설 분포가 낮아 인간의 언어 흐름에 가깝습니다.",
        ),
        'mean_entropy_base': (
            "토큰 생성 단계의 예측 엔트로피가 AI 알고리즘 특유의 고정된 규칙성을 반영합니다.",
            "토큰 생성 단계의 예측 엔트로피가 인간 특유의 불규칙한 문체 변동성을 반영합니다.",
        ),
        'entropy_diff': (
            "두 정렬 모델 간 엔트로피 편차가 AI 문체의 통계적 범주에 속합니다.",
            "두 정렬 모델 간 엔트로피 편차가 인간 저작물의 고유 범주에 속합니다.",
        ),
    }

    def __init__(self, classifier_dir: str, quantization: str = '4bit', max_length: int = 1024):
        """
        Args:
            classifier_dir: log_aid_classifier.pkl, log_aid_scaler.pkl이 있는 폴더 경로
            quantization:   '4bit' (10GB+) | '8bit' (16GB+) | 'none' (32GB+)
            max_length:     최대 토큰 길이
        """
        self.max_length   = max_length
        self.quantization = quantization

        self.clf    = joblib.load(os.path.join(classifier_dir, 'log_aid_classifier.pkl'))
        self.scaler = joblib.load(os.path.join(classifier_dir, 'log_aid_scaler.pkl'))
        print("✅ 분류기 및 스케일러 로드 완료")

        self.base_model, self.base_tokenizer = self._load_model("Qwen/Qwen2.5-7B")
        self.inst_model, self.inst_tokenizer = self._load_model("Qwen/Qwen2.5-7B-Instruct")

        if torch.cuda.is_available():
            used = torch.cuda.memory_allocated() / 1024**3
            print(f"✅ 모델 로드 완료 | GPU 메모리 사용량: {used:.1f}GB")

    def _load_model(self, model_name: str):
        print(f"  ⚙️ 로드 중: {model_name} ({self.quantization})")
        kwargs = {'trust_remote_code': True, 'device_map': 'auto'}

        if self.quantization == '8bit':
            kwargs['quantization_config'] = BitsAndBytesConfig(load_in_8bit=True)
        elif self.quantization == '4bit':
            kwargs['quantization_config'] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_quant_type='nf4',
            )
        else:
            kwargs['torch_dtype'] = torch.float16

        model = AutoModelForCausalLM.from_pretrained(model_name, **kwargs)
        model.eval()
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        return model, tokenizer

    @torch.no_grad()
    def _extract_features(self, text: str):
        """텍스트 → 6차원 피처 벡터"""
        try:
            # Base 모델
            inp_b = self.base_tokenizer(
                text, return_tensors='pt', truncation=True, max_length=self.max_length
            )
            ids_b = inp_b['input_ids'].to(self.base_model.device)
            if ids_b.shape[1] < 2:
                return None

            logits_b = self.base_model(ids_b).logits
            sl_b     = logits_b[0, :-1, :]
            lb_b     = ids_b[0, 1:]
            probs_b  = torch.softmax(sl_b.float(), dim=-1)

            tp_b    = probs_b.gather(1, lb_b.unsqueeze(1)).squeeze(1)
            surp_b  = -torch.log(tp_b + 1e-10)
            log_p_b = torch.log(probs_b + 1e-10)
            ent_b   = -(probs_b * log_p_b).sum(dim=-1)

            sorted_b = torch.argsort(probs_b, dim=-1, descending=True)
            n_tok    = lb_b.shape[0]
            ranks_b  = torch.zeros(n_tok, device=logits_b.device)
            for t in range(n_tok):
                pos = (sorted_b[t] == lb_b[t]).nonzero(as_tuple=True)[0]
                ranks_b[t] = (pos[0].float() + 1) if len(pos) > 0 else probs_b.shape[-1]
            lr_b = torch.log(ranks_b + 1e-10)

            del logits_b, sl_b, sorted_b, log_p_b
            torch.cuda.empty_cache()

            # Instruct 모델
            inp_i = self.inst_tokenizer(
                text, return_tensors='pt', truncation=True, max_length=self.max_length
            )
            ids_i = inp_i['input_ids'].to(self.inst_model.device)
            if ids_i.shape[1] < 2:
                return None

            logits_i = self.inst_model(ids_i).logits
            sl_i     = logits_i[0, :-1, :]
            lb_i     = ids_i[0, 1:]
            probs_i  = torch.softmax(sl_i.float(), dim=-1)

            tp_i    = probs_i.gather(1, lb_i.unsqueeze(1)).squeeze(1)
            surp_i  = -torch.log(tp_i + 1e-10)
            log_p_i = torch.log(probs_i + 1e-10)
            ent_i   = -(probs_i * log_p_i).sum(dim=-1)

            del logits_i, sl_i, log_p_i
            torch.cuda.empty_cache()

            # 6개 피처 계산
            n     = min(probs_b.shape[0], probs_i.shape[0])
            p, q  = probs_b[:n], probs_i[:n]
            m     = 0.5 * (p + q)
            log_m = torch.log(m + 1e-10)
            kl_pm = (p * (torch.log(p + 1e-10) - log_m)).sum(dim=-1)
            kl_qm = (q * (torch.log(q + 1e-10) - log_m)).sum(dim=-1)
            jsd      = 0.5 * (kl_pm + kl_qm)
            ent_diff = torch.abs(ent_b[:n] - ent_i[:n])

            feature = np.array([
                surp_b.mean().cpu().item(),
                surp_i.mean().cpu().item(),
                jsd.mean().cpu().item(),
                ent_diff.mean().cpu().item(),
                ent_b.mean().cpu().item(),
                lr_b.mean().cpu().item(),
            ])

            del probs_b, probs_i, p, q, m, log_m, kl_pm, kl_qm
            del surp_b, surp_i, ent_b, ent_i, ent_diff, jsd
            del ids_b, ids_i, ranks_b, lr_b
            torch.cuda.empty_cache()
            return feature

        except Exception as e:
            print(f"  [피처 추출 오류] {str(e)[:100]}")
            torch.cuda.empty_cache()
            return None

    def _build_reason(self, feature_scaled: np.ndarray) -> str:
        importances   = self.clf.feature_importances_
        contributions = importances * np.abs(feature_scaled[0])
        top_indices   = np.argsort(contributions)[::-1][:2]
        parts = []
        for idx in top_indices:
            name   = self.FEATURE_NAMES[idx]
            is_ai  = feature_scaled[0][idx] > 0
            ai_msg, human_msg = self.FEATURE_MESSAGES.get(name, ("AI 경향 감지.", "인간 저작 확인."))
            parts.append(ai_msg if is_ai else human_msg)
        return " / ".join(parts)

    def predict(self, text: str) -> dict:
        """
        텍스트를 분석하여 AI 생성 여부를 판별합니다.

        Returns:
            {
                "label":             "AI 생성" | "사람 작성",
                "human_probability": 83.2,
                "ai_probability":    16.8,
                "verdict":           "판정 등급 설명",
                "reason":            "상위 2개 피처 기반 판단 근거",
            }
        """
        feature = self._extract_features(text)
        if feature is None:
            return {
                "label":             "판단 불가",
                "human_probability": 0.0,
                "ai_probability":    0.0,
                "verdict":           "텍스트가 너무 짧거나 처리 중 오류가 발생했습니다.",
                "reason":            "",
            }

        X          = self.scaler.transform(feature.reshape(1, -1))
        probs      = self.clf.predict_proba(X)[0]
        human_prob = round(probs[0] * 100, 2)
        ai_prob    = round(probs[1] * 100, 2)

        # 4bit 기준 최적 임계값 0.60 적용
        label = "AI 생성" if ai_prob >= 60 else "사람 작성"

        if ai_prob >= 80:
            verdict = "AI 생성 가능성 높음"
        elif ai_prob >= 60:
            verdict = "AI 생성 의심"
        elif human_prob >= 80:
            verdict = "사람 작성 가능성 높음"
        else:
            verdict = "사람 작성 우위 / 일부 AI 윤색 또는 정형화된 어휘 규칙성 감지"

        return {
            "label":             label,
            "human_probability": human_prob,
            "ai_probability":    ai_prob,
            "verdict":           verdict,
            "reason":            self._build_reason(X),
        }

    def unload(self):
        """GPU 메모리 반납"""
        for attr in ('base_model', 'inst_model'):
            if hasattr(self, attr):
                del self.__dict__[attr]
        torch.cuda.empty_cache()
        gc.collect()
        print("✅ 모델 메모리 반납 완료")


# ──────────────────────────────────────────────────────────────
# 단독 실행 테스트
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    detector = TextDetectorKO(
        classifier_dir=".",
        quantization='4bit',  # 4bit: VRAM 10GB+ | 8bit: 16GB+ | none: 32GB+
    )

    test_texts = [
        "저는 산업공학을 공부하며 제조 현장의 비효율을 데이터와 기술로 해결하는 스마트팩토리 분야에 깊은 관심을 가져온 학생입니다.",
        "멀티모달 정합성 분석 모듈은 영상, 텍스트, 음성 간 의미, 시간, 구조적 일치도를 종합하여 평가한다.",
    ]

    for text in test_texts:
        result = detector.predict(text)
        print("=" * 60)
        print(f"  판정     : {result['label']}")
        print(f"  인간 확률 : {result['human_probability']}%")
        print(f"  AI 확률  : {result['ai_probability']}%")
        print(f"  등급     : {result['verdict']}")
        print(f"  근거     : {result['reason']}")

    detector.unload()