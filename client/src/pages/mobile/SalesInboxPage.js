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

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function weekAgoStr() {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SalesInboxPage() {
    const [proposals, setProposals] = useState([]);
    const [items, setItems] = useState([]);       // lending_items (MOVE 장비 선택용)
    const [hospitals, setHospitals] = useState([]); // 병원 선택용
    const [edits, setEdits] = useState({});         // { [id]: { ...editable fields } }
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

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
                    // NOTE
                    period_start: ex.period_start || weekAgoStr(),
                    period_end: ex.period_end || todayStr(),
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

    const approve = async (p) => {
        const e = edits[p.id] || {};
        const type = e.event_type || p.event_type;
        let body = { event_type: type };

        if (type === 'REPAIR') {
            if (!e.product_name || !e.product_name.trim()) { alert('장비명을 입력하세요.'); return; }
            body = { ...body, product_name: e.product_name, repair_company: e.repair_company, issue_description: e.issue_description, requested_by: e.requested_by };
        } else if (type === 'NOTE') {
            if (!e.note_text || !e.note_text.trim()) { alert('특이사항 내용을 입력하세요.'); return; }
            body = { ...body, period_start: e.period_start, period_end: e.period_end, note_text: e.note_text };
        } else if (type === 'MOVE') {
            if (!e.lending_item_id || !e.to_hospital_id) { alert('장비와 병원을 모두 선택해야 승인할 수 있습니다.'); return; }
            body = { ...body, lending_item_id: Number(e.lending_item_id), to_hospital_id: Number(e.to_hospital_id), moved_by: e.moved_by, notes: e.notes };
        }

        setBusyId(p.id);
        try {
            await axios.patch(`/api/inbox/proposals/${p.id}/apply`, body);
            setProposals(prev => prev.filter(x => x.id !== p.id));
        } catch (error) {
            alert('반영 실패: ' + (error.response?.data?.error || error.message));
        } finally {
            setBusyId(null);
        }
    };

    const reject = async (p) => {
        if (!window.confirm('이 제안을 거부할까요?')) return;
        setBusyId(p.id);
        try {
            await axios.patch(`/api/inbox/proposals/${p.id}/reject`);
            setProposals(prev => prev.filter(x => x.id !== p.id));
        } catch (error) {
            alert('거부 실패: ' + (error.response?.data?.error || error.message));
        } finally {
            setBusyId(null);
        }
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
            <div style={{ background: '#0f172a', color: 'white', padding: '1rem', position: 'sticky', top: 0, zIndex: 10 }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>📋 검토 대기함</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', opacity: 0.8 }}>단톡방 대화에서 자동추출된 제안 — 승인해야 반영됩니다</p>
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
                        return (
                            <div key={p.id} style={{ background: 'white', borderRadius: '10px', padding: '0.85rem', marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: `4px solid ${TYPE_COLOR[p.event_type] || '#94a3b8'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 700, color: TYPE_COLOR[p.event_type] }}>{TYPE_LABEL[p.event_type] || p.event_type}</span>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{p.message_date} {lowConf && <span title="낮은 신뢰도" style={{ color: '#f59e0b' }}>⚠️</span>}</span>
                                </div>

                                <details style={{ marginBottom: '0.6rem' }}>
                                    <summary style={{ fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}>원문 대화 보기</summary>
                                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.78rem', color: '#334155', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', marginTop: '0.4rem', maxHeight: '160px', overflow: 'auto' }}>{p.raw_text}</pre>
                                </details>

                                {renderFields(p)}

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    <button disabled={busyId === p.id} onClick={() => approve(p)} style={{ flex: 1, padding: '0.6rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem' }}>{busyId === p.id ? '처리중…' : '승인'}</button>
                                    <button disabled={busyId === p.id} onClick={() => reject(p)} style={{ flex: 1, padding: '0.6rem', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem' }}>거부</button>
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
