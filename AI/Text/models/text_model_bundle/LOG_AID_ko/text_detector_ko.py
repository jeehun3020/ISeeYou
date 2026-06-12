import os
import gc
import warnings
import numpy as np
import joblib
import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

warnings.filterwarnings('ignore')

# [Cell 1]: 9대 하이브리드 피처 및 마스킹 알고리즘 기반 고도화 모듈 구현
class TextDetectorKO:

    # 9차원 피처 가독성 식별자 체계 정렬
    FEATURE_NAMES = [
        'mean_surprisal_base',
        'mean_surprisal_instruct',
        'mean_jsd',
        'entropy_diff',
        'mean_entropy_base',
        'mean_log_rank',
        'std_surprisal_base',          # [신규 주입] 문체 기복 (핵심)
        'std_surprisal_instruct',      # [신규 주입] 지시어 모델 문체 기복
        'cross_perplexity_ratio'       # [신규 주입] Binoculars 민감도 교차 비율
    ]

    # 관점 C 대시보드 출력용 9대 피처 전용 메시지 템플릿 확장
    FEATURE_MESSAGES = {
        'mean_surprisal_instruct': (
            "지시어 정렬 구조 내부에서 기계적으로 생성된 전형적인 문맥 연결 패턴이 검출되었습니다.",
            "지시어 최적화 모델의 문맥 전개 리듬이 인간 고유의 자연스러운 서술 기법과 높은 정합성을 보입니다."
        ),
        'mean_log_rank': (
            "AI 모델이 주로 의존하는 정형화된 고빈도 단어 조합의 규칙성이 식별되었습니다.",
            "AI 알고리즘의 예측 범위를 벗어나는 인간 특유의 창의적 어휘 선택이 두드러집니다."
        ),
        'mean_jsd': (
            "기본·지시어 모델 간 확률 분포 차이가 생성형 AI 고유의 비틀림 임계 영역에 진입했습니다.",
            "두 모델 간 확률 변동폭이 안정적으로 수렴하며 인간 집필 문서의 통계적 지문과 일치합니다."
        ),
        'mean_surprisal_base': (
            "기본 모델의 서프라이설 분포가 높아 AI 생성 징후를 나타냅니다.",
            "기본 모델의 서프라이설 분포가 낮아 인간의 언어 흐름에 가깝습니다."
        ),
        'mean_entropy_base': (
            "토큰 생성 단계의 예측 엔트로피가 AI 알고리즘 특유의 고정된 규칙성을 반영합니다.",
            "토큰 생성 단계의 예측 엔트로피가 인간 특유의 불규칙한 문체 변동성을 반영합니다."
        ),
        'entropy_diff': (
            "두 정렬 모델 간 엔트로피 편차가 AI 문체의 통계적 범주에 속합니다.",
            "두 정렬 모델 간 엔트로피 편차가 인간 저작물의 고유 범주에 속합니다."
        ),
        'std_surprisal_base': (
            "기본 모델 서프라이설의 변동 기복이 극도로 낮아, 특정 어휘 유형만을 정형적으로 반복 배치하는 기계적 경향성이 포착되었습니다.",
            "서프라이설 수치가 문단별로 변칙적으로 출렁이며, 인간 저작물 특유의 창의적이고 불규칙한 문체 기복을 증명합니다."
        ),
        'std_surprisal_instruct': (
            "지시어 정렬 문체의 기복 분포가 인위적으로 통제되어 챗봇 고유의 일정한 문장 생성 리듬이 감지되었습니다.",
            "정렬 모델의 지형을 벗어나는 문장 간 표현력의 자연스러운 편차가 감지되어 인간 저작으로 판독합니다."
        ),
        'cross_perplexity_ratio': (
            "기본 모델 대비 지시어 모델의 상대적 민감도(Binoculars 교차 비율)가 AI 생성물의 통계적 임계 영역과 일치합니다.",
            "두 정렬 모델이 원문에 반응하는 상호 Perplexity 비율이 안정적으로 수렴하여 인간이 직접 집필한 서술 구조를 신뢰합니다."
        )
    }

    def __init__(self, classifier_dir: str, quantization: str = '4bit', max_length: int = 1024):
        self.max_length   = max_length
        self.quantization = quantization

        # 9비트 하이브리드 가중치로 학습 완료된 피클 파일 적재
        self.clf    = joblib.load(os.path.join(classifier_dir, 'log_aid_classifier.pkl'))
        self.scaler = joblib.load(os.path.join(classifier_dir, 'log_aid_scaler.pkl'))
        print("✅ 9차원 확장 분류기 및 스케일러 로드 완료")

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
        """텍스트 → 포맷터 마스킹 적용 및 9차원 하이브리드 피처 벡터 추출"""
        try:
            # 1. 줄바꿈 및 특수 기호 마스킹 서브 임베딩 함수 정의
            def get_text_mask(ids, tokenizer):
                tokens = tokenizer.convert_ids_to_tokens(ids[0, 1:].tolist())
                mask = torch.ones(len(tokens), dtype=torch.bool)
                for idx, tok in enumerate(tokens):
                    if tok in ['Ċ', 'ĊĊ', '▁', '•', '-', '·'] or tok.strip() == '':
                        mask[idx] = False
                return mask

            # Base 모델 통과 및 연산
            inp_b = self.base_tokenizer(text, return_tensors='pt', truncation=True, max_length=self.max_length)
            ids_b = inp_b['input_ids'].to(self.base_model.device)
            if ids_b.shape[1] < 2: return None

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

            # 포맷터 마스크 산출 및 적용 (Base)
            mask_b = get_text_mask(ids_b, self.base_tokenizer).to(self.base_model.device)
            surp_b_masked = surp_b[mask_b] if mask_b.sum() > 0 else surp_b

            del logits_b, sl_b, sorted_b, log_p_b
            torch.cuda.empty_cache()

            # Instruct 모델 통과 및 연산
            inp_i = self.inst_tokenizer(text, return_tensors='pt', truncation=True, max_length=self.max_length)
            ids_i = inp_i['input_ids'].to(self.inst_model.device)
            if ids_i.shape[1] < 2: return None

            logits_i = self.inst_model(ids_i).logits
            sl_i     = logits_i[0, :-1, :]
            lb_i     = ids_i[0, 1:]
            probs_i  = torch.softmax(sl_i.float(), dim=-1)

            tp_i    = probs_i.gather(1, lb_i.unsqueeze(1)).squeeze(1)
            surp_i  = -torch.log(tp_i + 1e-10)
            log_p_i = torch.log(probs_i + 1e-10)
            ent_i   = -(probs_i * log_p_i).sum(dim=-1)

            # 포맷터 마스크 산출 및 적용 (Instruct)
            mask_i = get_text_mask(ids_i, self.inst_tokenizer).to(self.inst_model.device)
            surp_i_masked = surp_i[mask_i] if mask_i.sum() > 0 else surp_i

            del logits_i, sl_i, log_p_i
            torch.cuda.empty_cache()

            # 연동 고도화 피처 산출 프로세스
            n     = min(probs_b.shape[0], probs_i.shape[0])
            p, q  = probs_b[:n], probs_i[:n]
            m     = 0.5 * (p + q)
            log_m = torch.log(m + 1e-10)
            kl_pm = (p * (torch.log(p + 1e-10) - log_m)).sum(dim=-1)
            kl_qm = (q * (torch.log(q + 1e-10) - log_m)).sum(dim=-1)
            jsd      = 0.5 * (kl_pm + kl_qm)
            ent_diff = torch.abs(ent_b[:n] - ent_i[:n])

            # Cross Perplexity Ratio 추출용 평균 가공
            mean_surp_b = surp_b_masked.mean().cpu().item()
            mean_surp_i = surp_i_masked.mean().cpu().item()
            cross_ratio = mean_surp_i / (mean_surp_b + 1e-10)

            # 9차원 융합 피처 생성
            feature = np.array([
                mean_surp_b,                                  # 1. mean_surprisal_base
                mean_surp_i,                                  # 2. mean_surprisal_instruct
                jsd.mean().cpu().item(),                      # 3. mean_jsd
                ent_diff.mean().cpu().item(),                 # 4. entropy_diff
                ent_b.mean().cpu().item(),                    # 5. mean_entropy_base
                lr_b.mean().cpu().item(),                     # 6. mean_log_rank
                surp_b_masked.std().cpu().item(),             # 7. std_surprisal_base (추가)
                surp_i_masked.std().cpu().item(),             # 8. std_surprisal_instruct (추가)
                cross_ratio                                   # 9. cross_perplexity_ratio (추가)
            ])

            del probs_b, probs_i, p, q, m, log_m, kl_pm, kl_qm
            del surp_b, surp_i, ent_b, ent_i, ent_diff, jsd
            del ids_b, ids_i, ranks_b, lr_b, surp_b_masked, surp_i_masked, mask_b, mask_i
            torch.cuda.empty_cache()
            return feature

        except Exception as e:
            print(f"  [피처 추출 오류] {str(e)[:100]}")
            torch.cuda.empty_cache()
            return None

    def _build_reason(self, feature_scaled: np.ndarray) -> str:
        """가중치 중요도 기반 상위 2개 피처 추출 및 NLG 사유 자동 조립"""
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
        """9차원 벡터 기반 AI 생성 여부 판별 스크립트"""
        feature = self._extract_features(text)
        if feature is None:
            return {
                "label":             "판단 불가",
                "human_probability": 0.0,
                "ai_probability":     0.0,
                "verdict":           "텍스트가 너무 짧거나 처리 중 오류가 발생했습니다.",
                "reason":            "",
            }

        X        = self.scaler.transform(feature.reshape(1, -1))
        probs      = self.clf.predict_proba(X)[0]
        human_prob = round(probs[0] * 100, 2)
        ai_prob    = round(probs[1] * 100, 2)

        # 4bit 및 9대 피처 기준의 정밀 임계값 60% 가이드라인 준수
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
            "ai_probability":     ai_prob,
            "verdict":           verdict,
            "reason":            self._build_reason(X),
        }

    def unload(self):
        """GPU 메모리 전면 해제"""
        for attr in ('base_model', 'inst_model'):
            if hasattr(self, attr):
                del self.__dict__[attr]
        torch.cuda.empty_cache()
        gc.collect()
        print("✅ 모델 메모리 반납 완료")


# ──────────────────────────────────────────────────────────────
# 모듈 정상 작동 검증용 단독 테스트 세션
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # 실행 경로 기준 디렉토리에 log_aid_classifier.pkl과 log_aid_scaler.pkl을 배치하십시오.
    detector = TextDetectorKO(
        classifier_dir=".",
        quantization='4bit'
    )

    test_texts = [
        "저는 산업공학을 공부하며 제조 현장의 비효율을 데이터와 기술로 해결하는 스마트팩토리 분야에 깊은 관심을 가져온 학생입니다.",
        "멀티모달 정합성 분석 모듈은 영상, 텍스트, 음성 간 의미, 시간, 구조적 일치도를 종합하여 평가한다."
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