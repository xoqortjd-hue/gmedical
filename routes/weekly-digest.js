'use strict';

// 단톡방 검토대기 제안(chat_proposals)을 주간 리포트 특이사항 "초안" 텍스트로 변환.
// 순수 함수(부수효과 없음) — 사용자가 초안을 검토/수정한 뒤 저장(승인)한다.
// 설계: docs/superpowers/specs/2026-06-04-kakao-to-aws-inbox-design.md

function parseExtracted(p) {
  if (p && typeof p.extracted_json === 'string') {
    try { return JSON.parse(p.extracted_json) || {}; } catch (e) { return {}; }
  }
  if (p && p.extracted && typeof p.extracted === 'object') return p.extracted;
  return {};
}

// 여러 줄/공백을 한 줄로 정리하고 너무 길면 자른다.
function oneLine(s, max = 140) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// 'YYYY-MM-DD...' → 'MM/DD'
function mmdd(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}` : '';
}

function repairBody(p, ex) {
  const name = ex.product_name || '';
  if (!name) return oneLine(p.raw_text);
  const issue = ex.issue_description || ex.note_text || '';
  const company = ex.repair_company || '';
  return name + (issue ? ` - ${issue}` : '') + (company ? ` (${company})` : '');
}

function moveBody(p, ex) {
  const name = ex.product_name || '';
  if (!name) return oneLine(p.raw_text);
  const note = ex.notes || ex.note_text || '';
  return name + (note ? ` - ${note}` : '');
}

function noteBody(p, ex) {
  return ex.note_text || ex.issue_description || p.raw_text || '';
}

const BUILDERS = { REPAIR: repairBody, MOVE: moveBody, NOTE: noteBody };
const SECTIONS = [
  ['REPAIR', '■ 수리 / 입고'],
  ['MOVE', '■ 장비 입출고'],
  ['NOTE', '■ 기타 특이사항'],
];

function buildWeeklyDigest(proposals) {
  if (!Array.isArray(proposals) || proposals.length === 0) return '';
  const groups = { REPAIR: [], MOVE: [], NOTE: [] };
  for (const p of proposals) {
    const builder = BUILDERS[p.event_type];
    if (!builder) continue; // 알 수 없는 타입 무시
    const ex = parseExtracted(p);
    const body = oneLine(builder(p, ex));
    if (!body) continue;
    const date = mmdd(p.message_date);
    groups[p.event_type].push(date ? `• [${date}] ${body}` : `• ${body}`);
  }
  return SECTIONS
    .filter(([key]) => groups[key].length > 0)
    .map(([key, title]) => `${title}\n${groups[key].join('\n')}`)
    .join('\n\n');
}

module.exports = { buildWeeklyDigest, mmdd, oneLine };
