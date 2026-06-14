'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildWeeklyDigest, mmdd } = require('../routes/weekly-digest');

// 제안 row 헬퍼 (DB chat_proposals 행 형태를 흉내)
const row = (o) => ({
  event_type: 'NOTE',
  message_date: '2026-06-10',
  raw_text: '원문 대화',
  extracted_json: '{}',
  ...o,
});

test('빈 배열이면 빈 문자열', () => {
  assert.equal(buildWeeklyDigest([]), '');
  assert.equal(buildWeeklyDigest(null), '');
});

test('mmdd: YYYY-MM-DD / 시간포함 모두 MM/DD', () => {
  assert.equal(mmdd('2026-06-10'), '06/10');
  assert.equal(mmdd('2026-06-10 13:22'), '06/10');
  assert.equal(mmdd(''), '');
});

test('REPAIR 제안 → 수리/입고 섹션 + 품목명/사유/업체/날짜 포함', () => {
  const d = buildWeeklyDigest([
    row({
      event_type: 'REPAIR',
      message_date: '2026-06-09',
      extracted_json: JSON.stringify({
        product_name: 'ZENIUS MIS',
        issue_description: '모터 소음',
        repair_company: '메디쎄이',
      }),
    }),
  ]);
  assert.match(d, /■ 수리 \/ 입고/);
  assert.match(d, /ZENIUS MIS/);
  assert.match(d, /모터 소음/);
  assert.match(d, /메디쎄이/);
  assert.match(d, /06\/09/);
});

test('MOVE 제안 → 장비 입출고 섹션', () => {
  const d = buildWeeklyDigest([
    row({ event_type: 'MOVE', extracted_json: JSON.stringify({ product_name: 'ILIAD SCREW', notes: '관문병원 입고' }) }),
  ]);
  assert.match(d, /■ 장비 입출고/);
  assert.match(d, /ILIAD SCREW/);
  assert.match(d, /관문병원 입고/);
});

test('NOTE 제안 → 기타 특이사항 섹션 (note_text 우선)', () => {
  const d = buildWeeklyDigest([
    row({ event_type: 'NOTE', extracted_json: JSON.stringify({ note_text: '데모장비 분실 보고' }) }),
  ]);
  assert.match(d, /■ 기타 특이사항/);
  assert.match(d, /데모장비 분실 보고/);
});

test('섹션 순서는 수리→입출고→기타, 입력 순서 무관', () => {
  const d = buildWeeklyDigest([
    row({ event_type: 'NOTE', extracted_json: JSON.stringify({ note_text: 'N1' }) }),
    row({ event_type: 'MOVE', extracted_json: JSON.stringify({ product_name: 'M1' }) }),
    row({ event_type: 'REPAIR', extracted_json: JSON.stringify({ product_name: 'R1' }) }),
  ]);
  const iRepair = d.indexOf('수리 / 입고');
  const iMove = d.indexOf('장비 입출고');
  const iNote = d.indexOf('기타 특이사항');
  assert.ok(iRepair >= 0 && iMove >= 0 && iNote >= 0);
  assert.ok(iRepair < iMove && iMove < iNote);
});

test('extracted_json 파싱 실패 시 raw_text로 폴백', () => {
  const d = buildWeeklyDigest([
    row({ event_type: 'NOTE', raw_text: '폴백 원문입니다', extracted_json: '{깨진 JSON' }),
  ]);
  assert.match(d, /폴백 원문입니다/);
});

test('알 수 없는 event_type 은 무시', () => {
  const d = buildWeeklyDigest([
    row({ event_type: 'WEIRD', raw_text: '무시되어야 함' }),
    row({ event_type: 'NOTE', extracted_json: JSON.stringify({ note_text: '유효' }) }),
  ]);
  assert.doesNotMatch(d, /무시되어야 함/);
  assert.match(d, /유효/);
});

test('여러 줄 raw_text 는 한 줄로 정리', () => {
  const d = buildWeeklyDigest([
    row({ event_type: 'NOTE', raw_text: '첫줄\n둘째줄\n\n셋째줄', extracted_json: '{}' }),
  ]);
  assert.doesNotMatch(d.split('기타 특이사항')[1], /\n.*\n.*\n/);
  assert.match(d, /첫줄 둘째줄 셋째줄/);
});
