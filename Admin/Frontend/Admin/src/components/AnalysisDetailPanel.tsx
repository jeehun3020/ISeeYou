import { useEffect, useMemo, useState } from "react";

import { ADMIN_ANALYSIS_API, fetchAdminResponse, postAdminJson } from "../api/adminApi";
import type { Analysis, AnalysisDetail, AnalysisLog, AnalysisReview } from "../types/analysis";

type Props = {
  detail: AnalysisDetail;
  selectedId: string;
  selectedItem: Analysis;
  previewBlobUrl: string;
  textContent: string;
  onClose: () => void;
  onDelete: () => void;
  onReviewSaved: (review: AnalysisReview) => void;
};

const TIMELINE_EVENTS = new Set([
  "created",
  "file_saved",
  "processing_started",
  "processing_finished",
  "processing_failed",
]);

export default function AnalysisDetailPanel({
  detail,
  selectedId,
  selectedItem,
  previewBlobUrl,
  textContent,
  onClose,
  onDelete,
  onReviewSaved,
}: Props) {
  const realScore = useMemo(() => formatPercentValue(detail.real_score), [detail.real_score]);
  const fakeScore = useMemo(() => formatPercentValue(detail.fake_score), [detail.fake_score]);
  const [reviewedLabel, setReviewedLabel] = useState(detail.review?.reviewed_label ?? "");
  const [reviewNote, setReviewNote] = useState(detail.review?.note ?? "");
  const [datasetCandidate, setDatasetCandidate] = useState(Boolean(detail.review?.dataset_candidate));
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const predictedReview = useMemo(
    () => getPredictedReviewStatus(selectedItem.result_label, reviewedLabel),
    [selectedItem.result_label, reviewedLabel],
  );

  useEffect(() => {
    setReviewedLabel(detail.review?.reviewed_label ?? "");
    setReviewNote(detail.review?.note ?? "");
    setDatasetCandidate(Boolean(detail.review?.dataset_candidate));
    setReviewMessage("");
  }, [detail.id, detail.review]);

  async function handleDownload() {
    try {
      const response = await fetchAdminResponse(`${ADMIN_ANALYSIS_API}/${selectedId}/download`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = selectedItem.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSaveReview() {
    setSavingReview(true);
    setReviewMessage("");
    try {
      const response = await postAdminJson<{ ok: boolean; review: AnalysisReview }>(
        `${ADMIN_ANALYSIS_API}/${selectedId}/review`,
        {
          reviewed_label: reviewedLabel || null,
          note: reviewNote,
          dataset_candidate: datasetCandidate,
        },
      );
      onReviewSaved(response.review);
      setReviewMessage("검수 결과를 저장했습니다.");
    } catch (error) {
      console.error(error);
      setReviewMessage("검수 결과를 저장하지 못했습니다.");
    } finally {
      setSavingReview(false);
    }
  }

  return (
    <div className="admin-panel-wrapper">
      <button className="admin-panel-close" onClick={onClose} aria-label="상세 패널 닫기">×</button>

      <aside className="admin-side-panel">
        <header className="panel-header">
          <div>
            <p>상세 분석 기록</p>
            <h2>{selectedItem.file_name}</h2>
          </div>
          <div className="panel-header-actions">
            <span className={`admin-badge status-${selectedItem.status}`}>{statusLabel(selectedItem.status)}</span>
            <button type="button" className="admin-delete-button is-panel" onClick={onDelete}>삭제</button>
          </div>
        </header>

        <section className="panel-summary-grid">
          <DetailMetric label="판정 결과" value={selectedItem.result_label ? resultLabel(selectedItem.result_label) : "-"} tone={selectedItem.result_label?.toLowerCase()} />
          <DetailMetric label="신뢰도" value={formatConfidence(selectedItem.confidence)} />
          <DetailMetric label="모델 유형" value={modelTypeLabel(selectedItem.model_type)} />
          <DetailMetric label="모델 이름" value={selectedItem.model_name} />
        </section>

        <section className="panel-preview-card">
          <div className="panel-section-title">
            <h3>입력 미리보기</h3>
            <button className="preview-download-button" onClick={handleDownload}>다운로드</button>
          </div>
          <div className="panel-preview">
            <Preview detail={detail} previewBlobUrl={previewBlobUrl} textContent={textContent} />
          </div>
        </section>

        <section className="panel-score-card">
          <div className="panel-section-title">
            <h3>모델 점수</h3>
            <span>서버에 저장된 결과 기준</span>
          </div>
          <div className="panel-score-bars">
            <ScoreBar label="Real" value={detail.real_score} tone="real" />
            <ScoreBar label="Fake" value={detail.fake_score} tone="fake" />
          </div>
          <div className="panel-score-values">
            <strong>{realScore}</strong>
            <strong>{fakeScore}</strong>
          </div>
        </section>

        <section className="panel-review-card">
          <div className="panel-section-title">
            <h3>관리자 검수</h3>
            <span>{detail.review ? reviewStatusLabel(detail.review.error_type) : "미검수"}</span>
          </div>
          <div className="review-compare-grid">
            <DetailMetric label="모델 판정" value={selectedItem.result_label ? resultLabel(selectedItem.result_label) : "-"} tone={selectedItem.result_label?.toLowerCase()} />
            <DetailMetric label="관리자 판정" value={reviewedLabel ? resultLabel(reviewedLabel) : "판단 보류"} tone={reviewedLabel.toLowerCase()} />
            <DetailMetric label="오류 분석" value={predictedReview.label} tone={predictedReview.tone} />
          </div>
          <div className="review-form-grid">
            <label className="review-field">
              <span>관리자 판정</span>
              <select value={reviewedLabel} onChange={(event) => setReviewedLabel(event.target.value)}>
                <option value="">판단 보류</option>
                <option value="REAL">Real</option>
                <option value="FAKE">Fake</option>
              </select>
            </label>
            <label className="review-check">
              <input
                type="checkbox"
                checked={datasetCandidate}
                onChange={(event) => setDatasetCandidate(event.target.checked)}
              />
              <span>재학습 데이터 후보로 표시</span>
            </label>
          </div>
          <label className="review-field">
            <span>검수 메모</span>
            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="오류 원인, 확인 근거, 재학습에 필요한 참고사항을 기록하세요."
              rows={4}
            />
          </label>
          <div className="review-actions">
            {reviewMessage ? <span className={reviewMessage.includes("못했습니다") ? "is-error" : ""}>{reviewMessage}</span> : <span>{predictedReview.description}</span>}
            <button type="button" className="review-save-button" onClick={handleSaveReview} disabled={savingReview}>
              {savingReview ? "저장 중" : "검수 저장"}
            </button>
          </div>
        </section>

        <section className="panel-meta-card">
          <div className="panel-section-title">
            <h3>처리 정보</h3>
            <span>{new Date(selectedItem.created_at).toLocaleString()}</span>
          </div>
          <dl className="panel-meta-list">
            <div><dt>소스 유형</dt><dd>{detail.source_kind}</dd></div>
            <div><dt>MIME</dt><dd>{detail.mime_type}</dd></div>
            <div><dt>파일 크기</dt><dd>{formatBytes(detail.file_size)}</dd></div>
            <div><dt>추론 시간</dt><dd>{detail.inference_time_ms != null ? `${detail.inference_time_ms}ms` : "-"}</dd></div>
            {detail.source_url ? <div className="is-wide"><dt>URL</dt><dd>{detail.source_url}</dd></div> : null}
            {detail.explanation ? <div className="is-wide"><dt>요약</dt><dd>{detail.explanation}</dd></div> : null}
            {detail.error_message ? <div className="is-wide is-error"><dt>오류</dt><dd>{detail.error_message}</dd></div> : null}
          </dl>
        </section>

        <section className="timeline-table">
          <div className="panel-section-title">
            <h3>처리 타임라인</h3>
            <span>저장 및 추론 로그</span>
          </div>
          <div className="timeline-rows">
            {detail.logs
              .filter((log) => TIMELINE_EVENTS.has(log.event_type))
              .map((log) => <TimelineRow key={log.id} log={log} />)}
          </div>
        </section>
      </aside>
    </div>
  );
}

function DetailMetric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`panel-detail-metric ${tone ? `tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Preview({
  detail,
  previewBlobUrl,
  textContent,
}: {
  detail: AnalysisDetail;
  previewBlobUrl: string;
  textContent: string;
}) {
  if (detail.model_type === "text" || detail.source_kind === "url_only") {
    return <pre className="panel-text-preview">{textContent || "미리보기 내용이 없습니다."}</pre>;
  }
  if (detail.mime_type.startsWith("image/")) {
    return <img src={previewBlobUrl} alt={detail.file_name} className="panel-preview-media" />;
  }
  if (detail.mime_type.startsWith("video/") || detail.model_type === "video" || detail.model_type === "multimodal") {
    return <video src={previewBlobUrl} controls className="panel-preview-media" />;
  }
  return <pre className="panel-text-preview">{textContent || "이 파일 형식은 미리보기를 지원하지 않습니다."}</pre>;
}

function ScoreBar({ label, value, tone }: { label: string; value: number | null; tone: "real" | "fake" }) {
  const width = value != null ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="panel-score-bar">
      <div className="panel-score-bar-label">
        <span>{label}</span>
        <strong>{formatPercentValue(value)}</strong>
      </div>
      <div className="panel-score-track">
        <span className={`panel-score-fill ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function TimelineRow({ log }: { log: AnalysisLog }) {
  return (
    <div className="timeline-row">
      <div>
        <strong>{timelineLabel(log.event_type)}</strong>
        {log.message ? <p>{log.message}</p> : null}
      </div>
      <time>{new Date(log.created_at).toLocaleString()}</time>
    </div>
  );
}

function getPredictedReviewStatus(modelLabel: string | null, reviewedLabel: string) {
  const model = (modelLabel ?? "").toUpperCase();
  const reviewed = reviewedLabel.toUpperCase();
  if (!reviewed) {
    return { label: "판단 보류", tone: "event", description: "관리자 판정을 선택하면 오류 유형이 자동으로 계산됩니다." };
  }
  if (model !== "REAL" && model !== "FAKE") {
    return { label: "모델 결과 없음", tone: "event", description: "모델 판정이 없어 정답 여부를 계산할 수 없습니다." };
  }
  if (model === reviewed) {
    return { label: "모델 판정 일치", tone: "success", description: "관리자 판정과 모델 판정이 일치합니다." };
  }
  if (model === "FAKE" && reviewed === "REAL") {
    return { label: "오탐", tone: "failed", description: "실제 Real로 검수되었지만 모델은 Fake로 판단했습니다." };
  }
  if (model === "REAL" && reviewed === "FAKE") {
    return { label: "미탐", tone: "failed", description: "실제 Fake로 검수되었지만 모델은 Real로 판단했습니다." };
  }
  return { label: "불일치", tone: "failed", description: "모델 판정과 관리자 판정이 다릅니다." };
}

function reviewStatusLabel(errorType: string) {
  if (errorType === "correct") return "모델 판정 일치";
  if (errorType === "false_positive") return "오탐";
  if (errorType === "false_negative") return "미탐";
  if (errorType === "needs_review") return "판단 보류";
  if (errorType === "model_unavailable") return "모델 결과 없음";
  return errorType;
}

function timelineLabel(eventType: string) {
  if (eventType === "created") return "기록 생성";
  if (eventType === "file_saved") return "입력 저장";
  if (eventType === "processing_started") return "분석 시작";
  if (eventType === "processing_finished") return "분석 완료";
  if (eventType === "processing_failed") return "분석 실패";
  return eventType;
}

function statusLabel(status: string) {
  if (status === "success") return "완료";
  if (status === "failed") return "실패";
  if (status === "processing") return "처리 중";
  return status;
}

function resultLabel(result: string) {
  if (result.toUpperCase() === "REAL") return "Real";
  if (result.toUpperCase() === "FAKE") return "Fake";
  return result;
}

function modelTypeLabel(type: string) {
  if (type === "text") return "Text";
  if (type === "image") return "Image";
  if (type === "video") return "Video";
  if (type === "multimodal") return "Multimodal";
  return type;
}

function formatPercentValue(value: number | null) {
  return value != null ? `${value.toFixed(1)}%` : "-";
}

function formatConfidence(confidence: number | null) {
  return confidence != null ? `${(confidence * 100).toFixed(1)}%` : "-";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
