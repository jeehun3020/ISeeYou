import cgi
import http.client
import json
import math
import mimetypes
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from email.message import Message
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, unquote, urlparse
from urllib.request import Request, urlopen
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from storage_config import settings
from storage_db import SessionLocal, init_db
from storage_models import AdminUser, Analysis, AnalysisLog, AnalysisReview, UserEvent
from storage_security import create_access_token, decode_access_token, verify_password


JSON_HEADERS = {"Content-Type": "application/json; charset=utf-8"}
MEDIA_URL_SUFFIXES = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".webm",
}
MAX_URL_DOWNLOAD_BYTES = 300 * 1024 * 1024


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def safe_name(name: str, fallback: str = "input") -> str:
    candidate = Path(name or fallback).name.strip().replace("\x00", "")
    return candidate or fallback


def as_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def relative_key(path: Path) -> str:
    return path.resolve().relative_to(settings.storage_root).as_posix()


def storage_path(key: str) -> Path:
    return (settings.storage_root / key).resolve()


def ensure_inside_storage(path: Path) -> Path:
    resolved = path.resolve()
    resolved.relative_to(settings.storage_root)
    return resolved


def json_bytes(payload: Any) -> bytes:
    return json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")


def parse_json_body(body: bytes) -> dict[str, Any]:
    if not body:
        return {}
    return json.loads(body.decode("utf-8"))


def parse_content_type(value: str) -> tuple[str, dict[str, str]]:
    message = Message()
    message["content-type"] = value
    return message.get_content_type(), dict(message.get_params()[1:])


def create_analysis(
    db: Session,
    *,
    analysis_id: uuid.UUID,
    file_name: str,
    mime_type: str,
    file_size: int,
    storage_key: str,
    model_type: str,
    model_name: str,
    source_kind: str,
    source_url: str | None = None,
) -> Analysis:
    analysis = Analysis(
        id=analysis_id,
        file_name=file_name,
        mime_type=mime_type,
        file_size=file_size,
        storage_key=storage_key,
        model_type=model_type,
        model_name=model_name,
        source_kind=source_kind,
        source_url=source_url,
        status="processing",
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    add_log(db, analysis.id, "created", "Analysis record created.")
    add_log(db, analysis.id, "file_saved", f"Stored input: {storage_key}")
    return analysis


def add_log(db: Session, analysis_id: uuid.UUID, event_type: str, message: str | None = None) -> None:
    db.add(AnalysisLog(analysis_id=analysis_id, event_type=event_type, message=message))
    db.commit()


def extract_result(analysis_payload: dict[str, Any]) -> dict[str, Any]:
    analysis = analysis_payload.get("analysis") or {}
    fake_percent = float(analysis.get("fakePercent") or 0)
    real_percent = float(analysis.get("realPercent") or 0)
    confidence_percent = float(analysis.get("confidence") or max(fake_percent, real_percent))
    result_label = "FAKE" if fake_percent >= real_percent else "REAL"
    metrics = analysis.get("metrics") or []
    inference_time_ms = None

    for metric in metrics:
        label = str(metric.get("label") or "").lower()
        if "latency" not in label:
            continue
        digits = "".join(ch for ch in str(metric.get("value") or "") if ch.isdigit())
        if digits:
            inference_time_ms = int(digits)
            break

    return {
        "result_label": result_label,
        "confidence": round(confidence_percent / 100, 6),
        "real_score": real_percent,
        "fake_score": fake_percent,
        "explanation": analysis.get("summary"),
        "inference_time_ms": inference_time_ms,
    }


def mark_success(db: Session, analysis: Analysis, payload: dict[str, Any], result_json_key: str) -> None:
    result = extract_result(payload)
    analysis.status = "success"
    analysis.result_label = result["result_label"]
    analysis.confidence = result["confidence"]
    analysis.real_score = result["real_score"]
    analysis.fake_score = result["fake_score"]
    analysis.explanation = result["explanation"]
    analysis.inference_time_ms = result["inference_time_ms"]
    analysis.result_json_key = result_json_key
    analysis.finished_at = utcnow()
    db.add(analysis)
    db.commit()
    add_log(db, analysis.id, "processing_finished", "Inference completed successfully.")


def mark_failed(db: Session, analysis: Analysis, message: str, result_json_key: str | None = None) -> None:
    analysis.status = "failed"
    analysis.error_message = message
    analysis.result_json_key = result_json_key
    analysis.finished_at = utcnow()
    db.add(analysis)
    db.commit()
    add_log(db, analysis.id, "processing_failed", message)


def write_result_json(analysis_id: uuid.UUID, payload: dict[str, Any]) -> str:
    result_path = settings.storage_root / "analyses" / str(analysis_id) / "result.json"
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_bytes(json_bytes(payload))
    return relative_key(result_path)


def forward_to_inference(path: str, body: bytes, headers: dict[str, str]) -> tuple[int, bytes, str]:
    origin = urlparse(settings.inference_origin)
    conn_cls = http.client.HTTPSConnection if origin.scheme == "https" else http.client.HTTPConnection
    host = origin.hostname or "127.0.0.1"
    port = origin.port or (443 if origin.scheme == "https" else 80)
    target = f"{origin.path.rstrip('/')}{path}"
    conn = conn_cls(host, port, timeout=900)
    try:
        conn.request("POST", target, body=body, headers=headers)
        response = conn.getresponse()
        response_body = response.read()
        content_type = response.getheader("Content-Type", "application/json")
        return response.status, response_body, content_type
    finally:
        conn.close()


def infer_model_type(path: str, page: str | None, mode: str | None) -> str:
    if page in {"text", "image", "video", "multimodal"}:
        return page
    if path in {"/analyze-image", "/analyze-image-url"}:
        return "image"
    if path in {"/analyze-video", "/analyze-video-url"}:
        return "video"
    if path in {"/analyze", "/analyze-url"}:
        return "multimodal"
    if path == "/analyze-text":
        return "text"
    if mode in {"text", "image", "video", "multimodal"}:
        return mode
    return "multimodal"


def try_download_source_url(remote_url: str, target_dir: Path) -> tuple[str, str, int, str] | None:
    parsed = urlparse(remote_url)
    suffix = Path(parsed.path).suffix.lower()
    request = Request(remote_url, headers={"User-Agent": "ISeeYou-storage-gateway/1.0"})

    try:
        with urlopen(request, timeout=20) as response:
            content_type = response.headers.get_content_type() or "application/octet-stream"
            if not (content_type.startswith("image/") or content_type.startswith("video/") or suffix in MEDIA_URL_SUFFIXES):
                return None

            if not suffix:
                suffix = mimetypes.guess_extension(content_type) or ".bin"

            file_name = safe_name(Path(parsed.path).name or f"remote{suffix}", f"remote{suffix}")
            target_path = target_dir / file_name
            total = 0
            with target_path.open("wb") as stream:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_URL_DOWNLOAD_BYTES:
                        raise ValueError("remote media is too large to store")
                    stream.write(chunk)

            return file_name, content_type, total, relative_key(target_path)
    except Exception:
        return None


def serialize_log(log: AnalysisLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "event_type": log.event_type,
        "message": log.message,
        "created_at": as_iso(log.created_at),
    }


def serialize_user_event(event: UserEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "session_id": event.session_id,
        "event_type": event.event_type,
        "page": event.page,
        "modality": event.modality,
        "model_name": event.model_name,
        "status": event.status,
        "detail": event.detail,
        "created_at": as_iso(event.created_at),
    }


def serialize_review(review: AnalysisReview | None) -> dict[str, Any] | None:
    if review is None:
        return None
    return {
        "id": review.id,
        "analysis_id": str(review.analysis_id),
        "admin_id": str(review.admin_id) if review.admin_id else None,
        "reviewed_label": review.reviewed_label,
        "review_status": review.review_status,
        "error_type": review.error_type,
        "note": review.note,
        "dataset_candidate": review.dataset_candidate,
        "created_at": as_iso(review.created_at),
        "updated_at": as_iso(review.updated_at),
    }


def serialize_analysis_item(analysis: Analysis) -> dict[str, Any]:
    return {
        "id": str(analysis.id),
        "file_name": analysis.file_name,
        "status": analysis.status,
        "result_label": analysis.result_label,
        "confidence": analysis.confidence,
        "model_type": analysis.model_type,
        "model_name": analysis.model_name,
        "created_at": as_iso(analysis.created_at),
        "review": serialize_review(analysis.review),
    }


def serialize_analysis_detail(analysis: Analysis) -> dict[str, Any]:
    data = serialize_analysis_item(analysis)
    data.update(
        {
            "mime_type": analysis.mime_type,
            "file_size": analysis.file_size,
            "storage_key": analysis.storage_key,
            "result_json_key": analysis.result_json_key,
            "source_url": analysis.source_url,
            "source_kind": analysis.source_kind,
            "real_score": analysis.real_score,
            "fake_score": analysis.fake_score,
            "explanation": analysis.explanation,
            "inference_time_ms": analysis.inference_time_ms,
            "error_message": analysis.error_message,
            "finished_at": as_iso(analysis.finished_at),
            "logs": [serialize_log(log) for log in analysis.logs],
        }
    )
    return data


def compute_review_error_type(model_label: str | None, reviewed_label: str | None) -> tuple[str, str]:
    normalized_model = (model_label or "").upper()
    normalized_review = (reviewed_label or "").upper()
    if normalized_review not in {"REAL", "FAKE"}:
        return "pending", "needs_review"
    if normalized_model not in {"REAL", "FAKE"}:
        return "reviewed", "model_unavailable"
    if normalized_model == normalized_review:
        return "reviewed", "correct"
    if normalized_model == "FAKE" and normalized_review == "REAL":
        return "reviewed", "false_positive"
    if normalized_model == "REAL" and normalized_review == "FAKE":
        return "reviewed", "false_negative"
    return "reviewed", "mismatch"


class StorageGatewayHandler(BaseHTTPRequestHandler):
    server_version = "ISeeYouStorageGateway/1.0"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Expose-Headers", "Content-Disposition")
        super().end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self.send_json({"ok": True, "service": "storage-gateway"})
            return

        if path == "/api/admin/auth/me":
            admin = self.require_admin()
            if admin is None:
                return
            self.send_json({"id": str(admin.id), "username": admin.username, "is_active": admin.is_active})
            return

        if path == "/api/admin/stats":
            admin = self.require_admin()
            if admin is None:
                return
            self.handle_stats()
            return

        if path == "/api/admin/events":
            admin = self.require_admin()
            if admin is None:
                return
            self.handle_user_events(parsed.query)
            return

        if path == "/api/admin/analysis/options":
            admin = self.require_admin()
            if admin is None:
                return
            self.handle_filter_options()
            return

        if path == "/api/admin/analysis":
            admin = self.require_admin()
            if admin is None:
                return
            self.handle_analysis_list(parsed.query)
            return

        if path.startswith("/api/admin/analysis/"):
            admin = self.require_admin()
            if admin is None:
                return
            self.handle_analysis_detail_path(path)
            return

        self.send_json({"ok": False, "message": "Not Found"}, status=404)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/admin/auth/login":
            self.handle_login()
            return

        if path == "/api/events":
            self.handle_public_event()
            return

        if path.startswith("/api/admin/analysis/"):
            admin = self.require_admin()
            if admin is None:
                return
            self.handle_analysis_review(path, admin)
            return

        if path.startswith("/api/analyze"):
            self.handle_public_analysis(path.removeprefix("/api"))
            return

        self.send_json({"ok": False, "message": "Not Found"}, status=404)

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/admin/analysis/"):
            admin = self.require_admin()
            if admin is None:
                return
            self.handle_analysis_delete(path)
            return

        self.send_json({"ok": False, "message": "Not Found"}, status=404)

    def read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(length)

    def send_json(self, payload: Any, status: int = 200) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        for key, value in JSON_HEADERS.items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_bytes(self, body: bytes, content_type: str, file_name: str | None = None, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        if file_name:
            ascii_name = file_name.encode("ascii", "ignore").decode() or "download"
            self.send_header("Content-Disposition", f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(file_name)}')
        self.end_headers()
        self.wfile.write(body)

    def require_admin(self) -> AdminUser | None:
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            self.send_json({"detail": "Not authenticated"}, status=401)
            return None

        payload = decode_access_token(auth_header.removeprefix("Bearer ").strip())
        admin_id = payload.get("sub") if payload else None
        if not admin_id:
            self.send_json({"detail": "Invalid token"}, status=401)
            return None
        try:
            admin_uuid = uuid.UUID(str(admin_id))
        except ValueError:
            self.send_json({"detail": "Invalid token"}, status=401)
            return None

        db = SessionLocal()
        try:
            admin = db.query(AdminUser).filter(AdminUser.id == admin_uuid).first()
            if not admin or not admin.is_active:
                self.send_json({"detail": "Inactive admin account"}, status=401)
                return None
            db.expunge(admin)
            return admin
        finally:
            db.close()

    def handle_login(self) -> None:
        try:
            payload = parse_json_body(self.read_body())
            username = str(payload.get("username") or "").strip()
            password = str(payload.get("password") or "")
        except Exception:
            self.send_json({"detail": "Invalid JSON"}, status=400)
            return

        db = SessionLocal()
        try:
            admin = db.query(AdminUser).filter(AdminUser.username == username).first()
            if not admin or not verify_password(password, admin.password_hash) or not admin.is_active:
                self.send_json({"detail": "Invalid username or password"}, status=401)
                return
            admin.last_login_at = utcnow()
            db.add(admin)
            db.commit()
            self.send_json({"access_token": create_access_token(str(admin.id)), "token_type": "bearer"})
        finally:
            db.close()

    def handle_public_event(self) -> None:
        try:
            payload = parse_json_body(self.read_body())
            session_id = safe_name(str(payload.get("sessionId") or payload.get("session_id") or "anonymous"), "anonymous")[:100]
            event_type = safe_name(str(payload.get("eventType") or payload.get("event_type") or "unknown"), "unknown")[:80]
            page = str(payload.get("page") or "").strip()[:80] or None
            modality = str(payload.get("modality") or "").strip()[:50] or None
            model_name = str(payload.get("modelName") or payload.get("model_name") or "").strip()[:100] or None
            status = str(payload.get("status") or "").strip()[:50] or None
            detail_payload = payload.get("detail")
            detail = None
            if detail_payload is not None:
                detail = json.dumps(detail_payload, ensure_ascii=False, default=str)[:2000]
        except Exception:
            self.send_json({"ok": False, "message": "Invalid event payload"}, status=400)
            return

        db = SessionLocal()
        try:
            event = UserEvent(
                session_id=session_id,
                event_type=event_type,
                page=page,
                modality=modality,
                model_name=model_name,
                status=status,
                detail=detail,
            )
            db.add(event)
            db.commit()
            self.send_json({"ok": True, "event_id": event.id})
        finally:
            db.close()

    def handle_public_analysis(self, inference_path: str) -> None:
        body = self.read_body()
        content_type = self.headers.get("Content-Type", "")
        forward_headers = {"Content-Type": content_type, "Content-Length": str(len(body))}
        db = SessionLocal()
        analysis: Analysis | None = None

        try:
            analysis = self.create_record_from_request(db, inference_path, body, content_type)
            add_log(db, analysis.id, "processing_started", "Inference request started.")

            status, response_body, response_type = forward_to_inference(inference_path, body, forward_headers)
            try:
                response_payload = parse_json_body(response_body)
            except Exception:
                response_payload = {"ok": False, "message": response_body.decode("utf-8", errors="replace")}

            result_json_key = write_result_json(analysis.id, response_payload)

            if status >= 400 or not response_payload.get("ok"):
                message = str(response_payload.get("message") or response_payload.get("error") or f"inference failed: {status}")
                mark_failed(db, analysis, message, result_json_key)
                self.send_bytes(response_body, response_type, status=status)
                return

            mark_success(db, analysis, response_payload, result_json_key)
            self.send_bytes(response_body, response_type, status=status)
        except Exception as error:  # noqa: BLE001
            if analysis is not None:
                try:
                    result_json_key = write_result_json(analysis.id, {"ok": False, "message": str(error)})
                    mark_failed(db, analysis, str(error), result_json_key)
                except Exception:
                    pass
            self.send_json({"ok": False, "message": str(error)}, status=500)
        finally:
            db.close()

    def create_record_from_request(self, db: Session, inference_path: str, body: bytes, content_type: str) -> Analysis:
        analysis_id = uuid.uuid4()
        analysis_dir = settings.storage_root / "analyses" / str(analysis_id)
        analysis_dir.mkdir(parents=True, exist_ok=True)

        media_type, _ = parse_content_type(content_type)
        if media_type == "multipart/form-data":
            form = cgi.FieldStorage(
                fp=BytesIO(body),
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": content_type,
                    "CONTENT_LENGTH": str(len(body)),
                },
            )
            file_item = form["file"] if "file" in form else None
            if file_item is None or not getattr(file_item, "filename", ""):
                raise ValueError("file is required")
            file_bytes = file_item.file.read()
            file_name = safe_name(file_item.filename, "upload.bin")
            mime_type = file_item.type or mimetypes.guess_type(file_name)[0] or "application/octet-stream"
            target_path = analysis_dir / file_name
            target_path.write_bytes(file_bytes)

            page = str(form.getvalue("page") or "")
            mode = str(form.getvalue("mode") or "")
            selected_mode = str(form.getvalue("selectedMode") or "unknown")
            model_type = infer_model_type(inference_path, page, mode)
            return create_analysis(
                db,
                analysis_id=analysis_id,
                file_name=file_name,
                mime_type=mime_type,
                file_size=len(file_bytes),
                storage_key=relative_key(target_path),
                model_type=model_type,
                model_name=selected_mode,
                source_kind="file",
            )

        payload = parse_json_body(body)
        selected_mode = str(payload.get("selectedMode") or "unknown")
        page = str(payload.get("page") or "")
        mode = str(payload.get("mode") or "")
        model_type = infer_model_type(inference_path, page, mode)

        if inference_path == "/analyze-text":
            text = str(payload.get("text") or "")
            file_name = safe_name(str(payload.get("fileName") or "input.txt"), "input.txt")
            if Path(file_name).suffix.lower() != ".txt":
                file_name = f"{Path(file_name).stem or 'input'}.txt"
            target_path = analysis_dir / file_name
            text_bytes = text.encode("utf-8")
            target_path.write_bytes(text_bytes)
            return create_analysis(
                db,
                analysis_id=analysis_id,
                file_name=file_name,
                mime_type="text/plain; charset=utf-8",
                file_size=len(text_bytes),
                storage_key=relative_key(target_path),
                model_type="text",
                model_name=selected_mode,
                source_kind="text",
            )

        remote_url = str(payload.get("url") or "").strip()
        downloaded = try_download_source_url(remote_url, analysis_dir) if remote_url else None
        if downloaded:
            file_name, mime_type, file_size, storage_key = downloaded
            source_kind = "url_file"
        else:
            file_name = "source_url.json"
            mime_type = "application/json"
            source_payload = {"url": remote_url, "downloaded": False}
            source_bytes = json_bytes(source_payload)
            target_path = analysis_dir / file_name
            target_path.write_bytes(source_bytes)
            file_size = len(source_bytes)
            storage_key = relative_key(target_path)
            source_kind = "url_only"

        return create_analysis(
            db,
            analysis_id=analysis_id,
            file_name=file_name,
            mime_type=mime_type,
            file_size=file_size,
            storage_key=storage_key,
            model_type=model_type,
            model_name=selected_mode,
            source_kind=source_kind,
            source_url=remote_url or None,
        )

    def handle_analysis_list(self, raw_query: str) -> None:
        query = parse_qs(raw_query)
        page = max(1, int(query.get("page", ["1"])[0]))
        limit = min(100, max(1, int(query.get("limit", ["10"])[0])))
        sort_order = query.get("sort_order", ["desc"])[0]

        db = SessionLocal()
        try:
            db_query = db.query(Analysis).options(joinedload(Analysis.review))
            for query_name, column in [
                ("status", Analysis.status),
                ("result_label", Analysis.result_label),
                ("model_type", Analysis.model_type),
                ("model_name", Analysis.model_name),
            ]:
                value = query.get(query_name, [None])[0]
                if value:
                    db_query = db_query.filter(column == value)

            total = db_query.count()
            order_column = Analysis.created_at.asc() if sort_order == "asc" else Analysis.created_at.desc()
            items = db_query.order_by(order_column).offset((page - 1) * limit).limit(limit).all()
            self.send_json(
                {
                    "items": [serialize_analysis_item(item) for item in items],
                    "total": total,
                    "page": page,
                    "limit": limit,
                    "total_pages": max(1, math.ceil(total / limit)),
                }
            )
        finally:
            db.close()

    def handle_analysis_detail_path(self, path: str) -> None:
        parts = [unquote(part) for part in path.split("/") if part]
        if len(parts) < 4:
            self.send_json({"detail": "Not Found"}, status=404)
            return
        analysis_id = parts[3]
        action = parts[4] if len(parts) > 4 else "detail"

        db = SessionLocal()
        try:
            analysis = (
                db.query(Analysis)
                .options(joinedload(Analysis.logs))
                .filter(Analysis.id == analysis_id)
                .first()
            )
            if not analysis:
                self.send_json({"detail": "Analysis not found"}, status=404)
                return

            if action == "detail":
                self.send_json(serialize_analysis_detail(analysis))
                return

            if action in {"preview", "download"}:
                file_path = ensure_inside_storage(storage_path(analysis.storage_key))
                if not file_path.exists():
                    self.send_json({"detail": "File not found"}, status=404)
                    return
                content_type = analysis.mime_type.split(";")[0] or "application/octet-stream"
                file_name = analysis.file_name if action == "download" else None
                self.send_bytes(file_path.read_bytes(), content_type, file_name=file_name)
                return

            self.send_json({"detail": "Not Found"}, status=404)
        finally:
            db.close()

    def handle_analysis_review(self, path: str, admin: AdminUser) -> None:
        parts = [unquote(part) for part in path.split("/") if part]
        if len(parts) != 5 or parts[4] != "review":
            self.send_json({"detail": "Not Found"}, status=404)
            return
        try:
            analysis_id = uuid.UUID(parts[3])
            payload = parse_json_body(self.read_body())
        except ValueError:
            self.send_json({"detail": "Invalid analysis id"}, status=400)
            return
        except Exception:
            self.send_json({"detail": "Invalid JSON"}, status=400)
            return

        reviewed_label_raw = str(payload.get("reviewed_label") or payload.get("reviewedLabel") or "").strip().upper()
        reviewed_label = reviewed_label_raw if reviewed_label_raw in {"REAL", "FAKE"} else None
        note = str(payload.get("note") or "").strip()[:4000] or None
        dataset_candidate = bool(payload.get("dataset_candidate") or payload.get("datasetCandidate") or False)

        db = SessionLocal()
        try:
            analysis = (
                db.query(Analysis)
                .options(joinedload(Analysis.review))
                .filter(Analysis.id == analysis_id)
                .first()
            )
            if not analysis:
                self.send_json({"detail": "Analysis not found"}, status=404)
                return

            review_status, error_type = compute_review_error_type(analysis.result_label, reviewed_label)
            review = analysis.review or AnalysisReview(analysis_id=analysis.id)
            review.admin_id = admin.id
            review.reviewed_label = reviewed_label
            review.review_status = review_status
            review.error_type = error_type
            review.note = note
            review.dataset_candidate = dataset_candidate
            review.updated_at = utcnow()
            db.add(review)
            db.commit()
            db.refresh(review)
            add_log(db, analysis.id, "admin_review_saved", f"Admin review saved: {error_type}.")
            self.send_json({"ok": True, "review": serialize_review(review)})
        finally:
            db.close()

    def handle_analysis_delete(self, path: str) -> None:
        parts = [unquote(part) for part in path.split("/") if part]
        if len(parts) != 4:
            self.send_json({"detail": "Not Found"}, status=404)
            return
        try:
            analysis_id = uuid.UUID(parts[3])
        except ValueError:
            self.send_json({"detail": "Invalid analysis id"}, status=400)
            return

        db = SessionLocal()
        try:
            analysis = (
                db.query(Analysis)
                .options(joinedload(Analysis.logs), joinedload(Analysis.review))
                .filter(Analysis.id == analysis_id)
                .first()
            )
            if not analysis:
                self.send_json({"detail": "Analysis not found"}, status=404)
                return

            analysis_dir = ensure_inside_storage(settings.storage_root / "analyses" / str(analysis.id))
            deleted_id = str(analysis.id)
            db.delete(analysis)
            db.commit()
            if analysis_dir.exists():
                shutil.rmtree(analysis_dir, ignore_errors=True)
            self.send_json({"ok": True, "deleted_id": deleted_id})
        finally:
            db.close()

    def handle_stats(self) -> None:
        db = SessionLocal()
        try:
            def count(*filters: Any) -> int:
                query = db.query(Analysis)
                for item in filters:
                    query = query.filter(item)
                return query.count()

            model_rows = (
                db.query(Analysis.model_type, func.count(Analysis.id))
                .group_by(Analysis.model_type)
                .order_by(func.count(Analysis.id).desc())
                .all()
            )
            event_rows = (
                db.query(UserEvent.event_type, func.count(UserEvent.id))
                .group_by(UserEvent.event_type)
                .order_by(func.count(UserEvent.id).desc())
                .limit(8)
                .all()
            )
            recent_events = db.query(UserEvent).order_by(UserEvent.created_at.desc(), UserEvent.id.desc()).limit(8).all()
            now = utcnow()
            day_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc) - timedelta(days=6)
            trend_seed = {
                (day_start + timedelta(days=offset)).date().isoformat(): {
                    "date": (day_start + timedelta(days=offset)).date().isoformat(),
                    "total": 0,
                    "success": 0,
                    "failed": 0,
                }
                for offset in range(7)
            }
            recent_analyses = (
                db.query(Analysis.created_at, Analysis.status)
                .filter(Analysis.created_at >= day_start)
                .all()
            )
            for created_at, status in recent_analyses:
                created = as_aware_utc(created_at)
                if created is None:
                    continue
                key = created.date().isoformat()
                if key not in trend_seed:
                    continue
                trend_seed[key]["total"] += 1
                if status == "success":
                    trend_seed[key]["success"] += 1
                elif status == "failed":
                    trend_seed[key]["failed"] += 1

            modality_rows = (
                db.query(Analysis.model_type, Analysis.status, func.count(Analysis.id))
                .group_by(Analysis.model_type, Analysis.status)
                .all()
            )
            modality_map: dict[str, dict[str, Any]] = {}
            for model_type, status, row_count in modality_rows:
                key = model_type or "unknown"
                item = modality_map.setdefault(key, {"label": key, "total": 0, "failed": 0, "success": 0, "failure_rate": 0.0})
                item["total"] += row_count
                if status == "failed":
                    item["failed"] += row_count
                elif status == "success":
                    item["success"] += row_count
            for item in modality_map.values():
                item["failure_rate"] = round((item["failed"] / item["total"]) * 100, 1) if item["total"] else 0.0

            funnel_order = ["page_view", "analysis_started", "analysis_finished", "result_expanded"]
            funnel_rows = (
                db.query(UserEvent.event_type, func.count(UserEvent.id))
                .filter(UserEvent.event_type.in_(funnel_order))
                .group_by(UserEvent.event_type)
                .all()
            )
            event_count_map = {row[0] or "unknown": row[1] for row in funnel_rows}
            funnel_steps = [
                {
                    "label": event_type,
                    "count": int(event_count_map.get(event_type, 0)),
                }
                for event_type in funnel_order
            ]
            review_total = db.query(AnalysisReview).filter(AnalysisReview.review_status == "reviewed").count()
            review_correct = db.query(AnalysisReview).filter(AnalysisReview.error_type == "correct").count()
            false_positive_count = db.query(AnalysisReview).filter(AnalysisReview.error_type == "false_positive").count()
            false_negative_count = db.query(AnalysisReview).filter(AnalysisReview.error_type == "false_negative").count()
            review_error_count = false_positive_count + false_negative_count
            review_accuracy = round((review_correct / review_total) * 100, 1) if review_total else 0.0
            dataset_candidate_count = db.query(AnalysisReview).filter(AnalysisReview.dataset_candidate.is_(True)).count()

            review_modality_rows = (
                db.query(Analysis.model_type, AnalysisReview.error_type, func.count(AnalysisReview.id))
                .join(AnalysisReview, AnalysisReview.analysis_id == Analysis.id)
                .filter(AnalysisReview.review_status == "reviewed")
                .group_by(Analysis.model_type, AnalysisReview.error_type)
                .all()
            )
            review_modality_map: dict[str, dict[str, Any]] = {}
            for model_type, error_type, row_count in review_modality_rows:
                key = model_type or "unknown"
                item = review_modality_map.setdefault(key, {"label": key, "reviewed": 0, "errors": 0, "accuracy": 0.0})
                item["reviewed"] += row_count
                if error_type not in {"correct"}:
                    item["errors"] += row_count
            for item in review_modality_map.values():
                item["accuracy"] = round(((item["reviewed"] - item["errors"]) / item["reviewed"]) * 100, 1) if item["reviewed"] else 0.0

            self.send_json(
                {
                    "total_count": count(),
                    "success_count": count(Analysis.status == "success"),
                    "failed_count": count(Analysis.status == "failed"),
                    "processing_count": count(Analysis.status == "processing"),
                    "real_count": count(Analysis.result_label == "REAL"),
                    "fake_count": count(Analysis.result_label == "FAKE"),
                    "event_count": db.query(UserEvent).count(),
                    "model_type_counts": [{"label": row[0] or "unknown", "count": row[1]} for row in model_rows],
                    "event_type_counts": [{"label": row[0] or "unknown", "count": row[1]} for row in event_rows],
                    "analysis_trend": list(trend_seed.values()),
                    "modality_failure_rates": sorted(modality_map.values(), key=lambda item: item["failure_rate"], reverse=True),
                    "event_funnel": funnel_steps,
                    "review_total": review_total,
                    "review_correct": review_correct,
                    "review_error_count": review_error_count,
                    "review_accuracy": review_accuracy,
                    "false_positive_count": false_positive_count,
                    "false_negative_count": false_negative_count,
                    "dataset_candidate_count": dataset_candidate_count,
                    "review_modality_accuracy": sorted(review_modality_map.values(), key=lambda item: item["accuracy"]),
                    "recent_events": [serialize_user_event(event) for event in recent_events],
                }
            )
        finally:
            db.close()

    def handle_user_events(self, raw_query: str) -> None:
        query = parse_qs(raw_query)
        page = max(1, int(query.get("page", ["1"])[0]))
        limit = min(100, max(1, int(query.get("limit", ["20"])[0])))
        db = SessionLocal()
        try:
            db_query = db.query(UserEvent)
            for query_name, column in [
                ("event_type", UserEvent.event_type),
                ("page", UserEvent.page),
                ("modality", UserEvent.modality),
                ("status", UserEvent.status),
            ]:
                value = query.get(query_name, [None])[0]
                if value:
                    db_query = db_query.filter(column == value)
            total = db_query.count()
            items = (
                db_query
                .order_by(UserEvent.created_at.desc(), UserEvent.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            self.send_json(
                {
                    "items": [serialize_user_event(event) for event in items],
                    "total": total,
                    "page": page,
                    "limit": limit,
                    "total_pages": max(1, math.ceil(total / limit)),
                }
            )
        finally:
            db.close()

    def handle_filter_options(self) -> None:
        db = SessionLocal()
        try:
            model_types = [row[0] for row in db.query(Analysis.model_type).distinct().order_by(Analysis.model_type).all()]
            model_names = [row[0] for row in db.query(Analysis.model_name).distinct().order_by(Analysis.model_name).all()]
            self.send_json(
                {
                    "statuses": ["processing", "success", "failed"],
                    "results": ["REAL", "FAKE"],
                    "model_types": model_types or ["text", "image", "video", "multimodal"],
                    "model_names": model_names,
                }
            )
        finally:
            db.close()


def main() -> None:
    settings.storage_root.mkdir(parents=True, exist_ok=True)
    init_db()
    server = ThreadingHTTPServer((settings.gateway_host, settings.gateway_port), StorageGatewayHandler)
    print(f"[storage-gateway] listening on http://{settings.gateway_host}:{settings.gateway_port}", flush=True)
    print(f"[storage-gateway] forwarding inference to {settings.inference_origin}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
