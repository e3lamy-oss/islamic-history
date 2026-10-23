-- قاعدة بيانات D1 للملاحظات فقط.
-- البيانات التاريخية لا تُخزَّن هنا: تُنشر ملفات ثابتة للقراءة فقط من المستودع،
-- فلا يوجد أي مسار عام يستعلم قاعدة بيانات عن المحتوى التاريخي.

CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  type        TEXT    NOT NULL CHECK (type IN ('historical', 'spelling', 'add_scholar', 'add_event', 'other')),
  item_key    TEXT,
  item_label  TEXT,
  details     TEXT    NOT NULL,
  source      TEXT,
  email       TEXT,
  ip_hash     TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'accepted', 'rejected')),
  reviewer    TEXT,
  review_note TEXT,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_ip ON feedback (ip_hash, created_at);

-- سجل تدقيق لكل إجراء إداري
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  feedback_id INTEGER,
  detail      TEXT
);

-- يبدأ معطّلاً حتى تُدخل بيانات الراعي الحقيقية وتفعّله من /admin/sponsor.html

CREATE TABLE IF NOT EXISTS sponsor (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  enabled    INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  badge      TEXT    NOT NULL DEFAULT 'برعاية رسمية',
  name       TEXT    NOT NULL DEFAULT '',
  tagline    TEXT    NOT NULL DEFAULT '',
  url        TEXT    NOT NULL DEFAULT '',
  cta        TEXT    NOT NULL DEFAULT 'اكتشف المزيد',
  logo       TEXT,
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT
);

INSERT OR IGNORE INTO sponsor (id, enabled, name, tagline, url)
VALUES (1, 0, 'اسم الجهة الراعية', 'بدعم من الجهة الراعية لنشر المحتوى المعرفي عن التاريخ الإسلامي', 'https://example.com');
