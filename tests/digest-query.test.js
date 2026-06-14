'use strict';

// 다이제스트 SQL(날짜범위·PENDING 필터)이 실제 sqlite에서 의도대로 동작하는지 검증.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3').verbose();
const { buildWeeklyDigest } = require('../routes/weekly-digest');

const DIGEST_SQL = `SELECT * FROM chat_proposals
   WHERE status = 'PENDING'
     AND date(substr(message_date, 1, 10)) BETWEEN date(?) AND date(?)
   ORDER BY message_date ASC, id ASC`;

test('날짜범위(월~일)+PENDING 필터가 정확히 동작', async () => {
  const db = new sqlite3.Database(':memory:');
  await new Promise((res) => db.serialize(() => {
    db.run(`CREATE TABLE chat_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_date TEXT, raw_text TEXT, event_type TEXT,
      extracted_json TEXT, status TEXT DEFAULT 'PENDING'
    )`);
    const ins = db.prepare(`INSERT INTO chat_proposals (message_date, raw_text, event_type, extracted_json, status) VALUES (?,?,?,?,?)`);
    ins.run('2026-06-09', 'r1', 'REPAIR', JSON.stringify({ product_name: 'ZENIUS' }), 'PENDING');
    ins.run('2026-06-14 21:30', 'n1', 'NOTE', JSON.stringify({ note_text: '데모 분실' }), 'PENDING');
    ins.run('2026-06-07', 'before', 'NOTE', JSON.stringify({ note_text: '범위 전' }), 'PENDING');
    ins.run('2026-06-15', 'after', 'NOTE', JSON.stringify({ note_text: '범위 후' }), 'PENDING');
    ins.run('2026-06-10', 'applied', 'NOTE', JSON.stringify({ note_text: '이미반영' }), 'APPLIED');
    ins.finalize(res);
  }));

  const rows = await new Promise((res, rej) =>
    db.all(DIGEST_SQL, ['2026-06-08', '2026-06-14'], (e, r) => e ? rej(e) : res(r)));

  assert.equal(rows.length, 2, '범위 내 PENDING 2건만');
  const draft = buildWeeklyDigest(rows);
  assert.match(draft, /ZENIUS/);
  assert.match(draft, /데모 분실/);
  assert.doesNotMatch(draft, /범위 전/);
  assert.doesNotMatch(draft, /범위 후/);
  assert.doesNotMatch(draft, /이미반영/);
  db.close();
});
