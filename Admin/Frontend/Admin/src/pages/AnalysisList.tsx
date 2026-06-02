import { useEffect, useMemo, useState } from "react";

import {
  ADMIN_ANALYSIS_API,
  clearAdminToken,
  deleteAdminJson,
  fetchAdminJson,
  fetchAdminResponse,
} from "../api/adminApi";
import { PageButton, Td, Th } from "../components/AdminTable";
import AnalysisDetailPanel from "../components/AnalysisDetailPanel";
import FilterField from "../components/FilterField";
import {
  MODEL_NAME_MAP,
  MODEL_TYPE_OPTIONS,
  RESULT_OPTIONS,
  STATUS_OPTIONS,
} from "../constants/analysisFilters";
import "../css/AnalysisList.css";
import type { AdminStats, Analysis, AnalysisDetail, AnalysisListResponse, AnalysisReview, UserEvent } from "../types/analysis";

type Props = {
  onLogout: () => void;
};

const ITEMS_PER_PAGE = 10;

export default function AnalysisList({ onLogout }: Props) {
  const [data, setData] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Analysis | null>(null);
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [modelTypeFilter, setModelTypeFilter] = useState("all");
  const [modelNameFilter, setModelNameFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [textContent, setTextContent] = useState("");
  const [previewBlobUrl, setPreviewBlobUrl] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<AdminStats | null>(null);

  const modelNameOptions = useMemo(() => {
    if (modelTypeFilter === "all") return [];
    return MODEL_NAME_MAP[modelTypeFilter] ?? [];
  }, [modelTypeFilter]);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setCurrentPage(1);
    setLoading(true);
  }

  function updateSortOrder(value: string) {
    setSortOrder(value as "desc" | "asc");
    setCurrentPage(1);
    setLoading(true);
  }

  function updateModelTypeFilter(value: string) {
    setModelTypeFilter(value);
    setModelNameFilter((current) => {
      const validModels = MODEL_NAME_MAP[value] ?? [];
      return value === "all" || !validModels.includes(current) ? "all" : current;
    });
    setCurrentPage(1);
    setLoading(true);
  }

  function updateCurrentPage(value: number) {
    setCurrentPage(value);
    setLoading(true);
  }

  function openDetail(item: Analysis) {
    setSelectedId(item.id);
    setSelectedItem(item);
    setDetail(null);
    setPreviewBlobUrl("");
    setTextContent("");
  }

  function closeDetailPanel() {
    setSelectedId(null);
    setSelectedItem(null);
    setDetail(null);
    setPreviewBlobUrl("");
    setTextContent("");
  }

  function handleReviewSaved(review: AnalysisReview) {
    setDetail((current) => (current ? { ...current, review } : current));
    setSelectedItem((current) => (current ? { ...current, review } : current));
    setData((items) => items.map((item) => (item.id === review.analysis_id ? { ...item, review } : item)));
    setRefreshKey((value) => value + 1);
  }

  async function handleDeleteAnalysis(item: Analysis) {
    const confirmed = window.confirm(`"${item.file_name}" 분석 기록을 삭제할까요? 저장된 입력 파일과 결과 JSON도 함께 삭제됩니다.`);
    if (!confirmed) return;

    try {
      await deleteAdminJson<{ ok: boolean; deleted_id: string }>(`${ADMIN_ANALYSIS_API}/${item.id}`);
      if (selectedId === item.id) closeDetailPanel();
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      console.error(error);
      setErrorMessage("분석 기록을 삭제하지 못했습니다. 관리자 서버 상태를 확인해주세요.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("sort_order", sortOrder);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (resultFilter !== "all") params.set("result_label", resultFilter);
    if (modelTypeFilter !== "all") params.set("model_type", modelTypeFilter);
    if (modelNameFilter !== "all") params.set("model_name", modelNameFilter);

    setErrorMessage("");
    fetchAdminJson<AnalysisListResponse>(`${ADMIN_ANALYSIS_API}?${params}`)
      .then((response) => {
        setData(response.items);
        setTotalPages(Math.max(response.total_pages, 1));
        setTotalCount(response.total);
      })
      .catch((error) => {
        console.error(error);
        setErrorMessage("분석 기록을 불러오지 못했습니다. 관리자 서버 상태를 확인해주세요.");
      })
      .finally(() => setLoading(false));
  }, [currentPage, statusFilter, resultFilter, modelTypeFilter, modelNameFilter, sortOrder, refreshKey]);

  useEffect(() => {
    fetchAdminJson<AdminStats>("/api/admin/stats")
      .then(setStats)
      .catch((error) => {
        console.error(error);
      });
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedId) return;
    fetchAdminJson<AnalysisDetail>(`${ADMIN_ANALYSIS_API}/${selectedId}`)
      .then(setDetail)
      .catch((error) => {
        console.error(error);
        setErrorMessage("선택한 분석 상세 정보를 불러오지 못했습니다.");
      });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !selectedItem || !detail) return;
    let objectUrl = "";

    fetchAdminResponse(`${ADMIN_ANALYSIS_API}/${selectedId}/preview`)
      .then(async (response) => {
        if (detail.mime_type.startsWith("text/") || detail.mime_type === "application/json" || detail.source_kind === "url_only") {
          setTextContent(await response.text());
          return;
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(objectUrl);
      })
      .catch(console.error);

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedId, selectedItem, detail]);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const max = 5;
    let start = Math.max(1, currentPage - 2);
    let end = start + max - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - max + 1);
    }
    for (let page = start; page <= end; page += 1) pages.push(page);
    return pages;
  }, [currentPage, totalPages]);

  const totalStats = stats?.total_count ?? totalCount;
  const successRate = totalStats ? Math.round(((stats?.success_count ?? 0) / totalStats) * 100) : 0;
  const eventCount = stats?.event_count ?? 0;

  return (
    <div className="admin-shell">
      <main className={`admin-page ${selectedItem ? "has-panel" : ""}`}>
        <div className="admin-main">
          <div className="admin-topbar">
            <div className="admin-brand">
              <span>I SEE YOU</span>
              <strong>Admin Console</strong>
            </div>
            <button
              type="button"
              className="admin-floating-logout"
              onClick={() => {
                clearAdminToken();
                onLogout();
              }}
            >
              로그아웃
            </button>
          </div>

          <section className="admin-hero">
            <div className="admin-hero-copy">
              <p>운영 현황</p>
              <h1>ISeeYou 운영 상태를 한눈에 확인합니다.</h1>
              <span>
                분석 요청, 판정 결과, 사용자 이벤트를 같은 화면에서 연결해
                서비스 사용 흐름과 모델 처리 상태를 점검합니다.
              </span>
            </div>
            <div className="admin-hero-stats">
              <div className="admin-stat-card"><span>저장된 분석</span><strong>{totalStats}</strong></div>
              <div className="admin-stat-card"><span>완료율</span><strong>{successRate}%</strong></div>
              <div className="admin-stat-card"><span>사용 이벤트</span><strong>{eventCount}</strong></div>
            </div>
          </section>

          <section className="admin-section-head" aria-label="대시보드 안내">
            <div>
              <span>Dashboard</span>
              <h2>핵심 흐름</h2>
            </div>
            <p>최근 분석량, 판정 분포, 사용자의 분석 진행 단계를 우선 확인합니다.</p>
          </section>

          <section className="admin-dashboard-grid is-primary" aria-label="핵심 운영 대시보드">
            <article className="admin-dashboard-card is-wide">
              <div className="dashboard-card-title">
                <span>Trend</span>
                <strong>최근 7일 분석량</strong>
              </div>
              <TrendBars rows={stats?.analysis_trend ?? []} />
            </article>

            <article className="admin-dashboard-card">
              <div className="dashboard-card-title">
                <span>Decision</span>
                <strong>Real / Fake 비율</strong>
              </div>
              <ResultDonut real={stats?.real_count ?? 0} fake={stats?.fake_count ?? 0} />
            </article>

            <article className="admin-dashboard-card">
              <div className="dashboard-card-title">
                <span>User Flow</span>
                <strong>분석 진행 흐름</strong>
              </div>
              <FunnelSteps rows={stats?.event_funnel ?? []} />
            </article>
          </section>

          <section className="admin-section-head" aria-label="운영 세부 지표 안내">
            <div>
              <span>Diagnostics</span>
              <h2>운영 세부 지표</h2>
            </div>
            <p>실패율과 모달리티 사용량, 최근 이벤트를 함께 보며 이상 징후를 확인합니다.</p>
          </section>

          <section className="admin-dashboard-grid is-secondary" aria-label="운영 세부 지표">
            <article className="admin-dashboard-card">
              <div className="dashboard-card-title">
                <span>Review</span>
                <strong>관리자 검수 요약</strong>
              </div>
              <ReviewSummary stats={stats} />
            </article>

            <article className="admin-dashboard-card">
              <div className="dashboard-card-title">
                <span>Operation</span>
                <strong>분석 처리 요약</strong>
              </div>
              <div className="dashboard-metric-grid">
                <StatPill label="전체" value={stats?.total_count ?? totalCount} />
                <StatPill label="성공" value={stats?.success_count ?? 0} tone="success" />
                <StatPill label="실패" value={stats?.failed_count ?? 0} tone="failed" />
                <StatPill label="처리 중" value={stats?.processing_count ?? 0} tone="event" />
              </div>
            </article>

            <article className="admin-dashboard-card">
              <div className="dashboard-card-title">
                <span>Quality</span>
                <strong>모달리티별 실패율</strong>
              </div>
              <FailureRateList rows={stats?.modality_failure_rates ?? []} />
            </article>

            <article className="admin-dashboard-card">
              <div className="dashboard-card-title">
                <span>Models</span>
                <strong>모달리티별 요청</strong>
              </div>
              <MiniBarList rows={stats?.model_type_counts ?? []} emptyText="아직 저장된 분석 요청이 없습니다." />
            </article>

            <article className="admin-dashboard-card">
              <div className="dashboard-card-title">
                <span>Events</span>
                <strong>최근 사용자 이벤트</strong>
              </div>
              <EventTypeBars rows={stats?.event_type_counts ?? []} />
              <RecentEventList events={stats?.recent_events ?? []} />
            </article>
          </section>

          <section className="admin-section-head is-records" aria-label="분석 기록 안내">
            <div>
              <span>Records</span>
              <h2>분석 기록</h2>
            </div>
            <p>총 {totalCount}개 기록 · {currentPage}/{totalPages}페이지 {loading ? "· 새로고침 중" : ""}</p>
          </section>

          <section className="admin-filter-panel" aria-label="분석 기록 필터">
            <FilterField
              label="처리 상태"
              value={statusFilter}
              onChange={(value) => updateFilter(setStatusFilter, value)}
              options={[{ value: "all", label: "전체" }, ...STATUS_OPTIONS.map((status) => ({ value: status, label: statusLabel(status) }))]}
            />
            <FilterField
              label="판정 결과"
              value={resultFilter}
              onChange={(value) => updateFilter(setResultFilter, value)}
              options={[{ value: "all", label: "전체" }, ...RESULT_OPTIONS.map((result) => ({ value: result, label: resultLabel(result) }))]}
            />
            <FilterField
              label="모델 유형"
              value={modelTypeFilter}
              onChange={updateModelTypeFilter}
              options={[{ value: "all", label: "전체" }, ...MODEL_TYPE_OPTIONS.map((type) => ({ value: type, label: modelTypeLabel(type) }))]}
            />
            <FilterField
              label="모델 이름"
              value={modelNameFilter}
              onChange={(value) => updateFilter(setModelNameFilter, value)}
              disabled={modelTypeFilter === "all"}
              options={[{ value: "all", label: "전체" }, ...modelNameOptions.map((name) => ({ value: name, label: name }))]}
            />
            <FilterField
              label="시간 정렬"
              value={sortOrder}
              onChange={updateSortOrder}
              options={[
                { value: "desc", label: "최신순" },
                { value: "asc", label: "오래된순" },
              ]}
            />
          </section>

          {errorMessage ? <div className="admin-alert">{errorMessage}</div> : null}

          <section className="admin-table-panel">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <Th>파일명</Th>
                    <Th>상태</Th>
                    <Th>결과</Th>
                    <Th>신뢰도</Th>
                    <Th>모델 유형</Th>
                    <Th>모델 이름</Th>
                    <Th>검수</Th>
                    <Th>시간</Th>
                    <Th>관리</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.length ? data.map((item) => (
                    <tr
                      key={item.id}
                      className={`admin-row ${selectedId === item.id ? "is-selected" : ""}`}
                      onClick={() => openDetail(item)}
                    >
                      <Td className="is-file">{item.file_name}</Td>
                      <Td><span className={`admin-badge status-${item.status}`}>{statusLabel(item.status)}</span></Td>
                      <Td>{item.result_label ? <span className={`admin-badge result-${item.result_label.toLowerCase()}`}>{resultLabel(item.result_label)}</span> : "-"}</Td>
                      <Td>{formatConfidence(item.confidence)}</Td>
                      <Td>{modelTypeLabel(item.model_type)}</Td>
                      <Td>{item.model_name}</Td>
                      <Td><span className={`admin-badge ${reviewBadgeClass(item.review)}`}>{reviewLabel(item.review)}</span></Td>
                      <Td>{new Date(item.created_at).toLocaleString()}</Td>
                      <Td>
                        <button
                          type="button"
                          className="admin-delete-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteAnalysis(item);
                          }}
                        >
                          삭제
                        </button>
                      </Td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="admin-empty" colSpan={9}>
                        조건에 맞는 분석 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <PageButton onClick={() => updateCurrentPage(Math.max(currentPage - 1, 1))} disabled={currentPage === 1}>이전</PageButton>
              {pageNumbers.map((page) => (
                <PageButton key={page} onClick={() => updateCurrentPage(page)} active={page === currentPage}>{page}</PageButton>
              ))}
              <PageButton onClick={() => updateCurrentPage(Math.min(currentPage + 1, totalPages))} disabled={currentPage === totalPages}>다음</PageButton>
            </div>
          </section>
        </div>

        {selectedItem && selectedId ? (
          detail ? (
            <AnalysisDetailPanel
              detail={detail}
              selectedId={selectedId}
              selectedItem={selectedItem}
              previewBlobUrl={previewBlobUrl}
              textContent={textContent}
              onClose={closeDetailPanel}
              onDelete={() => void handleDeleteAnalysis(selectedItem)}
              onReviewSaved={handleReviewSaved}
            />
          ) : (
            <aside className="admin-panel-wrapper">
              <section className="admin-side-panel is-loading">상세 정보를 불러오는 중입니다.</section>
            </aside>
          )
        ) : null}
      </main>
    </div>
  );
}

function StatPill({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`dashboard-stat-pill ${tone ? `tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReviewSummary({ stats }: { stats: AdminStats | null }) {
  const reviewed = stats?.review_total ?? 0;
  const accuracy = stats?.review_accuracy ?? 0;
  return (
    <div className="dashboard-review-summary">
      <div className="review-score-ring" style={{ background: `conic-gradient(var(--cyan) 0 ${accuracy}%, rgba(255, 248, 236, 0.12) ${accuracy}% 100%)` }}>
        <div>
          <strong>{reviewed ? `${accuracy.toFixed(1)}%` : "-"}</strong>
          <span>검수 기준 정답률</span>
        </div>
      </div>
      <div className="review-summary-list">
        <div><span>검수 완료</span><strong>{reviewed}</strong></div>
        <div><span>오류</span><strong>{stats?.review_error_count ?? 0}</strong></div>
        <div><span>오탐</span><strong>{stats?.false_positive_count ?? 0}</strong></div>
        <div><span>미탐</span><strong>{stats?.false_negative_count ?? 0}</strong></div>
        <div><span>재학습 후보</span><strong>{stats?.dataset_candidate_count ?? 0}</strong></div>
      </div>
    </div>
  );
}

function ResultDonut({ real, fake }: { real: number; fake: number }) {
  const total = real + fake;
  const realPct = total ? Math.round((real / total) * 100) : 0;
  const fakePct = total ? 100 - realPct : 0;
  const gradient = total
    ? `conic-gradient(#7ef2d0 0 ${realPct}%, #ff6f91 ${realPct}% 100%)`
    : "conic-gradient(rgba(255, 248, 236, 0.12) 0 100%)";

  return (
    <div className="dashboard-donut-layout">
      <div className="dashboard-donut" style={{ background: gradient }} aria-label={`Real ${realPct}%, Fake ${fakePct}%`}>
        <div className="dashboard-donut-center">
          <span>판정</span>
          <strong>{total ? `${realPct}%` : "-"}</strong>
          <small>Real</small>
        </div>
      </div>
      <div className="dashboard-donut-legend">
        <div className="dashboard-legend-row">
          <span className="legend-dot is-real" />
          <strong>Real</strong>
          <em>{real}건 · {total ? `${realPct}%` : "-"}</em>
        </div>
        <div className="dashboard-legend-row">
          <span className="legend-dot is-fake" />
          <strong>Fake</strong>
          <em>{fake}건 · {total ? `${fakePct}%` : "-"}</em>
        </div>
      </div>
    </div>
  );
}

function MiniBarList({ rows, emptyText }: { rows: Array<{ label: string; count: number }>; emptyText: string }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) return <p className="dashboard-empty">{emptyText}</p>;
  return (
    <div className="dashboard-mini-bars">
      {rows.map((row) => (
        <div key={row.label} className="dashboard-mini-row">
          <div><strong>{modelTypeLabel(row.label)}</strong><span>{row.count}</span></div>
          <div className="dashboard-mini-track"><span style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function TrendBars({ rows }: { rows: Array<{ date: string; total: number; success: number; failed: number }> }) {
  const max = Math.max(...rows.map((row) => row.total), 1);
  if (!rows.length) return <p className="dashboard-empty">최근 7일 분석 기록이 없습니다.</p>;
  return (
    <div className="dashboard-trend-chart">
      {rows.map((row) => {
        const height = row.total ? Math.max(18, (row.total / max) * 100) : 6;
        return (
          <div key={row.date} className="dashboard-trend-column">
            <div className="dashboard-trend-bar" title={`${formatShortDate(row.date)} · 전체 ${row.total}건`}>
              <span className="success" style={{ height: `${height}%` }} />
              {row.failed > 0 ? <i style={{ height: `${Math.max(12, (row.failed / Math.max(row.total, 1)) * height)}%` }} /> : null}
            </div>
            <strong>{row.total}</strong>
            <time>{formatShortDate(row.date)}</time>
          </div>
        );
      })}
    </div>
  );
}

function FailureRateList({ rows }: { rows: Array<{ label: string; total: number; success: number; failed: number; failure_rate: number }> }) {
  if (!rows.length) return <p className="dashboard-empty">아직 실패율을 계산할 분석 기록이 없습니다.</p>;
  return (
    <div className="dashboard-failure-list">
      {rows.map((row) => (
        <div key={row.label} className="dashboard-failure-row">
          <div>
            <strong>{modelTypeLabel(row.label)}</strong>
            <span>{row.failed}/{row.total} 실패</span>
          </div>
          <div className="dashboard-failure-track">
            <span style={{ width: `${Math.max(row.failure_rate ? 8 : 0, row.failure_rate)}%` }} />
          </div>
          <em>{row.failure_rate.toFixed(1)}%</em>
        </div>
      ))}
    </div>
  );
}

function FunnelSteps({ rows }: { rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) return <p className="dashboard-empty">아직 사용자 흐름 데이터가 없습니다.</p>;
  return (
    <div className="dashboard-funnel">
      {rows.map((row, index) => (
        <div key={row.label} className="dashboard-funnel-step">
          <div className="dashboard-funnel-index">{index + 1}</div>
          <div>
            <strong>{eventLabel(row.label)}</strong>
            <span>{row.count}건</span>
          </div>
          <div className="dashboard-funnel-track">
            <span style={{ width: `${Math.max(row.count ? 12 : 0, (row.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EventTypeBars({ rows }: { rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) return <p className="dashboard-empty">아직 집계된 사용자 이벤트가 없습니다.</p>;
  return (
    <div className="dashboard-event-bars">
      {rows.slice(0, 4).map((row) => (
        <div key={row.label} className="dashboard-event-bar-row">
          <div>
            <strong>{eventLabel(row.label)}</strong>
            <span>{row.count}</span>
          </div>
          <div className="dashboard-event-track">
            <span style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentEventList({ events }: { events: UserEvent[] }) {
  if (!events.length) return <p className="dashboard-empty">아직 사용자 이벤트가 없습니다.</p>;
  return (
    <div className="dashboard-event-list">
      {events.slice(0, 5).map((event) => (
        <div key={event.id} className="dashboard-event-row">
          <strong>{eventLabel(event.event_type)}</strong>
          <span>{[event.page, event.modality, event.status].filter(Boolean).join(" · ") || "사용자 이벤트"}</span>
          <time>{new Date(event.created_at).toLocaleString()}</time>
        </div>
      ))}
    </div>
  );
}

function eventLabel(eventType: string) {
  if (eventType === "page_view") return "페이지 방문";
  if (eventType === "analysis_started") return "분석 시작";
  if (eventType === "analysis_finished") return "분석 완료";
  if (eventType === "analysis_failed") return "분석 실패";
  if (eventType === "result_expanded") return "결과 확대";
  if (eventType === "input_changed") return "입력 변경";
  return eventType;
}

function reviewLabel(review: AnalysisReview | null) {
  if (!review) return "미검수";
  if (review.error_type === "correct") return "일치";
  if (review.error_type === "false_positive") return "오탐";
  if (review.error_type === "false_negative") return "미탐";
  if (review.error_type === "needs_review") return "보류";
  if (review.error_type === "model_unavailable") return "확인 필요";
  return review.error_type;
}

function reviewBadgeClass(review: AnalysisReview | null) {
  if (!review) return "review-unreviewed";
  if (review.error_type === "correct") return "review-correct";
  if (review.error_type === "false_positive" || review.error_type === "false_negative") return "review-error";
  return "review-pending";
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

function formatShortDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

function formatConfidence(confidence: number | null) {
  return confidence != null ? `${(confidence * 100).toFixed(1)}%` : "-";
}
