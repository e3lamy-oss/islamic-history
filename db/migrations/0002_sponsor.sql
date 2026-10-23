-- بنر الرعاية السنوية: صف واحد فقط (id = 1) يُعدَّل من لوحة الإدارة.
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
