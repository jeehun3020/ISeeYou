import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import './App.css'
import sensorPortrait from './assets/sensor-portrait.svg'
import signalWave from './assets/signal-wave.svg'
import fusionGrid from './assets/fusion-grid.svg'
import ImageStudioRoute from './pages/ImageStudioPage'
import TextStudioRoute from './pages/TextStudioPage'
import VideoStudioRoute from './pages/VideoStudioPage'
import MultimodalStudioRoute from './pages/MultimodalStudioPage'

const BRAND_MODEL_SRC = '/iseeyou-logo.glb'
const FREQUENCY_REFERENCE_PANEL_SRC = '/xai_refs/frequency_reference_panel.png'

type CategoryId = 'image' | 'text' | 'video' | 'multimodal'
type DeveloperOverrideTarget = 'real' | 'fake'
type View = { screen: 'home' } | { screen: 'studio'; category: CategoryId }
type UploadKind = 'image' | 'text' | 'video'

type UploadState = {
  file: File | null
  previewUrl: string
  textValue: string
  dragging: boolean
  sourceMode: 'file' | 'url'
  sourceUrl: string
}

type Profile = {
  id: string
  title: string
  subtitle: string
  description: string
  accent: string
  badge: string
  latency: string
  xai: string
  recommended?: boolean
  capabilities: string[]
}

type CategoryConfig = {
  id: CategoryId
  label: string
  kicker: string
  title: string
  subtitle: string
  uploadKind: UploadKind
  uploadAccept: string
  inputHint: string
  stageLabels: string[]
  profiles: Profile[]
  visual: string
  connectedModalities: string[]
}

type Analysis = {
  selectedMode?: string
  inferenceMode?: 'ensemble' | 'single'
  verdictLabel: string
  fakePercent: number
  realPercent: number
  confidence: number
  summary: string
  metrics: { label: string; value: string; detail: string }[]
  reasons: { title: string; body: string }[]
  bars: { label: string; score: number; note: string }[]
  timeline: { label: string; start: string; end: string; score: number; note: string; evidence?: string[] }[]
  regions: { id: string; label: string; x: number; y: number; width: number; height: number }[]
  tokens: { text: string; weight: number; tag: string }[]
  xaiHeadline?: string
  modalityJudgments?: { label: string; realPercent: number; fakePercent: number; verdict: string; reason: string }[]
  fusionSteps?: { title: string; weight: string; logic: string }[]
  modelTraits?: { model: string; role: string; trait: string; contribution: string }[]
  spectrumBins?: number[]
  syncBins?: number[]
  fusionWeights?: { label: string; weight: number }[]
  availability?: { hasFace: boolean; hasLips: boolean; hasSpeech: boolean; hasText: boolean; faceRatio: number; mouthRatio: number; subtitleRatio: number; speechConfidence: number; textConfidence: number }
  processingScope?: { readsWholeVideo: boolean; fullDurationSec: number; analyzedDurationSec: number; sampleFrames: number; maxSeconds: number; strategy: string; precheckSummary: string; computeDevice: string; windows?: { label: string; start: number; end: number; startLabel: string; endLabel: string }[] }
  heatmapPoints?: { x: number; y: number; radius: number; intensity: number; label: string }[]
  focusFrameUrl?: string
  mouthPreviewUrl?: string
  detectionOverlays?: { label: string; timestamp: number; timeLabel: string; boxes: { kind: string; label: string; x: number; y: number; width: number; height: number; confidence?: number }[]; motionScore?: number }[]
  frequencyComparison?: { realReference: number[]; fakeReference: number[]; sample: number[]; note: string; sampleImage?: string }
  gatedBranches?: string[]
  llmSections?: { heatmap: string; timeline: string; fusion: string; frequency: string }
  textLlmSections?: { userGuide: string; sentenceInterpretation: string; tip: string }
  videoXai?: VideoXai
  developerOverride?: {
    target: DeveloperOverrideTarget
    applied: boolean
    originalVerdictLabel: string
    originalFakePercent: number
    originalRealPercent: number
  }
}

type ApiAnalysis = {
  selectedMode?: string
  inferenceMode?: 'ensemble' | 'single'
  verdictLabel: string
  fakePercent: number
  realPercent: number
  confidence: number
  summary: string
  reasoning: { title: string; body: string }[]
  metrics: { label: string; value: string; detail: string }[]
  stages: { title: string; body: string }[]
  xaiHeadline?: string
  modalityJudgments?: { label: string; realPercent: number; fakePercent: number; verdict: string; reason: string }[]
  fusionSteps?: { title: string; weight: string; logic: string }[]
  modelTraits?: { model: string; role: string; trait: string; contribution: string }[]
  spectrumBins?: number[]
  syncBins?: number[]
  fusionWeights?: { label: string; weight: number }[]
  availability?: { hasFace: boolean; hasLips: boolean; hasSpeech: boolean; hasText: boolean; faceRatio: number; mouthRatio: number; subtitleRatio: number; speechConfidence: number; textConfidence: number }
  processingScope?: { readsWholeVideo: boolean; fullDurationSec: number; analyzedDurationSec: number; sampleFrames: number; maxSeconds: number; strategy: string; precheckSummary: string; computeDevice: string; windows?: { label: string; start: number; end: number; startLabel: string; endLabel: string }[] }
  frequencyComparison?: { realReference: number[]; fakeReference: number[]; sample: number[]; note: string; sampleImage?: string }
  gatedBranches?: string[]
  videoXai?: VideoXai
  xai: {
    headline: string
    regions: { id: string; label: string; x: number; y: number; width: number; height: number; score: number; note: string }[]
    timeline: { label: string; start: string; end: string; score: number; note: string; evidence?: string[] }[]
    textHighlights: { text: string; weight: number; tag: string }[]
    modalityBars: { label: string; score: number; note: string }[]
    focusFrame?: string
    mouthPreview?: string
    detectionOverlays?: { label: string; timestamp: number; timeLabel: string; boxes: { kind: string; label: string; x: number; y: number; width: number; height: number; confidence?: number }[]; motionScore?: number }[]
  }
}

type XaiSections = { heatmap: string; timeline: string; fusion: string; frequency: string }
type TextXaiSections = { userGuide: string; sentenceInterpretation: string; tip: string }
type VideoXai = {
  models: { label: string; imageSize: number; role: string; avgPGen: number }[]
  frames: {
    label: string
    timestamp: string
    pReal: number
    pGen: number
    weight: number
    modelScores: { label: string; pGen: number }[]
  }[]
  topFrameLabel: string
  consensus: string
  interpretation: string
  originalFocusFrame?: string
  maskedFocusFrame?: string
}

const initialUploadState = (): UploadState => ({
  file: null,
  previewUrl: '',
  textValue: '',
  dragging: false,
  sourceMode: 'file',
  sourceUrl: '',
})

const CATEGORY_CONFIG: Record<CategoryId, CategoryConfig> = {
  image: {
    id: 'image',
    label: 'Image',
    kicker: 'Visual Authenticity',
    title: '이미지 진위 판별',
    subtitle: '이미지의 질감, 경계, 조명, 배경 단서를 확인해 AI 생성 가능성과 판단 근거를 함께 보여줍니다.',
    uploadKind: 'image',
    uploadAccept: 'image/*',
    inputHint: 'PNG, JPG, WEBP 이미지를 드래그하거나 선택하세요.',
    stageLabels: ['Decode', 'Vision pass', 'Forensic pass', 'Explain'],
    visual: sensorPortrait,
    connectedModalities: ['Image/RGB', 'Face cues', 'FFT frequency'],
    profiles: [
      {
        id: 'image-fast',
        title: 'Fast Scan',
        subtitle: '빠른 버전',
        description: '전체 장면 기준으로 빠르게 1차 판별을 수행합니다.',
        accent: 'cyan',
        badge: 'Default',
        latency: 'Low latency',
        xai: '의심 영역 요약',
        recommended: true,
        capabilities: ['전체 장면 판독', '빠른 결과 확인', '의심 영역 요약'],
      },
      {
        id: 'image-precision',
        title: 'Precision Lab',
        subtitle: '정밀 버전',
        description: '이원석 모델의 RGB+FFT 이중 스트림으로 더 정밀한 판별을 수행합니다.',
        accent: 'violet',
        badge: 'High fidelity',
        latency: 'Deep scan',
        xai: 'RGB + 주파수 근거',
        capabilities: ['얼굴 단서 확인', '시각 아티팩트 추적', '상세 근거 설명'],
      },
    ],
  },
  text: {
    id: 'text',
    label: 'Text',
    kicker: 'Language Integrity',
    title: '텍스트 진위 판별',
    subtitle: '문체 일관성, 반복 표현, 생성형 AI 패턴을 확인하고 문장 단위 근거를 설명합니다.',
    uploadKind: 'text',
    uploadAccept: '.txt,text/plain',
    inputHint: '텍스트를 붙여넣거나 TXT 파일을 업로드하세요.',
    stageLabels: ['Parse', 'Language trace', 'Source cue', 'Explain'],
    visual: fusionGrid,
    connectedModalities: [],
    profiles: [
      {
        id: 'text-ai-detector',
        title: 'AI Text Detector',
        subtitle: '텍스트 AI 판정',
        description: '문체와 반복 패턴을 기반으로 AI 생성 가능성을 분석합니다.',
        accent: 'amber',
        badge: 'Writing signal',
        latency: 'Fast response',
        xai: '문장별 근거 해석',
        recommended: true,
        capabilities: ['문체 일관성', '반복 표현', '문장별 신뢰도'],
      },
      {
        id: 'text-fact-check',
        title: 'Web Fact Match',
        subtitle: '웹 진위 판별',
        description: '주장을 외부 출처와 대조해 일치 여부를 추적합니다.',
        accent: 'emerald',
        badge: 'Grounded truth',
        latency: 'Source sweep',
        xai: '주장 근거 지도',
        capabilities: ['주장 분리', '출처 대조', '불일치 추적'],
      },
    ],
  },
  video: {
    id: 'video',
    label: 'Video',
    kicker: 'Temporal Forensics',
    title: '비디오 진위 판별',
    subtitle: '영상에서 6개 대표 프레임을 샘플링하고 7개 모델의 의견 분포로 의심 구간을 설명합니다.',
    uploadKind: 'video',
    uploadAccept: 'video/*',
    inputHint: 'MP4, MOV, WEBM 비디오를 드래그하거나 선택하세요.',
    stageLabels: ['Decode', 'Text mask', 'N=7 TTA', 'Aggregate'],
    visual: signalWave,
    connectedModalities: ['Video frames only', 'Top/bottom text mask', 'Horizontal flip TTA', 'Median ensemble', 'Confidence-mean aggregation'],
    profiles: [
      {
        id: 'video-efficientnet-n7',
        title: 'EfficientNet-B0 N=7 Ensemble',
        subtitle: 'video-only frame ensemble',
        description: '6개 균등 샘플 프레임을 7개 EfficientNet-B0 체크포인트로 판정하고 median + confidence_mean으로 최종 결과를 계산합니다.',
        accent: 'cyan',
        badge: 'Actual model',
        latency: '7 checkpoints',
        xai: '프레임별 확률 추적',
        recommended: true,
        capabilities: ['6개 균등 샘플 프레임', '자막 영역 마스킹', '모델별 의견 비교', '프레임 가중 집계'],
      },
    ],
  },
  multimodal: {
    id: 'multimodal',
    label: 'Multimodal',
    kicker: 'Cross-Signal Intelligence',
    title: '멀티모달 진위 판별',
    subtitle: '시각, 오디오, 텍스트, 시간축 단서를 함께 보고 신뢰도 낮은 입력은 영향력을 낮춰 종합 판단합니다.',
    uploadKind: 'video',
    uploadAccept: 'video/*',
    inputHint: '비디오를 업로드하고 필요하면 캡션이나 설명 텍스트를 함께 입력하세요.',
    stageLabels: ['Ingest', 'Cross-modal align', 'Rank', 'Explain'],
    visual: fusionGrid,
    connectedModalities: ['Vision', 'Audio', 'Text when provided', 'Temporal', 'Frequency', 'Structure'],
    profiles: [
      { id: 'mm-openclip', title: 'OpenCLIP', subtitle: 'image-text consistency', description: '프레임과 텍스트 설명이 서로 맞는지 확인합니다.', accent: 'cyan', badge: 'Contrastive', latency: 'Balanced', xai: '장면-문장 정합성', capabilities: ['의미 정합성', '프레임 요약', '문맥 점수'] },
      { id: 'mm-flava', title: 'FLAVA', subtitle: 'cross-modal fusion', description: '여러 입력 신호를 함께 묶어 최종 정합성을 계산합니다.', accent: 'violet', badge: 'Cross-modal', latency: 'Balanced', xai: '융합 근거 지도', capabilities: ['종합 점수', '신호 통합', '안정적 판정'] },
      { id: 'mm-blip-nli', title: 'BLIP + NLI', subtitle: 'caption contradiction', description: '장면 설명을 만들고 문장 간 모순 여부를 비교합니다.', accent: 'rose', badge: 'Explanation-led', latency: 'Narrative', xai: '설명 모순 카드', capabilities: ['장면 설명', '모순 확인', '텍스트 근거'] },
      { id: 'mm-avsync', title: 'AVSync', subtitle: 'lip-audio mismatch', description: '입 모양과 음성 타이밍이 자연스럽게 맞는지 추적합니다.', accent: 'emerald', badge: 'Recommended', latency: 'Specialized', xai: '싱크 타임라인', recommended: true, capabilities: ['입 모양', '음성 지연', '시간축 이상'] },
      { id: 'mm-frequency', title: 'Frequency Fusion', subtitle: 'artifact domain', description: '주파수 영역의 잔여 패턴으로 생성 흔적을 확인합니다.', accent: 'amber', badge: 'Artifact specialist', latency: 'Forensic', xai: '주파수 비교', capabilities: ['FFT 단서', '오디오 스펙트럼', '잔여 패턴'] },
      { id: 'mm-scenegraph', title: 'SceneGraph GCN', subtitle: 'relational structure', description: '객체와 장면 관계가 자연스럽게 유지되는지 비교합니다.', accent: 'slate', badge: 'Structured XAI', latency: 'Structured', xai: '관계 구조 근거', capabilities: ['객체 관계', '구조 신뢰도', '관계 설명'] },
    ],
  },
}

const HOME_HIGHLIGHTS = [
  { title: 'AI 생성물 탐지', body: '텍스트, 이미지, 영상, 멀티모달 입력에서 생성형 AI 가능성을 분석합니다.' },
  { title: '진위 판별 보조', body: '결과는 확률과 근거를 함께 제공하며, 최종 사실 확인을 대체하지 않습니다.' },
  { title: '설명 가능한 분석', body: 'AI가 어떤 신호를 근거로 판단했는지 카드, 타임라인, 간단한 차트로 정리합니다.' },
] as const

const CATEGORY_NAME_KO: Record<CategoryId, string> = {
  image: '이미지',
  text: '텍스트',
  video: '비디오',
  multimodal: '멀티모달',
}

function categoryNameKo(category: CategoryId) {
  return CATEGORY_NAME_KO[category]
}

const MODE_GUIDES: Record<CategoryId, {
  purpose: string
  whenToUse: string
  evidence: string[]
  xaiGuide: string
  caution: string
}> = {
  text: {
    purpose: '글이 AI로 생성됐을 가능성과 문장별 설명 신호를 확인합니다.',
    whenToUse: '기사 초안, 자기소개서, 댓글, 보고서 문단처럼 충분한 길이의 텍스트를 확인할 때 적합합니다.',
    evidence: ['문체 일관성', '반복 표현', '문장 길이 패턴', '구체적 근거 표현', '모델 신뢰도'],
    xaiGuide: '하이라이트와 문장 span은 직접 증거가 아니라 모델 판정에 영향을 준 설명용 신호입니다.',
    caution: '단어 몇 개나 아주 짧은 문장은 판별하지 않고 더 긴 입력을 요청합니다.',
  },
  image: {
    purpose: '이미지의 시각 단서와 주파수 단서를 바탕으로 AI 생성 가능성을 확인합니다.',
    whenToUse: '인물 사진, 제품 이미지, SNS 이미지처럼 이미지 한 장의 진위를 빠르게 확인할 때 적합합니다.',
    evidence: ['질감/경계 이상', '조명과 그림자', '얼굴 단서', '배경 정합성', '주파수 잔여 패턴'],
    xaiGuide: '의심 영역은 모델이 참고한 시각 단서를 쉽게 읽도록 정리한 보조 설명입니다.',
    caution: '이미지 압축, 리사이즈, 강한 보정도 유사한 신호를 만들 수 있어 원본 확인이 필요합니다.',
  },
  video: {
    purpose: '영상에서 대표 프레임을 추출해 7개 프레임 모델의 의견 분포로 진위 가능성을 확인합니다.',
    whenToUse: '짧은 영상, 쇼츠, 릴스, 업로드 영상의 프레임 단위 의심 구간을 확인할 때 적합합니다.',
    evidence: ['프레임별 generated 확률', '7개 모델 합의도', '의심 프레임', '프레임 반영 가중치', 'text mask 입력'],
    xaiGuide: '비디오 XAI는 가짜 영역 heatmap이 아니라 실제 모델 확률과 모델 간 합의도를 중심으로 보여줍니다.',
    caution: '오디오나 립싱크는 이 비디오 전용 모델의 직접 입력이 아니며, 필요하면 멀티모달 분석을 함께 사용하세요.',
  },
  multimodal: {
    purpose: '시각, 오디오, 텍스트, 시간축 신호를 함께 보고 최종 진위 판단을 종합합니다.',
    whenToUse: '영상에 음성, 인물, 자막, 설명 텍스트가 함께 있을 때 가장 많은 단서를 비교할 수 있습니다.',
    evidence: ['Visual score', 'Audio/Sync score', 'Text consistency', 'Frequency signal', 'Final decision'],
    xaiGuide: '신뢰도가 낮은 입력은 자동으로 영향력이 낮아지고, 확보된 단서가 최종 판단에 더 크게 반영됩니다.',
    caution: '단서가 충분하지 않은 입력은 최종 판단에서 낮은 비중으로 처리됩니다. 이는 오류가 아니라 근거가 약한 정보를 과신하지 않기 위한 처리입니다.',
  },
}

function XaiTrustNotice({ compact = false }: { compact?: boolean }) {
  return (
    <article className={`xai-trust-notice ${compact ? 'is-compact' : ''}`}>
      <strong>결과 해석 안내</strong>
      <p>이 결과는 AI 생성물 탐지와 진위 판별을 돕는 보조적 판단 도구입니다. 점수와 XAI 근거는 의심 신호를 이해하기 위한 참고 자료이며, 최종 사실 확인은 원본 출처, 메타데이터, 추가 검증과 함께 판단해 주세요.</p>
    </article>
  )
}

function InfoDisclosure({ title = '도움말', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="info-disclosure">
      <summary aria-label={title} title={title}>?</summary>
      <div className="info-disclosure-body">{children}</div>
    </details>
  )
}

function ModeGuideCard({ category }: { category: CategoryConfig }) {
  const guide = MODE_GUIDES[category.id]
  return (
    <article className="mode-guide-card mode-guide-card-compact">
      <div className="panel-header compact">
        <div><span className="eyebrow">분석 가이드</span><h3>{categoryNameKo(category.id)} 모드 도움말</h3></div>
        <InfoDisclosure title={`${categoryNameKo(category.id)} 모드 설명`}>
          <p>{guide.purpose}</p>
          <p>{guide.whenToUse}</p>
          <div className="guide-note-row">
            <div><strong>XAI 읽는 법</strong><span>{guide.xaiGuide}</span></div>
            <div><strong>주의</strong><span>{guide.caution}</span></div>
          </div>
        </InfoDisclosure>
      </div>
      <div className="guide-chip-list compact">{guide.evidence.slice(0, 4).map((item) => <span key={item}>{item}</span>)}</div>
    </article>
  )
}

function ResultInterpretationGuide({ category, analysis }: { category: CategoryConfig; analysis: Analysis }) {
  const guide = MODE_GUIDES[category.id]
  const isFake = analysis.fakePercent >= analysis.realPercent
  const primary = isFake ? 'AI 생성 가능성 쪽 신호가 더 강하게 계산됐습니다.' : '진본 또는 사람 작성 쪽 신호가 더 강하게 계산됐습니다.'
  const cards = category.id === 'text'
    ? [
        { title: '종합 판단', body: primary },
        { title: '주요 근거', body: '문장 span, 반복 표현, 문체 일관성, 구체적 근거 표현을 함께 확인하세요.' },
        { title: '사용자 확인', body: '작성 맥락, 실제 출처, 원문 작성 과정을 함께 확인하면 판단이 더 안정적입니다.' },
      ]
    : category.id === 'image'
      ? [
          { title: '종합 판단', body: primary },
          { title: '주요 근거', body: '질감, 경계, 조명, 얼굴 또는 배경 이상 신호가 어디에 집중되는지 확인하세요.' },
          { title: '사용자 확인', body: '압축, 보정, 캡처본은 유사한 흔적을 만들 수 있으므로 원본 이미지도 비교하세요.' },
        ]
      : category.id === 'video'
        ? [
            { title: '종합 판단', body: primary },
            { title: '주요 근거', body: '프레임별 generated 확률과 7개 모델의 합의도가 높은 구간을 우선 확인하세요.' },
            { title: '사용자 확인', body: '오디오, 입 모양, 자막 정합성이 중요하다면 멀티모달 분석으로 추가 확인하세요.' },
          ]
        : [
            { title: '종합 판단', body: primary },
            { title: '주요 근거', body: 'Visual, Audio/Sync, Text, Frequency, Consistency 점수가 어떻게 모이는지 확인하세요.' },
            { title: '사용자 확인', body: '신뢰도가 낮아 영향력이 낮아진 입력이 있는지 보고, 필요한 단서를 추가해 재분석하세요.' },
          ]
  return (
    <section className="result-interpretation-guide">
      <div className="panel-header compact">
        <div><span className="eyebrow">해석 가이드</span><h3>XAI 결과를 어떻게 읽어야 하나요?</h3></div>
        <span className="panel-chip">{categoryNameKo(category.id)}</span>
      </div>
      <p>{guide.xaiGuide}</p>
      <div className="interpretation-card-grid">
        {cards.map((card) => <article key={card.title}><strong>{card.title}</strong><span>{card.body}</span></article>)}
      </div>
    </section>
  )
}

function StudioLink({
  category,
  className,
  children,
  onNavigate,
}: {
  category: CategoryId
  className: string
  children: ReactNode
  onNavigate?: (category: CategoryId) => void
}) {
  return (
    <a
      href={`#/studio/${category}`}
      className={className}
      onClick={() => onNavigate?.(category)}
    >
      {children}
    </a>
  )
}

function HomeStageVisual({ category }: { category: CategoryConfig }) {
  if (category.id === 'text') {
    return (
      <div className="pillar-stage-image pillar-stage-image-text" aria-hidden="true">
        <div className="text-stage-card">
          <div className="text-stage-lines">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="text-stage-tags">
            <span>claim</span>
            <span>source</span>
            <span>mismatch</span>
          </div>
          <div className="text-stage-sources">
            <b />
            <b />
            <b />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pillar-stage-image">
      <img src={category.visual} alt={`${category.label} overview`} loading="lazy" />
    </div>
  )
}

function MultimodalMethodsSection({ onOpenCategory }: { onOpenCategory: (category: CategoryId) => void }) {
  const multimodalProfiles = CATEGORY_CONFIG.multimodal.profiles
  const methodVisualClass: Record<string, string> = {
    'mm-openclip': 'idle-bars',
    'mm-flava': 'idle-fusion',
    'mm-blip-nli': 'idle-text',
    'mm-avsync': 'idle-sync',
    'mm-frequency': 'idle-spectrum',
    'mm-scenegraph': 'idle-graph',
  }

  return (
    <section className="cinematic-state multimodal-methods">
      <div className="cinematic-copy">
        <span className="eyebrow">MULTIMODAL METHODS</span>
        <h2>멀티모달 6가지 실험 방법을 한 화면에서 비교해 보여줍니다.</h2>
        <p>OpenCLIP, FLAVA, BLIP+NLI, AVSync, Frequency Fusion, SceneGraph GCN을 각각 다른 시각 언어로 표현해, 사용자가 선택 가능한 분석 전략을 먼저 이해할 수 있도록 구성했습니다.</p>
      </div>
      <div className="demo-grid method-grid">
        {multimodalProfiles.map((profile) => (
          <article key={profile.id} className={`demo-card method-card tone-${profile.accent}`}>
            <div className="demo-head">
              <span>{profile.badge}</span>
              <strong>{profile.title}</strong>
              <small>{profile.subtitle}</small>
            </div>
            <div className={`idle-visual ${methodVisualClass[profile.id]}`} aria-hidden="true">
              {profile.id === 'mm-openclip' ? <><i /><i /><i /><i /><i /></> : null}
              {profile.id === 'mm-flava' ? <><span /><span /><span /><span /></> : null}
              {profile.id === 'mm-blip-nli' ? <><b /><b /><b /><b /></> : null}
              {profile.id === 'mm-avsync' ? <><div className="idle-sync-mouth"><span className="upper-lip" /><span className="mouth-core" /><span className="lower-lip" /></div><div className="idle-sync-track"><em /><em /><em /><em /><em /><em /></div></> : null}
              {profile.id === 'mm-frequency' ? <><i /><i /><i /><i /><i /><i /></> : null}
              {profile.id === 'mm-scenegraph' ? <><span /><span /><span /><span /><i /><i /><i /></> : null}
            </div>
            <p>{profile.description}</p>
          </article>
        ))}
      </div>
      <div className="methods-cta-row">
        <StudioLink category="multimodal" className="primary-cta" onNavigate={onOpenCategory}>
          멀티모달 스튜디오로 바로 이동
        </StudioLink>
      </div>
    </section>
  )
}

function parseHashToView(hash: string): View {
  const normalized = hash.replace(/^#/, '')
  if (normalized.startsWith('/studio/')) {
    const category = normalized.replace('/studio/', '') as CategoryId
    if (category in CATEGORY_CONFIG) {
      return { screen: 'studio', category }
    }
  }
  return { screen: 'home' }
}

function syncHash(view: View) {
  const nextHash = view.screen === 'home' ? '#/' : `#/studio/${view.category}`
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

function getUsageSessionId() {
  const key = 'isy_usage_session_id'
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const next = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  window.sessionStorage.setItem(key, next)
  return next
}

function trackUsageEvent(eventType: string, payload: {
  page?: string
  modality?: string
  modelName?: string
  status?: string
  detail?: Record<string, unknown>
} = {}) {
  const eventPayload = {
    sessionId: getUsageSessionId(),
    eventType,
    page: payload.page,
    modality: payload.modality,
    modelName: payload.modelName,
    status: payload.status,
    detail: payload.detail,
  }
  const body = JSON.stringify(eventPayload)
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/events', blob)
      return
    }
  } catch {
    // Fall through to fetch.
  }
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined)
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function scoreWidth(value: number, minVisible = 2) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  if (safeValue <= 0) return '0%'
  return `${Math.max(minVisible, safeValue)}%`
}

function confidenceRingStyle(analysis: Analysis): CSSProperties {
  const isFake = analysis.fakePercent >= analysis.realPercent
  const winner = Math.max(analysis.fakePercent, analysis.realPercent)
  const startColor = isFake ? 'var(--rose)' : 'var(--mint)'
  const endColor = isFake ? 'var(--amber)' : 'var(--cyan)'
  const degrees = Math.max(0, Math.min(100, winner)) * 3.6
  return {
    backgroundImage: `conic-gradient(from 180deg, ${startColor} 0deg, ${endColor} ${degrees}deg, rgba(255,255,255,0.08) ${degrees}deg, rgba(255,255,255,0.04) 360deg)`,
  }
}

function randomScore(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10
}

function developerTargetMatches(analysis: Analysis, target: DeveloperOverrideTarget) {
  const modelTarget: DeveloperOverrideTarget = analysis.fakePercent >= analysis.realPercent ? 'fake' : 'real'
  return modelTarget === target
}

function applyDeveloperOverride(analysis: Analysis, target: DeveloperOverrideTarget): Analysis {
  const matched = developerTargetMatches(analysis, target)
  const original = {
    originalVerdictLabel: analysis.verdictLabel,
    originalFakePercent: analysis.fakePercent,
    originalRealPercent: analysis.realPercent,
  }
  if (matched) {
    return {
      ...analysis,
      developerOverride: {
        target,
        applied: false,
        ...original,
      },
    }
  }

  const fakePercent = target === 'fake' ? randomScore(78.4, 93.8) : randomScore(6.8, 22.4)
  const realPercent = Math.round((100 - fakePercent) * 10) / 10
  const confidence = Math.round(Math.max(fakePercent, realPercent))
  const verdictLabel = target === 'fake' ? 'Likely synthetic' : 'Likely authentic'
  const summary = target === 'fake'
    ? 'Fake 시나리오 결과로 표시했습니다. 주요 설명은 합성 가능성이 높은 신호가 강하게 나타난 흐름으로 정리됩니다.'
    : 'Real 시나리오 결과로 표시했습니다. 주요 설명은 실제 촬영 또는 실제 작성 신호가 강하게 나타난 흐름으로 정리됩니다.'
  const targetReason = target === 'fake'
    ? 'Fake 시나리오 표시가 적용되었습니다.'
    : 'Real 시나리오 표시가 적용되었습니다.'

  return {
    ...analysis,
    verdictLabel,
    fakePercent,
    realPercent,
    confidence,
    summary,
    metrics: analysis.metrics.map((metric) => {
      const lower = metric.label.toLowerCase()
      if (lower.includes('fake')) return { ...metric, value: formatPercent(fakePercent) }
      if (lower.includes('real')) return { ...metric, value: formatPercent(realPercent) }
      if (lower.includes('confidence')) return { ...metric, value: formatPercent(confidence) }
      return metric
    }),
    reasons: [
      { title: 'Developer mode scenario', body: targetReason },
      ...analysis.reasons.slice(0, 5),
    ],
    modalityJudgments: analysis.modalityJudgments?.map((item) => ({
      ...item,
      realPercent: target === 'real' ? Math.max(item.realPercent, Math.round(realPercent)) : Math.min(item.realPercent, Math.round(realPercent)),
      fakePercent: target === 'fake' ? Math.max(item.fakePercent, Math.round(fakePercent)) : Math.min(item.fakePercent, Math.round(fakePercent)),
      verdict: target === 'fake' ? 'Fake 우세' : 'Real 우세',
    })),
    developerOverride: {
      target,
      applied: true,
      ...original,
    },
  }
}

function transitionTo(update: () => void) {
  const withTransition = (document as Document & { startViewTransition?: (callback: () => void) => void }).startViewTransition?.bind(document)
  if (withTransition) {
    withTransition(() => startTransition(update))
    return
  }
  startTransition(update)
}

function getDefaultProfile(category: CategoryConfig) {
  return category.profiles.find((profile) => profile.recommended) ?? category.profiles[0]
}

/* Legacy demo-only multimodal path kept disabled for reference.
function inferMultimodalDemoKind(upload: UploadState, explicitPreset: 'auto' | 'real-demo' | 'fake-demo', fallbackFakePercent = 50): 'real-demo' | 'fake-demo' {
  if (explicitPreset !== 'auto') return explicitPreset
  const fileName = upload.file?.name.toLowerCase() ?? ''
  if (/(fake|ai|synthetic|deepfake|generated)/.test(fileName)) return 'fake-demo'
  if (/(real|authentic|official|live|original)/.test(fileName)) return 'real-demo'
  return fallbackFakePercent >= 50 ? 'fake-demo' : 'real-demo'
}

function buildFusionWeights(profileId: string) {
  if (profileId === 'mm-openclip') return [{ label: 'OpenCLIP', weight: 34 }, { label: 'FLAVA', weight: 18 }, { label: 'AVSync', weight: 14 }, { label: 'Frequency', weight: 12 }, { label: 'BLIP+NLI', weight: 10 }, { label: 'SceneGraph', weight: 12 }]
  if (profileId === 'mm-avsync') return [{ label: 'AVSync', weight: 36 }, { label: 'OpenCLIP', weight: 18 }, { label: 'Frequency', weight: 16 }, { label: 'FLAVA', weight: 14 }, { label: 'BLIP+NLI', weight: 8 }, { label: 'SceneGraph', weight: 8 }]
  if (profileId === 'mm-frequency') return [{ label: 'Frequency', weight: 34 }, { label: 'OpenCLIP', weight: 16 }, { label: 'AVSync', weight: 16 }, { label: 'FLAVA', weight: 18 }, { label: 'BLIP+NLI', weight: 8 }, { label: 'SceneGraph', weight: 8 }]
  if (profileId === 'mm-blip-nli') return [{ label: 'BLIP+NLI', weight: 28 }, { label: 'OpenCLIP', weight: 18 }, { label: 'FLAVA', weight: 18 }, { label: 'AVSync', weight: 12 }, { label: 'Frequency', weight: 12 }, { label: 'SceneGraph', weight: 12 }]
  if (profileId === 'mm-scenegraph') return [{ label: 'SceneGraph', weight: 30 }, { label: 'FLAVA', weight: 20 }, { label: 'OpenCLIP', weight: 16 }, { label: 'AVSync', weight: 12 }, { label: 'Frequency', weight: 12 }, { label: 'BLIP+NLI', weight: 10 }]
  return [{ label: 'FLAVA', weight: 30 }, { label: 'OpenCLIP', weight: 18 }, { label: 'AVSync', weight: 16 }, { label: 'Frequency', weight: 14 }, { label: 'BLIP+NLI', weight: 12 }, { label: 'SceneGraph', weight: 10 }]
}

function buildMultimodalDemoAnalysis(profile: Profile, upload: UploadState, demoKind: 'real-demo' | 'fake-demo', base?: Analysis): Analysis {
  const fileName = upload.file?.name ?? ''
  const lowerFileName = fileName.toLowerCase()
  const isGrahamNortonReal = lowerFileName === '1uld2dfakc8.mp4' && !base
  const fakePercent = clampPercent(base?.fakePercent ?? (demoKind === 'fake-demo' ? 86.8 : 9.4))
  const realPercent = clampPercent(base?.realPercent ?? (100 - fakePercent))
  const confidence = Math.round(base?.confidence ?? (demoKind === 'fake-demo' ? 94 : 92))
  const fusionWeights = buildFusionWeights(profile.id)
  const isFake = demoKind === 'fake-demo' && !isGrahamNortonReal

  if (isGrahamNortonReal) {
    return {
      verdictLabel: 'Likely authentic',
      fakePercent: 4.6,
      realPercent: 95.4,
      confidence: 97,
      summary: '얼굴, 음성, 배경, 시간축 신호가 전반적으로 안정적으로 맞물려 진짜 영상 쪽 점수가 높게 형성됐습니다.',
      metrics: [
        { label: 'Real score', value: '95.4%', detail: 'broadcast authenticity confidence' },
        { label: 'Fake score', value: '4.6%', detail: 'synthetic confidence' },
        { label: 'Primary engine', value: profile.title, detail: 'multimodal consistency board' },
        { label: 'Fusion policy', value: 'consistency-first fusion', detail: '97% confidence' },
      ],
      reasons: [
        { title: 'Final decision', body: '얼굴, 음성, 배경, 컷 전환이 모두 자연스럽게 맞물려 real 우세 판정이 강하게 유지됐습니다.' },
        { title: 'Most influential evidence', body: '입술 움직임과 발화 onset 정렬, 배경 노이즈의 자연스러운 분포, 프레임 전환 이후 얼굴 구조 유지가 핵심 근거였습니다.' },
        { title: 'XAI conclusion', body: '강한 이상 징후가 집중된 구간이 거의 없고, 자연스러운 정합성이 시간축 전체에 걸쳐 누적되면서 진짜 영상으로 판단했습니다.' },
      ],
      bars: [
        { label: 'Vision', score: 0.08, note: 'skin texture / studio lighting / cut stability' },
        { label: 'Audio', score: 0.06, note: 'speech onset / laughter bed / room tone' },
        { label: 'Text', score: 0.12, note: 'caption / spoken content / reaction context' },
        { label: 'Temporal', score: 0.05, note: 'broadcast edit rhythm / camera switching' },
        { label: 'Frequency', score: 0.09, note: 'natural spectrum / no synthetic residue' },
        { label: 'Structure', score: 0.07, note: 'face / couch / background relation stability' },
      ],
      timeline: [
        { label: 'Host intro', start: '00:00', end: '00:03', score: 0.08, note: '초반부터 음성-입술 정합성과 스튜디오 조명이 안정적입니다.' },
        { label: 'Guest reaction', start: '00:03', end: '00:06', score: 0.05, note: '표정 변화와 관객 반응음이 자연스럽게 이어집니다.' },
        { label: 'Laughter overlap', start: '00:06', end: '00:09', score: 0.11, note: '겹치는 웃음 소리와 반응 컷이 실제 방송처럼 정렬됩니다.' },
        { label: 'Broadcast hold', start: '00:09', end: '00:12', score: 0.07, note: '멀티 카메라 전환 이후에도 구조와 텍스처가 안정적으로 유지됩니다.' },
      ],
      regions: [
        { id: 'r1', label: 'Host face stability', x: 12, y: 14, width: 24, height: 34 },
        { id: 'r2', label: 'Speech alignment zone', x: 43, y: 46, width: 20, height: 15 },
        { id: 'r3', label: 'Audience / studio context', x: 66, y: 20, width: 20, height: 26 },
      ],
      tokens: [
        { text: 'broadcast cadence', weight: 0.12, tag: 'temporal' },
        { text: 'room tone consistency', weight: 0.1, tag: 'audio' },
        { text: 'natural facial detail', weight: 0.08, tag: 'vision' },
        { text: 'reaction context match', weight: 0.11, tag: 'text' },
      ],
      xaiHeadline: '이 영상은 가짜 단서보다 자연스러운 얼굴·음성·배경 정합성이 누적되면서 진짜 영상으로 판단됐습니다.',
      modalityJudgments: [
        { label: 'Vision', realPercent: 94, fakePercent: 6, verdict: '진짜 우세', reason: '스튜디오 조명, 피부 질감, 컷 전환 후 얼굴 디테일이 방송 영상답게 자연스럽습니다.' },
        { label: 'Audio', realPercent: 96, fakePercent: 4, verdict: '진짜 우세', reason: '발화 onset, 웃음, 객석 ambience가 과도한 합성 흔적 없이 연결됩니다.' },
        { label: 'Text', realPercent: 89, fakePercent: 11, verdict: '진짜 우세', reason: '대사 내용과 장면 맥락, 리액션 흐름이 서로 자연스럽게 맞습니다.' },
          { label: 'Temporal', realPercent: 95, fakePercent: 5, verdict: '진짜 우세', reason: '장면 전환과 motion continuity가 자연스럽고 drift가 거의 없습니다.' },
          { label: 'Frequency', realPercent: 91, fakePercent: 9, verdict: '진짜 우세', reason: '주파수 분포가 넓고 synthetic residue가 거의 검출되지 않았습니다.' },
          { label: 'Structure', realPercent: 93, fakePercent: 7, verdict: '진짜 우세', reason: '인물, 소파, 배경, 객석 구조가 계속 안정적으로 유지됩니다.' },
        ],
      fusionSteps: [
        { title: '모달 점수 정규화', weight: '0~1 스케일', logic: '얼굴, 배경, 음성, 컷 전환 신호를 동일한 범위로 정규화합니다.' },
        { title: '대화 구간 정합성 반영', weight: '34%', logic: '입술-음성 정렬과 발화 템포를 가장 강하게 반영합니다.' },
        { title: '환경 신호 보조 검증', weight: '38%', logic: '배경 조명, 주변 소리, 장면 전환의 자연스러움을 교차 검증합니다.' },
        { title: '최종 authenticity fusion', weight: 'consistency aggregation', logic: '가짜 단서보다 자연스러운 정합성이 누적되어 real score를 최종 확정합니다.' },
      ],
      modelTraits: [
        { model: 'OpenCLIP', role: '의미 정합성', trait: '장면과 대화 문맥의 자연스러운 연결을 측정', contribution: '장면-대사 정합성 유지 확인' },
        { model: 'FLAVA', role: '융합 중심', trait: '비전·오디오·텍스트 단서를 하나의 통합 표현으로 융합', contribution: '최종 real score를 안정적으로 유지' },
        { model: 'BLIP + NLI', role: '설명 생성', trait: '인물 상호작용과 장면 맥락을 설명 수준에서 확인', contribution: '서사 일관성 보강' },
        { model: 'AVSync', role: '오디오-입술', trait: '발화 시 mouth motion과 음성 onset 정렬 분석', contribution: '자연스러운 sync 확인' },
        { model: 'Frequency Fusion', role: '포렌식', trait: '배경 노이즈와 음성 주파수의 인공적 residue 여부 확인', contribution: 'synthetic residue 부재 확인' },
        { model: 'SceneGraph GCN', role: '구조 관계', trait: '인물·배경의 구조 관계를 비교', contribution: '공간 구조 안정성 확인' },
      ],
      spectrumBins: [8, 12, 10, 14, 18, 15, 11],
      syncBins: [8, 10, 12, 14, 16, 13, 10, 8],
      heatmapPoints: [
        { x: 23, y: 28, radius: 20, intensity: 0.42, label: 'face stability' },
        { x: 52, y: 54, radius: 14, intensity: 0.3, label: 'speech alignment' },
        { x: 74, y: 32, radius: 18, intensity: 0.22, label: 'background consistency' },
      ],
      focusFrameUrl: undefined,
      fusionWeights,
      demoTag: '진짜 시연',
    }
  }

  const modalityJudgments = isFake
    ? [
        { label: 'Vision', realPercent: 17, fakePercent: 83, verdict: '가짜 우세', reason: '얼굴 경계와 배경 텍스처에서 합성 잔여가 반복적으로 검출됐습니다.' },
        { label: 'Audio', realPercent: 11, fakePercent: 89, verdict: '가짜 우세', reason: '보컬 에너지와 mouth motion 사이에 지속적인 offset이 관찰됩니다.' },
        { label: 'Text', realPercent: 28, fakePercent: 72, verdict: '가짜 우세', reason: '자막 의미와 장면 서술이 완전히 맞물리지 않고 일부 구간에서 모순이 생깁니다.' },
        { label: 'Temporal', realPercent: 14, fakePercent: 86, verdict: '가짜 우세', reason: '프레임 리듬이 부자연스럽고 컷 전환 직전 confidence spike가 큽니다.' },
        { label: 'Frequency', realPercent: 21, fakePercent: 79, verdict: '가짜 우세', reason: '고주파 영역과 mel contour에서 생성형 잔여 패턴이 강합니다.' },
        { label: 'Structure', realPercent: 33, fakePercent: 67, verdict: '가짜 우세', reason: '얼굴 중심 구조는 유지되지만 객체 관계와 공간 깊이가 얕습니다.' },
      ]
    : [
        { label: 'Vision', realPercent: 88, fakePercent: 12, verdict: '진짜 우세', reason: '피부 텍스처와 배경 노이즈가 자연스럽고 프레임 간 일관성이 안정적입니다.' },
        { label: 'Audio', realPercent: 91, fakePercent: 9, verdict: '진짜 우세', reason: 'mouth motion과 음성 onset이 거의 같은 타이밍으로 움직입니다.' },
        { label: 'Text', realPercent: 86, fakePercent: 14, verdict: '진짜 우세', reason: '자막, 음성, 장면 설명이 자연스럽게 정합됩니다.' },
        { label: 'Temporal', realPercent: 90, fakePercent: 10, verdict: '진짜 우세', reason: '시간축 confidence가 안정적이며 급격한 drift가 보이지 않습니다.' },
        { label: 'Frequency', realPercent: 84, fakePercent: 16, verdict: '진짜 우세', reason: '주파수 분포가 넓고 인공적 고주파 과응답이 약합니다.' },
        { label: 'Structure', realPercent: 87, fakePercent: 13, verdict: '진짜 우세', reason: '얼굴 위치, 배경 구조, 공간 관계가 전반적으로 자연스럽습니다.' },
      ]

  return {
    verdictLabel: base?.verdictLabel ?? (isFake ? 'Likely synthetic' : 'Likely authentic'),
    fakePercent,
    realPercent,
    confidence,
    summary:
      base?.summary ??
      (isFake
        ? `${profile.title} 기준으로 시각·오디오·텍스트 신호를 교차 검증한 결과, 립싱크 드리프트와 주파수 잔여가 동시에 검출되어 가짜 가능성이 높게 산출됐습니다.`
        : `${profile.title} 기준으로 시각·오디오·텍스트 신호를 교차 검증한 결과, 모달리티 간 정합성이 높고 시간축 안정성도 유지되어 진짜 가능성이 우세합니다.`),
    metrics: [
      { label: 'Real score', value: formatPercent(realPercent), detail: 'authenticity confidence' },
      { label: 'Fake score', value: formatPercent(fakePercent), detail: 'synthetic confidence' },
      { label: 'Primary engine', value: profile.title, detail: profile.badge },
      { label: 'Fusion policy', value: isFake ? 'risk-first fusion' : 'consistency-first fusion', detail: `${confidence}% confidence` },
    ],
    reasons: [
      { title: 'Final decision', body: isFake ? '비전·오디오·주파수 세 축에서 동시에 가짜 우세 판정이 나와 최종 fake 비율이 높아졌습니다.' : '모든 주요 모달리티가 진짜 우세를 유지해 최종 real 비율이 높게 고정됐습니다.' },
      { title: 'Most influential evidence', body: isFake ? '립싱크 mismatch, caption contradiction, harmonic residue가 최종 결정에 가장 크게 기여했습니다.' : '립싱크 안정성, 장면-텍스트 정합성, 자연스러운 주파수 분포가 결정에 가장 크게 기여했습니다.' },
      { title: 'XAI conclusion', body: isFake ? '얼굴 주변 히트맵, 오디오-입술 drift, 고주파 스펙트럼이 동일 구간에서 겹쳐 나타났습니다.' : '얼굴, 음성, 자막의 정렬이 유지되며 특정 구간만 과도하게 튀는 이상 신호가 거의 없습니다.' },
    ],
    bars: [
      { label: 'Vision', score: modalityJudgments[0].fakePercent / 100, note: 'face / artifact / scene residue' },
      { label: 'Audio', score: modalityJudgments[1].fakePercent / 100, note: 'voiceprint / onset / breath cadence' },
      { label: 'Text', score: modalityJudgments[2].fakePercent / 100, note: 'claim / caption / contradiction map' },
      { label: 'Temporal', score: modalityJudgments[3].fakePercent / 100, note: 'frame cadence / continuity / edit rhythm' },
      { label: 'Frequency', score: modalityJudgments[4].fakePercent / 100, note: 'fft / mel / harmonic residue' },
      { label: 'Structure', score: modalityJudgments[5].fakePercent / 100, note: 'scene graph / relation stability' },
    ],
    timeline:
      base?.timeline ??
      (isFake
        ? [
            { label: 'Intro mismatch', start: '00:00', end: '00:02', score: 0.61, note: '자막과 장면 연결이 약해지는 구간입니다.' },
            { label: 'Lip drift peak', start: '00:03', end: '00:05', score: 0.88, note: '입술 움직임과 음성 onset이 가장 크게 어긋난 구간입니다.' },
            { label: 'Artifact cluster', start: '00:05', end: '00:07', score: 0.79, note: '배경과 피부 텍스처에 고주파 패턴이 집중됩니다.' },
            { label: 'Fusion decision', start: '00:07', end: '00:09', score: 0.91, note: '다중 모달리티 점수가 같은 방향으로 수렴한 구간입니다.' },
          ]
        : [
            { label: 'Stable intro', start: '00:00', end: '00:02', score: 0.18, note: '초기 구간부터 모달 정합성이 안정적으로 유지됩니다.' },
            { label: 'Speech alignment', start: '00:02', end: '00:04', score: 0.12, note: 'mouth motion과 오디오 onset이 자연스럽게 맞물립니다.' },
            { label: 'Context hold', start: '00:04', end: '00:06', score: 0.09, note: '장면-자막-음성이 큰 드리프트 없이 유지됩니다.' },
            { label: 'Decision lock', start: '00:06', end: '00:08', score: 0.14, note: '최종 fusion에서도 real 우세가 유지됩니다.' },
          ]),
    regions:
      base?.regions ??
      (isFake
        ? [
            { id: 'r1', label: 'Face heat zone', x: 14, y: 12, width: 28, height: 36 },
            { id: 'r2', label: 'Lip-sync drift', x: 44, y: 47, width: 20, height: 15 },
            { id: 'r3', label: 'Background residue', x: 68, y: 16, width: 18, height: 28 },
          ]
        : [
            { id: 'r1', label: 'Stable face zone', x: 14, y: 12, width: 28, height: 36 },
            { id: 'r2', label: 'Aligned speech area', x: 44, y: 47, width: 20, height: 15 },
            { id: 'r3', label: 'Natural background', x: 68, y: 16, width: 18, height: 28 },
          ]),
    tokens:
      base?.tokens ??
      (isFake
        ? [
            { text: 'lip drift', weight: 0.92, tag: 'sync' },
            { text: 'caption mismatch', weight: 0.84, tag: 'text' },
            { text: 'harmonic residue', weight: 0.8, tag: 'frequency' },
            { text: 'confidence spike', weight: 0.7, tag: 'fusion' },
          ]
        : [
            { text: 'stable onset', weight: 0.2, tag: 'sync' },
            { text: 'natural cadence', weight: 0.18, tag: 'audio' },
            { text: 'consistent caption', weight: 0.16, tag: 'text' },
            { text: 'low artifact', weight: 0.14, tag: 'frequency' },
          ]),
    xaiHeadline: base?.xaiHeadline ?? (isFake ? '가짜 판단은 얼굴 열지도, 립싱크 드리프트, 주파수 잔여가 겹친 구간을 중심으로 이루어졌습니다.' : '진짜 판단은 모달리티 간 정합성이 유지되고 이상 신호가 낮게 분포한 점에 기반합니다.'),
    modalityJudgments,
    fusionSteps: [
      { title: '모달 점수 정규화', weight: '0~1 스케일', logic: 'Vision / Audio / Text / Temporal / Frequency / Structure 점수를 같은 범위로 보정합니다.' },
      { title: '주력 모델 우선 반영', weight: `${fusionWeights[0].weight}%`, logic: `${profile.title}의 핵심 신호를 최우선으로 반영합니다.` },
      { title: '보조 모델 교차 검증', weight: `${fusionWeights.slice(1).reduce((sum, item) => sum + item.weight, 0)}%`, logic: '다른 모달리티 모델이 같은 방향으로 판단하는지 확인합니다.' },
      { title: '최종 fusion decision', weight: isFake ? 'risk aggregation' : 'consistency aggregation', logic: isFake ? '불일치가 겹치는 구간의 위험도를 더 크게 반영합니다.' : '정합성이 유지되는 구간의 안정성을 더 크게 반영합니다.' },
    ],
    modelTraits: [
      { model: 'OpenCLIP', role: '의미 정합성', trait: '프레임과 텍스트 사이의 scene-text gap을 측정', contribution: isFake ? '장면 설명 불일치 검출' : '장면-텍스트 일치 유지 확인' },
      { model: 'FLAVA', role: '융합 중심', trait: '멀티모달 fusion embedding으로 최종 점수 안정화', contribution: '최종 authenticity score의 중심축' },
      { model: 'BLIP + NLI', role: '설명 생성', trait: '장면 설명과 자막/보조 설명의 모순 탐지', contribution: isFake ? 'caption contradiction 보강' : '서술 일관성 확인' },
      { model: 'AVSync', role: '오디오-입술', trait: 'mouth motion과 음성 onset의 타이밍 차이 분석', contribution: isFake ? 'lip-audio drift 핵심 근거' : '동기화 안정성 보증' },
      { model: 'Frequency Fusion', role: '포렌식', trait: '고주파 / mel 잔여 패턴 분석', contribution: isFake ? '생성형 잔여 검출' : '인공적 스펙트럼 부재 확인' },
      { model: 'SceneGraph GCN', role: '구조 관계', trait: '객체/얼굴/배경 구조 관계의 안정성 비교', contribution: isFake ? '구조 단순화와 공간 어색함 지적' : '관계 구조 자연스러움 확인' },
    ],
    spectrumBins: isFake ? [18, 32, 56, 82, 88, 70, 44] : [12, 16, 18, 22, 24, 20, 14],
    syncBins: isFake ? [14, 20, 36, 64, 88, 72, 48, 24] : [10, 12, 14, 16, 18, 14, 12, 10],
    heatmapPoints: base?.heatmapPoints ?? (isFake
      ? [
          { x: 22, y: 24, radius: 20, intensity: 0.88, label: 'face artifact' },
          { x: 54, y: 53, radius: 14, intensity: 0.94, label: 'lip drift' },
          { x: 76, y: 28, radius: 18, intensity: 0.72, label: 'background residue' },
        ]
      : [
          { x: 22, y: 24, radius: 18, intensity: 0.28, label: 'stable face' },
          { x: 54, y: 53, radius: 12, intensity: 0.22, label: 'aligned speech' },
          { x: 76, y: 28, radius: 16, intensity: 0.2, label: 'natural context' },
        ]),
    focusFrameUrl: base?.focusFrameUrl,
    fusionWeights,
    demoTag: isFake ? '가짜 시연' : '진짜 시연',
  }
}

*/
function mapApiAnalysisToUi(analysis: ApiAnalysis): Analysis {
  return {
    selectedMode: analysis.selectedMode,
    inferenceMode: analysis.inferenceMode,
    verdictLabel: analysis.verdictLabel,
    fakePercent: analysis.fakePercent,
    realPercent: analysis.realPercent,
    confidence: analysis.confidence,
    summary: analysis.summary,
    metrics: analysis.metrics,
    reasons: analysis.reasoning,
    bars: analysis.xai.modalityBars,
    timeline: analysis.xai.timeline,
    regions: analysis.xai.regions.map(({ id, label, x, y, width, height }) => ({ id, label, x, y, width, height })),
    tokens: analysis.xai.textHighlights,
    xaiHeadline: analysis.xaiHeadline ?? analysis.xai.headline,
    modalityJudgments: analysis.modalityJudgments,
    fusionSteps: analysis.fusionSteps,
    modelTraits: analysis.modelTraits,
    spectrumBins: analysis.spectrumBins,
    syncBins: analysis.syncBins,
    fusionWeights: analysis.fusionWeights,
    availability: analysis.availability,
    processingScope: analysis.processingScope,
    frequencyComparison: analysis.frequencyComparison,
    gatedBranches: analysis.gatedBranches,
    videoXai: analysis.videoXai,
    heatmapPoints: analysis.xai.regions.map((region) => ({
      x: region.x + region.width / 2,
      y: region.y + region.height / 2,
      radius: Math.max(region.width, region.height) * 0.7,
      intensity: region.score,
      label: region.label,
    })),
    focusFrameUrl: analysis.xai.focusFrame,
    mouthPreviewUrl: analysis.xai.mouthPreview,
    detectionOverlays: analysis.xai.detectionOverlays ?? [],
  }
}

async function requestMultimodalSections(analysis: Analysis, selectedMode: string): Promise<XaiSections> {
  const response = await fetch('/multimodal-api/explain', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      selectedMode,
      analysis,
    }),
  })

  if (!response.ok) {
    throw new Error(`multimodal explain failed: ${response.status}`)
  }

  const payload = (await response.json()) as { ok: boolean; sections?: XaiSections }
  if (!payload.ok || !payload.sections) {
    throw new Error('multimodal explain payload missing')
  }
  return payload.sections
}

async function requestTextSections(analysis: Analysis, selectedMode: string, text: string): Promise<TextXaiSections> {
  const response = await fetch('/multimodal-api/explain-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      selectedMode,
      text,
      analysis,
    }),
  })

  if (!response.ok) {
    throw new Error(`text explain failed: ${response.status}`)
  }

  const payload = (await response.json()) as { ok: boolean; sections?: TextXaiSections }
  if (!payload.ok || !payload.sections) {
    throw new Error('text explain payload missing')
  }
  return payload.sections
}

function HeatmapLayer({ points }: { points: NonNullable<Analysis['heatmapPoints']> }) {
  return (
    <div className="heatmap-layer" aria-hidden="true">
      {points.map((point) => (
        <div
          key={`${point.label}-${point.x}-${point.y}`}
          className="heatmap-spot"
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: `${point.radius * 2}%`,
            height: `${point.radius * 2}%`,
            opacity: 0.18 + point.intensity * 0.52,
            ['--spot-intensity' as string]: String(point.intensity),
          } as CSSProperties}
        >
          <span>{point.label}</span>
        </div>
      ))}
    </div>
  )
}

function XaiVisualMedia({ analysis, upload }: { analysis: Analysis; upload: UploadState }) {
  if (analysis.focusFrameUrl) {
    return <img src={analysis.focusFrameUrl} alt="xai focus frame" className="visual-media" />
  }
  if (upload.previewUrl) {
    return upload.file?.type.startsWith('video/')
      ? <video src={upload.previewUrl} className="visual-media" controls />
      : <img src={upload.previewUrl} alt="analysis preview" className="visual-media" />
  }
  return <div className="visual-fallback">Preview not available</div>
}

function canRenderDirectVideoUrl(sourceUrl: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(sourceUrl.trim())
}

function extractYouTubeVideoId(sourceUrl: string): string {
  const trimmed = sourceUrl.trim()
  if (!trimmed) return ''
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] ?? ''
    if (!host.endsWith('youtube.com')) return ''
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v') ?? ''
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') return parts[1] ?? ''
    return ''
  } catch {
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{6,})/)
    return match?.[1] ?? ''
  }
}

function SourceOverlayMedia({ analysis, upload }: { analysis: Analysis; upload: UploadState }) {
  const uploadedVideoUrl = upload.previewUrl && upload.file?.type.startsWith('video/') ? upload.previewUrl : ''
  const directVideoUrl = upload.sourceMode === 'url' && canRenderDirectVideoUrl(upload.sourceUrl) ? upload.sourceUrl : ''
  const videoUrl = uploadedVideoUrl || directVideoUrl

  if (videoUrl) {
    return (
      <video
        src={videoUrl}
        className="visual-media source-overlay-video"
        controls
        loop
        autoPlay
        playsInline
      />
    )
  }

  return <XaiVisualMedia analysis={analysis} upload={upload} />
}

function SourceOverlayStage({ analysis, upload, frameRows }: { analysis: Analysis; upload: UploadState; frameRows: { label: string; range: string; score: number; verdict: string; note: string }[] }) {
  const [currentTime, setCurrentTime] = useState(0)
  const uploadedVideoUrl = upload.previewUrl && upload.file?.type.startsWith('video/') ? upload.previewUrl : ''
  const directVideoUrl = upload.sourceMode === 'url' && canRenderDirectVideoUrl(upload.sourceUrl) ? upload.sourceUrl : ''
  const videoUrl = uploadedVideoUrl || directVideoUrl
  const isRepresentativeImage = !videoUrl
  const overlays = analysis.detectionOverlays ?? []
  const activeOverlay = overlays.length
    ? (isRepresentativeImage
      ? overlays.reduce((best, item) => {
        const scoreOverlay = (overlay: typeof item) => overlay.boxes.reduce((score, box) => {
          if (box.kind === 'face') return score + 10 + (box.confidence ?? 0.7)
          if (box.kind === 'mouth') return score + 5 + (box.confidence ?? 0.7)
          if (box.kind === 'person') return score + 1
          return score
        }, 0)
        return scoreOverlay(item) > scoreOverlay(best) ? item : best
      }, overlays[0])
      : overlays.reduce((best, item) => Math.abs(item.timestamp - currentTime) < Math.abs(best.timestamp - currentTime) ? item : best, overlays[0]))
    : undefined
  const rawActiveBoxes = activeOverlay?.boxes ?? []
  const representativeFaceBox = rawActiveBoxes
    .filter((box) => box.kind === 'face')
    .sort((a, b) => (b.confidence ?? 0.7) - (a.confidence ?? 0.7))[0]
  const activeBoxes = isRepresentativeImage && representativeFaceBox ? [representativeFaceBox] : rawActiveBoxes
  const hasActualBoxes = activeBoxes.length > 0
  const boxKindCounts = activeBoxes.reduce<Record<string, number>>((acc, box) => {
    acc[box.kind] = (acc[box.kind] ?? 0) + 1
    return acc
  }, {})
  const overlayKindText = [
    boxKindCounts.person ? `인물 ${boxKindCounts.person}` : '',
    boxKindCounts.face ? `얼굴 ${boxKindCounts.face}` : '',
    boxKindCounts.mouth ? `입술 ${boxKindCounts.mouth}` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="multimodal-source-stage">
      {videoUrl ? (
        <video
          src={videoUrl}
          className="visual-media source-overlay-video"
          controls
          loop
          autoPlay
          playsInline
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setCurrentTime(event.currentTarget.currentTime)}
        />
      ) : (
        <SourceOverlayMedia analysis={analysis} upload={upload} />
      )}
      <div className={`source-evidence-layer ${hasActualBoxes ? 'has-detections' : 'is-empty'} ${isRepresentativeImage ? 'is-face-priority' : 'is-live-video'}`} aria-label="원본 영상 위 실제 감지 단서">
        <div className="source-scan-grid" aria-hidden="true" />
        <div className="source-scan-beam" aria-hidden="true" />
        {activeBoxes.map((box) => (
          <div
            key={`${activeOverlay?.timestamp}-${box.kind}-${box.x}-${box.y}`}
            className={`source-detected-box is-${box.kind}`}
            style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, ['--box-confidence' as string]: String(box.confidence ?? 0.72) } as CSSProperties}
          >
            <i className="source-box-corner is-tl" />
            <i className="source-box-corner is-tr" />
            <i className="source-box-corner is-bl" />
            <i className="source-box-corner is-br" />
            <span><b>{box.label}</b>{typeof box.confidence === 'number' ? <em>{Math.round(box.confidence * 100)}%</em> : null}</span>
          </div>
        ))}
        {!hasActualBoxes ? <div className="source-overlay-empty">현재 표시 시점에 인물·얼굴·입술·자막 감지 좌표가 없습니다.</div> : null}
        <div className="source-overlay-readout">
          <span>{isRepresentativeImage ? 'SINGLE FACE EVIDENCE' : 'LIVE EVIDENCE OVERLAY'}</span>
          <strong>{activeOverlay ? `${activeOverlay.timeLabel} 샘플` : '샘플 대기'}</strong>
          <p>{overlayKindText || '표시 가능한 감지 단서 없음'}</p>
        </div>
        <div className="source-signal-badges">
          <b className={boxKindCounts.person ? 'is-active' : 'is-muted'}>인물 {boxKindCounts.person ? '감지' : '미표시'}</b>
          <b className={boxKindCounts.face ? 'is-active' : 'is-muted'}>얼굴 {boxKindCounts.face ? '감지' : '미표시'}</b>
          <b className={boxKindCounts.mouth ? 'is-active' : 'is-muted'}>MediaPipe 입술 {boxKindCounts.mouth ? '감지' : '미표시'}</b>
          <b className={analysis.availability?.hasSpeech ? 'is-active' : 'is-muted'}>음성 단서 {analysis.availability?.hasSpeech ? '감지' : '부족'}</b>
          <b className={analysis.availability?.hasText ? 'is-active' : 'is-muted'}>자막/텍스트 {analysis.availability?.hasText ? '감지' : '부족'}</b>
        </div>
        <div className="source-audio-ribbon source-audio-ribbon-actual">
          {(analysis.syncBins ?? [18, 32, 44, 36, 52, 40, 24, 30]).slice(0, 8).map((value, index) => <i key={`audio-${value}-${index}`} style={{ height: `${Math.max(12, value)}%` }} />)}
          <span>음성 에너지</span>
        </div>
        <div className="source-window-strip">
          {frameRows.slice(0, 3).map((row) => <b key={`window-${row.label}`}>{row.range}</b>)}
        </div>
      </div>
    </div>
  )
}

function padSeries(series: number[], target = 6, fallback = 42): number[] {
  const normalized = series.filter((value) => Number.isFinite(value)).map((value) => Math.max(8, Math.min(100, value)))
  if (!normalized.length) return Array.from({ length: target }, () => fallback)
  if (normalized.length >= target) return normalized.slice(0, target)
  return [...normalized, ...Array.from({ length: target - normalized.length }, () => normalized[normalized.length - 1] ?? fallback)]
}

function polylinePoints(series: number[], width: number, height: number): string {
  const step = series.length > 1 ? width / (series.length - 1) : width
  return series
    .map((value, index) => {
      const x = index * step
      const y = height - (Math.max(0, Math.min(100, value)) / 100) * height
      return `${x},${y}`
    })
    .join(' ')
}

function modeLabel(mode?: string): string {
  const labels: Record<string, string> = {
    'mm-openclip': 'OpenCLIP',
    'mm-flava': 'FLAVA',
    'mm-blip-nli': 'BLIP + NLI',
    'mm-avsync': 'AVSync',
    'mm-frequency': 'Frequency Fusion',
    'mm-scenegraph': 'SceneGraph GCN',
  }
  return labels[mode ?? 'mm-avsync'] ?? 'Selected model'
}

function modelSignalCaption(analysis: Analysis): string {
  switch (analysis.selectedMode) {
    case 'mm-openclip':
      return '프레임 흐름과 텍스트 정합성의 변화를 함께 그려, 장면-설명 연결이 유지되는지 확인합니다.'
    case 'mm-flava':
      return '각 브랜치의 가중치와 결합 비중을 함께 보여, 어떤 모달이 최종 판정에 크게 기여했는지 읽습니다.'
    case 'mm-blip-nli':
      return '설명 생성에 쓰인 핵심 단어와 모순 가능성이 높은 토큰을 중심으로 판정 근거를 보여줍니다.'
    case 'mm-avsync':
      return '입술 움직임과 오디오 에너지 리듬을 나란히 두고, 구간별 드리프트가 있는지 확인합니다.'
    case 'mm-frequency':
      return '현재 영상의 주파수 분포를 real/synthetic 기준 패턴과 나란히 비교해 포렌식 단서를 읽습니다.'
    case 'mm-scenegraph':
      return '얼굴·객체 위치와 관계선을 통해 장면 구조가 안정적인지, 특정 영역이 비정상적으로 튀는지 확인합니다.'
    default:
      return '선택한 모델이 실제로 반영한 핵심 단서를 시각적으로 요약합니다.'
  }
}

function modelSignalGuide(analysis: Analysis): { title: string; bullets: string[] } {
  switch (analysis.selectedMode) {
    case 'mm-openclip':
      return {
        title: '어떻게 읽으면 되나요?',
        bullets: [
          '청록 선은 장면 흐름에 따른 frame-text 정합성입니다. 급격히 꺾이는 구간은 설명과 장면이 어긋날 가능성이 큽니다.',
          '주황 선은 자막·텍스트 단서 강도입니다. 텍스트 근거가 약한데 정합성만 높게 나오면 과신하지 않도록 함께 봅니다.',
          '두 선이 함께 안정적으로 움직이면 실제 장면-설명 대응이 자연스럽다는 쪽으로 해석합니다.',
        ],
      }
    case 'mm-flava':
      return {
        title: '어떻게 읽으면 되나요?',
        bullets: [
          '중앙 fusion 코어는 최종 융합 표현이고, 바깥 노드는 각 모달 branch의 기여도입니다.',
          '특정 노드 비중이 높으면, 그 모달이 이번 판정에서 더 큰 역할을 했다는 뜻입니다.',
          '노드 분포가 고르게 유지되면 다중 단서가 함께 일관되게 반영된 경우로 읽을 수 있습니다.',
        ],
      }
    case 'mm-blip-nli':
      return {
        title: '어떻게 읽으면 되나요?',
        bullets: [
          '길게 강조된 토큰일수록 caption 생성 및 모순 판정에 더 크게 반영된 단어입니다.',
          'tag가 contradiction에 가까울수록 장면 설명과 자막·STT 사이의 충돌 가능성이 큽니다.',
          '중요 단어가 특정 개체나 행동에 몰려 있으면 그 부분이 핵심 판단 근거입니다.',
        ],
      }
    case 'mm-avsync':
      return {
        title: '어떻게 읽으면 되나요?',
        bullets: [
          '입 모양 보드는 발화에 필요한 시각 단서를 상징하고, 아래 strip은 시간축 sync 강도를 보여줍니다.',
          '막대 길이가 들쭉날쭉하거나 특정 구간만 약하면 mouth-audio drift가 있었다는 뜻입니다.',
          '고르게 긴 막대가 이어지면 입술과 음성 타이밍이 비교적 안정적이었다고 볼 수 있습니다.',
        ],
      }
    case 'mm-frequency':
      return {
        title: '어떻게 읽으면 되나요?',
        bullets: [
          '위 참조 패널은 실제·생성 평균 주파수 분포와 둘의 차이를 함께 보여주는 기준 맵입니다.',
          '현재 영상 맵을 나란히 비교하면 중심 저주파, 축 방향 잔여, 대칭 패턴이 어느 쪽에 더 가까운지 볼 수 있습니다.',
          '밝은 Difference 영역은 real과 fake가 통계적으로 더 다르게 나타난 주파수 구간입니다.',
        ],
      }
    case 'mm-scenegraph':
      return {
        title: '어떻게 읽으면 되나요?',
        bullets: [
          '노드는 얼굴·입·배경처럼 모델이 구조 단서로 본 영역을 뜻하고, 선은 그 관계를 나타냅니다.',
          '연결이 한쪽으로 치우치거나 특정 노드만 튀면 구조적 정합성이 불안정하다고 해석할 수 있습니다.',
          '노드 배치가 자연스럽고 관계선이 균형적이면 장면 구조가 실제 영상 쪽에 가깝게 읽힙니다.',
        ],
      }
    default:
      return {
        title: '어떻게 읽으면 되나요?',
        bullets: ['선택한 모델이 실제 반영한 핵심 단서를 시각적으로 요약한 보드입니다.'],
      }
  }
}

function selectedJudgment(analysis: Analysis) {
  const key = modeLabel(analysis.selectedMode ?? 'mm-avsync')
  return analysis.modalityJudgments?.find((item) => item.label.toLowerCase() === key.toLowerCase())
}

function ConnectedModalitiesCard({ category }: { category: CategoryConfig }) {
  return (
    <article className="studio-inline-note-card connected-modal-card">
      <strong>{category.id === 'video' ? '실제 사용 입력' : '연결된 분석 신호'}</strong>
      {category.connectedModalities.length ? (
        <div className="connected-modal-list">
          {category.connectedModalities.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : (
        <span>없음</span>
      )}
    </article>
  )
}

function ModelSignalPanel({ analysis }: { analysis: Analysis }) {
  const selectedMode = analysis.selectedMode ?? 'mm-avsync'
  const frameSeries = padSeries(analysis.timeline.map((slice) => slice.score * 100), 6, 46)
  const tokenSeries = padSeries(analysis.tokens.map((token) => token.weight * 100), 6, 38)
  const syncSeries = padSeries((analysis.syncBins ?? []).map((value) => value), 8, 28)
  const sampleSpectrum = padSeries(analysis.frequencyComparison?.sample ?? analysis.spectrumBins ?? [], 7, 42)
  const realSpectrum = padSeries(analysis.frequencyComparison?.realReference ?? [], 7, 52)
  const fakeSpectrum = padSeries(analysis.frequencyComparison?.fakeReference ?? [], 7, 58)
  const nodes = analysis.regions.length
    ? analysis.regions.slice(0, 5)
    : [
        { id: 'n1', label: 'face', x: 26, y: 34, width: 16, height: 18 },
        { id: 'n2', label: 'mouth', x: 46, y: 54, width: 14, height: 10 },
        { id: 'n3', label: 'context', x: 74, y: 38, width: 18, height: 18 },
      ]
  const graphLayout = [
    { x: 78, y: 54 },
    { x: 164, y: 36 },
    { x: 248, y: 68 },
    { x: 122, y: 132 },
    { x: 268, y: 128 },
  ]
  const graphNodes = nodes.map((node, index) => ({
    ...node,
    plotX: graphLayout[index % graphLayout.length].x,
    plotY: graphLayout[index % graphLayout.length].y,
  }))

  return (
    <article className="signal-board-panel model-signal-panel">
      <span>Model-specific clues</span>
      <div className="panel-header compact">
        <div>
          <strong>{modeLabel(selectedMode)}</strong>
          <p className="panel-subcopy">{modelSignalCaption(analysis)}</p>
        </div>
      </div>
      {selectedMode === 'mm-openclip' ? (
        <div className="model-visual-card">
          <div className="model-stat-strip">
            <div><span>peak consistency</span><strong>{Math.max(...frameSeries).toFixed(1)}%</strong></div>
            <div><span>text evidence</span><strong>{Math.max(...tokenSeries).toFixed(1)}%</strong></div>
          </div>
          <svg viewBox="0 0 360 170" className="signal-svg" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => <line key={index} x1="0" x2="360" y1={20 + index * 30} y2={20 + index * 30} className="signal-grid-line" />)}
            <text x="10" y="16" className="signal-axis-label">High alignment</text>
            <text x="10" y="162" className="signal-axis-label">Low alignment</text>
            <polyline points={polylinePoints(frameSeries, 340, 130)} transform="translate(10 20)" className="signal-line signal-line-primary" />
            <polyline points={polylinePoints(tokenSeries, 340, 130)} transform="translate(10 20)" className="signal-line signal-line-secondary" />
          </svg>
          <div className="signal-legend">
            <span><i className="signal-legend-dot cyan" /> frame-text consistency</span>
            <span><i className="signal-legend-dot amber" /> text evidence strength</span>
          </div>
        </div>
      ) : null}
      {selectedMode === 'mm-flava' ? (
        <div className="model-visual-card">
          <div className="model-stat-strip">
            <div><span>dominant branch</span><strong>{analysis.fusionWeights?.[0]?.label ?? 'fusion'}</strong></div>
            <div><span>top weight</span><strong>{analysis.fusionWeights?.[0]?.weight ?? 0}%</strong></div>
          </div>
          <div className="fusion-orbit">
            {(analysis.fusionWeights ?? []).slice(0, 6).map((item, index) => (
              <i key={`${item.label}-line`} className={`fusion-spoke spoke-${index + 1}`} />
            ))}
            <div className="fusion-core">fusion</div>
            {(analysis.fusionWeights ?? []).slice(0, 6).map((item, index) => (
              <div key={item.label} className={`fusion-node orbit-${index + 1}`}>
                <strong>{item.label}</strong>
                <b>{item.weight}%</b>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {selectedMode === 'mm-blip-nli' ? (
        <div className="model-visual-card">
          <div className="model-stat-strip">
            <div><span>strongest token</span><strong>{analysis.tokens?.[0]?.text ?? 'caption'}</strong></div>
            <div><span>max contradiction</span><strong>{((Math.max(...tokenSeries) || 0)).toFixed(1)}%</strong></div>
          </div>
          <div className="token-stack">
            {(analysis.tokens.length ? analysis.tokens : [{ text: 'caption', weight: 0.62, tag: 'caption' }, { text: 'context', weight: 0.48, tag: 'entailment' }, { text: 'mismatch', weight: 0.76, tag: 'contradiction' }]).slice(0, 6).map((token, index) => (
              <div key={`${token.text}-${index}`} className="token-rail">
                <div className="token-meta"><strong>{token.text}</strong><span>{token.tag}</span></div>
                <div className="token-track"><i style={{ width: `${Math.max(12, token.weight * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {selectedMode === 'mm-avsync' ? (
        <div className="model-visual-card">
          <div className="model-stat-strip">
            <div><span>best sync bin</span><strong>{Math.max(...syncSeries).toFixed(1)}%</strong></div>
            <div><span>speech/lips</span><strong>{analysis.availability?.hasSpeech && analysis.availability?.hasLips ? 'active' : 'gated'}</strong></div>
          </div>
          <div className="mouth-sync-stage">
            <div className="mouth-preview-shell">
              <figure className="mouth-preview-card">
                {analysis.mouthPreviewUrl ? (
                  <img src={analysis.mouthPreviewUrl} alt="실제로 추적된 입술 ROI 미리보기" />
                ) : (
                  <div className="mouth-preview-empty">
                    <div className="mouth-icon">
                      <div className="mouth-upper" />
                      <div className="mouth-lower" />
                    </div>
                    <span>입술 ROI가 안정적으로 추적되지 않았습니다.</span>
                  </div>
                )}
                <figcaption>실제로 추적한 입술 ROI</figcaption>
              </figure>
              <div className="mouth-preview-note">
                <strong>AVSync reference</strong>
                <p>입술 ROI와 오디오 onset을 함께 보며, 발화 시점의 mouth motion이 음성과 얼마나 맞는지 비교합니다.</p>
              </div>
            </div>
            <div className="sync-strip sync-strip-large">{syncSeries.map((value, index) => <b key={`${value}-${index}`} style={{ width: `${Math.max(10, value)}%` }} />)}</div>
          </div>
        </div>
      ) : null}
      {selectedMode === 'mm-frequency' ? (
        <div className="model-visual-card">
          <div className="model-stat-strip">
            <div><span>real reference peak</span><strong>{Math.max(...realSpectrum).toFixed(1)}%</strong></div>
            <div><span>sample peak</span><strong>{Math.max(...sampleSpectrum).toFixed(1)}%</strong></div>
          </div>
          <div className="frequency-image-stack">
            <figure className="frequency-image-panel frequency-image-panel-annotated">
              <div className="frequency-reference-shell">
                <img src={FREQUENCY_REFERENCE_PANEL_SRC} alt="real과 synthetic 평균 주파수 비교 기준" />
                <div className="frequency-hotspot hotspot-center">
                  <span>저주파 중심</span>
                </div>
                <div className="frequency-hotspot hotspot-axis">
                  <span>축 방향 차이</span>
                </div>
                <div className="frequency-hotspot hotspot-ring">
                  <span>대칭 잔여 패턴</span>
                </div>
              </div>
              <figcaption>실제 데이터셋 평균 기준 패턴</figcaption>
            </figure>
            {analysis.frequencyComparison?.sampleImage ? (
              <figure className="frequency-image-panel">
                <img src={analysis.frequencyComparison.sampleImage} alt="현재 업로드 영상의 주파수 맵" />
                <figcaption>현재 영상 대표 프레임 주파수 맵</figcaption>
              </figure>
            ) : null}
          </div>
          <div className="frequency-reading-guide">
            <p><strong>Real Avg.</strong>와 <strong>Fake Avg.</strong>는 둘 다 자연 영상의 큰 구조를 공유하므로 비슷해 보일 수 있습니다.</p>
            <p><strong>Difference</strong>는 두 평균의 절대 차이를 강조한 맵으로, 밝을수록 실제와 생성 영상의 주파수 분포가 더 다르게 나타난 영역입니다.</p>
            <p>현재 영상 맵은 이 기준과 나란히 비교되어, 중심 저주파 분포와 축 방향 잔여 패턴이 real 쪽에 가까운지 synthetic 쪽에 가까운지 함께 반영됩니다.</p>
          </div>
          <div className="frequency-compare-list frequency-compare-list-tight">
            <div className="frequency-compare-row">
              <strong>real reference</strong>
              <div className="spectrum-bars spectrum-bars-compare">{realSpectrum.map((value, index) => <i key={`real-${value}-${index}`} style={{ height: `${value}%` }} />)}</div>
            </div>
            <div className="frequency-compare-row">
              <strong>synthetic reference</strong>
              <div className="spectrum-bars spectrum-bars-compare">{fakeSpectrum.map((value, index) => <i key={`fake-${value}-${index}`} style={{ height: `${value}%` }} />)}</div>
            </div>
            <div className="frequency-compare-row">
              <strong>current sample</strong>
              <div className="spectrum-bars spectrum-bars-compare spectrum-bars-emphasis">{sampleSpectrum.map((value, index) => <i key={`sample-${value}-${index}`} style={{ height: `${value}%` }} />)}</div>
            </div>
          </div>
        </div>
      ) : null}
      {selectedMode === 'mm-scenegraph' ? (
        <div className="model-visual-card">
          <div className="model-stat-strip">
            <div><span>graph nodes</span><strong>{nodes.length}</strong></div>
            <div><span>top region</span><strong>{analysis.regions?.[0]?.label ?? 'face'}</strong></div>
          </div>
          <svg viewBox="0 0 360 180" className="signal-svg" aria-hidden="true">
            {graphNodes.map((node, index) => {
              if (index === graphNodes.length - 1) return null
              const next = graphNodes[(index + 1) % graphNodes.length]
              return (
                <line
                  key={`${node.id}-${next.id}`}
                  x1={node.plotX}
                  y1={node.plotY}
                  x2={next.plotX}
                  y2={next.plotY}
                  className="signal-graph-edge"
                />
              )
            })}
            {graphNodes.map((node) => (
              <g key={node.id}>
                <circle cx={node.plotX} cy={node.plotY} r={12} className="signal-graph-node" />
                <text x={node.plotX} y={node.plotY + 24} textAnchor="middle" className="signal-graph-label">{node.label}</text>
              </g>
            ))}
          </svg>
        </div>
      ) : null}
      <div className="model-score-summary">
        <span>현재 선택 모델 판정</span>
        <strong>{selectedJudgment(analysis)?.fakePercent ?? analysis.fakePercent}% fake</strong>
        <em>{selectedJudgment(analysis)?.reason ?? '선택 모델의 실제 출력과 사전 탐지 결과를 함께 반영합니다.'}</em>
      </div>
      <div className="model-reading-guide">
        <strong>{modelSignalGuide(analysis).title}</strong>
        {modelSignalGuide(analysis).bullets.map((bullet) => (
          <p key={bullet}>{bullet}</p>
        ))}
      </div>
    </article>
  )
}

async function requestAnalysis(params: {
  category: CategoryConfig
  activeProfile: Profile
  upload: UploadState
  imageScope: 'full-scene' | 'face-focus'
  xaiDepth: 'signature' | 'deep-dive'
  companionText: string
  inferenceMode: 'ensemble' | 'single'
}): Promise<Analysis> {
  const { category, activeProfile, upload, imageScope, xaiDepth, companionText, inferenceMode } = params
  const settings = {
    imageScope,
    xaiDepth,
    companionText: companionText.trim(),
    inferenceMode,
  }

  if (category.uploadKind === 'text') {
    const response = await fetch('/api/analyze-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: upload.textValue,
        fileName: upload.file?.name ?? 'input.txt',
        selectedMode: activeProfile.id,
        page: category.id,
        settings,
      }),
    })

    const payload = (await response.json()) as { ok: boolean; analysis?: ApiAnalysis; message?: string }
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || `text analyze failed: ${response.status}`)
    }
    if (!payload.ok || !payload.analysis) {
      throw new Error('text analyze payload missing')
    }
    return mapApiAnalysisToUi(payload.analysis)
  }

  const normalizedUrl = upload.sourceUrl.trim()
  if (upload.sourceMode === 'url' && normalizedUrl) {
    const urlEndpoint = category.id === 'image'
      ? '/api/analyze-image-url'
      : category.id === 'video'
        ? '/api/analyze-video-url'
        : '/api/analyze-url'
    const response = await fetch(urlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: normalizedUrl,
        mode: category.uploadKind,
        page: category.id,
        selectedMode: activeProfile.id,
        settings,
      }),
    })

    const payload = (await response.json()) as { ok: boolean; analysis?: ApiAnalysis; message?: string }
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || `url analyze failed: ${response.status}`)
    }
    if (!payload.ok || !payload.analysis) {
      throw new Error('url analyze payload missing')
    }
    return mapApiAnalysisToUi(payload.analysis)
  }

  if (!upload.file) {
    throw new Error('file is required')
  }

  const formData = new FormData()
  formData.append('file', upload.file)
  formData.append('mode', category.uploadKind)
  formData.append('page', category.id)
  formData.append('selectedMode', activeProfile.id)
  formData.append('settings', JSON.stringify(settings))

  const endpoint = category.id === 'image'
    ? '/api/analyze-image'
    : category.id === 'video'
      ? '/api/analyze-video'
      : (category.id === 'multimodal' || category.uploadKind === 'video' ? '/api/analyze' : '/api/analyze-media')
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  })

  const payload = (await response.json()) as { ok: boolean; analysis?: ApiAnalysis; message?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || `media analyze failed: ${response.status}`)
  }
  if (!payload.ok || !payload.analysis) {
    throw new Error('media analyze payload missing')
  }
  return mapApiAnalysisToUi(payload.analysis)
}
function Shell({ children, onHome, onSelectCategory, activeCategory }: { children: ReactNode; onHome: () => void; onSelectCategory: (category: CategoryId) => void; activeCategory: CategoryId | null }) {
  return (
    <div className="app-shell">
      <header className="global-header">
        <a href="#/" className="brand-mark" onClick={() => onHome()}>
          <span className="brand-model-shell" aria-hidden="true">
            <model-viewer class="brand-model" src={BRAND_MODEL_SRC} camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="18deg" interaction-prompt="none" shadow-intensity="1" exposure="1.1" disable-zoom touch-action="pan-y" />
          </span>
          <span className="brand-wordmark">I SEE YOU</span>
        </a>
        <nav className="global-nav">
          {Object.values(CATEGORY_CONFIG).map((item) => (
            <a key={item.id} href={`#/studio/${item.id}`} className={`global-nav-button ${activeCategory === item.id ? 'is-active' : ''}`} onClick={() => onSelectCategory(item.id)}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      {children}
      <footer className="global-footer">
        <div>
          <strong>I SEE YOU</strong>
          <span>AI 생성물 탐지와 진위 판별을 돕는 설명 가능한 분석 서비스</span>
        </div>
        <p>분석 결과는 보조적 판단 도구이며, 원본 출처와 추가 검증을 함께 확인해 주세요.</p>
      </footer>
    </div>
  )
}

function HomePage({ onOpenCategory }: { onOpenCategory: (category: CategoryId) => void }) {
  const categories = Object.values(CATEGORY_CONFIG)
  const [activeHomeCategoryId, setActiveHomeCategoryId] = useState<CategoryId>('multimodal')
  const activeHomeCategory = CATEGORY_CONFIG[activeHomeCategoryId]
  const activeHomeProfile = getDefaultProfile(activeHomeCategory)
  return (
    <main className="page page-home">
      <section className="marquee-ribbon" aria-hidden="true">
        <div><span>IMAGE</span><span>TEXT</span><span>AUDIO</span><span>VIDEO</span><span>FREQUENCY</span><span>LIP-SYNC</span><span>TIME-SERIES</span><span>XAI</span><span>FUSION</span></div>
      </section>

      <section className="pillar-stage tone-violet">
        <div className="pillar-stage-shell">
          <div className="pillar-stage-header">
            <div className="hero-topline"><span className="eyebrow">I SEE YOU</span><span className="hero-live-pill">Explainable AI Check</span></div>
            <h1 className="pillar-hero-title">
              <span className="hero-brand-lockup">I SEE YOU</span>
              <span className="hero-brand-separator">:</span>
              <span className="hero-brand-promise">AI 흔적을 근거로 확인합니다</span>
            </h1>
            <p>I SEE YOU는 텍스트, 이미지, 영상, 멀티모달 입력을 분석해 AI 생성 가능성과 판단 근거를 함께 보여주는 검증 보조 서비스입니다.</p>
            <div className="hero-actions hero-actions-inline">
              <StudioLink category="multimodal" className="primary-cta" onNavigate={onOpenCategory}>멀티모달 분석 시작</StudioLink>
              <div className="hero-stat-strip">
                <div><strong>4</strong><span>분석 모드</span></div>
                <div><strong>XAI</strong><span>판단 근거 설명</span></div>
                <div><strong>Guide</strong><span>결과 해석 안내</span></div>
              </div>
            </div>
          </div>

          <div className="pillar-pill-row" role="tablist" aria-label="Detection pillars">
            {categories.map((category) => (
              <button key={category.id} type="button" className={`pillar-pill ${activeHomeCategoryId === category.id ? 'is-active' : ''}`} onClick={() => setActiveHomeCategoryId(category.id)}>{category.label}</button>
            ))}
          </div>

          <div className="pillar-stage-body">
            <div className="pillar-stage-copy">
              <span className="pillar-stage-index">서비스 개요</span>
              <h3>{categoryNameKo(activeHomeCategory.id)}</h3>
              <strong>{activeHomeCategory.title}</strong>
              <p>{activeHomeCategory.subtitle}</p>
              <div className="home-guide-mini">
                <span>언제 쓰나요?</span>
                <p>{MODE_GUIDES[activeHomeCategory.id].whenToUse}</p>
              </div>
            </div>
            <div className="pillar-stage-visual">
              <div className="pillar-stage-glow" />
              <HomeStageVisual category={activeHomeCategory} />
              <div className="pillar-stage-caption"><span>{activeHomeCategory.kicker}</span><p>{activeHomeProfile.description}</p></div>
            </div>
            <div className="pillar-stage-side">
              <div className="pillar-side-metrics">
                <div><strong>{categoryNameKo(activeHomeCategory.id)}</strong><small>{activeHomeProfile.subtitle}</small></div>
                <div><strong>{activeHomeCategory.profiles.length}</strong><small>{activeHomeCategory.id === 'image' || activeHomeCategory.id === 'text' ? '선택 가능한 분석 방식' : '선택 가능한 실험 모델'}</small></div>
                <div><strong>{activeHomeProfile.xai}</strong><small>설명 가능한 판별 시각화</small></div>
                <div><strong>{activeHomeProfile.latency}</strong><small>{activeHomeProfile.badge}</small></div>
              </div>
              <StudioLink category={activeHomeCategory.id} className="primary-cta" onNavigate={onOpenCategory}>{categoryNameKo(activeHomeCategory.id)} 분석 화면으로 이동</StudioLink>
            </div>
          </div>
        </div>
      </section>

      <section className="mode-entry-section">
        <div className="section-copy">
          <span className="eyebrow">Choose Analysis Mode</span>
          <h2>무엇을 확인하려는지에 따라 분석 모드를 선택하세요.</h2>
          <p>각 모드는 입력 유형과 설명 방식이 다릅니다. 아래 카드를 기준으로 가장 가까운 작업을 선택하면 됩니다.</p>
        </div>
        <div className="mode-entry-grid">
          {categories.map((category) => (
            <article key={category.id} className={`mode-entry-card tone-${getDefaultProfile(category).accent}`}>
              <div className="mode-entry-head">
                <CategoryGlyph category={category.id} />
                <div><span>{category.label}</span><strong>{categoryNameKo(category.id)} 분석</strong></div>
              </div>
              <p>{MODE_GUIDES[category.id].purpose}</p>
              <div className="guide-chip-list">{MODE_GUIDES[category.id].evidence.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>
              <StudioLink category={category.id} className="secondary-cta" onNavigate={onOpenCategory}>{categoryNameKo(category.id)}로 이동</StudioLink>
            </article>
          ))}
        </div>
      </section>

      <XaiTrustNotice />

      <section className="editorial-gallery">
        {[sensorPortrait, signalWave, fusionGrid].map((image, index) => (
          <article key={index} className="editorial-card tone-violet">
            <div className="editorial-media"><img src={image} alt={`visual-${index}`} loading="lazy" /></div>
            <div className="editorial-copy"><span className="showcase-kicker">분석 단서</span><h3>{index === 0 ? '시각 단서 레이어' : index === 1 ? '동기화·주파수 단서' : '최종 융합 판정'}</h3><p>{index === 0 ? '장면, 얼굴, 경계 흔들림처럼 눈에 보이는 단서를 읽습니다.' : index === 1 ? '오디오, 립싱크, 주파수 흔적을 함께 묶어 해석합니다.' : '모든 신호를 결합해 최종 진위 판단과 근거를 정리합니다.'}</p></div>
          </article>
        ))}
      </section>

      <section className="highlight-row">
        {HOME_HIGHLIGHTS.map((item) => (
          <article key={item.title} className="highlight-card"><span className="highlight-dot" /><h3>{item.title}</h3><p>{item.body}</p></article>
        ))}
      </section>

      <MultimodalMethodsSection onOpenCategory={onOpenCategory} />

      <section className="cinematic-state">
        <div className="cinematic-copy">
          <span className="eyebrow">MODALITY PREVIEW</span>
          <h2>모달리티별 판별 경험을 미리 보여줍니다.</h2>
          <p>메인 화면에서는 Image, Text, Video, Multimodal이 어떤 단서를 읽는지 먼저 보여주고, 상세 모델 비교는 아래 6가지 멀티모달 방법 보드에서 이어집니다.</p>
        </div>
        <div className="demo-grid">
          <article className="demo-card tone-cyan">
            <div className="demo-head">
              <span>IMAGE</span>
              <strong>빠른 판별 / 정밀 판별</strong>
            </div>
            <div className="idle-visual idle-bars" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </div>
          </article>
          <article className="demo-card tone-amber">
            <div className="demo-head">
              <span>TEXT</span>
              <strong>토큰 강조 / 출처 검증</strong>
            </div>
            <div className="idle-visual idle-text" aria-hidden="true">
              <b /><b /><b /><b />
            </div>
          </article>
          <article className="demo-card tone-emerald">
            <div className="demo-head">
              <span>VIDEO</span>
              <strong>프레임 확률 / 의심 구간</strong>
            </div>
            <div className="idle-visual idle-sync" aria-hidden="true">
              <div className="idle-sync-mouth">
                <span className="upper-lip" />
                <span className="mouth-core" />
                <span className="lower-lip" />
              </div>
              <div className="idle-sync-track"><em /><em /><em /><em /><em /><em /></div>
            </div>
          </article>
          <article className="demo-card tone-violet">
            <div className="demo-head">
              <span>MULTIMODAL</span>
              <strong>교차 신호 융합 판별</strong>
            </div>
            <div className="idle-visual idle-fusion" aria-hidden="true">
              <span /><span /><span /><span />
            </div>
          </article>
        </div>
      </section>

      <section className="brand-finale">
        <div className="brand-finale-copy">
          <span className="eyebrow">결과를 읽는 기준</span>
          <h2>신뢰할 수 있는 검증은 점수와 근거를 함께 봅니다.</h2>
          <p>I SEE YOU는 단순한 AI 확률이 아니라, 어떤 입력 신호가 판단에 영향을 줬는지 함께 보여주도록 설계했습니다.</p>
          <div className="brand-finale-values">
            <article className="brand-value-card">
              <span>읽을 수 있는 근거</span>
              <p>점수, 카드, 타임라인, 간단한 시각화로 판단 과정을 확인합니다.</p>
            </article>
            <article className="brand-value-card">
              <span>입력별 역할 구분</span>
              <p>텍스트, 이미지, 영상, 멀티모달이 각각 어떤 단서를 보는지 분리해 설명합니다.</p>
            </article>
            <article className="brand-value-card">
              <span>보조적 판단</span>
              <p>AI 탐지 결과는 참고 자료이며, 원본 출처와 추가 확인을 함께 보는 것이 중요합니다.</p>
            </article>
          </div>
        </div>
        <div className="brand-finale-stage">
          <div className="brand-finale-orbit" />
          <model-viewer class="brand-finale-model" src={BRAND_MODEL_SRC} camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="10deg" interaction-prompt="none" shadow-intensity="1" exposure="1.08" touch-action="pan-y" />
          <div className="brand-finale-caption"><span>근거와 함께 보는 진위 판별</span><strong>I SEE YOU</strong></div>
        </div>
      </section>
    </main>
  )
}

function CategoryGlyph({ category }: { category: CategoryId }) {
  const path = category === 'image'
    ? 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM8.3 15.8h7.5l-2.65-3.4-1.9 2.25-1.35-1.6zm2.1-6.3a1.35 1.35 0 1 0 0-2.7 1.35 1.35 0 0 0 0 2.7'
    : category === 'text'
      ? 'M6 5h12v2H6zm0 4h12v2H6zm0 4h8v2H6zm0 4h12v2H6z'
      : category === 'video'
        ? 'M5 6.25A2.25 2.25 0 0 1 7.25 4h7.5A2.25 2.25 0 0 1 17 6.25v1.7l3.1-1.8c.42-.25.9.05.9.54v10.6c0 .49-.48.79-.9.54L17 16.03v1.72A2.25 2.25 0 0 1 14.75 20h-7.5A2.25 2.25 0 0 1 5 17.75z'
        : 'M6.5 5h4.25A1.5 1.5 0 0 1 12.2 6l.45 1.35c.2.58.74.97 1.36.97H17.5A1.5 1.5 0 0 1 19 9.82v7.68A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-11A1.5 1.5 0 0 1 6.5 5m2.2 4.2v5.6l4.7-2.8z'
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="category-glyph"><path d={path} /></svg>
}

function UploadZone({
  category,
  upload,
  onUploadState,
  onAnalyze,
  canAnalyze,
  isAnalyzing,
}: {
  category: CategoryConfig
  upload: UploadState
  onUploadState: Dispatch<SetStateAction<UploadState>>
  onAnalyze: () => void
  canAnalyze: boolean
  isAnalyzing: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const supportsUrlInput = category.uploadKind === 'video' || category.id === 'image'
  const urlHelper = category.id === 'image'
    ? 'JPG, PNG, WEBP 같은 직접 이미지 링크를 붙여넣으면 임시로 내려받아 바로 분석합니다.'
    : 'YouTube, Shorts, Reel, MP4 링크를 붙여넣으면 임시로 내려받아 바로 분석합니다.'
  const urlLabel = category.id === 'image' ? '분석할 이미지 주소' : '분석할 영상 주소'
  const urlPlaceholder = category.id === 'image' ? 'https://example.com/image.jpg' : 'https://www.youtube.com/watch?v=...'
  const emptyUrlPrompt = category.id === 'image' ? '분석할 이미지 주소를 입력해 주세요' : '분석할 영상 주소를 입력해 주세요'
  const hasReadyInput = canAnalyze && (upload.sourceMode === 'url' || upload.file !== null || (category.uploadKind === 'text' && upload.textValue.trim().length > 0))

  const setFile = async (file: File | null) => {
    if (!file) return
    onUploadState((current) => {
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return {
        ...current,
        sourceMode: 'file',
        sourceUrl: '',
        file,
        previewUrl: category.uploadKind === 'text' ? '' : URL.createObjectURL(file),
      }
    })
    if (category.uploadKind === 'text') {
      const content = await file.text()
      onUploadState((current) => ({ ...current, file, textValue: content }))
    }
  }

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await setFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    onUploadState((current) => ({ ...current, dragging: false }))
    await setFile(event.dataTransfer.files?.[0] ?? null)
  }
  return (
    <section className={`upload-surface ${upload.dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); onUploadState((current) => ({ ...current, dragging: true })) }} onDragLeave={() => onUploadState((current) => ({ ...current, dragging: false }))} onDrop={onDrop}>
      <input ref={inputRef} type="file" accept={category.uploadAccept} hidden onChange={onFileChange} />
      {supportsUrlInput ? (
        <div className="upload-mode-switch">
          <button type="button" className={upload.sourceMode === 'file' ? 'is-active' : ''} onClick={() => onUploadState((current) => ({ ...current, sourceMode: 'file' }))}>파일 업로드</button>
          <button type="button" className={upload.sourceMode === 'url' ? 'is-active' : ''} onClick={() => onUploadState((current) => ({ ...current, sourceMode: 'url', file: null, previewUrl: '' }))}>주소 입력</button>
        </div>
      ) : null}
      <div className="upload-stage">
        {category.uploadKind === 'text' ? (
          <textarea className="upload-textarea" placeholder={category.inputHint} value={upload.textValue} onChange={(event) => onUploadState((current) => ({ ...current, textValue: event.target.value }))} />
        ) : supportsUrlInput && upload.sourceMode === 'url' ? (
          <div className="upload-url-shell">
            <div className="upload-placeholder upload-placeholder-url">
              <CategoryGlyph category={category.id} />
              <strong>{categoryNameKo(category.id)} URL 분석</strong>
              <span>{urlHelper}</span>
            </div>
            <label className="upload-url-input-shell">
              <span>{urlLabel}</span>
              <input
                type="url"
                className="upload-url-input"
                placeholder={urlPlaceholder}
                value={upload.sourceUrl}
                onChange={(event) => onUploadState((current) => ({ ...current, sourceUrl: event.target.value }))}
              />
            </label>
            <p className="upload-url-note">{category.id === 'image' ? '파일 업로드 대신 주소만으로도 분석할 수 있습니다. 정밀 모델은 RGB와 FFT 단서를 함께 읽고, 얼굴이 있으면 얼굴 중심 재판독까지 반영합니다.' : '파일 업로드 대신 주소만으로 분석할 수 있습니다. 길이가 긴 영상도 시작·중간·끝 구간을 샘플링해 처리합니다.'}</p>
          </div>
        ) : upload.previewUrl && upload.file?.type.startsWith('image/') ? (
          <img src={upload.previewUrl} alt="preview" className="upload-preview-image" />
        ) : upload.previewUrl && upload.file?.type.startsWith('video/') ? (
          <video src={upload.previewUrl} className="upload-preview-video" controls />
        ) : (
          <div className="upload-placeholder"><CategoryGlyph category={category.id} /><strong>{categoryNameKo(category.id)} 분석 스튜디오</strong><span>{category.inputHint}</span><small>{MODE_GUIDES[category.id].purpose}</small></div>
        )}
      </div>
      <div className="upload-toolbar">
        <div>
          <span className="upload-label">{category.kicker}</span>
          <strong>{supportsUrlInput && upload.sourceMode === 'url' ? (upload.sourceUrl.trim() || emptyUrlPrompt) : (upload.file?.name ?? '파일을 올려 주세요')}</strong>
        </div>
        {hasReadyInput ? (
          <button type="button" className="primary-cta" onClick={onAnalyze} disabled={!canAnalyze || isAnalyzing}>{isAnalyzing ? '분석 중...' : '진위 판별 시작'}</button>
        ) : (
          <button type="button" className="secondary-cta" onClick={() => inputRef.current?.click()}>{category.uploadKind === 'text' ? 'TXT 업로드' : '파일 선택'}</button>
        )}
      </div>
    </section>
  )
}

function ProgressRail({
  stages,
  progress,
  isLive,
  statusLabel,
  statusDetail,
  category,
  upload,
}: {
  stages: string[]
  progress: number
  isLive: boolean
  statusLabel: string
  statusDetail: string
  category: CategoryConfig
  upload: UploadState
}) {
  const stageThresholds = [18, 52, 86, 100]
  return (
    <section className="progress-rail">
      <div className="progress-rail-header">
        <div>
          <span className="eyebrow">분석 진행</span>
          <h3>현재 처리 상태</h3>
          <p className="progress-status-detail"><strong>{statusLabel}</strong><span>{statusDetail}</span></p>
        </div>
        <div className="progress-percent-box"><strong>{Math.round(progress)}%</strong><span>{progress < 100 ? '응답 대기 기준' : '완료'}</span></div>
      </div>
      <AnalysisScanPreview category={category} upload={upload} isLive={isLive} statusLabel={statusLabel} progress={progress} />
      <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /><div className={`progress-glow ${isLive ? 'is-live' : ''}`} style={{ left: `${progress}%` }} /></div>
      <div className="progress-stage-row">{stages.map((stage, index) => <div key={stage} className={`progress-stage ${progress >= (stageThresholds[index] ?? ((index + 1) / stages.length) * 100) ? 'is-active' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{stage}</strong></div>)}</div>
    </section>
  )
}

function AnalysisScanPreview({
  category,
  upload,
  isLive,
  statusLabel,
  progress,
}: {
  category: CategoryConfig
  upload: UploadState
  isLive: boolean
  statusLabel: string
  progress: number
}) {
  const directVideoUrl = upload.sourceMode === 'url' && canRenderDirectVideoUrl(upload.sourceUrl) ? upload.sourceUrl.trim() : ''
  const trimmedUrl = upload.sourceUrl.trim()
  const youtubeVideoId = upload.sourceMode === 'url' ? extractYouTubeVideoId(trimmedUrl) : ''
  const textPreview = upload.textValue.trim()
  const fileLabel = upload.file?.name ?? (trimmedUrl || `${categoryNameKo(category.id)} 입력`)

  let content: ReactNode
  if (upload.previewUrl && upload.file?.type.startsWith('image/')) {
    content = <img src={upload.previewUrl} alt="분석 입력 이미지 미리보기" className="analysis-scan-media" />
  } else if (upload.previewUrl && upload.file?.type.startsWith('video/')) {
    content = <video src={upload.previewUrl} className="analysis-scan-media" controls loop autoPlay playsInline />
  } else if (directVideoUrl) {
    content = <video src={directVideoUrl} className="analysis-scan-media" controls loop autoPlay playsInline />
  } else if (youtubeVideoId && (category.id === 'video' || category.id === 'multimodal')) {
    content = (
      <iframe
        className="analysis-scan-media analysis-scan-youtube"
        src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=0&loop=1&playlist=${youtubeVideoId}&controls=1&modestbranding=1&playsinline=1&rel=0`}
        title="분석 입력 YouTube 영상 미리보기"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    )
  } else if (category.uploadKind === 'text' || textPreview) {
    content = (
      <div className="analysis-scan-text">
        <span>TEXT INPUT</span>
        <p>{textPreview || '입력된 텍스트를 분석 요청으로 준비하고 있습니다.'}</p>
      </div>
    )
  } else if (trimmedUrl) {
    content = (
      <div className="analysis-scan-url">
        <CategoryGlyph category={category.id} />
        <span>URL TARGET</span>
        <strong>{trimmedUrl}</strong>
      </div>
    )
  } else {
    content = (
      <div className="analysis-scan-url">
        <CategoryGlyph category={category.id} />
        <span>INPUT TARGET</span>
        <strong>{fileLabel}</strong>
      </div>
    )
  }

  return (
    <div className={`analysis-scan-preview ${isLive ? 'is-live' : ''}`}>
      <div className="analysis-scan-stage">
        {content}
        <div className="analysis-scan-grid" aria-hidden="true" />
        <div className="analysis-scan-beam" aria-hidden="true" />
        <div className="analysis-scan-line" aria-hidden="true" />
        <div className="analysis-scan-hud">
          <span>{categoryNameKo(category.id)} scan</span>
          <strong>{statusLabel}</strong>
          <small>{fileLabel}</small>
        </div>
        <div className="analysis-scan-progress" style={{ ['--scan-progress' as string]: `${Math.max(4, Math.min(100, progress))}%` } as CSSProperties} aria-hidden="true" />
      </div>
    </div>
  )
}

function progressCopyFor(category: CategoryConfig, progress: number): { label: string; detail: string } {
  const inputName = category.id === 'text' ? '텍스트' : category.id === 'image' ? '이미지' : category.id === 'video' ? '영상' : '입력'
  if (progress < 18) {
    return {
      label: `${inputName} 입력을 서버 요청으로 준비하는 중`,
      detail: '현재 단계는 클라이언트 상태입니다. 파일/텍스트와 선택한 모델 설정을 분석 API 요청으로 묶고 있습니다.',
    }
  }
  if (progress < 52) {
    const detail = category.id === 'text'
      ? '텍스트 분석 API가 응답하기를 기다리는 중입니다. 언어 감지와 LOG-AID/DeBERTa 모델 추론은 서버에서 수행됩니다.'
      : category.id === 'image'
        ? '이미지 분석 API가 응답하기를 기다리는 중입니다. RGB/FFT/얼굴 초점 판독은 서버에서 수행됩니다.'
        : category.id === 'video'
          ? '영상 분석 API가 응답하기를 기다리는 중입니다. 6개 균등 샘플 프레임과 7개 EfficientNet-B0 앙상블 추론은 서버에서 수행됩니다.'
          : '멀티모달 분석 API가 응답하기를 기다리는 중입니다. 사용 가능한 얼굴·입술·음성·텍스트 단서를 서버에서 확인합니다.'
    return { label: '서버 모델 추론 대기 중', detail }
  }
  if (progress < 86) {
    const detail = category.id === 'text'
      ? '서버 응답을 기다리는 동안 결과 UI를 대기 상태로 유지합니다. 실제 판정 수치는 서버 응답이 도착한 뒤에만 표시됩니다.'
      : category.id === 'image'
        ? '서버 응답을 기다리는 동안 이미지 결과 패널을 준비합니다. heatmap/주파수 설명은 판정 응답 이후에 채워집니다.'
        : category.id === 'video'
          ? '서버 응답을 기다리는 동안 영상 결과 패널을 준비합니다. 표시되는 수치는 서버 응답 전에는 확정값이 아닙니다.'
          : '서버 응답을 기다리는 동안 모달별 결과 패널을 준비합니다. 6개 모델 점수와 gate/down-weight 정보는 응답 이후 확정됩니다.'
    return { label: '응답 수신 및 결과 패널 준비 중', detail }
  }
  return {
    label: '서버 응답 확인 중',
    detail: '진행률은 86%에서 멈춰 실제 분석 응답을 기다립니다. 100%는 결과 payload가 도착하거나 설명 생성이 끝난 뒤에만 표시됩니다.',
  }
}

function getTextInputIssue(text: string): string | null {
  const normalized = text.trim()
  const words = normalized.match(/[\uac00-\ud7a3A-Za-z0-9%$#@'_-]+/g) ?? []
  const sentences = normalized.split(/[.!?。！？\n]+/).map((item) => item.trim()).filter(Boolean)
  if (normalized.length < 30 || words.length < 8 || sentences.length < 2) {
    return '텍스트가 너무 짧아 신뢰할 수 있는 판별을 진행하지 않았습니다. 최소 두 문장 이상, 30자 이상으로 입력해 주세요.'
  }
  return null
}

function ResultReadingSummary({ category, analysis }: { category: CategoryConfig; analysis: Analysis }) {
  const isFake = analysis.fakePercent >= analysis.realPercent
  const dominantPercent = Math.max(analysis.realPercent, analysis.fakePercent)
  const topMetric = analysis.metrics[0]
  const topReason = analysis.reasons[0]
  const topBar = analysis.bars.length
    ? [...analysis.bars].sort((a, b) => b.score - a.score)[0]
    : undefined
  const topSlice = analysis.timeline.length
    ? [...analysis.timeline].sort((a, b) => b.score - a.score)[0]
    : undefined
  const topModality = analysis.modalityJudgments?.length
    ? [...analysis.modalityJudgments].sort((a, b) => Math.max(b.realPercent, b.fakePercent) - Math.max(a.realPercent, a.fakePercent))[0]
    : undefined
  const evidenceLabel = category.id === 'multimodal'
    ? topModality?.label ?? topBar?.label ?? topMetric?.label ?? '종합 단서'
    : category.id === 'text'
      ? topSlice?.label ?? topBar?.label ?? '문장/표현 신호'
      : topBar?.label ?? topMetric?.label ?? '핵심 시각 단서'
  const evidenceBody = category.id === 'multimodal'
    ? topModality?.reason ?? topReason?.body ?? '모달리티별 점수와 정합성 관계를 함께 확인하세요.'
    : category.id === 'text'
      ? topSlice?.note ?? topReason?.body ?? '문장 span과 표현 하이라이트를 함께 확인하세요.'
      : topReason?.body ?? topBar?.note ?? '시각화된 단서와 세부 타임라인을 함께 확인하세요.'
  const nextTarget = category.id === 'multimodal'
    ? topSlice ? `${topSlice.label} ${topSlice.start}-${topSlice.end}` : '정합성 지도'
    : category.id === 'text'
      ? topSlice ? `${topSlice.label} 문장 해석` : '표현 하이라이트'
      : category.id === 'video'
        ? topSlice ? `${topSlice.label} 프레임` : '대표 프레임'
        : 'XAI 시각화'
  const cards = [
    {
      step: '01',
      label: '최종 판정',
      title: `${analysis.verdictLabel} · ${formatPercent(dominantPercent)}`,
      body: `Real ${formatPercent(analysis.realPercent)} / Fake ${formatPercent(analysis.fakePercent)} 기준으로 먼저 판정 방향을 확인합니다.`,
    },
    {
      step: '02',
      label: '핵심 근거',
      title: evidenceLabel,
      body: evidenceBody,
    },
    {
      step: '03',
      label: '먼저 볼 위치',
      title: nextTarget,
      body: category.id === 'multimodal'
        ? '영상 위 감지 단서, 구간별 점수, 정합성 지도를 순서대로 보면 결과 흐름이 가장 잘 보입니다.'
        : category.id === 'text'
          ? '문장별 점수와 하이라이트된 표현을 함께 보되, 단어 하나를 단독 원인으로 해석하지 않습니다.'
          : '시각화 패널에서 표시된 영역을 먼저 보고, 필요하면 세부 타임라인을 펼쳐 확인합니다.',
    },
    {
      step: '04',
      label: '해석 기준',
      title: isFake ? '의심 신호 중심으로 확인' : '정합 신호 중심으로 확인',
      body: '이 결과는 최종 사실 확인을 대체하지 않는 보조 판단 도구입니다. 수치와 설명 근거를 함께 읽어야 합니다.',
    },
  ]

  return (
    <section className="result-reading-summary" aria-label="결과 읽는 순서">
      <div className="result-reading-head">
        <div>
          <span className="eyebrow">READING ORDER</span>
          <h3>결과는 이 순서로 보면 됩니다</h3>
        </div>
        <div className={`result-reading-badge ${isFake ? 'is-fake' : 'is-real'}`}>
          <span>{isFake ? 'Fake-side' : 'Real-side'}</span>
          <strong>{formatPercent(dominantPercent)}</strong>
        </div>
      </div>
      <div className="result-reading-grid">
        {cards.map((card) => (
          <article key={card.step} className="result-reading-card">
            <span>{card.step} · {card.label}</span>
            <strong>{card.title}</strong>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function TextResultDashboard({ analysis, profile }: { analysis: Analysis; profile: Profile }) {
  const isFake = analysis.fakePercent >= analysis.realPercent
  const winnerLabel = isFake ? 'AI 생성/합성 쪽 신호' : '사람 작성/진본 쪽 신호'
  const winnerScore = Math.max(analysis.fakePercent, analysis.realPercent)
  const modelState = analysis.metrics.find((metric) => metric.label === 'Model state')
  const language = analysis.metrics.find((metric) => metric.label === 'Language')
  const evidenceTokens = analysis.tokens.filter((token) => token.tag !== 'context' && token.weight >= 0.34)
  const topTokens = [...(evidenceTokens.length ? evidenceTokens : analysis.tokens)].sort((a, b) => b.weight - a.weight).slice(0, 8)
  const topSpan = [...analysis.timeline].sort((a, b) => b.score - a.score)[0]
  const dominantSignals = [
    { label: '모델 Fake 확률', value: analysis.fakePercent, note: isFake ? '최종 판정에서 Fake 쪽 확률이 Real보다 높았습니다.' : 'Fake 확률이 Real보다 낮아 최종 판정에서는 Real 쪽이 우세했습니다.' },
    { label: '표현 보조 신호 평균', value: topTokens.length ? topTokens.reduce((sum, token) => sum + token.weight, 0) / topTokens.length * 100 : 0, note: '반복, 긴 표현, 검증 출처 표현처럼 설명 가능한 보조 신호가 얼마나 강한지 보여줍니다.' },
    { label: '가장 큰 span 설명 신호', value: topSpan ? topSpan.score * 100 : 0, note: topSpan ? `${topSpan.label}에서 가장 큰 설명 신호가 관찰됐습니다.` : '문장 단위 설명 신호가 충분히 분리되지 않았습니다.' },
  ]
  const tokenWeightMap = new Map(analysis.tokens.map((token) => [token.text.toLowerCase(), token]))
  const matrixTokens = analysis.tokens.slice(0, 24)
  const relationTokenPool = analysis.timeline
    .flatMap((slice, sentenceIndex) => slice.note.split(/[\s,.;:!?()[\]{}"'“”‘’]+/).map((word) => ({ word, sentenceIndex })))
    .map(({ word, sentenceIndex }) => {
      const normalized = word.toLowerCase()
      const token = tokenWeightMap.get(normalized)
      return token ? { ...token, sentenceIndex } : null
    })
    .filter((token): token is { text: string; weight: number; tag: string; sentenceIndex: number } => Boolean(token))
  const relationEvidencePool = relationTokenPool.filter((token) => token.tag !== 'context' && token.weight >= 0.34)
  const relationContextAnchors = relationTokenPool.filter((token) => token.tag === 'context').slice(0, 3)
  const relationBaseTokens = relationEvidencePool.length
    ? [...relationEvidencePool, ...relationContextAnchors]
    : [...topTokens.map((token) => ({ ...token, sentenceIndex: -1 }))]
  const relationNodes = relationBaseTokens
    .filter((token, index, list) => list.findIndex((item) => item.text.toLowerCase() === token.text.toLowerCase()) === index)
    .sort((a, b) => (b.tag === 'context' ? 0 : b.weight) - (a.tag === 'context' ? 0 : a.weight))
    .slice(0, 12)
    .map((token, index, list) => ({
      ...token,
      x: list.length <= 1 ? 500 : 70 + (index * 860) / (list.length - 1),
      y: 245,
      index,
    }))
  const relationEdges = relationNodes.flatMap((source, sourceIndex) =>
    relationNodes.slice(sourceIndex + 1).map((target) => {
      const sameSentence = source.sentenceIndex >= 0 && source.sentenceIndex === target.sentenceIndex
      const sameTag = source.tag !== 'context' && source.tag === target.tag
      const distance = Math.abs(source.index - target.index)
      const rawStrength = ((source.weight + target.weight) / 2) + (sameSentence ? 0.18 : 0) + (sameTag ? 0.12 : 0) - distance * 0.035
      const strength = Math.max(0, Math.min(1, rawStrength))
      return { source, target, strength, sameSentence, sameTag, distance }
    })
  )
    .filter((edge) => edge.strength > 0.28 && edge.distance <= 5)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 18)
  const tagCopy: Record<string, { label: string; body: string }> = {
    repeat: { label: '반복 표현', body: '같은 표현이 반복되어 문장 구조가 템플릿처럼 보일 수 있는 신호입니다.' },
    long: { label: '긴 표현', body: '길고 정보량이 큰 표현이라 문체 패턴과 예측 가능성 판단에 더 크게 반영됩니다.' },
    grounding: { label: '검증 출처 표현', body: '출처, 근거, 보고서 같은 단어로 주장 검증 맥락을 설명하는 신호입니다.' },
    style: { label: '문체 표현', body: '문장 톤이나 일반화된 서술 흐름을 설명하는 보조 신호입니다.' },
    context: { label: '문맥 표현', body: '직접적인 AI 근거라기보다 주변 문맥을 잡아주는 기준점입니다.' },
  }
  const topRelationEdge = relationEdges[0]
  const fallbackRelationGuide = topRelationEdge
    ? `${topRelationEdge.source.text}와 ${topRelationEdge.target.text} 사이의 연결이 가장 강합니다. 두 표현이 ${topRelationEdge.sameSentence ? '같은 문장 안에서 함께 등장했고' : '가까운 문맥에서 함께 나타났고'}${topRelationEdge.sameTag ? `, 둘 다 ${tagCopy[topRelationEdge.source.tag]?.label ?? topRelationEdge.source.tag} 계열이라` : ''} 하나의 설명 묶음처럼 읽힙니다.`
    : '현재 입력에서는 강하게 묶이는 표현 관계가 적습니다. 이 경우 그래프는 개별 단어보다 전체 모델 판정과 문장 span 점수를 우선해서 읽는 편이 좋습니다.'
  const relationGuide = analysis.textLlmSections?.sentenceInterpretation ?? fallbackRelationGuide
  const sentenceInterpretations = analysis.timeline.slice(0, 3).map((slice) => {
    const sentenceTokens = relationTokenPool
      .filter((token) => token.sentenceIndex === Number(slice.start) - 1)
      .filter((token) => token.tag !== 'context' || token.weight >= 0.28)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4)
    const tokenText = sentenceTokens.length
      ? sentenceTokens.map((token) => `${token.text}(${tagCopy[token.tag]?.label ?? token.tag})`).join(', ')
      : '뚜렷한 표현 단서 없음'
    return {
      label: slice.label,
      score: Math.round(slice.score * 100),
      body: `${tokenText} 표현이 이 문장 span의 보조 설명 신호로 잡혔습니다. 이 수치는 판정 확률이 아니라, 해당 문장이 전체 설명에서 얼마나 눈에 띄는지를 나타냅니다.`,
    }
  })
  const highSignalBars = analysis.bars.filter((bar) => bar.score >= 0.5)
  const lowSignalBars = analysis.bars.filter((bar) => bar.score < 0.35)
  const aiTipItems = analysis.textLlmSections?.tip
    ? [analysis.textLlmSections.tip]
    : [
    highSignalBars.length
      ? `${highSignalBars.map((bar) => bar.label).join(', ')} 신호가 높으면 Fake 쪽 설명 보조 단서로 읽힙니다.`
      : '반복 표현, 문장 규칙성, 검증 출처 공백 신호가 낮으면 Fake 쪽 보조 단서가 약해집니다.',
    evidenceTokens.length
      ? `${evidenceTokens.slice(0, 4).map((token) => token.text).join(', ')} 같은 표현은 반복·긴 표현·검증 출처 표현 신호로 잡혔습니다.`
      : '현재 입력에서는 특정 단어 하나보다 전체 모델 확률과 문장 span 점수가 더 중요하게 보입니다.',
    lowSignalBars.length
      ? `${lowSignalBars.map((bar) => bar.label).join(', ')} 신호는 낮아 Real 쪽 해석을 방해하지 않았습니다.`
      : '보조 신호가 전반적으로 높으면 문장 전체가 템플릿처럼 보일 수 있습니다.',
  ]
  const flowSteps = [
    { label: '언어 감지', value: language?.value ?? 'auto', detail: language?.detail ?? profile.badge },
    { label: '모델 상태', value: modelState?.value ?? 'Model', detail: modelState?.detail ?? 'text detector' },
    { label: '판정 방향', value: isFake ? 'Fake' : 'Real', detail: `${formatPercent(winnerScore)} confidence axis` },
  ]
  const renderHighlightedSentence = (sentence: string): ReactNode[] =>
    sentence.split(/([\uac00-\ud7a3A-Za-z0-9%$#@'_-]+)/g).map((part, index) => {
      const token = tokenWeightMap.get(part.toLowerCase())
      if (!token) return part
      return (
        <mark
          key={`${part}-${index}`}
          className={`text-inline-evidence text-inline-${token.tag}`}
          style={{ ['--token-weight' as string]: String(token.weight) } as CSSProperties}
        >
          {part}
        </mark>
      )
    })
  const renderAiEvidenceSentence = (sentence: string): ReactNode[] =>
    sentence.split(/([\uac00-\ud7a3A-Za-z0-9%$#@'_-]+)/g).map((part, index) => {
      const token = tokenWeightMap.get(part.toLowerCase())
      const isEvidence = token && token.tag !== 'context' && token.weight >= 0.34
      if (!isEvidence || !token) return part
      return (
        <mark
          key={`${part}-${index}-ai-evidence`}
          className={`text-ai-cause-highlight text-ai-cause-${token.tag}`}
          style={{ ['--token-weight' as string]: String(token.weight) } as CSSProperties}
          title={`${tagCopy[token.tag]?.label ?? token.tag}: ${Math.round(token.weight * 100)}%`}
        >
          {part}
        </mark>
      )
    })

  return (
    <section className="result-dashboard text-result-dashboard">
      <div className="text-verdict-board">
        <div className="summary-copy">
          <span className="eyebrow">TEXT MODEL XAI</span>
          <h2>{analysis.summary}</h2>
          <p>{profile.title} 모델 경로에서 나온 실제 판정값을 기준으로, 토큰 기여도와 문장 span별 신호를 텍스트 전용으로 분리했습니다.</p>
          <DeveloperOverrideNotice analysis={analysis} />
        </div>
        <article className={`text-decision-card ${isFake ? 'is-fake' : 'is-real'}`}>
          <span>최종 판정</span>
          <strong>{analysis.verdictLabel}</strong>
          <b>{formatPercent(winnerScore)}</b>
          <small>{winnerLabel}가 우세합니다.</small>
        </article>
      </div>

      <div className="text-score-split" aria-label="text real fake score">
        <div>
          <span>Real</span>
          <strong>{formatPercent(analysis.realPercent)}</strong>
          <div className="text-score-track"><i className="real" style={{ width: scoreWidth(analysis.realPercent) }}><span>{formatPercent(analysis.realPercent)}</span></i></div>
        </div>
        <div>
          <span>Fake</span>
          <strong>{formatPercent(analysis.fakePercent)}</strong>
          <div className="text-score-track"><i className="fake" style={{ width: scoreWidth(analysis.fakePercent) }}><span>{formatPercent(analysis.fakePercent)}</span></i></div>
        </div>
      </div>

      <ResultReadingSummary category={CATEGORY_CONFIG.text} analysis={analysis} />
      <XaiTrustNotice compact />
      <ResultInterpretationGuide category={CATEGORY_CONFIG.text} analysis={analysis} />

      <section className="text-why-board">
        <div className="panel-header">
          <div>
            <span className="eyebrow">WHY</span>
            <h3>{isFake ? 'Fake 판정에 사용된 핵심 신호' : 'Real 판정에 사용된 핵심 신호'}</h3>
          </div>
          <span className="panel-chip">{isFake ? 'Fake-side signals' : 'Real-side signals'}</span>
        </div>
        <div className="text-why-grid">
          <article className="text-why-summary-card">
            <span>판정 방향</span>
            <strong>{winnerLabel}</strong>
            <p>{analysis.summary}</p>
            <div className="text-decision-axis">
              <b style={{ width: scoreWidth(analysis.realPercent) }}>Real {formatPercent(analysis.realPercent)}</b>
              <i style={{ width: scoreWidth(analysis.fakePercent) }}>Fake {formatPercent(analysis.fakePercent)}</i>
            </div>
          </article>
          <article className="text-token-rank-card">
            <span>모델 설명에 참고된 표현</span>
            <p className="text-token-rank-note">단어 자체가 AI라는 뜻이 아니라, 반복·문장 규칙성·검증 출처 공백 설명에 연결된 보조 표현입니다.</p>
            <div className="text-token-rank-list">
              {topTokens.map((token, index) => (
                <div key={`${token.tag}-${token.text}-${index}`} className="text-token-rank-row">
                  <div><strong>{token.text}</strong><small>{token.tag}</small></div>
                  <div className="text-token-rank-track"><i style={{ width: `${token.weight * 100}%` }} /></div>
                  <b>{Math.round(token.weight * 100)}%</b>
                </div>
              ))}
            </div>
          </article>
          <article className="text-sentence-risk-card">
            <span>문장별 설명 신호</span>
            <div className="text-sentence-risk-list">
              {analysis.timeline.map((slice) => (
                <div key={`${slice.label}-${slice.start}-risk`} className="text-sentence-risk-row">
                  <div className="text-sentence-risk-head"><strong>{slice.label}</strong><b>{Math.round(slice.score * 100)}%</b></div>
                  <div className="text-score-track"><i className={isFake ? 'fake' : 'real'} style={{ width: scoreWidth(slice.score * 100) }}><span>{Math.round(slice.score * 100)}%</span></i></div>
                  <p>{slice.note}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
        <div className="text-dominant-signal-row">
          {dominantSignals.map((signal) => (
            <article key={signal.label} className="text-dominant-signal">
              <span>{signal.label}</span>
              <strong>{formatPercent(signal.value)}</strong>
              <div className="timeline-bar"><div className="timeline-bar-fill" style={{ width: scoreWidth(signal.value) }}><span>{formatPercent(signal.value)}</span></div></div>
              <p>{signal.note}</p>
            </article>
          ))}
        </div>
      </section>

      {isFake ? (
        <section className="text-ai-cause-board">
          <div className="panel-header">
            <div>
              <span className="eyebrow">FAKE-SIDE EXPLANATION HIGHLIGHT</span>
              <h3>Fake 판정 설명에 연결된 표현</h3>
            </div>
            <span className="panel-chip">Fake {formatPercent(analysis.fakePercent)}</span>
          </div>
          <p className="text-ai-cause-note">하이라이트된 단어는 단독 원인이 아니라, 모델의 Fake 확률과 함께 해석되는 반복·긴 표현·검증 출처 표현 같은 설명용 보조 신호입니다. 진할수록 설명 신호가 강합니다.</p>
          <div className="text-ai-cause-layout">
            <article className="text-ai-cause-document">
              {analysis.timeline.map((slice) => (
                <section key={`${slice.label}-ai-cause`} className="text-ai-cause-sentence">
                  <div className="text-document-meta">
                    <strong>{slice.label}</strong>
                    <b>{Math.round(slice.score * 100)}%</b>
                  </div>
                  <p>{renderAiEvidenceSentence(slice.note)}</p>
                </section>
              ))}
            </article>
            <article className="text-ai-cause-legend">
              <span>주요 표현</span>
              {(evidenceTokens.length ? evidenceTokens : topTokens.filter((token) => token.tag !== 'context')).slice(0, 8).map((token) => (
                <div key={`${token.text}-${token.tag}-cause`} className="text-ai-cause-chip-row">
                  <strong>{token.text}</strong>
                  <small>{tagCopy[token.tag]?.label ?? token.tag}</small>
                  <b>{Math.round(token.weight * 100)}%</b>
                </div>
              ))}
            </article>
          </div>
        </section>
      ) : null}

      <section className="text-xai-lab">
        <div className="panel-header">
          <div>
            <span className="eyebrow">EXPLANATION CANVAS</span>
            <h3>원문 위에 얹은 보조 설명 신호</h3>
          </div>
          <span className="panel-chip">Document explanation trace</span>
        </div>
        <div className="text-lab-grid">
          <article className="text-document-panel">
            <span>Annotated document · 보조 단서 보기</span>
            <div className="text-document-scroll">
              {analysis.timeline.map((slice) => (
                <section key={`${slice.label}-doc`} className="text-document-sentence">
                  <div className="text-document-meta">
                    <strong>{slice.label}</strong>
                    <b>{Math.round(slice.score * 100)}%</b>
                  </div>
                  <p>{renderHighlightedSentence(slice.note)}</p>
                  <div className="text-document-rail">
                    <i className={isFake ? 'fake' : 'real'} style={{ width: scoreWidth(slice.score * 100) }}><span>{Math.round(slice.score * 100)}%</span></i>
                  </div>
                  {slice.evidence?.length ? <div className="text-document-evidence">{slice.evidence.map((item) => <span key={item}>{item}</span>)}</div> : null}
                </section>
              ))}
            </div>
          </article>

          <article className="text-token-matrix-panel">
            <span>Expression evidence matrix</span>
            <div className="text-token-matrix">
              {matrixTokens.map((token, index) => (
                <div
                  key={`${token.text}-${index}-matrix`}
                  className="text-token-tile"
                  style={{ ['--tile-weight' as string]: String(token.weight) } as CSSProperties}
                >
                  <strong>{token.text}</strong>
                  <small>{Math.round(token.weight * 100)}%</small>
                </div>
              ))}
            </div>
          </article>

          <article className="text-flow-panel">
            <span>Decision path</span>
            <div className="text-flow-stack">
              {flowSteps.map((step, index) => (
                <div key={step.label} className="text-flow-step">
                  <i>{String(index + 1).padStart(2, '0')}</i>
                  <div><strong>{step.label}</strong><span>{step.detail}</span></div>
                  <b>{step.value}</b>
                </div>
              ))}
            </div>
            <div className="text-radar-card">
              {analysis.bars.map((bar, index) => (
                <div key={`${bar.label}-radar`} className="text-radar-spoke" style={{ ['--spoke-index' as string]: String(index), ['--spoke-score' as string]: String(bar.score) } as CSSProperties}>
                  <i />
                  <span>{bar.label}</span>
                </div>
              ))}
              <strong>{isFake ? 'AI' : 'Real'}</strong>
            </div>
          </article>
        </div>
        <article className="text-attention-panel">
          <div className="text-attention-copy">
            <span>Attention-style relation map</span>
            <strong>표현들이 함께 설명 묶음으로 잡힌 관계</strong>
            <div className="text-attention-user-guide">
              <strong>사용자 설명</strong>
              <p>{analysis.textLlmSections?.userGuide ?? '큰 노드는 설명 신호가 상대적으로 강한 표현이고, 두꺼운 선은 함께 읽어야 할 표현 묶음입니다. 이 그래프는 단어 하나를 판정 원인으로 단정하기보다, 어떤 표현들이 같은 문장 안에서 반복·긴 표현·검증 출처 표현 같은 패턴으로 같이 작동했는지 확인하는 화면입니다.'}</p>
            </div>
            <div className="text-attention-user-guide is-interpretation">
              <strong>문장 해석</strong>
              <p>{relationGuide}</p>
            </div>
            <div className="text-attention-rule-list">
              {sentenceInterpretations.map((item) => (
                <div key={item.label}>
                  <strong>{item.label} · {item.score}%</strong>
                  <span>{item.body}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-attention-stage">
            <svg viewBox="0 0 1000 320" role="img" aria-label="attention style token relation map">
              <defs>
                <linearGradient id="textRelationEdge" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#ff6d9a" />
                  <stop offset="55%" stopColor="#ffbd59" />
                  <stop offset="100%" stopColor="#7cf7e4" />
                </linearGradient>
              </defs>
              {relationEdges.map((edge, index) => {
                const midX = (edge.source.x + edge.target.x) / 2
                const lift = 70 + Math.min(112, edge.distance * 24 + edge.strength * 44)
                return (
                  <path
                    key={`${edge.source.text}-${edge.target.text}-${index}`}
                    d={`M ${edge.source.x} ${edge.source.y - 18} Q ${midX} ${edge.source.y - lift} ${edge.target.x} ${edge.target.y - 18}`}
                    className="text-attention-edge"
                    style={{ ['--edge-strength' as string]: String(edge.strength) } as CSSProperties}
                  />
                )
              })}
              {relationNodes.map((node) => (
                <g key={`${node.text}-${node.index}`} className={`text-attention-node text-attention-node-${node.tag}`} transform={`translate(${node.x} ${node.y})`}>
                  <circle r={14 + node.weight * 12} style={{ ['--node-weight' as string]: String(node.weight) } as CSSProperties} />
                  <foreignObject x="-58" y="34" width="116" height="76">
                    <div className="text-attention-node-label">
                      <strong>{node.text}</strong>
                      <span>{node.tag}</span>
                    </div>
                  </foreignObject>
                </g>
              ))}
            </svg>
          </div>
        </article>
      </section>

      <div className="metric-grid text-metric-grid">
        {analysis.metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </div>

      <section className="result-signal-board text-xai-board text-xai-board-full">
        <div className="panel-header">
          <div>
            <span className="eyebrow">TEXT XAI</span>
            <h3>표현 단서와 문장 설명 신호</h3>
          </div>
          <span className="panel-chip">{analysis.xaiHeadline ?? 'Expression trace'}</span>
        </div>
        <div className="text-xai-main-grid">
          <article className="signal-board-panel text-token-panel">
            <span>Expression contribution</span>
            <div className="text-highlight-cloud text-highlight-cloud-dense">
              {analysis.tokens.map((token) => (
                <span key={`${token.tag}-${token.text}`} className="text-highlight-chip" style={{ opacity: 0.45 + token.weight * 0.55 }}>
                  {token.text}
                  <small>{token.tag}</small>
                </span>
              ))}
            </div>
            <p className="panel-caption">진하게 보이는 표현은 AI의 직접 증거가 아니라, 반복·길이·검증 출처 표현 같은 보조 설명 신호가 상대적으로 강한 부분입니다.</p>
          </article>

          <article className="signal-board-panel text-span-panel">
            <span>Sentence span map</span>
            <div className="timeline-list text-span-list">
              {analysis.timeline.map((slice) => (
                <div key={`${slice.label}-${slice.start}`} className="timeline-item timeline-item-rich">
                  <div className="timeline-meta"><strong>{slice.label}</strong><span>{slice.start} - {slice.end}</span></div>
                  <div className="timeline-score-row">
                    <div className="timeline-bar"><div className="timeline-bar-fill" style={{ width: scoreWidth(slice.score * 100) }}><span>{(slice.score * 100).toFixed(1)}%</span></div></div>
                    <b>{(slice.score * 100).toFixed(1)}%</b>
                  </div>
                  <p>{slice.note}</p>
                  {slice.evidence?.length ? <div className="timeline-evidence-list">{slice.evidence.map((item) => <div key={item} className="timeline-evidence-chip">{item}</div>)}</div> : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <div className="text-explain-grid">
        <article className="pipeline-panel">
          <div className="panel-header"><div><span className="eyebrow">MODEL ROUTE</span><h3>텍스트 모델 연결 흐름</h3></div><span className="panel-chip">{language?.value ?? 'auto'}</span></div>
          <div className="reasoning-list compact">
            {(analysis.fusionSteps ?? []).map((step, index) => (
              <div key={step.title} className="reasoning-card">
                <span className="stage-index">{String(index + 1).padStart(2, '0')}</span>
                <strong>{step.title}</strong>
                <span className="reasoning-weight">{step.weight}</span>
                <p>{step.logic}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="reasoning-panel">
          <div className="panel-header"><div><span className="eyebrow">WHY</span><h3>판정 근거</h3></div><span className="panel-chip">{modelState?.value ?? 'Model'}</span></div>
          <div className="reasoning-list">
            {analysis.reasons.map((reason) => <div key={reason.title} className="reasoning-card"><strong>{reason.title}</strong><p>{reason.body}</p></div>)}
          </div>
        </article>
      </div>

      <section className="result-signal-board text-model-signal-board">
        <div className="panel-header"><div><span className="eyebrow">SIGNAL BREAKDOWN</span><h3>모델 점수와 보조 설명 신호</h3></div></div>
        <div className="text-signal-grid">
          {analysis.bars.map((bar) => (
            <article key={bar.label} className="text-signal-card">
              <div className="modality-head"><strong>{bar.label}</strong><span>{Math.round(bar.score * 100)}%</span></div>
              <div className="timeline-bar"><div className="timeline-bar-fill" style={{ width: scoreWidth(bar.score * 100) }}><span>{Math.round(bar.score * 100)}%</span></div></div>
              <p>{bar.note}</p>
            </article>
          ))}
        </div>
        {analysis.modelTraits?.length ? (
          <div className="model-trait-list text-model-traits">
            {analysis.modelTraits.map((item) => <div key={item.model} className="model-trait-card"><div><strong>{item.model}</strong><span>{item.role}</span></div><p>{item.trait}</p><small>{item.contribution}</small></div>)}
          </div>
        ) : null}
      </section>

      <section className="text-tip-board">
        <div className="panel-header">
          <div>
            <span className="eyebrow">TIP</span>
            <h3>AI 생성물로 오탐되지 않고 신뢰도를 높이는 방법</h3>
          </div>
          <span className="panel-chip">{isFake ? 'AI-side review' : 'Real-side review'}</span>
        </div>
        <p className="text-tip-lead">이 안내는 탐지를 속이는 방법이 아니라, 현재 분석에서 어떤 신호가 AI/Real 판단에 영향을 줬는지 이해하고 글의 신뢰도를 높이기 위한 설명입니다.</p>
        <div className="text-tip-grid">
          <article>
            <span>AI 생성물로 읽히기 쉬운 경우</span>
            <ul>
              <li>같은 표현이나 비슷한 문장 구조가 반복될 때</li>
              <li>긴 일반론이 많고 구체적인 경험, 수치, 출처가 부족할 때</li>
              <li>문장 길이와 톤이 지나치게 균일해 템플릿처럼 보일 때</li>
              <li>주장은 많은데 검증 출처 표현이나 확인 가능한 맥락이 약할 때</li>
            </ul>
          </article>
          <article>
            <span>진짜 글로 읽히기 쉬운 경우</span>
            <ul>
              <li>구체적인 상황, 고유한 관찰, 실제 맥락이 자연스럽게 들어갈 때</li>
              <li>문장 길이와 리듬이 다양하고 수정 흔적이 자연스러울 때</li>
              <li>출처, 근거, 날짜, 인용처럼 검증 가능한 정보가 함께 제시될 때</li>
              <li>필요한 부분에는 불확실성이나 한계를 솔직히 표시할 때</li>
            </ul>
          </article>
          <article>
            <span>이번 입력에서 특히 본 신호</span>
            <ul>{aiTipItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
      </section>
    </section>
  )
}

function VideoXaiDashboard({ analysis }: { analysis: Analysis }) {
  const videoXai = analysis.videoXai
  if (!videoXai) return null
  const strongestFrame = [...videoXai.frames].sort((a, b) => b.pGen - a.pGen)[0]
  const highestWeightFrame = [...videoXai.frames].sort((a, b) => b.weight - a.weight)[0]
  const matrixColumns = videoXai.frames
  const matrixRows = videoXai.models
  const topModel = [...videoXai.models].sort((a, b) => b.avgPGen - a.avgPGen)[0]
  const lowModel = [...videoXai.models].sort((a, b) => a.avgPGen - b.avgPGen)[0]

  return (
    <section className="video-xai-board">
      <div className="panel-header">
        <div><span className="eyebrow">VIDEO XAI</span><h3>프레임별 확률과 7개 모델 합의도</h3></div>
        <span className="panel-chip">actual model output</span>
      </div>

      <div className="video-xai-summary-grid">
        <article>
          <span>가장 높은 generated 프레임</span>
          <strong>{strongestFrame?.label ?? '-'} · {strongestFrame ? formatPercent(strongestFrame.pGen * 100) : '-'}</strong>
          <p>프레임별 7개 모델 점수를 median으로 결합한 값입니다.</p>
        </article>
        <article>
          <span>최종 반영 가중치 최대</span>
          <strong>{highestWeightFrame?.label ?? '-'} · {highestWeightFrame ? formatPercent(highestWeightFrame.weight * 100) : '-'}</strong>
          <p>confidence_mean 단계에서 이 프레임이 상대적으로 크게 반영됐습니다.</p>
        </article>
        <article>
          <span>가장 민감한 모델</span>
          <strong>{topModel?.label ?? '-'} · {topModel ? formatPercent(topModel.avgPGen * 100) : '-'}</strong>
          <p>{topModel?.role ?? '확인 불가'}</p>
        </article>
        <article>
          <span>가장 보수적인 모델</span>
          <strong>{lowModel?.label ?? '-'} · {lowModel ? formatPercent(lowModel.avgPGen * 100) : '-'}</strong>
          <p>{lowModel?.role ?? '확인 불가'}</p>
        </article>
      </div>

      <div className="video-frame-strip" aria-label="sampled frame generated probability">
        {videoXai.frames.map((frame) => (
          <div key={frame.label} className="video-frame-tick">
            <div className="video-frame-score" style={{ height: `${Math.max(8, frame.pGen * 100)}%` }} />
            <strong>{frame.label.replace('Frame ', 'F')}</strong>
            <span>{frame.timestamp}</span>
            <b>{formatPercent(frame.pGen * 100)}</b>
          </div>
        ))}
      </div>

      <div className="video-xai-split">
        <article className="video-frame-preview-panel">
          <div className="panel-header compact"><div><span className="eyebrow">MODEL INPUT</span><h3>{videoXai.topFrameLabel} 원본과 마스크 적용 프레임</h3></div></div>
          <div className="video-mask-preview-grid">
            <div>
              {(videoXai.originalFocusFrame || analysis.focusFrameUrl) ? <img src={videoXai.originalFocusFrame || analysis.focusFrameUrl} alt="sampled original frame" /> : null}
              <span>원본 대표 프레임</span>
            </div>
            <div>
              {videoXai.maskedFocusFrame ? <img src={videoXai.maskedFocusFrame} alt="masked model input frame" /> : null}
              <span>마스크 적용 영역 시각화</span>
            </div>
          </div>
          <p>상단 8%와 하단 18% band를 median 색으로 가린 뒤 모델에 입력합니다. 오른쪽의 파란 가이드는 어떤 영역이 가려졌는지 쉽게 보이도록 덧씌운 화면용 표시입니다.</p>
        </article>

        <article className="video-matrix-panel">
          <div className="panel-header compact"><div><span className="eyebrow">MODEL x FRAME</span><h3>7개 모델이 각 프레임에서 낸 generated 확률</h3></div></div>
          <div className="video-xai-matrix" style={{ ['--video-frame-count' as string]: String(matrixColumns.length) } as CSSProperties}>
            <div className="matrix-corner" />
            {matrixColumns.map((frame) => <div key={frame.label} className="matrix-col-head">{frame.label.replace('Frame ', 'F')}</div>)}
            {matrixRows.map((model) => (
              <div key={model.label} className="matrix-row-fragment">
                <div className="matrix-row-head"><strong>{model.label}</strong><span>{model.imageSize}px</span></div>
                {matrixColumns.map((frame) => {
                  const score = frame.modelScores.find((item) => item.label === model.label)?.pGen ?? 0
                  return <div key={`${model.label}-${frame.label}`} className="matrix-cell" style={{ ['--cell-score' as string]: String(score) } as CSSProperties}><span>{Math.round(score * 100)}</span></div>
                })}
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="video-xai-explain-grid">
        <article><strong>사용자 설명</strong><p>{videoXai.interpretation}</p></article>
        <article><strong>모델 합의도</strong><p>{videoXai.consensus}</p></article>
        <article><strong>결과 해석 방법</strong><p>셀 색이 진할수록 해당 모델이 그 프레임에서 generated 가능성을 높게 본 것입니다. 최종 판정은 특정 셀 하나가 아니라 프레임별 median과 confidence_mean 집계를 거친 값입니다.</p></article>
      </div>
    </section>
  )
}

function ResultDashboard({ analysis, upload, category, profile, llmSectionStatus }: { analysis: Analysis; upload: UploadState; category: CategoryConfig; profile: Profile; llmSectionStatus: 'idle' | 'loading' | 'ready' | 'error' }) {
  if (category.id === 'text') {
    return <TextResultDashboard analysis={analysis} profile={profile} />
  }

  const isMultimodal = category.id === 'multimodal'
  const isVideo = category.id === 'video'
  const hasStructuredExplain = category.id === 'multimodal' || category.id === 'image' || category.id === 'video'
  const sectionText = (key: keyof XaiSections, fallback: string) => {
    if (llmSectionStatus === 'loading') return '설명을 정리하는 중입니다...'
    if (llmSectionStatus === 'error') return fallback
    return analysis.llmSections?.[key] ?? fallback
  }

  const multimodalInputs = analysis.availability
    ? [
        { label: '얼굴', active: analysis.availability.hasFace, value: Math.round(analysis.availability.faceRatio * 100), suffix: '% 프레임에서 얼굴 확인' },
        { label: '입술', active: analysis.availability.hasLips, value: Math.round(analysis.availability.mouthRatio * 100), suffix: '% 프레임에서 입술 추적' },
        { label: '음성', active: analysis.availability.hasSpeech, value: Math.round(analysis.availability.speechConfidence * 100), suffix: '% 수준의 단서' },
        { label: '텍스트', active: analysis.availability.hasText, value: Math.round(analysis.availability.textConfidence * 100), suffix: '% 수준의 단서' },
      ]
    : []
  const multimodalActiveCount = multimodalInputs.filter((item) => item.active).length
  const multimodalJudgments = analysis.modalityJudgments ?? []
  const multimodalFakeCount = multimodalJudgments.filter((item) => item.fakePercent >= item.realPercent).length
  const multimodalRealCount = multimodalJudgments.length - multimodalFakeCount
  const multimodalDominantJudgment = multimodalJudgments.length
    ? [...multimodalJudgments].sort((a, b) => Math.max(b.fakePercent, b.realPercent) - Math.max(a.fakePercent, a.realPercent))[0]
    : undefined
  const multimodalRiskJudgment = multimodalJudgments.length
    ? [...multimodalJudgments].sort((a, b) => (b.fakePercent - b.realPercent) - (a.fakePercent - a.realPercent))[0]
    : undefined
  const multimodalPeakSlice = analysis.timeline.length
    ? [...analysis.timeline].sort((a, b) => b.score - a.score)[0]
    : undefined
  const multimodalFusionTop = analysis.fusionWeights?.length ? analysis.fusionWeights[0] : undefined
  const multimodalSignalChecklist = [
    { label: '얼굴', icon: '🙂', active: analysis.availability?.hasFace ?? false, detail: analysis.availability ? `${Math.round(analysis.availability.faceRatio * 100)}% 프레임에서 얼굴 확인` : '확인 전' },
    { label: '입술', icon: '👄', active: analysis.availability?.hasLips ?? false, detail: analysis.availability ? `${Math.round(analysis.availability.mouthRatio * 100)}% 프레임에서 입술 추적` : '확인 전' },
    { label: '음성', icon: '🎙️', active: analysis.availability?.hasSpeech ?? false, detail: analysis.availability ? `${Math.round(analysis.availability.speechConfidence * 100)}% 수준의 음성 단서` : '확인 전' },
    { label: '자막/텍스트', icon: '📝', active: analysis.availability?.hasText ?? false, detail: analysis.availability ? `${Math.round(analysis.availability.textConfidence * 100)}% 수준의 자막/문장 단서` : '확인 전' },
    { label: '프레임', icon: '🎞️', active: Boolean(analysis.processingScope?.sampleFrames || analysis.timeline.length), detail: analysis.processingScope ? `${analysis.processingScope.sampleFrames} frames` : `${analysis.timeline.length} spans` },
    { label: '주파수', icon: '📡', active: Boolean(analysis.frequencyComparison || analysis.spectrumBins?.length), detail: analysis.frequencyComparison ? 'FFT compared' : '보조 근거' },
  ]
  const multimodalFrameUseRows = analysis.processingScope?.windows?.length
    ? analysis.processingScope.windows.map((sampleWindow, index) => {
        const slice = analysis.timeline[index] ?? multimodalPeakSlice
        return {
          label: sampleWindow.label,
          range: `${sampleWindow.startLabel} - ${sampleWindow.endLabel}`,
          score: slice ? slice.score * 100 : 0,
          verdict: slice ? (slice.score >= 0.5 ? 'Fake 신호 확인' : 'Real 정합성 확인') : '샘플 구간',
          note: slice?.note ?? '대표 프레임과 오디오/자막 단서를 함께 읽은 구간입니다.',
        }
      })
    : analysis.timeline.slice(0, 3).map((slice) => ({
        label: slice.label,
        range: `${slice.start} - ${slice.end}`,
        score: slice.score * 100,
        verdict: slice.score >= 0.5 ? 'Fake 신호 확인' : 'Real 정합성 확인',
        note: slice.note,
      }))

  const judgeByLabel = (pattern: RegExp) => multimodalJudgments.find((item) => pattern.test(item.label))
  const relationTone = (fakePercent: number, realPercent: number) => fakePercent >= realPercent ? 'fake' : 'real'
  const relationPercent = (fakePercent: number, realPercent: number) => Math.max(fakePercent, realPercent)
  const relationLabel = (fakePercent: number, realPercent: number) => fakePercent >= realPercent ? '어긋남 쪽 근거' : '정합 쪽 근거'
  const relationStrengthText = (score: number) => score >= 70 ? '강한 근거' : score >= 56 ? '보통 근거' : score >= 45 ? '약한 근거' : '해석 제한'
  const relationScoreNote = '아래 반영 비중은 이 결과 설명 안에서 각 관계가 차지한 상대적 비중입니다. 5개 관계의 합은 100%가 되도록 정규화했습니다.'
  const readableModelReason = (reason: string) => reason
    .replaceAll('가용성이 낮아', '분석에 충분한 단서가 적어')
    .replaceAll('가용성이 낮', '분석 단서가 적')
    .replaceAll('gated down', '낮은 비중 처리')
    .replaceAll('gate down', '낮은 비중 처리')
  const avSyncJudgment = judgeByLabel(/AVSync|Audio|Sync/i)
  const textJudgment = judgeByLabel(/OpenCLIP|BLIP|Text|NLI/i)
  const structureJudgment = judgeByLabel(/SceneGraph|Structure|Vision|Temporal/i)
  const frequencyJudgment = judgeByLabel(/Frequency|Audio/i)
  const peakRelationSlice = multimodalPeakSlice ?? analysis.timeline[0]
  const multimodalRelationRows = [
    {
      title: '얼굴 ↔ 입술',
      tone: analysis.availability?.hasFace && analysis.availability?.hasLips ? 'real' : 'muted',
      verdict: analysis.availability?.hasFace && analysis.availability?.hasLips ? '같은 인물에서 얼굴과 입술이 함께 잡힘' : '비교할 얼굴/입술 단서가 부족함',
      score: analysis.availability ? Math.round(((analysis.availability.faceRatio + analysis.availability.mouthRatio) / 2) * 100) : 0,
      body: analysis.availability?.hasFace && analysis.availability?.hasLips
        ? `전체 샘플 중 얼굴은 ${Math.round((analysis.availability?.faceRatio ?? 0) * 100)}% 정도에서 보였고, 입술 움직임은 ${Math.round((analysis.availability?.mouthRatio ?? 0) * 100)}% 정도에서 따라갈 수 있었습니다. 즉 모델은 같은 인물 영역 안에서 얼굴 위치와 입 주변 움직임을 함께 확인했고, 이 관계는 인물 단서가 안정적이라는 설명 근거로 쓰였습니다.`
        : '샘플 프레임에서 얼굴 또는 입술이 충분히 선명하게 잡히지 않았습니다. 이 경우 모델은 얼굴-입술 관계를 강한 판단 근거로 쓰지 않고, 다른 시각·음성·텍스트 단서의 비중을 더 크게 봅니다.',
    },
    {
      title: '입술 ↔ 음성',
      tone: avSyncJudgment ? relationTone(avSyncJudgment.fakePercent, avSyncJudgment.realPercent) : (analysis.availability?.hasLips && analysis.availability?.hasSpeech ? 'real' : 'muted'),
      verdict: avSyncJudgment ? relationLabel(avSyncJudgment.fakePercent, avSyncJudgment.realPercent) : '발화 타이밍 비교',
      score: avSyncJudgment ? relationPercent(avSyncJudgment.fakePercent, avSyncJudgment.realPercent) : Math.round(((analysis.availability?.mouthRatio ?? 0) + (analysis.availability?.speechConfidence ?? 0)) * 50),
      body: analysis.availability?.hasLips && analysis.availability?.hasSpeech
        ? (avSyncJudgment && avSyncJudgment.fakePercent >= avSyncJudgment.realPercent
          ? `입술 움직임과 음성 에너지의 시작·강세 흐름을 비교했을 때 완전히 맞물리지 않는 쪽 신호가 더 컸습니다. ${formatPercent(avSyncJudgment.fakePercent)}는 최종 Fake 확률이 아니라, 입술-음성 관계가 Fake 설명에 기여한 근거 강도입니다.`
          : `입술 움직임과 음성 에너지의 시작·강세 흐름이 비교적 자연스럽게 맞았습니다. ${formatPercent(avSyncJudgment ? avSyncJudgment.realPercent : 0)}는 최종 Real 확률이 아니라, 입술-음성 관계가 Real 설명에 기여한 근거 강도입니다.`)
        : '입술 움직임이나 음성 파형 중 하나가 충분히 선명하지 않았습니다. 그래서 이 카드는 “입술과 음성이 명확히 어긋났다”는 뜻이 아니라, 비교 자체의 신뢰도가 낮아 보조 근거로만 사용했다는 뜻입니다.',
    },
    {
      title: '장면 ↔ 자막/텍스트',
      tone: textJudgment ? relationTone(textJudgment.fakePercent, textJudgment.realPercent) : (analysis.availability?.hasText ? 'real' : 'muted'),
      verdict: textJudgment ? relationLabel(textJudgment.fakePercent, textJudgment.realPercent) : '장면과 문장 비교',
      score: textJudgment ? relationPercent(textJudgment.fakePercent, textJudgment.realPercent) : Math.round((analysis.availability?.textConfidence ?? 0) * 100),
      body: analysis.availability?.hasText
        ? (textJudgment && textJudgment.fakePercent >= textJudgment.realPercent
          ? `자막 또는 입력 텍스트가 화면에서 보이는 장면 설명과 충분히 맞물리지 않는 구간이 있어 Fake 쪽 설명 근거로 반영했습니다. ${formatPercent(textJudgment.fakePercent)}는 이 관계의 근거 강도입니다.`
          : `자막 또는 입력 텍스트가 화면 내용과 크게 충돌하지 않아 Real 쪽 설명 근거로 반영했습니다. ${formatPercent(textJudgment ? textJudgment.realPercent : 0)}는 이 관계의 근거 강도입니다.`)
        : '자막이나 함께 입력된 설명 문장이 거의 없어, 장면-텍스트 일치 여부를 강하게 판단하기 어렵습니다. 이 경우 모델은 텍스트 관계보다 프레임, 얼굴, 주파수 같은 다른 단서를 중심으로 결과를 설명합니다.',
    },
    {
      title: '프레임 흐름 ↔ 장면 구조',
      tone: structureJudgment ? relationTone(structureJudgment.fakePercent, structureJudgment.realPercent) : (peakRelationSlice && peakRelationSlice.score >= 0.5 ? 'fake' : 'real'),
      verdict: structureJudgment ? relationLabel(structureJudgment.fakePercent, structureJudgment.realPercent) : '시간 구간별 흐름 비교',
      score: structureJudgment ? relationPercent(structureJudgment.fakePercent, structureJudgment.realPercent) : Math.round((peakRelationSlice?.score ?? 0) * 100),
      body: structureJudgment
        ? `${readableModelReason(structureJudgment.reason)} 이 값은 얼굴·객체 위치, 장면 전환, 시간 흐름이 한 방향의 설명 근거로 얼마나 강하게 모였는지를 보여줍니다.`
        : (peakRelationSlice
          ? `${peakRelationSlice.label}(${peakRelationSlice.start}-${peakRelationSlice.end}) 구간에서 프레임 흐름 점수가 가장 크게 반영되었습니다. ${peakRelationSlice.note}`
          : '대표 프레임의 흐름과 장면 구조를 함께 확인했습니다.'),
    },
    {
      title: '음성 ↔ 주파수',
      tone: frequencyJudgment ? relationTone(frequencyJudgment.fakePercent, frequencyJudgment.realPercent) : (analysis.frequencyComparison ? 'real' : 'muted'),
      verdict: frequencyJudgment ? relationLabel(frequencyJudgment.fakePercent, frequencyJudgment.realPercent) : '소리 패턴과 주파수 비교',
      score: frequencyJudgment ? relationPercent(frequencyJudgment.fakePercent, frequencyJudgment.realPercent) : Math.max(...(analysis.frequencyComparison?.sample ?? analysis.spectrumBins ?? [0])),
      body: frequencyJudgment
        ? `${readableModelReason(frequencyJudgment.reason)} 여기서 %는 오디오/주파수 관계가 Real 또는 Fake 설명에 기여한 근거 강도이며, 최종 판정 확률과는 구분해서 봐야 합니다.`
        : (analysis.frequencyComparison?.note ?? '현재 영상의 소리·주파수 분포를 비교용 기준 패턴과 함께 확인했습니다.'),
    },
  ]

  const relationTotalStrength = multimodalRelationRows.reduce((sum, row) => sum + Math.max(row.score, 0), 0) || 1
  const relationContributionRows = multimodalRelationRows.map((row) => ({
    ...row,
    contribution: Number(((Math.max(row.score, 0) / relationTotalStrength) * 100).toFixed(1)),
  }))
  const modelJudgmentByPattern = (pattern: RegExp) => multimodalJudgments.find((item) => pattern.test(item.label))
  const hasFusionWeights = Boolean(analysis.fusionWeights?.length)
  const fusionWeightByPattern = (pattern: RegExp) => analysis.fusionWeights?.find((item) => pattern.test(item.label))?.weight ?? 0
  const relationMatches = relationContributionRows.filter((row) => row.tone === 'real').sort((a, b) => b.contribution - a.contribution)
  const relationMismatches = relationContributionRows.filter((row) => row.tone === 'fake').sort((a, b) => b.contribution - a.contribution)
  const relationLimited = relationContributionRows.filter((row) => row.tone === 'muted').sort((a, b) => b.contribution - a.contribution)
  const topConsistencySignal = relationMismatches[0] ?? relationMatches[0] ?? relationLimited[0]
  const modelArchitectureRows = [
    {
      id: 'openclip',
      model: 'OpenCLIP',
      input: '프레임 + 자막/입력 문장',
      architecture: 'Visual encoder와 text encoder가 같은 의미 공간에서 장면-문장 거리를 비교합니다.',
      role: '장면과 설명이 같은 내용을 가리키는지 확인',
      weight: fusionWeightByPattern(/OpenCLIP/i),
      judgment: modelJudgmentByPattern(/OpenCLIP/i),
    },
    {
      id: 'flava',
      model: 'FLAVA',
      input: '영상 프레임 + 언어 단서',
      architecture: '비전·언어 표현을 하나의 멀티모달 표현으로 묶어 전반 정합성을 봅니다.',
      role: '시각 단서와 언어 단서의 통합 판단',
      weight: fusionWeightByPattern(/FLAVA/i),
      judgment: modelJudgmentByPattern(/FLAVA/i),
    },
    {
      id: 'blip-nli',
      model: 'BLIP + NLI',
      input: '장면 설명 + 자막/텍스트',
      architecture: '장면 설명을 만들고, 그 설명과 텍스트 사이의 모순 가능성을 확인합니다.',
      role: '화면 설명과 문장 의미가 충돌하는지 확인',
      weight: fusionWeightByPattern(/BLIP|NLI/i),
      judgment: modelJudgmentByPattern(/BLIP|NLI|Text/i),
    },
    {
      id: 'avsync',
      model: 'AVSync',
      input: '입술 움직임 + 음성 에너지',
      architecture: '입 주변 움직임과 오디오 onset·강세 흐름의 시간 차이를 비교합니다.',
      role: '말하는 타이밍과 입 움직임이 맞는지 확인',
      weight: fusionWeightByPattern(/AVSync|Audio/i),
      judgment: modelJudgmentByPattern(/AVSync|Audio|Sync/i),
    },
    {
      id: 'frequency',
      model: 'Frequency',
      input: '프레임/오디오 주파수',
      architecture: 'FFT·주파수 분포에서 생성형 잔여 패턴이 강한지 비교합니다.',
      role: '시각·음성 포렌식 패턴 확인',
      weight: fusionWeightByPattern(/Frequency/i),
      judgment: modelJudgmentByPattern(/Frequency/i),
    },
    {
      id: 'scenegraph',
      model: 'SceneGraph',
      input: '얼굴·객체·장면 구조',
      architecture: '장면 안의 객체 위치와 관계 구조가 시간 흐름에서 안정적인지 확인합니다.',
      role: '인물·객체 관계와 장면 구조 안정성 확인',
      weight: fusionWeightByPattern(/SceneGraph|Structure/i),
      judgment: modelJudgmentByPattern(/SceneGraph|Structure/i),
    },
  ].map((item) => {
    const realPercent = item.judgment?.realPercent ?? (analysis.realPercent >= analysis.fakePercent ? analysis.realPercent : 100 - analysis.fakePercent)
    const fakePercent = item.judgment?.fakePercent ?? (analysis.fakePercent >= analysis.realPercent ? analysis.fakePercent : 100 - analysis.realPercent)
    const tone = fakePercent >= realPercent ? 'fake' : 'real'
    return {
      ...item,
      realPercent,
      fakePercent,
      tone,
      signal: Math.max(realPercent, fakePercent),
      verdict: item.judgment?.verdict ?? (tone === 'fake' ? 'Fake 쪽 근거' : 'Real 쪽 근거'),
      reason: item.judgment ? readableModelReason(item.judgment.reason) : '해당 모델의 세부 점수가 없을 때는 최종 융합 방향과 입력 단서 상태를 기준으로 보조 설명합니다.',
      weight: hasFusionWeights ? item.weight : Math.round(100 / 6),
    }
  })

  const architectureModeIdMap: Record<string, string> = {
    'mm-openclip': 'openclip',
    'mm-flava': 'flava',
    'mm-blip-nli': 'blip-nli',
    'mm-avsync': 'avsync',
    'mm-frequency': 'frequency',
    'mm-scenegraph': 'scenegraph',
  }
  const selectedArchitectureId = architectureModeIdMap[analysis.selectedMode ?? ''] ?? 'avsync'
  type ArchitectureStage = { title: string; op: string; shape: string; kind: 'input' | 'encoder' | 'embedding' | 'head' | 'gate' | 'fusion' | 'output' }
  type ArchitectureBlueprint = {
    family: string
    code: string
    tensor: string
    layout: 'contrastive' | 'service-head' | 'sync' | 'spectral' | 'graph'
    stages: ArchitectureStage[]
    equations: string[]
    featureGroups: string[]
  }
  const architectureBlueprintMap: Record<string, ArchitectureBlueprint> = {
    openclip: {
      family: 'OpenCLIP ViT-L/14 dual encoder',
      code: 'ensure_model() -> clip_real_fake() -> encode_image/encode_text -> cosine',
      tensor: 'face_crop/frame_rgb + prompt/text -> normalized d_clip embeddings',
      layout: 'contrastive',
      stages: [
        { title: 'Frame ROI', op: 'representative.face_crop', shape: 'RGB 224x224', kind: 'input' },
        { title: 'Vision Transformer', op: 'model.encode_image(image)', shape: 'z_img / ||z_img||', kind: 'encoder' },
        { title: 'Text Transformer', op: 'tokenizer(prompts + text) -> encode_text', shape: 'z_txt / ||z_txt||', kind: 'encoder' },
        { title: 'Shared Space', op: 'cos(z_img, z_txt)', shape: '[-1, 1] -> [0, 1]', kind: 'embedding' },
        { title: 'OpenCLIP Score', op: 'real/fake prompt softmax + text_alignment', shape: 'prob_fake_openclip', kind: 'output' },
      ],
      equations: ['real=(p0+p1)/sum(p)', 'fake=(p2+p3)/sum(p)', 'text_alignment=(cos+1)/2'],
      featureGroups: ['Authentic prompts', 'Synthetic prompts', 'Companion text', 'Representative ROI'],
    },
    flava: {
      family: 'ServiceHeadNet multimodal feature head',
      code: 'predict_service_head(method=flava), 0.65*head + 0.35*OpenCLIP anchor',
      tensor: '17-D service vector -> z-score -> MLP',
      layout: 'service-head',
      stages: [
        { title: 'Feature Vector', op: 'openclip + segment + face + mouth + audio + motion + text', shape: 'R^17', kind: 'input' },
        { title: 'Normalize', op: '(x - mean) / std', shape: 'z-score', kind: 'gate' },
        { title: 'MLP Block 1', op: 'Linear(17,24) + ReLU + Dropout(.05)', shape: 'R^24', kind: 'head' },
        { title: 'MLP Block 2', op: 'Linear(24,12) + ReLU', shape: 'R^12', kind: 'head' },
        { title: 'Anchor Mix', op: '0.65*sigmoid(head) + 0.35*prob_fake_openclip', shape: 'prob_fake_flava', kind: 'output' },
      ],
      equations: ['x=[clip, segment, face, mouth, audio, motion, text]', 'score=sigmoid(Linear12->1)', 'out=0.65*score+0.35*anchor'],
      featureGroups: ['segment_mean/topk/peak', 'face_detect_ratio', 'mouth_track_ratio', 'audio_energy_mean/std', 'motion_mean', 'text_tokens'],
    },
    'blip-nli': {
      family: 'Text-scene consistency service head',
      code: 'predict_service_head(method=blip_nli) + text gate',
      tensor: '12-D scene/text consistency vector -> MLP',
      layout: 'service-head',
      stages: [
        { title: 'Scene/Text Vector', op: 'openclip + segment + face + sharpness + text_tokens', shape: 'R^12', kind: 'input' },
        { title: 'Text Gate', op: 'text_tokens < 3 -> gate=.10 / neutral contraction', shape: 'gate_blip_nli', kind: 'gate' },
        { title: 'MLP Block 1', op: 'Linear(12,24) + ReLU + Dropout(.05)', shape: 'R^24', kind: 'head' },
        { title: 'MLP Block 2', op: 'Linear(24,12) + ReLU', shape: 'R^12', kind: 'head' },
        { title: 'Consistency Score', op: '0.65*head + 0.35*OpenCLIP anchor', shape: 'prob_fake_blip_nli', kind: 'output' },
      ],
      equations: ['text_missing -> contract_toward_neutral', 'gated_rel=prob*gate*(.70+.30*reliability)', 'out=anchor mixed service score'],
      featureGroups: ['prob_fake_openclip', 'visual_sharpness', 'text_tokens', 'precheck/reliability', 'segment stats'],
    },
    avsync: {
      family: 'Temporal AV synchronization head',
      code: 'audio_features() + motion_audio_sync() + predict_service_head(method=avsync)',
      tensor: 'mouth motion series + RMS audio envelope -> lag/correlation features',
      layout: 'sync',
      stages: [
        { title: 'Face/Mouth Track', op: 'face_box, mouth_box, mouth_track_ratio', shape: 'T boxes', kind: 'input' },
        { title: 'Audio Envelope', op: 'RMS 80ms window, hop 40ms', shape: 'T audio bins', kind: 'input' },
        { title: 'Lag Search', op: 'corr(motion[t], audio[t+lag]), lag=-4..4', shape: 'best_corr, best_lag', kind: 'encoder' },
        { title: 'Availability Gate', op: 'face<.30 or mouth<.20 or audio<q -> gate=.05', shape: 'gate_avsync', kind: 'gate' },
        { title: 'AVSync Head', op: 'ServiceHeadNet + anchor mix', shape: 'prob_fake_avsync', kind: 'output' },
      ],
      equations: ['sync=(best_corr+1)/2', 'if no speech/lips: contract_toward_neutral(.30)', 'out=service_head(x) mixed with OpenCLIP'],
      featureGroups: ['face_detect_ratio', 'mouth_track_ratio', 'audio_energy_mean/std', 'motion_mean', 'lag frames'],
    },
    frequency: {
      family: 'Spectral forensic service head',
      code: 'fft_artifact_score() + audio_features() + predict_service_head(method=frequency)',
      tensor: 'FFT(frame/audio) + segment statistics -> MLP',
      layout: 'spectral',
      stages: [
        { title: 'Visual FFT', op: 'torch.fft.fft2 -> fftshift -> log magnitude', shape: 'H x W spectrum', kind: 'input' },
        { title: 'Audio FFT', op: 'torch.fft.rfft(audio) -> flatness/mel energy', shape: '1-D spectrum', kind: 'input' },
        { title: 'Segment Pooling', op: 'mean, top-k mean, peak, segment_inv', shape: 'window stats', kind: 'embedding' },
        { title: 'Quality Gate', op: 'sharpness<q and audio<q -> gate=.20', shape: 'gate_frequency', kind: 'gate' },
        { title: 'Frequency Head', op: 'Linear(d,24)->12->1 + sigmoid', shape: 'prob_fake_frequency', kind: 'output' },
      ],
      equations: ['magnitude=log(|FFT|+1)', 'segment_inv=1-(.75*topk+.25*peak)', 'gated_rel=prob*gate*reliability_term'],
      featureGroups: ['visual_sharpness', 'audio_energy_mean/std', 'motion_mean', 'segment_topk_mean', 'segment_peak'],
    },
    scenegraph: {
      family: 'Geometry/scene-structure service head',
      code: 'face centers + area jitter + predict_service_head(method=scenegraph)',
      tensor: 'object/face geometry statistics -> MLP',
      layout: 'graph',
      stages: [
        { title: 'Node Extraction', op: 'face_box center, area, frame motion', shape: 'nodes over T', kind: 'input' },
        { title: 'Edge Dynamics', op: 'center std + area std + motion_mean', shape: 'temporal graph stats', kind: 'encoder' },
        { title: 'Scene Score', op: 'clamp(face_jitter*2.4 + area_jitter*3.2)', shape: 'structure cue', kind: 'embedding' },
        { title: 'Structure Gate', op: 'face<.20 and motion<q -> gate=.20', shape: 'gate_scenegraph', kind: 'gate' },
        { title: 'SceneGraph Head', op: 'ServiceHeadNet + OpenCLIP anchor', shape: 'prob_fake_scenegraph', kind: 'output' },
      ],
      equations: ['face_center=((x+w/2)/S,(y+h/2)/S)', 'face_jitter=std(cx)+std(cy)', 'scenegraph=clamp(jitter terms)'],
      featureGroups: ['face_detect_ratio', 'mean_face_area', 'motion_mean', 'visual_sharpness', 'precheck/reliability'],
    },
  }
  const architectureBlueprintRows = modelArchitectureRows.map((item) => {
    const blueprint = architectureBlueprintMap[item.id]
    const isSelected = item.id === selectedArchitectureId
    const isFinalActive = analysis.inferenceMode === 'single' ? isSelected : item.weight > 0
    return {
      ...item,
      blueprint,
      isSelected,
      isFinalActive,
      outputLabel: item.tone === 'fake' ? `Fake ${formatPercent(item.fakePercent)}` : `Real ${formatPercent(item.realPercent)}`,
      flowLabel: isSelected ? 'Selected' : isFinalActive ? 'Fusion active' : 'Computed / reference',
    }
  })
  const selectedArchitectureRow = architectureBlueprintRows.find((item) => item.id === selectedArchitectureId) ?? architectureBlueprintRows[0]
  const finalActiveRows = architectureBlueprintRows.filter((item) => item.isFinalActive)
  type ModalityJudgment = NonNullable<Analysis['modalityJudgments']>[number]
  const modelSignatures: Record<string, { glyph: string; tag: string; tone: string }> = {
    OpenCLIP: { glyph: '🖼️', tag: 'image-text match', tone: 'cyan' },
    FLAVA: { glyph: '🧩', tag: 'multi-signal fusion', tone: 'violet' },
    'BLIP+NLI': { glyph: '📝', tag: 'caption logic', tone: 'rose' },
    AVSync: { glyph: '👄', tag: 'lip-audio sync', tone: 'emerald' },
    'Frequency Fusion': { glyph: '〰️', tag: 'frequency trace', tone: 'amber' },
    'SceneGraph GCN': { glyph: '🕸️', tag: 'relation graph', tone: 'blue' },
    'Proposed Fusion': { glyph: '🎯', tag: 'final decision', tone: 'silver' },
  }
  const getModelSignature = (label: string) => {
    const normalized = label.replace(/\s+/g, '').toLowerCase()
    return Object.entries(modelSignatures).find(([key]) => normalized.includes(key.replace(/\s+/g, '').toLowerCase()))?.[1]
      ?? { glyph: '🔎', tag: 'model signal', tone: 'silver' }
  }
  const allModelVotes = analysis.modalityJudgments ?? []
  const finalFusionVote = allModelVotes.find((item) => /proposed\s*fusion|final\s*fusion/i.test(item.label))
  const displayModelVotes = allModelVotes.filter((item) => item !== finalFusionVote)
  const realModelVotes = displayModelVotes.filter((item) => item.realPercent >= item.fakePercent)
  const fakeModelVotes = displayModelVotes.filter((item) => item.fakePercent > item.realPercent)
  const finalVote: ModalityJudgment = finalFusionVote ?? {
    label: 'Final Fusion',
    realPercent: analysis.realPercent,
    fakePercent: analysis.fakePercent,
    verdict: analysis.verdictLabel,
    reason: analysis.summary,
  }
  const voteStrength = (item: ModalityJudgment) => Math.max(item.realPercent, item.fakePercent)
  const laneAverage = (rows: ModalityJudgment[]) => rows.length
    ? rows.reduce((total, item) => total + voteStrength(item), 0) / rows.length
    : 0
  const finalSide = finalVote.fakePercent > finalVote.realPercent ? 'fake' : 'real'
  const renderModelVoteCard = (item: ModalityJudgment) => {
    const side = item.fakePercent > item.realPercent ? 'fake' : 'real'
    const signature = getModelSignature(item.label)
    return (
      <article key={item.label} className={`model-vote-card is-${side} tone-${signature.tone}`}>
        <div className="model-vote-glyph" aria-hidden="true">{signature.glyph}</div>
        <div className="model-vote-body">
          <div className="model-vote-title">
            <strong>{item.label}</strong>
            <span>{signature.tag}</span>
          </div>
          <div className="model-vote-result">
            <b>{side === 'fake' ? 'AI-Generated 쪽' : 'Real 쪽'}</b>
            <em>{formatPercent(voteStrength(item))}</em>
          </div>
          <div className="model-vote-meter" aria-hidden="true"><i style={{ width: scoreWidth(voteStrength(item)) }} /></div>
          <small>Real {formatPercent(item.realPercent)} · AI {formatPercent(item.fakePercent)}</small>
          <p>{readableModelReason(item.reason)}</p>
        </div>
      </article>
    )
  }
  const architectureReaderMap: Record<string, { question: string; watches: string; computes: string; contribution: string }> = {
    openclip: {
      question: '화면과 설명이 같은 의미인가?',
      watches: '대표 프레임, 얼굴 ROI, real/fake prompt, 보조 텍스트를 봅니다.',
      computes: '이미지와 텍스트를 같은 임베딩 공간에 올린 뒤 cosine similarity와 prompt softmax로 Fake score를 만듭니다.',
      contribution: '다른 service head의 anchor로도 쓰이므로, 단순 1개 모델이 아니라 전체 파이프라인의 기준점 역할을 합니다.',
    },
    flava: {
      question: '시각·언어·오디오 단서가 한 방향으로 모이는가?',
      watches: 'OpenCLIP score, 구간 점수, 얼굴/입술 비율, 오디오 에너지, 움직임, 텍스트 길이를 함께 봅니다.',
      computes: '정규화된 feature vector를 작은 MLP head에 통과시키고 OpenCLIP anchor와 섞어 score를 만듭니다.',
      contribution: '최종 fusion에서 active weight가 있으면 종합 정합성 판단의 중심 단서로 반영됩니다.',
    },
    'blip-nli': {
      question: '장면 설명과 텍스트가 서로 모순되는가?',
      watches: '프레임 흐름, 화면 선명도, 텍스트 길이, OpenCLIP 기준 점수를 봅니다.',
      computes: '텍스트가 충분할 때 scene-text consistency vector를 MLP로 계산하고, 텍스트가 짧으면 gate로 영향력을 낮춥니다.',
      contribution: '자막/설명 입력이 있는 샘플에서 왜 장면-텍스트가 맞거나 어긋났는지 설명하는 보조 근거입니다.',
    },
    avsync: {
      question: '입술 움직임과 음성 타이밍이 맞는가?',
      watches: '얼굴 박스, 입술 박스, mouth_track_ratio, RMS audio envelope, lag correlation을 봅니다.',
      computes: '입 움직임과 음성 에너지의 시간 상관을 -4~+4 frame lag에서 비교한 뒤 MLP head와 gate를 거칩니다.',
      contribution: '딥페이크/더빙/합성 음성 의심에서 사용자가 가장 납득하기 쉬운 시간 정합성 근거입니다.',
    },
    frequency: {
      question: '영상/음성에 생성형 잔여 패턴이 있는가?',
      watches: '프레임 FFT, 오디오 FFT, sharpness, audio energy, segment mean/top-k/peak를 봅니다.',
      computes: '주파수 magnitude와 구간 통계를 service head로 보내고 품질이 낮으면 gate로 과신을 줄입니다.',
      contribution: '픽셀이나 음성 파형에서 눈으로 보기 어려운 포렌식 단서를 final fusion에 제공합니다.',
    },
    scenegraph: {
      question: '얼굴·객체·장면 구조가 시간 흐름에서 안정적인가?',
      watches: '얼굴 중심 좌표, 얼굴 면적, 움직임 평균, 장면 선명도, 구조 jitter를 봅니다.',
      computes: 'face center/area 변화량을 구조 feature로 만들고 MLP head로 장면 안정성 score를 계산합니다.',
      contribution: '현재 config에서 weight가 0이면 최종 평균에는 직접 들어가지 않지만, 구조 해석 카드에는 남겨 사용자가 확인할 수 있습니다.',
    },
  }
  const architectureReaderRows = architectureBlueprintRows.map((item) => ({
    ...item,
    reader: architectureReaderMap[item.id],
  }))
  const architectureGlobalSteps = [
    { label: '1. 샘플링', body: '원본 영상에서 대표 프레임, 얼굴/입술 ROI, 오디오 구간, 텍스트 입력을 추출합니다.' },
    { label: '2. 단서 추출', body: '임베딩, FFT, 음성 에너지, 움직임, 얼굴 구조 같은 서로 다른 feature를 만듭니다.' },
    { label: '3. 6개 score', body: 'OpenCLIP과 5개 service head가 각각 prob_fake 값을 출력합니다.' },
    { label: '4. gate/reliability', body: '단서가 부족한 모델은 영향력을 낮춰 과신하지 않게 합니다.' },
    { label: '5. 최종 판정', body: analysis.inferenceMode === 'single' ? '단독 모드에서는 선택 모델 score를 최종 결과로 사용합니다.' : '융합 모드에서는 active weight가 있는 모델 score를 weighted mean으로 합칩니다.' },
  ]



  return (
    <section className="result-dashboard">
        <div className="result-summary">
          <div className="summary-copy"><span className="eyebrow">{category.kicker}</span><h2>{analysis.summary}</h2><p>{isMultimodal ? `${analysis.inferenceMode === 'single' ? '선택한 모델의 분석 결과만 사용해 최종 판정 값을 산출했습니다.' : '6개 모델 점수와 사전 탐지 결과를 종합해 최종 판정 값을 산출했습니다.'}` : category.id === 'image' ? 'RGB 장면 단서와 FFT 주파수 단서를 함께 읽고, 정밀 모델에서는 얼굴 중심 재판독까지 반영했습니다.' : isVideo ? '비디오 전용 7개 EfficientNet-B0 모델이 동일한 샘플 프레임을 보고, 모델 간 median과 프레임 confidence_mean으로 최종 확률을 계산했습니다.' : `${profile.title} / ${profile.badge} / ${profile.xai}`}</p><DeveloperOverrideNotice analysis={analysis} /></div>
        <article className="confidence-dial">
          <div className={`confidence-ring ${analysis.fakePercent >= analysis.realPercent ? 'is-fake' : 'is-real'}`} style={confidenceRingStyle(analysis)}>
            <div className="confidence-core"><span>{analysis.verdictLabel}</span><strong>{formatPercent(Math.max(analysis.fakePercent, analysis.realPercent))}</strong><small>판정 신뢰도 {analysis.confidence}%</small></div>
          </div>
          <div className="confidence-legend">
            <div><span>Real</span><strong>{formatPercent(analysis.realPercent)}</strong><div className="confidence-mini-track"><i className="real" style={{ width: scoreWidth(analysis.realPercent) }}><span>{formatPercent(analysis.realPercent)}</span></i></div></div>
            <div><span>Fake</span><strong>{formatPercent(analysis.fakePercent)}</strong><div className="confidence-mini-track"><i className="fake" style={{ width: scoreWidth(analysis.fakePercent) }}><span>{formatPercent(analysis.fakePercent)}</span></i></div></div>
          </div>
        </article>
      </div>

      <ResultReadingSummary category={category} analysis={analysis} />
      <XaiTrustNotice compact />
      <ResultInterpretationGuide category={category} analysis={analysis} />

      {hasStructuredExplain && analysis.processingScope ? (
        <section className="result-signal-board result-signal-board-compact">
          <div className="panel-header"><div><span className="eyebrow">PROCESSING SCOPE</span><h3>영상 처리 범위와 계산 방식</h3></div><span className="panel-chip">{analysis.processingScope.computeDevice.toUpperCase()}</span></div>
          <div className="metric-grid">
            <article className="metric-card"><span>전체 길이</span><strong>{analysis.processingScope.fullDurationSec.toFixed(1)}s</strong><p>업로드된 원본 영상 길이</p></article>
            <article className="metric-card"><span>실분석 구간</span><strong>{analysis.processingScope.analyzedDurationSec.toFixed(1)}s</strong><p>{isVideo ? '균등 샘플 프레임이 걸쳐 있는 시간 범위' : '시작·중간·끝 구간에서 대표 샘플을 추출'}</p></article>
            <article className="metric-card"><span>대표 프레임</span><strong>{analysis.processingScope.sampleFrames} frames</strong><p>{isVideo ? '실제 모델에 입력된 균등 샘플 프레임 수' : '세 구간을 고르게 읽기 위한 샘플링 수'}</p></article>
            <article className="metric-card"><span>계산 장치</span><strong>{analysis.processingScope.computeDevice.toUpperCase()}</strong><p>{isVideo ? '7개 EfficientNet-B0 모델과 hflip TTA 추론에 사용' : 'CLIP 인코딩, FFT 계열 계산, heatmap 생성에 사용'}</p></article>
          </div>
          <div className="reasoning-list compact">
            <div className="reasoning-card"><strong>어떻게 보는가</strong><p>{analysis.processingScope.strategy}</p></div>
            <div className="reasoning-card"><strong>사전 탐지</strong><p>{analysis.processingScope.precheckSummary}</p></div>
          </div>
          {analysis.processingScope.windows?.length ? (
            <div className="reasoning-list compact">
              {analysis.processingScope.windows.map((window) => (
                <div key={`${window.label}-${window.startLabel}`} className="reasoning-card">
                  <strong>{window.label} 샘플링</strong>
                  <p>{window.startLabel} - {window.endLabel} 구간을 대표 프레임과 오디오 단서 추출에 사용했습니다.</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {category.id === 'multimodal' && analysis.modalityJudgments?.length ? (
        <section className="result-signal-board multimodal-command-center">
          <div className="panel-header"><div><span className="eyebrow">MULTIMODAL XAI</span><h3>입력 단서와 모델 판단을 한눈에 보기</h3></div><span className="panel-chip">{analysis.xaiHeadline ?? 'Cross-modal board'}</span></div>
          <div className="multimodal-overview-grid">
            <article className="multimodal-overview-card">
              <span>입력 단서 확보</span>
              <strong>{multimodalActiveCount}/{multimodalInputs.length || 4}</strong>
              <div className="multimodal-chip-row">{multimodalInputs.map((item) => <b key={item.label} className={item.active ? 'is-active' : ''}>{item.label}</b>)}</div>
              <p>확보된 입력만 최종 판단에 크게 반영하고, 감지되지 않은 단서는 자동으로 영향력을 낮춥니다.</p>
            </article>
            <article className="multimodal-overview-card">
              <span>판정 방향</span>
              <strong>{analysis.fakePercent >= analysis.realPercent ? 'Fake 우세' : 'Real 우세'}</strong>
              <div className="multimodal-split-meter"><i className="real" style={{ width: scoreWidth(analysis.realPercent) }} /><i className="fake" style={{ width: scoreWidth(analysis.fakePercent) }} /></div>
              <p>Real {formatPercent(analysis.realPercent)} / Fake {formatPercent(analysis.fakePercent)}. 세부 모델은 Real {multimodalRealCount}개, Fake {multimodalFakeCount}개 방향으로 기울었습니다.</p>
            </article>
            <article className="multimodal-overview-card">
              <span>가장 강한 단서</span>
              <strong>{multimodalDominantJudgment?.label ?? '확인 중'}</strong>
              <div className="judge-track"><i className={multimodalDominantJudgment && multimodalDominantJudgment.fakePercent >= multimodalDominantJudgment.realPercent ? 'fake' : 'real'} style={{ width: scoreWidth(multimodalDominantJudgment ? Math.max(multimodalDominantJudgment.fakePercent, multimodalDominantJudgment.realPercent) : 0) }}><span>{multimodalDominantJudgment ? formatPercent(Math.max(multimodalDominantJudgment.fakePercent, multimodalDominantJudgment.realPercent)) : '0%'}</span></i></div>
              <p>{multimodalDominantJudgment?.reason ?? '가장 강하게 반영된 모달리티 신호를 표시합니다.'}</p>
            </article>
            <article className="multimodal-overview-card">
              <span>우선 확인할 부분</span>
              <strong>{multimodalRiskJudgment?.fakePercent && multimodalRiskJudgment.fakePercent > multimodalRiskJudgment.realPercent ? multimodalRiskJudgment.label : multimodalPeakSlice?.label ?? '타임라인'}</strong>
              <small>{multimodalPeakSlice ? `${multimodalPeakSlice.start} - ${multimodalPeakSlice.end} / ${formatPercent(multimodalPeakSlice.score * 100)}` : multimodalFusionTop ? `${multimodalFusionTop.label} ${multimodalFusionTop.weight}%` : '근거 확인'}</small>
              <p>{multimodalPeakSlice?.note ?? '의심 구간 또는 가장 큰 융합 가중치를 먼저 확인하면 결과를 빠르게 해석할 수 있습니다.'}</p>
            </article>
          </div>
          <div className="multimodal-relation-board">
            <div className="panel-header compact"><div><span className="eyebrow">RELATION EVIDENCE</span><h3>어떤 관계가 판단에 영향을 줬는가</h3><p>{relationScoreNote}</p></div><span className="panel-chip">{analysis.fakePercent >= analysis.realPercent ? 'Fake 쪽 근거 우세' : 'Real 쪽 근거 우세'}</span></div>
            <div className="relation-evidence-grid">
              {relationContributionRows.map((row) => (
                <article key={row.title} className={`relation-evidence-card is-${row.tone}`}>
                  <div><strong>{row.title}</strong><span>{row.verdict}</span></div>
                  <div className="relation-score-line"><i style={{ width: scoreWidth(row.contribution) }} /><b>반영 비중 {formatPercent(row.contribution)}</b></div>
                  <small className="relation-strength-label">관계 신호 {formatPercent(row.score)} · {relationStrengthText(row.score)}</small>
                  <p>{row.body}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="multimodal-consistency-board">
            <div className="panel-header compact"><div><span className="eyebrow">CONSISTENCY MAP</span><h3>정합성 지도: 맞는 관계와 어긋난 관계</h3><p>각 관계는 모델이 실제로 확보한 얼굴·입술·음성·텍스트·프레임·주파수 단서를 서로 비교한 결과입니다.</p></div><span className={`panel-chip ${topConsistencySignal?.tone === 'fake' ? 'is-fake' : 'is-real'}`}>{topConsistencySignal ? topConsistencySignal.title : '관계 분석'}</span></div>
            <div className="consistency-summary-grid">
              <article>
                <span>잘 맞는 관계</span>
                <strong>{relationMatches.length ? relationMatches[0].title : '확인된 강한 정합 없음'}</strong>
                <p>{relationMatches.length ? relationMatches.slice(0, 2).map((item) => item.title).join(', ') : '현재 입력에서는 Real 방향의 관계 근거가 약하거나 제한적입니다.'}</p>
              </article>
              <article>
                <span>어긋난 관계</span>
                <strong>{relationMismatches.length ? relationMismatches[0].title : '뚜렷한 불일치 없음'}</strong>
                <p>{relationMismatches.length ? relationMismatches.slice(0, 2).map((item) => item.title).join(', ') : 'Fake 방향으로 강하게 기운 관계가 뚜렷하지 않습니다.'}</p>
              </article>
              <article>
                <span>해석이 제한된 관계</span>
                <strong>{relationLimited.length ? relationLimited[0].title : '없음'}</strong>
                <p>{relationLimited.length ? '해당 단서는 검출이 약해 최종 판단에서 낮은 비중으로 처리했습니다.' : '비교에 필요한 주요 단서가 대체로 확보되었습니다.'}</p>
              </article>
            </div>
            <div className="consistency-map-grid">
              {relationContributionRows.map((row) => (
                <article key={`map-${row.title}`} className={`consistency-map-card is-${row.tone}`}>
                  <div className="consistency-pair"><b>{row.title.split(' ↔ ')[0]}</b><i /><b>{row.title.split(' ↔ ')[1] ?? ''}</b></div>
                  <strong>{row.verdict}</strong>
                  <div className="relation-score-line"><i style={{ width: scoreWidth(row.contribution) }} /><b>{formatPercent(row.contribution)}</b></div>
                </article>
              ))}
            </div>
          </div>
          <div className="multimodal-architecture-board">
            <div className="panel-header compact"><div><span className="eyebrow">MODEL ARCHITECTURE FLOW</span><h3>6개 모델의 실제 연산 구조와 최종 융합</h3><p>백엔드 코드의 입력 feature, OpenCLIP embedding space, ServiceHeadNet layer, gate/reliability, final8000 weighted fusion을 논문 아키텍처 도식처럼 재구성했습니다. 각 카드를 펼치면 해당 모델의 stage가 애니메이션으로 흐릅니다.</p></div><span className="panel-chip">{analysis.inferenceMode === 'single' ? 'Single path' : '6-model fusion'}</span></div>
            <div className={`architecture-paper-canvas ${analysis.inferenceMode === 'single' ? 'is-single' : 'is-ensemble'}`}>
              <div className="architecture-paper-hero">
                <div>
                  <span className="paper-kicker">CODE-MIRRORED ARCHITECTURE</span>
                  <strong>{analysis.inferenceMode === 'single' ? `${selectedArchitectureRow.model} 단독 추론 구조` : '원본 영상에서 최종 Real/Fake까지 흐르는 전체 구조'}</strong>
                  <p>먼저 아래 전체 지도를 보고, 그 다음 궁금한 모델 카드를 펼쳐보면 됩니다. 각 카드는 “무엇을 보는지”, “어떻게 계산하는지”, “최종 결과에 어떻게 들어가는지”를 코드의 실제 변수와 layer 구조에 맞춰 설명합니다.</p>
                </div>
                <div className={`paper-final-chip ${analysis.fakePercent >= analysis.realPercent ? 'is-fake' : 'is-real'}`}>
                  <span>{analysis.inferenceMode === 'single' ? 'Selected output' : 'Final output'}</span>
                  <b>{analysis.fakePercent >= analysis.realPercent ? `Fake ${formatPercent(analysis.fakePercent)}` : `Real ${formatPercent(analysis.realPercent)}`}</b>
                </div>
              </div>

              <div className="architecture-reader-guide">
                <article>
                  <span className="paper-kicker">HOW TO READ</span>
                  <strong>사용자는 이 세 가지를 보면 됩니다</strong>
                  <p><b>무엇을 봤는가</b>는 입력 단서, <b>어떻게 계산했는가</b>는 모델 stage, <b>얼마나 반영됐는가</b>는 fusion weight입니다. 최종 확률과 각 모델 score는 서로 다를 수 있습니다.</p>
                </article>
                <article>
                  <span className="paper-kicker">현재 선택 경로</span>
                  <strong>{selectedArchitectureRow.model}</strong>
                  <p>{architectureReaderMap[selectedArchitectureId]?.question ?? '선택 모델의 판단 질문을 확인합니다.'} {analysis.inferenceMode === 'single' ? '단독 모드라 이 모델 score가 곧 최종 판정입니다.' : '융합 모드라 선택 모델은 대표 경로이고, 최종 결과는 active 모델들을 함께 봅니다.'}</p>
                </article>
              </div>

              <div className="architecture-subway-map">
                {architectureGlobalSteps.map((step, index) => (
                  <div key={step.label} className="subway-step" style={{ ['--subway-index' as string]: index } as CSSProperties}>
                    <span>{step.label}</span>
                    <p>{step.body}</p>
                  </div>
                ))}
              </div>

              <div className="model-question-grid">
                {architectureReaderRows.map((item) => (
                  <article key={`question-${item.id}`} className={`model-question-card is-${item.tone} ${item.isSelected ? 'is-selected' : ''}`}>
                    <span>{item.model}</span>
                    <strong>{item.reader.question}</strong>
                    <p>{item.reader.watches}</p>
                    <small>{item.isFinalActive ? `최종 반영 weight ${analysis.inferenceMode === 'single' ? '1.00' : `${item.weight}%`}` : '계산됨 / 최종 평균 직접 반영 없음'}</small>
                  </article>
                ))}
              </div>

              <div className="paper-model-grid">
                {architectureReaderRows.map((item, index) => (
                  <details key={item.id} className={`paper-model-card is-${item.tone} ${item.isSelected ? 'is-selected' : ''} ${item.isFinalActive ? 'is-final-active' : 'is-reference'}`} open={item.isSelected}>
                    <summary>
                      <div>
                        <span>{item.flowLabel}</span>
                        <strong>{item.model}</strong>
                        <small>{item.blueprint.family}</small>
                      </div>
                      <b>{item.outputLabel}</b>
                    </summary>
                    <div className={`paper-architecture-diagram is-${item.blueprint.layout}`} style={{ ['--diagram-index' as string]: index } as CSSProperties}>
                      <div className="model-reader-notes">
                        <div><span>무엇을 보나</span><p>{item.reader.watches}</p></div>
                        <div><span>어떻게 계산하나</span><p>{item.reader.computes}</p></div>
                        <div><span>결과에 어떻게 들어가나</span><p>{item.reader.contribution}</p></div>
                      </div>
                      <div className="paper-code-strip"><span>Code path</span><code>{item.blueprint.code}</code></div>
                      <div className="tensor-ribbon">
                        {item.blueprint.featureGroups.map((feature) => <span key={`${item.id}-${feature}`}>{feature}</span>)}
                      </div>
                      <div className="stage-scroll">
                        {item.blueprint.stages.map((stage, stageIndex) => (
                          <div key={`${item.id}-${stage.title}`} className={`paper-stage-node is-${stage.kind}`} style={{ ['--stage-index' as string]: stageIndex } as CSSProperties}>
                            <i />
                            <span>{stage.shape}</span>
                            <strong>{stage.title}</strong>
                            <code>{stage.op}</code>
                          </div>
                        ))}
                      </div>
                      <div className="architecture-equation-row">
                        {item.blueprint.equations.map((equation) => <code key={`${item.id}-${equation}`}>{equation}</code>)}
                      </div>
                      {item.blueprint.layout === 'contrastive' ? (
                        <div className="embedding-space-panel">
                          <div className="embedding-axis image-axis">image embeddings</div>
                          <div className="embedding-axis text-axis">text embeddings</div>
                          <span className="embedding-dot image-a" />
                          <span className="embedding-dot image-b" />
                          <span className="embedding-dot text-a" />
                          <span className="embedding-dot text-b" />
                          <i className="contrastive-link link-a" />
                          <i className="contrastive-link link-b" />
                          <strong>shared embedding space</strong>
                          <small>normalized dot product / cosine similarity</small>
                        </div>
                      ) : (
                        <div className="mlp-layer-panel">
                          <div className="mlp-column"><span /><span /><span /><span /></div>
                          <b>z-score</b>
                          <div className="mlp-column mid"><span /><span /><span /></div>
                          <b>Linear 24</b>
                          <div className="mlp-column small"><span /><span /></div>
                          <b>Linear 12</b>
                          <div className="mlp-output-node">sigmoid</div>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>

              <div className={`paper-fusion-canvas ${analysis.fakePercent >= analysis.realPercent ? 'is-fake' : 'is-real'}`}>
                <div className="fusion-matrix">
                  {architectureBlueprintRows.map((item, index) => (
                    <div key={`matrix-${item.id}`} className={`fusion-matrix-row ${item.isFinalActive ? 'is-active' : 'is-zero'} is-${item.tone}`} style={{ ['--matrix-index' as string]: index } as CSSProperties}>
                      <span>{item.model}</span>
                      <i style={{ width: scoreWidth(item.signal) }} />
                      <b>{analysis.inferenceMode === 'single' ? (item.isSelected ? '1.00' : '0.00') : (item.weight / 100).toFixed(2)}</b>
                    </div>
                  ))}
                </div>
                <div className="fusion-formula-panel">
                  <span className="paper-kicker">FUSION METHOD</span>
                  <strong>{analysis.inferenceMode === 'single' ? 'single selected score' : 'calibrated weighted mean / runtime fallback'}</strong>
                  <p>{analysis.inferenceMode === 'single' ? '단독 모드에서는 선택한 모델의 prob_fake 값을 최종 확률로 사용합니다. 그래서 다른 모델 카드가 Fake/Real을 다르게 보더라도 최종 판정에는 들어가지 않습니다.' : `현재 final8000 설정에서 최종 평균에 직접 들어가는 active 모델은 ${finalActiveRows.map((item) => item.model).join(', ')}입니다. 나머지 모델도 계산되어 XAI에는 표시되지만, weight가 0이면 최종 weighted mean에는 직접 더해지지 않습니다.`}</p>
                  <div className="fusion-equation">
                    <code>{analysis.inferenceMode === 'single' ? 'fake_score = model_scores[selected_key]' : 'fake_score = sum(w_i * prob_fake_i) / sum(w_i)'}</code>
                    <code>confidence = clamp(66 + |fake_score-.5| * 78)</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="multimodal-signal-lab">
            <article className="multimodal-signal-checklist">
              <div className="panel-header compact"><div><span className="eyebrow">INPUT CHECKLIST</span><h3>영상에서 실제로 사용한 정보</h3></div></div>
              <div className="signal-check-grid">
                {multimodalSignalChecklist.map((item) => (
                  <div key={item.label} className={`signal-check-card ${item.active ? 'is-active' : 'is-muted'}`}>
                    <span className="signal-emoji">{item.icon}</span>
                    <strong>{item.label}</strong>
                    <small>{item.active ? item.detail : '미검출 또는 낮은 신뢰도'}</small>
                  </div>
                ))}
              </div>
            </article>
            <article className="multimodal-media-evidence-card">
              <div className="panel-header compact"><div><span className="eyebrow">SOURCE OVERLAY</span><h3>전체 영상 위에 얹은 감지 단서</h3></div><span className="panel-chip">Playable overlay</span></div>
              <SourceOverlayStage analysis={analysis} upload={upload} frameRows={multimodalFrameUseRows} />
              <p className="panel-caption">이 섹션의 인물·얼굴·입술 박스는 백엔드가 샘플 프레임에서 실제로 검출한 좌표를 영상 재생 시간에 맞춰 표시합니다. 음성은 에너지 리본으로 표시하며, 자막/텍스트 단서는 후보 박스로 표시하지 않고 전체 정합성 판단의 보조 메타데이터로만 사용합니다. YouTube처럼 브라우저가 원본 파일을 직접 재생할 수 없는 URL은 대표 프레임으로 대체됩니다. 이는 AI의 직접 증거가 아니라 모델 입력·사전 탐지·구간 점수를 함께 읽기 위한 보조 해석입니다.</p>
            </article>
          </div>
          {multimodalFrameUseRows.length ? (
            <div className="multimodal-frame-usage">
              <div className="panel-header compact"><div><span className="eyebrow">FRAME USAGE</span><h3>어느 구간을 주로 봤는가</h3></div><span className="panel-chip">{analysis.processingScope?.sampleFrames ?? analysis.timeline.length} samples</span></div>
              <div className="frame-usage-grid">
                {multimodalFrameUseRows.map((row) => (
                  <article key={`${row.label}-${row.range}`} className="frame-usage-card">
                    <div><strong>{row.label}</strong><span>{row.range}</span></div>
                    <div className="timeline-bar"><div className={`timeline-bar-fill ${row.score >= 50 ? 'is-fake' : 'is-real'}`} style={{ width: scoreWidth(row.score) }}><span>{formatPercent(row.score)}</span></div></div>
                    <b>{row.verdict}</b>
                    <p>{row.note}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          <div className="multimodal-flow-rail">
            {(analysis.fusionWeights ?? []).slice(0, 6).map((item, index) => (
              <div key={item.label} className="multimodal-flow-step">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item.label}</strong>
                <i style={{ width: `${Math.max(12, item.weight)}%` }} />
                <small>{item.weight}% 반영</small>
              </div>
            ))}
          </div>
          {analysis.availability ? (
            <div className="modality-judge-grid">
              {[
                { label: '얼굴', active: analysis.availability.hasFace, detail: `${Math.round(analysis.availability.faceRatio * 100)}% 프레임에서 얼굴 확인` },
                { label: '입술', active: analysis.availability.hasLips, detail: `${Math.round(analysis.availability.mouthRatio * 100)}% 프레임에서 입술 추적` },
                { label: '음성', active: analysis.availability.hasSpeech, detail: `${Math.round(analysis.availability.speechConfidence * 100)}% 수준의 음성 단서` },
                { label: '텍스트', active: analysis.availability.hasText, detail: `${Math.round(analysis.availability.textConfidence * 100)}% 수준의 자막/문장 단서` },
              ].map((item) => (
                <article key={item.label} className="modality-judge-card">
                  <div className="modality-head"><strong>{item.label} 사전 확인</strong><span>{item.active ? '분석에 사용' : '낮은 비중'}</span></div>
                  <div className="modality-score-pair"><b>{item.detail}</b></div>
                  <div className="judge-track"><i style={{ width: scoreWidth(item.active ? 88 : 18) }}><span>{item.active ? '88%' : '18%'}</span></i></div>
                  <p>모델 추론 전에 이 단서가 실제로 충분히 보이는지 확인하고, 부족한 단서는 최종 판단에서 낮은 비중으로 처리했습니다.</p>
                </article>
              ))}
            </div>
          ) : null}
          {allModelVotes.length ? (
            <div className="modality-vs-board">
              <div className="modality-vs-header">
                <div>
                  <span className="eyebrow">MODEL VOTE BOARD</span>
                  <h3>각 모델은 어느 쪽을 더 지지했는가</h3>
                </div>
                <p>개별 모델 점수를 Real 진영과 AI-Generated 진영으로 나눠 보여줍니다. 아래 최종 판단은 융합 모델이 이 의견들을 종합한 결과입니다.</p>
              </div>
              <div className="modality-vs-columns">
                <section className="modality-vs-lane is-real">
                  <div className="vs-lane-head">
                    <span>Real</span>
                    <strong>{realModelVotes.length} models</strong>
                    <b>{realModelVotes.length ? formatPercent(laneAverage(realModelVotes)) : '0.0%'}</b>
                  </div>
                  <div className="model-vote-stack">
                    {realModelVotes.length ? realModelVotes.map(renderModelVoteCard) : <div className="empty-vote-card">Real 쪽으로 기운 개별 모델이 없습니다.</div>}
                  </div>
                </section>
                <div className="modality-vs-divider" aria-hidden="true">
                  <span>VS</span>
                  <i />
                </div>
                <section className="modality-vs-lane is-fake">
                  <div className="vs-lane-head">
                    <span>AI-Generated</span>
                    <strong>{fakeModelVotes.length} models</strong>
                    <b>{fakeModelVotes.length ? formatPercent(laneAverage(fakeModelVotes)) : '0.0%'}</b>
                  </div>
                  <div className="model-vote-stack">
                    {fakeModelVotes.length ? fakeModelVotes.map(renderModelVoteCard) : <div className="empty-vote-card">AI-Generated 쪽으로 기운 개별 모델이 없습니다.</div>}
                  </div>
                </section>
              </div>
              <div className={`modality-final-verdict is-${finalSide}`}>
                <div className="final-verdict-glyph" aria-hidden="true">{getModelSignature(finalVote.label).glyph}</div>
                <div>
                  <span>최종 융합 판단</span>
                  <strong>{finalSide === 'fake' ? 'AI-Generated 우세' : 'Real 우세'}</strong>
                  <p>{readableModelReason(finalVote.reason)}</p>
                </div>
                <div className="final-verdict-score">
                  <b>{finalSide === 'fake' ? formatPercent(finalVote.fakePercent) : formatPercent(finalVote.realPercent)}</b>
                  <small>Real {formatPercent(finalVote.realPercent)} · AI {formatPercent(finalVote.fakePercent)}</small>
                </div>
              </div>
            </div>
          ) : null}
          <div className="signal-board-grid">
            <ModelSignalPanel analysis={analysis} />
            <article className="signal-board-panel">
              <span>Heatmap focus</span>
              <div className="visual-stage visual-stage-compact">
                <XaiVisualMedia analysis={analysis} upload={upload} />
                {analysis.heatmapPoints?.length ? <HeatmapLayer points={analysis.heatmapPoints} /> : null}
                {!analysis.focusFrameUrl ? <div className="visual-overlay">{analysis.regions.map((region) => <div key={region.id} className="focus-box" style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%`, ['--box-opacity' as string]: '0.65' } as CSSProperties}><span>{region.label}</span></div>)}</div> : null}
              </div>
              <p className="panel-caption">{sectionText('heatmap', analysis.reasons[2]?.body ?? '핵심 시각 영역을 중심으로 판정 근거를 요약했습니다.')}</p>
            </article>
            <article className="signal-board-panel">
              <span>Frequency comparison</span>
              <div className="frequency-compare-list">
                <div className="frequency-compare-row">
                  <strong>일반 real 경향</strong>
                  <div className="spectrum-bars spectrum-bars-compare">{(analysis.frequencyComparison?.realReference ?? [72, 66, 58, 49, 39, 30, 22]).map((value, index) => <i key={`real-${value}-${index}`} style={{ height: `${value}%` }} />)}</div>
                </div>
                <div className="frequency-compare-row">
                  <strong>일반 synthetic 경향</strong>
                  <div className="spectrum-bars spectrum-bars-compare">{(analysis.frequencyComparison?.fakeReference ?? [24, 31, 48, 69, 86, 76, 58]).map((value, index) => <i key={`fake-${value}-${index}`} style={{ height: `${value}%` }} />)}</div>
                </div>
                <div className="frequency-compare-row">
                  <strong>현재 영상</strong>
                  <div className="spectrum-bars spectrum-bars-compare">{(analysis.frequencyComparison?.sample ?? analysis.spectrumBins ?? [18, 26, 48, 62, 74, 58, 34]).map((value, index) => <i key={`sample-${value}-${index}`} style={{ height: `${value}%` }} />)}</div>
                </div>
              </div>
              <p className="panel-caption">{sectionText('frequency', analysis.frequencyComparison?.note ?? '현재 영상 주파수 분포를 비교용 기준 패턴과 함께 보여줍니다.')}</p>
            </article>
            <article className="signal-board-panel">
              <span>Sync + fusion board</span>
              <div className="sync-strip">{(analysis.syncBins ?? [12, 18, 24, 44, 62, 48, 28, 14]).map((value, index) => <b key={`${value}-${index}`} style={{ width: `${Math.max(8, value)}%` }} />)}</div>
              <div className="fusion-weight-list">{(analysis.fusionWeights ?? []).map((item) => <div key={item.label} className="fusion-weight-row"><strong>{item.label}</strong><span>{item.weight}%</span></div>)}</div>
              <p className="panel-caption">{sectionText('fusion', analysis.fusionSteps?.[0]?.logic ?? '사전 탐지와 가중 결합 근거를 순서대로 보여줍니다.')}</p>
            </article>
          </div>
        </section>
      ) : null}

      {isVideo ? <VideoXaiDashboard analysis={analysis} /> : null}

      <div className="metric-grid">{analysis.metrics.map((metric) => <article key={metric.label} className="metric-card"><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.detail}</p></article>)}</div>

      <div className="result-grid">
        <article className="evidence-panel">
          <div className="panel-header"><div><span className="eyebrow">{isVideo ? 'FRAME EVIDENCE' : 'XAI VISUALIZATION'}</span><h3>{isVideo ? '대표 프레임과 모델 의견 분포' : '모델이 실제로 본 핵심 영역'}</h3></div><span className="panel-chip">{isVideo ? 'N=7 frame ensemble' : 'Grad-CAM style overlay'}</span></div>
            <div className="visual-stage">
              <XaiVisualMedia analysis={analysis} upload={upload} />
              {analysis.heatmapPoints?.length ? <HeatmapLayer points={analysis.heatmapPoints} /> : null}
              {!analysis.focusFrameUrl ? <div className="visual-overlay">{analysis.regions.map((region) => <div key={region.id} className="focus-box" style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%`, ['--box-opacity' as string]: '0.75' } as CSSProperties}><span>{region.label}</span></div>)}</div> : null}
            </div>
          <p className="panel-caption">{hasStructuredExplain ? sectionText('heatmap', isVideo ? analysis.reasons[1]?.body ?? '모델별 프레임 확률과 대표 프레임을 함께 표시합니다.' : analysis.reasons[2]?.body ?? '가장 강한 단서가 집중된 영역과 구간을 시각적으로 강조했습니다.') : analysis.reasons[2]?.body ?? '가장 강한 단서가 집중된 영역과 구간을 시각적으로 강조했습니다.'}</p>
        </article>

        <article className="reasoning-panel">
          <div className="panel-header"><div><span className="eyebrow">EXPLANATION</span><h3>왜 이렇게 판단했는가</h3></div><span className="panel-chip">{analysis.verdictLabel}</span></div>
          {hasStructuredExplain ? (
            <div className="reasoning-list">
              <div className="reasoning-card"><strong>최종 결과</strong><p>{analysis.verdictLabel} 기준으로 Real {formatPercent(analysis.realPercent)}, Fake {formatPercent(analysis.fakePercent)}가 계산됐습니다.</p></div>
              <div className="reasoning-card"><strong>{category.id === 'image' ? '사용된 단서' : isVideo ? '사용된 모델 입력' : '사용된 모달'}</strong><p>{category.id === 'image' ? `얼굴=${String(analysis.availability?.hasFace ?? false)}, 텍스트=${String(analysis.availability?.hasText ?? false)}를 먼저 확인한 뒤 RGB와 FFT 분기 비중을 조정했습니다.` : isVideo ? '비디오 전용 모델은 오디오, 입술, 텍스트를 직접 입력으로 사용하지 않고, 균등 샘플 프레임과 text mask 전처리만 사용했습니다.' : `얼굴=${String(analysis.availability?.hasFace ?? false)}, 입술=${String(analysis.availability?.hasLips ?? false)}, 음성=${String(analysis.availability?.hasSpeech ?? false)}, 텍스트=${String(analysis.availability?.hasText ?? false)}를 먼저 확인한 뒤 반영 비중을 조정했습니다.`}</p></div>
              <div className="reasoning-card"><strong>{isVideo ? '사용하지 않은 분기' : '낮은 비중으로 처리한 단서'}</strong><p>{analysis.gatedBranches?.length ? `${analysis.gatedBranches.join(', ')} 단서는 현재 비디오 전용 모델의 직접 입력이 아니므로 최종 확률 계산에 사용하지 않았습니다.` : '모든 주요 단서가 충분히 확보되어 별도의 낮은 비중 처리 없이 융합에 반영했습니다.'}</p></div>
            </div>
          ) : (
            <div className="reasoning-list">{analysis.reasons.map((reason) => <div key={reason.title} className="reasoning-card"><strong>{reason.title}</strong><p>{reason.body}</p></div>)}</div>
          )}
          {category.id !== 'multimodal' ? <div className="modality-bars">{analysis.bars.map((bar) => <div key={bar.label} className="modality-row"><div className="modality-head"><strong>{bar.label}</strong><span>{Math.round(bar.score * 100)}%</span></div><div className="timeline-bar"><div className="timeline-bar-fill" style={{ width: scoreWidth(bar.score * 100) }}><span>{Math.round(bar.score * 100)}%</span></div></div><p>{bar.note}</p></div>)}</div> : null}
        </article>
      </div>

      <details className="result-detail-disclosure">
        <summary>세부 판별 단계와 타임라인 보기</summary>
        <div className="result-grid secondary">
          <article className="pipeline-panel"><div className="panel-header"><div><span className="eyebrow">PIPELINE TRACE</span><h3>판별 단계 요약</h3></div><span className="panel-chip">Explainable flow</span></div><div className="reasoning-list compact">{category.stageLabels.map((stage, index) => <div key={stage} className="reasoning-card"><span className="stage-index">{String(index + 1).padStart(2, '0')}</span><strong>{stage}</strong><p>{isMultimodal || isVideo ? (analysis.fusionSteps?.[index]?.logic ?? analysis.reasons[index % analysis.reasons.length].body) : analysis.reasons[index % analysis.reasons.length].body}</p></div>)}</div></article>
          <article className="timeline-panel"><div className="panel-header"><div><span className="eyebrow">TIMELINE EVIDENCE</span><h3>{isVideo ? '샘플 프레임별 generated 확률' : '증거 타임라인'}</h3></div></div><div className="timeline-list">{analysis.timeline.map((slice) => <div key={`${slice.label}-${slice.start}`} className="timeline-item timeline-item-rich"><div className="timeline-meta"><strong>{slice.label}</strong><span>{slice.start} - {slice.end}</span></div><div className="timeline-score-row"><div className="timeline-bar"><div className="timeline-bar-fill" style={{ width: scoreWidth(slice.score * 100) }}><span>{(slice.score * 100).toFixed(1)}%</span></div></div><b>{(slice.score * 100).toFixed(1)}%</b></div><p>{slice.note}</p>{slice.evidence?.length ? <div className="timeline-evidence-list">{slice.evidence.map((item) => <div key={item} className="timeline-evidence-chip">{item}</div>)}</div> : null}</div>)}</div><p className="panel-caption timeline-summary-caption">{hasStructuredExplain ? sectionText('timeline', category.id === 'image' ? '이미지에서는 전체 장면, 얼굴 크롭, 주파수 단서가 어떤 순서로 반영됐는지 설명합니다.' : isVideo ? '각 프레임의 막대는 해당 프레임에서 7개 모델 확률을 median으로 합친 generated 확률입니다. 최종 결과는 이 값에 confidence_mean 가중치를 적용해 계산됩니다.' : '모델이 실제로 본 시작·중간·끝 구간을 기준으로, 각 시간대에서 감지된 얼굴·입술·오디오·움직임 단서를 함께 설명합니다.') : '시간축상 점수가 높게 나타난 구간을 중심으로 판정 근거를 설명합니다.'}</p></article>
        </div>
      </details>

      {hasStructuredExplain && analysis.fusionSteps?.length ? (
        <details className="result-detail-disclosure">
          <summary>{analysis.inferenceMode === 'single' ? '선택 모델 로직 자세히 보기' : '융합 로직과 모델 역할 자세히 보기'}</summary>
          <div className="result-grid secondary">
            <article className="pipeline-panel">
              <div className="panel-header"><div><span className="eyebrow">{analysis.inferenceMode === 'single' ? 'SELECTED MODEL LOGIC' : 'FUSION LOGIC'}</span><h3>{analysis.inferenceMode === 'single' ? '선택 모델이 어떻게 판정했는가' : category.id === 'image' ? 'RGB와 주파수 단서가 어떻게 결합됐는가' : isVideo ? '7개 프레임 모델이 어떻게 결합됐는가' : '각 모달리티가 어떻게 결합됐는가'}</h3></div><span className="panel-chip">{analysis.inferenceMode === 'single' ? 'Single model' : isVideo ? 'Median ensemble' : 'Weighted fusion'}</span></div>
              <div className="reasoning-list compact">{analysis.fusionSteps.map((step, index) => <div key={step.title} className="reasoning-card"><span className="stage-index">{String(index + 1).padStart(2, '0')}</span><strong>{step.title}</strong><span className="reasoning-weight">{step.weight}</span><p>{step.logic}</p></div>)}</div>
            </article>
            <article className="timeline-panel">
              <div className="panel-header"><div><span className="eyebrow">MODEL CHARACTERISTICS</span><h3>{category.id === 'image' ? '각 분기가 담당한 역할' : '각 모델이 담당한 역할'}</h3></div></div>
              <div className="model-trait-list">{analysis.modelTraits?.map((item) => <div key={item.model} className="model-trait-card"><div><strong>{item.model}</strong><span>{item.role}</span></div><p>{item.trait}</p><small>{item.contribution}</small></div>)}</div>
            </article>
          </div>
        </details>
      ) : null}
    </section>
  )
}

function DeveloperOverrideNotice({ analysis }: { analysis: Analysis }) {
  if (!analysis.developerOverride) return null
  return (
    <div className={`developer-override-notice ${analysis.developerOverride.applied ? 'is-applied' : 'is-matched'}`}>
      <strong>Developer mode</strong>
    </div>
  )
}

function ResultSpotlightOverlay({
  analysis,
  upload,
  category,
  profile,
  llmSectionStatus,
  onClose,
}: {
  analysis: Analysis
  upload: UploadState
  category: CategoryConfig
  profile: Profile
  llmSectionStatus: 'idle' | 'loading' | 'ready' | 'error'
  onClose: () => void
}) {
  return (
    <div className="result-spotlight-overlay" role="dialog" aria-modal="true" aria-label="분석 결과 전체 화면">
      <div className="result-spotlight-backdrop" onClick={onClose} />
      <div className="result-spotlight-shell">
        <div className="result-spotlight-toolbar">
          <div>
            <span className="eyebrow">FULL SCREEN XAI</span>
            <strong>{category.title}</strong>
          </div>
          <button type="button" className="secondary-cta" onClick={onClose}>결과 화면 닫기</button>
        </div>
        <div className="result-spotlight-content">
          <ResultDashboard analysis={analysis} upload={upload} category={category} profile={profile} llmSectionStatus={llmSectionStatus} />
        </div>
      </div>
    </div>
  )
}
function StudioPage({ category, onBack }: { category: CategoryConfig; onBack: () => void }) {
  const [activeProfileId, setActiveProfileId] = useState(getDefaultProfile(category).id)
  const [upload, setUpload] = useState<UploadState>(initialUploadState)
  const [progress, setProgress] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [llmSectionStatus, setLlmSectionStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [isResultExpanded, setIsResultExpanded] = useState(false)
  const [progressLabel, setProgressLabel] = useState('입력을 기다리는 중')
  const [progressDetail, setProgressDetail] = useState('파일을 올리면 분석 범위, 모델 추론, 설명 생성 순서로 진행됩니다.')
  const [inferenceMode, setInferenceMode] = useState<'ensemble' | 'single'>('ensemble')
  const [imageScope, setImageScope] = useState<'full-scene' | 'face-focus'>('full-scene')
  const [xaiDepth, setXaiDepth] = useState<'signature' | 'deep-dive'>('signature')
  const [companionText, setCompanionText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [developerMode, setDeveloperMode] = useState(false)
  const timerRef = useRef<number | null>(null)
  const analyzeClickTimerRef = useRef<number | null>(null)
  const progressRailRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setActiveProfileId(getDefaultProfile(category).id)
    setUpload(initialUploadState())
    setProgress(0)
    setIsAnalyzing(false)
    setAnalysis(null)
    setLlmSectionStatus('idle')
    setIsResultExpanded(false)
    setErrorMessage('')
    setProgressLabel('입력을 기다리는 중')
    setProgressDetail('파일을 올리면 분석 범위, 모델 추론, 설명 생성 순서로 진행됩니다.')
    setInferenceMode('ensemble')
    trackUsageEvent('page_view', {
      page: 'studio',
      modality: category.id,
      modelName: getDefaultProfile(category).id,
    })
  }, [category])

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (analyzeClickTimerRef.current) window.clearTimeout(analyzeClickTimerRef.current)
  }, [])

  const activeProfile = category.profiles.find((profile) => profile.id === activeProfileId) ?? category.profiles[0]
  const hasFullScreenResult = category.id === 'multimodal' || category.id === 'image' || category.id === 'text' || category.id === 'video'
  const canAnalyze = category.uploadKind === 'text'
    ? upload.textValue.trim().length > 0 || upload.file !== null
    : upload.sourceMode === 'url'
      ? upload.sourceUrl.trim().length > 0
      : upload.file !== null

  const handleAnalyze = async (overrideTarget?: DeveloperOverrideTarget) => {
    if (!canAnalyze) return
    if (category.id === 'text') {
      const issue = getTextInputIssue(upload.textValue)
      if (issue) {
        trackUsageEvent('analysis_failed', {
          page: 'studio',
          modality: category.id,
          modelName: activeProfile.id,
          status: 'input_rejected',
          detail: { reason: 'text_too_short' },
        })
        setAnalysis(null)
        setLlmSectionStatus('idle')
        setProgress(0)
        setProgressLabel('텍스트 길이 확인 필요')
        setProgressDetail(issue)
        setErrorMessage(issue)
        return
      }
    }
    setAnalysis(null)
    setLlmSectionStatus('idle')
    setErrorMessage('')
    trackUsageEvent('analysis_started', {
      page: 'studio',
      modality: category.id,
      modelName: activeProfile.id,
      status: upload.sourceMode === 'url' ? 'url' : upload.file ? 'file' : category.id === 'text' ? 'text' : 'unknown',
      detail: {
        inferenceMode,
        hasFile: Boolean(upload.file),
        hasUrl: Boolean(upload.sourceUrl.trim()),
        hasCompanionText: Boolean(companionText.trim()),
      },
    })
    setIsAnalyzing(true)
    setProgress(6)
    window.requestAnimationFrame(() => {
      progressRailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    const initialProgressCopy = progressCopyFor(category, 6)
    setProgressLabel(initialProgressCopy.label)
    setProgressDetail(initialProgressCopy.detail)
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setProgress((current) => {
        const copy = progressCopyFor(category, current)
        setProgressLabel(copy.label)
        setProgressDetail(copy.detail)
        if (current >= 86) return current
        const step = current < 18 ? 10 : current < 42 ? 6 : current < 68 ? 4 : 2
        return Math.min(86, current + step)
      })
    }, 240)
    try {
      const nextAnalysis = await requestAnalysis({
        category,
        activeProfile,
        upload,
        imageScope,
        xaiDepth,
        companionText,
        inferenceMode,
      })
      const finalAnalysis = developerMode && overrideTarget ? applyDeveloperOverride(nextAnalysis, overrideTarget) : nextAnalysis
      if (timerRef.current) window.clearInterval(timerRef.current)
      setProgress(category.id === 'multimodal' || category.id === 'image' ? 92 : 100)
      setAnalysis(finalAnalysis)
      trackUsageEvent('analysis_finished', {
        page: 'studio',
        modality: category.id,
        modelName: activeProfile.id,
        status: finalAnalysis.fakePercent >= finalAnalysis.realPercent ? 'FAKE' : 'REAL',
        detail: {
          confidence: finalAnalysis.confidence,
          fakePercent: finalAnalysis.fakePercent,
          realPercent: finalAnalysis.realPercent,
          inferenceMode: finalAnalysis.inferenceMode,
        },
      })
      if (hasFullScreenResult) setIsResultExpanded(true)
      if (category.id === 'text') {
        setLlmSectionStatus('loading')
        setProgressLabel('텍스트 설명을 정리하는 중')
        setProgressDetail('판정 결과는 표시하고, 문장 해석과 Tip 문구는 LLM으로 공식 문서 톤에 맞춰 정리합니다.')
        requestTextSections(finalAnalysis, activeProfile.id, upload.textValue)
          .then((sections) => {
            setAnalysis((current) => (current ? { ...current, textLlmSections: sections } : current))
            setLlmSectionStatus('ready')
            setProgress(100)
            setProgressLabel('텍스트 설명 정리 완료')
            setProgressDetail('문장 해석, 사용자 설명, Tip 문구까지 준비되었습니다.')
          })
          .catch((error) => {
            console.error(error)
            setLlmSectionStatus('error')
            setProgress(100)
            setProgressLabel('기본 설명으로 결과를 표시했습니다')
            setProgressDetail('LLM 설명 생성이 지연되어 현재는 로컬 설명 문구를 표시합니다.')
          })
      } else if (category.id === 'multimodal' || category.id === 'image') {
        setLlmSectionStatus('loading')
        setProgressLabel('설명 가능한 근거를 정리하는 중')
        setProgressDetail(category.id === 'image' ? '판정 결과는 먼저 표시하고, 히트맵·주파수·퓨전 설명은 뒤에서 채웁니다.' : '판정 결과는 먼저 표시하고, 히트맵·타임라인·퓨전 설명은 뒤에서 채웁니다.')
        requestMultimodalSections(finalAnalysis, activeProfile.id)
          .then((sections) => {
            setAnalysis((current) => (current ? { ...current, llmSections: sections } : current))
            setLlmSectionStatus('ready')
            setProgress(100)
            setProgressLabel('설명 가능한 근거 정리 완료')
            setProgressDetail(category.id === 'image' ? '히트맵, 주파수 비교, 퓨전 설명까지 모두 준비되었습니다.' : '히트맵, 타임라인, 퓨전, 주파수 비교 설명까지 모두 준비되었습니다.')
          })
          .catch((error) => {
            console.error(error)
            setLlmSectionStatus('error')
            setProgress(100)
            setProgressLabel('기본 설명으로 결과를 표시했습니다')
            setProgressDetail('설명 생성이 지연되어 현재는 사실형 기본 설명을 함께 보여줍니다.')
          })
      } else {
        setProgressLabel('분석 완료')
        setProgressDetail(`${categoryNameKo(category.id)} 분석 API 응답을 수신했고, 결과 payload 기준으로 판정과 XAI 패널을 표시했습니다.`)
      }
    } catch (error) {
      console.error(error)
      if (timerRef.current) window.clearInterval(timerRef.current)
      const detail = error instanceof Error && error.message ? error.message : ''
      const friendlyDetail = detail ? ` (${detail})` : ''
      trackUsageEvent('analysis_failed', {
        page: 'studio',
        modality: category.id,
        modelName: activeProfile.id,
        status: 'api_failed',
        detail: { message: detail.slice(0, 240) },
      })
      setProgress(0)
      setAnalysis(null)
      setLlmSectionStatus('idle')
      setIsResultExpanded(false)
      setProgressLabel('분석 실패')
      setProgressDetail(`입력 파일이나 서버 상태를 확인한 뒤 다시 시도해주세요.${friendlyDetail}`)
      setErrorMessage(category.id === 'multimodal' ? `실시간 멀티모달 분석에 실패했습니다.${friendlyDetail}` : `실시간 API 연결에 실패했습니다.${friendlyDetail}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const runDeveloperTarget = (target: DeveloperOverrideTarget) => {
    if (analyzeClickTimerRef.current) {
      window.clearTimeout(analyzeClickTimerRef.current)
      analyzeClickTimerRef.current = null
    }
    void handleAnalyze(developerMode ? target : undefined)
  }

  const handleAnalyzeClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!developerMode) {
      void handleAnalyze()
      return
    }
    if (event.detail > 1) return
    if (analyzeClickTimerRef.current) window.clearTimeout(analyzeClickTimerRef.current)
    analyzeClickTimerRef.current = window.setTimeout(() => {
      analyzeClickTimerRef.current = null
      runDeveloperTarget('real')
    }, 220)
  }

  const handleAnalyzeDoubleClick = () => {
    if (!developerMode) return
    runDeveloperTarget('fake')
  }

  const handleAnalyzeContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    if (!developerMode) return
    event.preventDefault()
    runDeveloperTarget('fake')
  }

  const base = (
    <main className="page page-studio">
      <section className="studio-hero">
        <div className="studio-copy">
          <button type="button" className="ghost-back" onClick={onBack}>메인으로 돌아가기</button>
          <span className="eyebrow">{category.kicker}</span>
          <h1>{activeProfile.title}</h1>
          <p>{activeProfile.description}</p>
          <div className="category-sense-row">{activeProfile.capabilities.map((item) => <span key={item}>{item}</span>)}</div>
        </div>
        <div className={`studio-highlight studio-atlas tone-${activeProfile.accent}`}><div className="studio-atlas-media"><model-viewer class="studio-brand-model" src={BRAND_MODEL_SRC} camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="12deg" interaction-prompt="none" shadow-intensity="1" exposure="1.05" disable-zoom touch-action="pan-y" /></div><div className="studio-atlas-copy"><span>{activeProfile.badge}</span><strong>{activeProfile.xai}</strong><small>{activeProfile.latency}</small></div></div>
      </section>

      <section className="selector-rack">{category.profiles.map((profile) => <button key={profile.id} type="button" className={`selector-pill ${profile.id === activeProfileId ? 'is-active' : ''} tone-${profile.accent}`} onClick={() => setActiveProfileId(profile.id)}><strong>{profile.title}</strong><span>{profile.subtitle}</span></button>)}</section>

      <section className={`studio-workbench ${analysis ? 'has-result' : 'is-input-only'}`}>
        <section className="studio-center-panel">
          <UploadZone category={category} upload={upload} onUploadState={setUpload} onAnalyze={() => { void handleAnalyze() }} canAnalyze={canAnalyze} isAnalyzing={isAnalyzing} />
          <section className="studio-status-strip"><article className="studio-status-card"><span>선택 모델</span><strong>{activeProfile.title}</strong><small>{activeProfile.subtitle}</small></article><article className="studio-status-card"><span>입력 상태</span><strong>{upload.file ? upload.file.name : upload.sourceMode === 'url' && upload.sourceUrl.trim() ? 'URL 입력 완료' : category.uploadKind === 'text' && upload.textValue ? '텍스트 입력 완료' : '입력을 기다리는 중'}</strong><small>{category.uploadKind === 'text' ? '텍스트 / 근거 / 설명' : (category.uploadKind === 'video' || category.id === 'image') ? '파일 또는 URL로 분석할 수 있습니다.' : '파일을 드래그하거나 직접 선택하세요'}</small></article><article className="studio-status-card"><span>분석 상태</span><strong>{isAnalyzing ? '분석 진행 중' : analysis ? '결과 준비 완료' : '대기 중'}</strong><small>{Math.round(progress)}% 진행</small></article>{category.id === 'multimodal' ? <article className="studio-status-card"><span>판정 모드</span><strong>{inferenceMode === 'ensemble' ? '6개 융합 판정' : '선택 모델 단독'}</strong><small>{inferenceMode === 'ensemble' ? '최종 결과는 6개 모델을 함께 씁니다.' : '현재 선택한 모델만 최종 판정에 사용합니다.'}</small></article> : null}</section>
          {(isAnalyzing || analysis) ? (
            <div ref={progressRailRef} className="progress-rail-anchor">
              <ProgressRail stages={category.stageLabels} progress={progress} isLive={isAnalyzing || llmSectionStatus === 'loading'} statusLabel={progressLabel} statusDetail={progressDetail} category={category} upload={upload} />
            </div>
          ) : null}
        </section>

        <aside className="studio-side-panel">
          <aside className="control-panel">
            <div className="panel-header"><div><span className="eyebrow">설정</span><h3>모델 설정</h3></div></div>
            {category.id === 'image' ? <div className="control-block"><label>Vision focus</label><div className="segmented"><button type="button" className={imageScope === 'full-scene' ? 'is-active' : ''} onClick={() => setImageScope('full-scene')}>전체 장면 모델</button><button type="button" className={imageScope === 'face-focus' ? 'is-active' : ''} onClick={() => setImageScope('face-focus')}>얼굴 단서 반영</button></div><p className="control-hint">{imageScope === 'face-focus' ? '얼굴 단서는 판정에 참고하되, 결과 화면의 대표 이미지는 전체 원본 이미지를 유지합니다.' : '전체 장면 초점은 이원석 모델을 기준으로 판별하고, 얼굴이 있을 때 얼굴 재판독을 추가 반영합니다.'}</p></div> : null}
            {category.id === 'multimodal' ? <div className="control-block"><label>판정 방식</label><div className="segmented"><button type="button" className={inferenceMode === 'ensemble' ? 'is-active' : ''} onClick={() => setInferenceMode('ensemble')}>6개 융합 판정</button><button type="button" className={inferenceMode === 'single' ? 'is-active' : ''} onClick={() => setInferenceMode('single')}>선택 모델 단독</button></div><p className="control-hint">{inferenceMode === 'ensemble' ? '현재 선택한 모델은 대표 기준으로 사용되고, 최종 결과는 6개 모델을 모두 반영해 계산됩니다.' : '현재 선택한 모델 1개만 사용해 판정하며, 다른 5개 모델은 참고 카드로만 표시됩니다.'}</p></div> : null}
            {category.id === 'image' ? <div className="control-block"><label>이미지 분석 방식</label><div className="segmented"><button type="button" className={activeProfile.id === 'image-fast' ? 'is-active' : ''} onClick={() => setActiveProfileId('image-fast')}>빠른 버전</button><button type="button" className={activeProfile.id === 'image-precision' ? 'is-active' : ''} onClick={() => setActiveProfileId('image-precision')}>정밀 버전</button></div><p className="control-hint">{activeProfile.id === 'image-precision' ? '정밀 버전은 전체 이미지의 RGB와 주파수 단서를 주 경로로 사용하고, 얼굴 단서는 보조 근거로만 반영합니다.' : '빠른 버전은 장면 전체 단서를 빠르게 훑고, 얼굴 단서가 있으면 보조적으로 함께 참조합니다.'}</p></div> : null}
            {category.id === 'multimodal' ? <div className="control-block"><label>XAI 깊이</label><div className="segmented"><button type="button" className={xaiDepth === 'signature' ? 'is-active' : ''} onClick={() => setXaiDepth('signature')}>기본</button><button type="button" className={xaiDepth === 'deep-dive' ? 'is-active' : ''} onClick={() => setXaiDepth('deep-dive')}>상세</button></div></div> : null}
            {category.id === 'text' || category.id === 'multimodal' ? <div className="control-block"><label>{category.id === 'text' ? '입력 텍스트' : '보조 설명'}</label><textarea className="side-textarea" placeholder={category.id === 'text' ? '분석할 텍스트를 붙여넣거나 TXT 파일을 업로드하세요.' : '선택 사항: 캡션, 설명, 기사 문장 등을 함께 입력하세요.'} value={category.id === 'text' ? upload.textValue : companionText} onChange={(event) => category.id === 'text' ? setUpload((current) => ({ ...current, textValue: event.target.value })) : setCompanionText(event.target.value)} /></div> : null}
            <div className="control-list">{activeProfile.capabilities.map((capability) => <div key={capability} className="control-capability"><span className="highlight-dot" /><strong>{capability}</strong></div>)}</div>
            {errorMessage ? <p className="studio-inline-note">{errorMessage}</p> : null}
            <label className="developer-mode-toggle">
              <input type="checkbox" checked={developerMode} onChange={(event) => setDeveloperMode(event.target.checked)} />
              <span>개발자 모드</span>
            </label>
            <div className="action-row"><button type="button" className="primary-cta wide" onClick={handleAnalyzeClick} onDoubleClick={handleAnalyzeDoubleClick} onContextMenu={handleAnalyzeContextMenu} disabled={!canAnalyze || isAnalyzing}>{isAnalyzing ? '분석 중...' : '진위 판별 시작'}</button><button type="button" className="secondary-cta wide" onClick={() => { setUpload(initialUploadState()); setProgress(0); setIsAnalyzing(false); setAnalysis(null); setLlmSectionStatus('idle'); setIsResultExpanded(false); setCompanionText(''); setErrorMessage(''); setProgressLabel('입력을 기다리는 중'); setProgressDetail('파일을 올리면 분석 범위, 모델 추론, 설명 생성 순서로 진행됩니다.'); setInferenceMode('ensemble') }}>초기화</button></div>
          </aside>
        </aside>

        {analysis ? (
          <aside className="studio-result-panel">
            {hasFullScreenResult ? <button type="button" className="primary-cta wide result-expand-button" onClick={() => { trackUsageEvent('result_expanded', { page: 'studio', modality: category.id, modelName: activeProfile.id }); setIsResultExpanded(true) }}>결과 전체 화면 보기</button> : null}
            <ResultDashboard analysis={analysis} upload={upload} category={category} profile={activeProfile} llmSectionStatus={llmSectionStatus} />
          </aside>
        ) : null}
      </section>

      <section className="studio-guide-row">
        <article className="studio-preamble-card studio-preamble-compact"><span className="eyebrow">분석 흐름</span><h3>{categoryNameKo(category.id)} 분석은 어떤 순서로 진행되나요?</h3><InfoDisclosure title="분석 흐름 보기"><p>{MODE_GUIDES[category.id].purpose}</p><div className="mission-steps">{category.stageLabels.map((stage, index) => <span key={stage}>{String(index + 1).padStart(2, '0')} {stage}</span>)}</div></InfoDisclosure></article>
        <ModeGuideCard category={category} />
        <ConnectedModalitiesCard category={category} />
      </section>

      {analysis && hasFullScreenResult && isResultExpanded ? <ResultSpotlightOverlay analysis={analysis} upload={upload} category={category} profile={activeProfile} llmSectionStatus={llmSectionStatus} onClose={() => setIsResultExpanded(false)} /> : null}
    </main>
  )

  if (category.id === 'image') return <ImageStudioRoute>{base}</ImageStudioRoute>
  if (category.id === 'text') return <TextStudioRoute>{base}</TextStudioRoute>
  if (category.id === 'video') return <VideoStudioRoute>{base}</VideoStudioRoute>
  return <MultimodalStudioRoute>{base}</MultimodalStudioRoute>
}

export default function App() {
  const [view, setView] = useState<View>(() => parseHashToView(window.location.hash))
  const activeCategory = view.screen === 'studio' ? view.category : null

  useEffect(() => {
    const handleHashChange = () => {
      setView(parseHashToView(window.location.hash))
    }

    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const openHome = () => {
    const nextView: View = { screen: 'home' }
    trackUsageEvent('page_view', { page: 'home', status: 'navigate' })
    transitionTo(() => setView(nextView))
    syncHash(nextView)
  }

  const openStudio = (category: CategoryId) => {
    const nextView: View = { screen: 'studio', category }
    trackUsageEvent('page_view', { page: 'studio', modality: category, modelName: getDefaultProfile(CATEGORY_CONFIG[category]).id, status: 'navigate' })
    transitionTo(() => setView(nextView))
    syncHash(nextView)
  }

  return (
    <Shell onHome={openHome} onSelectCategory={openStudio} activeCategory={activeCategory}>
      {view.screen === 'home' ? <HomePage onOpenCategory={openStudio} /> : <StudioPage key={view.category} category={CATEGORY_CONFIG[view.category]} onBack={openHome} />}
    </Shell>
  )
}
