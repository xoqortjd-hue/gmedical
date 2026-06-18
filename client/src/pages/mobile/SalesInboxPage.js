import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SalesBottomNav from '../../components/SalesBottomNav';
import { API_BASE_URL } from '../../config';
import '../../styles/mobile.css';

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

// 단톡방 대화 자동분석 → 검토 대기함
// 설계: docs/superpowers/specs/2026-06-04-kakao-to-aws-inbox-design.md
const TYPE_LABEL = { REPAIR: '🔧 수리', MOVE: '📦 입출고', NOTE: '📝 특이사항' };
const TYPE_COLOR = { REPAIR: '#ef4444', MOVE: '#3b82f6', NOTE: '#8b5cf6' };

const fmtDate = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
// 추출(메시지) 날짜가 속한 주(월~일) 범위 — 리포트가 월~일 키로 특이사항을 조회하므로 그에 맞춤
function weekOf(dateStr) {
    const base = dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr) ? new Date(dateStr.slice(0, 10) + 'T00:00:00') : new Date();
    const dow = base.getDay(); // 0=일 .. 6=토
    const mon = new Date(base); mon.setDate(base.getDate() + (dow === 0 ? -6 : 1 - dow));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: fmtDate(mon), end: fmtDate(sun) };
}

function SalesInboxPage() {
    const [proposals, setProposals] = useState([]);
    const [items, setItems] = useState([]);       // lending_items (MOVE 장비 선택용)
    const [hospitals, setHospitals] = useState([]); // 병원 선택용
    const [edits, setEdits] = useState({});         // { [id]: { ...editable fields } }
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [selected, setSelected] = useState({});   // { [id]: true } — 포함(반영)할 항목 체크
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkMsg, setBulkMsg] = useState('');

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [propRes, itemRes, hospRes] = await Promise.all([
                axios.get('/api/inbox/proposals?status=PENDING'),
                axios.get('/api/lending/items').catch(() => ({ data: [] })),
                axios.get('/api/hospitals').catch(() => ({ data: [] })),
            ]);
            const props = propRes.data || [];
            setProposals(props);
            setItems(itemRes.data || []);
            setHospitals(hospRes.data || []);
            setSelected({});

            // 추출결과로 편집필드 프리필
            const initial = {};
            props.forEach(p => {
                let ex = {};
                try { ex = JSON.parse(p.extracted_json || '{}'); } catch (e) { ex = {}; }
                initial[p.id] = {
                    event_type: p.event_type,
                    // REPAIR
                    product_name: ex.product_name || '',
                    repair_company: ex.repair_company || '',
                    issue_description: ex.issue_description || '',
                    requested_by: ex.requested_by || '',
                    // NOTE — 기본 기간 = 추출(메시지) 날짜가 속한 주(월~일). 추출값(ex.period_*)이 있으면 우선.
                    period_start: ex.period_start || weekOf(p.message_date).start,
                    period_end: ex.period_end || weekOf(p.message_date).end,
                    note_text: ex.note_text || ex.issue_description || '',
                    // MOVE
                    lending_item_id: p.mapped_product_id || '',
                    to_hospital_id: p.mapped_hospital_id || '',
                    moved_by: ex.requested_by || '',
                    notes: ex.notes || '',
                };
            });
            setEdits(initial);
        } catch (error) {
            console.error('검토 대기함 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const setField = (id, key, value) => {
        setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    };

    // 승인 body 생성 — 필수값 누락 시 {skip} 반환(알림 없음, 일괄처리에서 재사용)
    const buildApplyBody = (p) => {
        const e = edits[p.id] || {};
        const type = e.event_type || p.event_type;
        let body = { event_type: type };
        if (type === 'REPAIR') {
            if (!e.product_name || !e.product_name.trim()) return { skip: '장비명 미입력' };
            body = { ...body, product_name: e.product_name, repair_company: e.repair_company, issue_description: e.issue_description, requested_by: e.requested_by };
        } else if (type === 'NOTE') {
            if (!e.note_text || !e.note_text.trim()) return { skip: '특이사항 내용 미입력' };
            body = { ...body, period_start: e.period_start, period_end: e.period_end, note_text: e.note_text };
        } else if (type === 'MOVE') {
            if (!e.lending_item_id || !e.to_hospital_id) return { skip: '입출고 장비·병원 미선택' };
            body = { ...body, lending_item_id: Number(e.lending_item_id), to_hospital_id: Number(e.to_hospital_id), moved_by: e.moved_by, notes: e.notes };
        }
        return { body };
    };

    // 1건 승인(반영) — 알림 없이 결과 반환: {status:'applied'|'skipped'|'error', reason}
    const applyOne = async (p) => {
        const built = buildApplyBody(p);
        if (built.skip) return { status: 'skipped', reason: built.skip };
        try {
            await axios.patch(`/api/inbox/proposals/${p.id}/apply`, built.body);
            return { status: 'applied' };
        } catch (error) {
            return { status: 'error', reason: error.response?.data?.error || error.message };
        }
    };

    // 1건 거부 — 알림 없이 성공여부 반환
    const rejectOne = async (p) => {
        try {
            await axios.patch(`/api/inbox/proposals/${p.id}/reject`);
            return true;
        } catch (error) {
            return false;
        }
    };

    // 개별 승인 버튼
    const approve = async (p) => {
        const built = buildApplyBody(p);
        if (built.skip) {
            const t = (edits[p.id] || {}).event_type || p.event_type;
            alert(t === 'MOVE' ? '장비와 병원을 모두 선택해야 승인할 수 있습니다.' : built.skip + ' — 내용을 입력하세요.');
            return;
        }
        setBusyId(p.id);
        const r = await applyOne(p);
        setBusyId(null);
        if (r.status === 'applied') setProposals(prev => prev.filter(x => x.id !== p.id));
        else if (r.status === 'error') alert('반영 실패: ' + r.reason);
    };

    // 개별 거부 버튼
    const reject = async (p) => {
        if (!window.confirm('이 제안을 거부할까요?')) return;
        setBusyId(p.id);
        const ok = await rejectOne(p);
        setBusyId(null);
        if (ok) setProposals(prev => prev.filter(x => x.id !== p.id));
        else alert('거부 실패');
    };

    const toggleSelect = (id) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));
    const checkedCount = proposals.filter(p => selected[p.id]).length;
    const allChecked = proposals.length > 0 && proposals.every(p => selected[p.id]);
    const toggleSelectAll = () => {
        if (allChecked) setSelected({});
        else { const all = {}; proposals.forEach(p => { all[p.id] = true; }); setSelected(all); }
    };

    // ⭐ 일괄 적용: 체크한 것만 반영(승인), 나머지(미체크)는 자동 거부.
    //   체크된 입출고(MOVE)가 장비/병원 미선택이면 거부하지 않고 '보류'로 남김(실수 방지).
    const handleBulkApply = async () => {
        const checked = proposals.filter(p => selected[p.id]);
        const unchecked = proposals.filter(p => !selected[p.id]);
        if (checked.length === 0 && unchecked.length === 0) return;
        const ok = window.confirm(
            `✅ 포함(반영): ${checked.length}건\n🗑️ 나머지 거부: ${unchecked.length}건\n\n진행할까요? (거부는 되돌릴 수 없습니다)`
        );
        if (!ok) return;

        setBulkBusy(true);
        let applied = 0, rejected = 0;
        const skipped = [], errors = [];
        const doneIds = [];
        let n = 0; const total = checked.length + unchecked.length;

        for (const p of checked) {
            setBulkMsg(`반영 중… (${++n}/${total})`);
            const r = await applyOne(p);
            if (r.status === 'applied') { applied++; doneIds.push(p.id); }
            else if (r.status === 'skipped') { skipped.push(`${TYPE_LABEL[p.event_type] || p.event_type} — ${r.reason}`); }
            else { errors.push(`${TYPE_LABEL[p.event_type] || p.event_type} 반영실패: ${r.reason}`); }
        }
        for (const p of unchecked) {
            setBulkMsg(`거부 중… (${++n}/${total})`);
            const okr = await rejectOne(p);
            if (okr) { rejected++; doneIds.push(p.id); }
            else { errors.push(`거부실패 id=${p.id}`); }
        }

        setProposals(prev => prev.filter(x => !doneIds.includes(x.id)));
        setSelected({});
        setBulkBusy(false);
        setBulkMsg('');

        let summary = `완료 — 반영 ${applied}건 · 거부 ${rejected}건`;
        if (skipped.length) summary += `\n\n⏸️ 보류 ${skipped.length}건 (체크했으나 미선택 — 그대로 남겨둠):\n- ${skipped.join('\n- ')}`;
        if (errors.length) summary += `\n\n⚠️ 오류 ${errors.length}건:\n- ${errors.join('\n- ')}`;
        alert(summary);
    };

    const inputStyle = { width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', marginTop: '0.25rem', boxSizing: 'border-box' };
    const labelStyle = { fontSize: '0.78rem', color: '#64748b', fontWeight: 600 };

    const renderFields = (p) => {
        const e = edits[p.id] || {};
        const type = e.event_type || p.event_type;
        if (type === 'REPAIR') {
            return (
                <>
                    <label style={labelStyle}>장비명 *<input style={inputStyle} value={e.product_name} onChange={ev => setField(p.id, 'product_name', ev.target.value)} /></label>
                    <label style={labelStyle}>수리업체<input style={inputStyle} value={e.repair_company} onChange={ev => setField(p.id, 'repair_company', ev.target.value)} /></label>
                    <label style={labelStyle}>사유<textarea style={{ ...inputStyle, minHeight: '48px' }} value={e.issue_description} onChange={ev => setField(p.id, 'issue_description', ev.target.value)} /></label>
                    <label style={labelStyle}>의뢰자<input style={inputStyle} value={e.requested_by} onChange={ev => setField(p.id, 'requested_by', ev.target.value)} /></label>
                </>
            );
        }
        if (type === 'NOTE') {
            return (
                <>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <label style={{ ...labelStyle, flex: 1 }}>기간 시작<input type="date" style={inputStyle} value={e.period_start} onChange={ev => setField(p.id, 'period_start', ev.target.value)} /></label>
                        <label style={{ ...labelStyle, flex: 1 }}>기간 끝<input type="date" style={inputStyle} value={e.period_end} onChange={ev => setField(p.id, 'period_end', ev.target.value)} /></label>
                    </div>
                    <label style={labelStyle}>특이사항 내용 *<textarea style={{ ...inputStyle, minHeight: '60px' }} value={e.note_text} onChange={ev => setField(p.id, 'note_text', ev.target.value)} /></label>
                </>
            );
        }
        // MOVE
        return (
            <>
                <label style={labelStyle}>장비 선택 * (현재 위치)
                    <select style={inputStyle} value={e.lending_item_id} onChange={ev => setField(p.id, 'lending_item_id', ev.target.value)}>
                        <option value="">-- 장비 선택 --</option>
                        {items.map(it => (
                            <option key={it.id} value={it.id}>{it.product_name} {it.serial_number ? `#${it.serial_number}` : ''} ({it.hospital_name || '미지정'})</option>
                        ))}
                    </select>
                </label>
                <label style={labelStyle}>이동할 병원 *
                    <select style={inputStyle} value={e.to_hospital_id} onChange={ev => setField(p.id, 'to_hospital_id', ev.target.value)}>
                        <option value="">-- 병원 선택 --</option>
                        {hospitals.map(h => (<option key={h.id} value={h.id}>{h.name}</option>))}
                    </select>
                </label>
                <label style={labelStyle}>담당자<input style={inputStyle} value={e.moved_by} onChange={ev => setField(p.id, 'moved_by', ev.target.value)} /></label>
                <label style={labelStyle}>메모<input style={inputStyle} value={e.notes} onChange={ev => setField(p.id, 'notes', ev.target.value)} /></label>
            </>
        );
    };

    return (
        <div style={{ paddingBottom: '70px', background: '#f1f5f9', minHeight: '100vh' }}>
            {/* 헤더 + 일괄처리 바 (함께 상단 고정) */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ background: '#0f172a', color: 'white', padding: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>📋 검토 대기함</h2>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', opacity: 0.8 }}>포함할 것만 체크 → [일괄 적용] = 체크는 반영, 나머지는 자동 거부</p>
                </div>
                {!loading && proposals.length > 0 && (
                    <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0.55rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                            <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} style={{ width: 18, height: 18 }} />
                            전체선택
                        </label>
                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            전체 {proposals.length} · <b style={{ color: '#16a34a' }}>{checkedCount}</b> 포함 / <b style={{ color: '#ef4444' }}>{proposals.length - checkedCount}</b> 거부
                        </span>
                        <button
                            disabled={bulkBusy}
                            onClick={handleBulkApply}
                            style={{ marginLeft: 'auto', padding: '0.5rem 0.9rem', background: bulkBusy ? '#94a3b8' : '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.88rem' }}>
                            {bulkBusy ? (bulkMsg || '처리중…') : '일괄 적용'}
                        </button>
                    </div>
                )}
            </div>

            <div style={{ padding: '0.75rem' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', color: '#64748b' }}>불러오는 중…</p>
                ) : proposals.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem 1rem' }}>
                        <div style={{ fontSize: '2.5rem' }}>✅</div>
                        <p>검토할 제안이 없습니다.</p>
                    </div>
                ) : (
                    proposals.map(p => {
                        const lowConf = (p.confidence || 0) < 0.5;
                        const isSel = !!selected[p.id];
                        return (
                            <div key={p.id} style={{ background: 'white', borderRadius: '10px', padding: '0.85rem', marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: `4px solid ${TYPE_COLOR[p.event_type] || '#94a3b8'}`, outline: isSel ? '2px solid #0ea5e9' : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} style={{ width: 18, height: 18 }} />
                                        <span style={{ fontWeight: 700, color: TYPE_COLOR[p.event_type] }}>{TYPE_LABEL[p.event_type] || p.event_type}</span>
                                    </label>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{p.message_date} {lowConf && <span title="낮은 신뢰도" style={{ color: '#f59e0b' }}>⚠️</span>}</span>
                                </div>

                                <details style={{ marginBottom: '0.6rem' }}>
                                    <summary style={{ fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}>원문 대화 보기</summary>
                                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.78rem', color: '#334155', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', marginTop: '0.4rem', maxHeight: '160px', overflow: 'auto' }}>{p.raw_text}</pre>
                                </details>

                                {renderFields(p)}

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    <button disabled={busyId === p.id || bulkBusy} onClick={() => approve(p)} style={{ flex: 1, padding: '0.6rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem' }}>{busyId === p.id ? '처리중…' : '승인'}</button>
                                    <button disabled={busyId === p.id || bulkBusy} onClick={() => reject(p)} style={{ flex: 1, padding: '0.6rem', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem' }}>거부</button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <SalesBottomNav />
        </div>
    );
}

export default SalesInboxPage;
