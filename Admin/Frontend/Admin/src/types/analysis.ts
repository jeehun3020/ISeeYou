export type Analysis = {
  id: string;
  file_name: string;
  status: string;
  result_label: string | null;
  confidence: number | null;
  model_type: string;
  model_name: string;
  created_at: string;
  review: AnalysisReview | null;
};

export type AnalysisListResponse = {
  items: Analysis[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type AnalysisDetail = Analysis & {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_key: string;
  result_json_key: string | null;
  source_url: string | null;
  source_kind: string;
  result_label: string | null;
  confidence: number | null;
  real_score: number | null;
  fake_score: number | null;
  explanation: string | null;
  inference_time_ms: number | null;
  error_message: string | null;
  finished_at: string | null;
  logs: AnalysisLog[];
};

export type AnalysisLog = {
  id: number;
  event_type: string;
  message: string | null;
  created_at: string;
};

export type UserEvent = {
  id: number;
  session_id: string;
  event_type: string;
  page: string | null;
  modality: string | null;
  model_name: string | null;
  status: string | null;
  detail: string | null;
  created_at: string;
};

export type AnalysisReview = {
  id: number;
  analysis_id: string;
  admin_id: string | null;
  reviewed_label: string | null;
  review_status: string;
  error_type: string;
  note: string | null;
  dataset_candidate: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminStats = {
  total_count: number;
  success_count: number;
  failed_count: number;
  processing_count: number;
  real_count: number;
  fake_count: number;
  event_count: number;
  model_type_counts: Array<{ label: string; count: number }>;
  event_type_counts: Array<{ label: string; count: number }>;
  analysis_trend: Array<{ date: string; total: number; success: number; failed: number }>;
  modality_failure_rates: Array<{ label: string; total: number; success: number; failed: number; failure_rate: number }>;
  event_funnel: Array<{ label: string; count: number }>;
  review_total: number;
  review_correct: number;
  review_error_count: number;
  review_accuracy: number;
  false_positive_count: number;
  false_negative_count: number;
  dataset_candidate_count: number;
  review_modality_accuracy: Array<{ label: string; reviewed: number; errors: number; accuracy: number }>;
  recent_events: UserEvent[];
};
