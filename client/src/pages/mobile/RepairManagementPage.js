import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SalesBottomNav from '../../components/SalesBottomNav';
import { API_BASE_URL } from '../../config';
import '../../styles/mobile.css';

axios.defaults.baseURL = API_BASE_URL;

const STATUS_LABELS = {
    REQUESTED: '의뢰접수', SENT: '택배발송', IN_REPAIR: '수리중', RETURNED: '회수', COMPLETED: '전달완료'
};
const STATUS_COLORS = {
    REQUESTED: '#f59e0b', SENT: '#3b82f6', IN_REPAIR: '#ef4444', RETURNED: '#8b5cf6', COMPLETED: '#10b981'
};
const STATUS_ORDER = ['REQUESTED', 'SENT', 'IN_REPAIR', 'RETURNED', 'COMPLETED'];

function getDaysElapsed(dateStr) {
    if (!dateStr) return 0;
    return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

function RepairManagementPage() {
    const [repairs, setRepairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('active'); // 'active' | status | 'all'
    const [personnelList, setPersonnelList] = useState([]);
    const [companies, setCompanies] = useState([]);

    // 모달 상태
    const [showNewModal, setShowNewModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(null); // repair object
    const [detailLogs, setDetailLogs] = useState([]);

    // 새 의뢰 폼
    const [newForm, setNewForm] = useState({ product_name: '', repair_company: '', issue_description: '', requested_by: '', notes: '' });
    const [newPhoto, setNewPhoto] = useState(null);

    // 상태 변경/로그 추가
    const [logNote, setLogNote] = useState('');
    const [logPhoto, setLogPhoto] = useState(null);
    const [logBy, setLogBy] = useState('');
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState('');

    // 알림
    const [alerts, setAlerts] = useState([]);
    const [showAlerts, setShowAlerts] = useState(false);

    const photoRef = useRef(null);
    const logPhotoRef = useRef(null);

    useEffect(() => {
        fetchRepairs();
        fetchPersonnel();
        fetchCompanies();
    }, []);

    const fetchRepairs = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/repairs');
            setRepairs(res.data);
            // 알림 계산 (1주 단위)
            const activeRepairs = res.data.filter(r => r.status !== 'COMPLETED');
            const weekAlerts = activeRepairs.filter(r => {
                const days = getDaysElapsed(r.requested_date);
                return days >= 7;
            });
            setAlerts(weekAlerts);
        } catch (e) { console.error('수리 목록 조회 실패:', e); }
        finally { setLoading(false); }
    };

    const fetchPersonnel = async () => {
        try { const res = await axios.get('/api/staff'); setPersonnelList(res.data.map(s => s.name)); } catch (e) {}
    };

    const fetchCompanies = async () => {
        try { const res = await axios.get('/api/repair-companies'); setCompanies(res.data); } catch (e) {}
    };

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // 새 수리 의뢰 등록
    const handleNewRepair = async () => {
        if (!newForm.product_name.trim()) { setMessage('❌ 장비명을 입력해주세요'); return; }
        if (!newForm.issue_description.trim()) { setMessage('❌ 수리 사유를 입력해주세요'); return; }
        setProcessing(true);
        try {
            await axios.post('/api/repairs', { ...newForm, photo_url: newPhoto });
            setMessage('✅ 수리 의뢰가 등록되었습니다');
            setShowNewModal(false);
            setNewForm({ product_name: '', repair_company: '', issue_description: '', requested_by: '', notes: '' });
            setNewPhoto(null);
            fetchRepairs();
            fetchCompanies();
        } catch (e) { setMessage('❌ 등록 실패'); }
        finally { setProcessing(false); setTimeout(() => setMessage(''), 2000); }
    };

    // 상세 보기
    const openDetail = async (repair) => {
        try {
            const res = await axios.get(`/api/repairs/${repair.id}`);
            setShowDetailModal(res.data);
            setDetailLogs(res.data.logs || []);
            setLogNote('');
            setLogPhoto(null);
            setLogBy('');
        } catch (e) { console.error(e); }
    };

    // 상태 변경
    const handleStatusChange = async (newStatus) => {
        if (!showDetailModal) return;
        setProcessing(true);
        try {
            await axios.put(`/api/repairs/${showDetailModal.id}/status`, {
                status: newStatus, note: logNote, logged_by: logBy, photo_url: logPhoto
            });
            setMessage(`✅ ${STATUS_LABELS[newStatus]}(으)로 변경되었습니다`);
            setLogNote(''); setLogPhoto(null);
            await openDetail(showDetailModal);
            fetchRepairs();
        } catch (e) { setMessage('❌ 상태 변경 실패'); }
        finally { setProcessing(false); setTimeout(() => setMessage(''), 2000); }
    };

    // 메모/사진 추가
    const handleAddLog = async () => {
        if (!logNote.trim() && !logPhoto) { setMessage('❌ 메모 또는 사진을 입력해주세요'); return; }
        setProcessing(true);
        try {
            await axios.post(`/api/repairs/${showDetailModal.id}/log`, {
                note: logNote, logged_by: logBy, photo_url: logPhoto
            });
            setLogNote(''); setLogPhoto(null);
            await openDetail(showDetailModal);
        } catch (e) { setMessage('❌ 추가 실패'); }
        finally { setProcessing(false); }
    };

    const filteredRepairs = filter === 'active'
        ? repairs.filter(r => r.status !== 'COMPLETED')
        : filter === 'all' ? repairs
        : repairs.filter(r => r.status === filter);

    const getNextStatus = (current) => {
        const idx = STATUS_ORDER.indexOf(current);
        return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
    };

    return (
        <div style={{ paddingBottom: '80px', minHeight: '100vh', background: '#f8fafc' }}>
            {/* 헤더 */}
            <div style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                color: 'white', padding: '1.5rem 1rem 1rem', borderRadius: '0 0 16px 16px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700' }}>🔧 장비 수리 관리</h1>
                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', opacity: 0.85 }}>
                            수리 의뢰 → 택배발송 → 수리중 → 회수 → 전달완료
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {alerts.length > 0 && (
                            <button onClick={() => setShowAlerts(!showAlerts)} style={{
                                background: '#fbbf24', border: 'none', color: '#92400e', padding: '0.4rem 0.7rem',
                                borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', position: 'relative'
                            }}>
                                🔔 {alerts.length}
                            </button>
                        )}
                        <button onClick={fetchRepairs} style={{
                            background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                            padding: '0.4rem 0.7rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem'
                        }}>🔄</button>
                    </div>
                </div>
            </div>

            {/* 알림 패널 */}
            {showAlerts && alerts.length > 0 && (
                <div style={{ margin: '0.5rem', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '10px', padding: '0.75rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#92400e', marginBottom: '0.5rem' }}>⚠️ 수리 경과 알림</div>
                    {alerts.map(r => {
                        const days = getDaysElapsed(r.requested_date);
                        const weeks = Math.floor(days / 7);
                        return (
                            <div key={r.id} onClick={() => openDetail(r)} style={{
                                padding: '0.5rem', background: 'white', borderRadius: '6px', marginBottom: '0.3rem',
                                cursor: 'pointer', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between'
                            }}>
                                <span><strong>{r.product_name}</strong> - {STATUS_LABELS[r.status]}</span>
                                <span style={{ color: '#ef4444', fontWeight: '700' }}>D+{days} ({weeks}주 경과)</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 필터 */}
            <div style={{ display: 'flex', gap: '0.3rem', padding: '0.75rem', overflowX: 'auto', flexWrap: 'nowrap' }}>
                {[
                    { key: 'active', label: '진행중' },
                    { key: 'REQUESTED', label: '의뢰접수' },
                    { key: 'SENT', label: '택배발송' },
                    { key: 'IN_REPAIR', label: '수리중' },
                    { key: 'RETURNED', label: '회수' },
                    { key: 'COMPLETED', label: '완료' },
                    { key: 'all', label: '전체' }
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} style={{
                        padding: '0.4rem 0.7rem', borderRadius: '16px', border: 'none', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: filter === f.key ? '700' : '400', whiteSpace: 'nowrap',
                        background: filter === f.key ? '#ef4444' : '#e2e8f0',
                        color: filter === f.key ? 'white' : '#475569'
                    }}>{f.label} ({f.key === 'active' ? repairs.filter(r => r.status !== 'COMPLETED').length
                        : f.key === 'all' ? repairs.length
                        : repairs.filter(r => r.status === f.key).length})</button>
                ))}
            </div>

            {/* 수리 목록 */}
            <div style={{ padding: '0 0.75rem' }}>
                {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>로딩 중...</div> : (
                    filteredRepairs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>수리 기록이 없습니다</div>
                    ) : filteredRepairs.map(repair => {
                        const days = getDaysElapsed(repair.requested_date);
                        const nextStatus = getNextStatus(repair.status);
                        const nextLabel = nextStatus ? STATUS_LABELS[nextStatus] : null;
                        return (
                            <div key={repair.id} onClick={() => openDetail(repair)} style={{
                                background: 'white', borderRadius: '12px', padding: '1rem', marginBottom: '0.75rem',
                                border: `2px solid ${STATUS_COLORS[repair.status]}40`, cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <strong style={{ fontSize: '1rem' }}>{repair.product_name}</strong>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700',
                                        color: 'white', background: STATUS_COLORS[repair.status]
                                    }}>{STATUS_LABELS[repair.status]}</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                    {repair.issue_description && <div>사유: {repair.issue_description}</div>}
                                    {repair.repair_company && <div>수리업체: {repair.repair_company}</div>}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                                        <span>의뢰: {repair.requested_by || '-'} ({new Date(repair.requested_date).toLocaleDateString('ko-KR')})</span>
                                        {repair.status !== 'COMPLETED' && (
                                            <span style={{ color: days >= 14 ? '#ef4444' : days >= 7 ? '#f59e0b' : '#6b7280', fontWeight: days >= 7 ? '700' : '400' }}>
                                                D+{days}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* 다음 단계 안내 */}
                                <div style={{
                                    marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    {nextLabel ? (
                                        <span style={{
                                            padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600',
                                            background: `${STATUS_COLORS[nextStatus]}15`, color: STATUS_COLORS[nextStatus],
                                            border: `1px solid ${STATUS_COLORS[nextStatus]}30`
                                        }}>
                                            👆 탭하여 → {nextLabel} 처리
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>✅ 완료</span>
                                    )}
                                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>상세보기 →</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* 새 의뢰 버튼 */}
            <div style={{ padding: '0.75rem' }}>
                <button onClick={() => { setShowNewModal(true); setMessage(''); }} style={{
                    width: '100%', padding: '1rem', borderRadius: '12px', border: '2px dashed #ef4444',
                    background: '#fef2f2', color: '#ef4444', fontSize: '1rem', fontWeight: '700',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}>
                    ➕ 새 수리 의뢰 등록
                </button>
            </div>

            {/* 새 의뢰 모달 */}
            {showNewModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}>
                    <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem' }}>🔧 새 수리 의뢰 등록</h3>
                        <input placeholder="장비명 *" value={newForm.product_name} onChange={e => setNewForm(p => ({ ...p, product_name: e.target.value }))}
                            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '0.5rem', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        <textarea placeholder="수리 사유 *" value={newForm.issue_description} onChange={e => setNewForm(p => ({ ...p, issue_description: e.target.value }))}
                            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '0.5rem', fontSize: '0.9rem', minHeight: '80px', boxSizing: 'border-box' }} />
                        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                            <input placeholder="수리 업체" value={newForm.repair_company} onChange={e => setNewForm(p => ({ ...p, repair_company: e.target.value }))}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            {companies.length > 0 && (
                                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>
                                    이전: {companies.map(c => <span key={c} onClick={() => setNewForm(p => ({ ...p, repair_company: c }))} style={{ cursor: 'pointer', color: '#6366f1', marginRight: '8px' }}>{c}</span>)}
                                </div>
                            )}
                        </div>
                        <select value={newForm.requested_by} onChange={e => setNewForm(p => ({ ...p, requested_by: e.target.value }))}
                            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                            <option value="">의뢰자 선택...</option>
                            {personnelList.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input placeholder="비고" value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))}
                            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '0.5rem', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button onClick={() => photoRef.current?.click()} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f8fafc', cursor: 'pointer', fontSize: '0.85rem' }}>📸 사진</button>
                            {newPhoto && <img src={newPhoto} alt="" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }} />}
                        </div>
                        <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                            onChange={async (e) => { if (e.target.files[0]) setNewPhoto(await fileToBase64(e.target.files[0])); e.target.value = ''; }} />
                        {message && <div style={{ padding: '0.5rem', borderRadius: '8px', marginBottom: '0.5rem', textAlign: 'center', fontSize: '0.85rem', color: message.startsWith('✅') ? '#10b981' : '#ef4444' }}>{message}</div>}
                        <button onClick={handleNewRepair} disabled={processing} style={{
                            width: '100%', padding: '0.8rem', borderRadius: '10px', border: 'none', background: processing ? '#9ca3af' : '#ef4444',
                            color: 'white', fontSize: '1rem', fontWeight: '700', cursor: 'pointer'
                        }}>{processing ? '등록 중...' : '🔧 수리 의뢰 등록'}</button>
                    </div>
                </div>
            )}

            {/* 상세/타임라인 모달 */}
            {showDetailModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowDetailModal(null); }}>
                    <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>🔧 {showDetailModal.product_name}</h3>
                            <button onClick={() => setShowDetailModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
                        </div>

                        {/* 상태 표시 */}
                        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
                            {STATUS_ORDER.map(s => (
                                <div key={s} style={{
                                    flex: 1, padding: '0.3rem', borderRadius: '4px', textAlign: 'center', fontSize: '0.6rem', fontWeight: '600',
                                    background: STATUS_ORDER.indexOf(s) <= STATUS_ORDER.indexOf(showDetailModal.status) ? STATUS_COLORS[s] : '#e2e8f0',
                                    color: STATUS_ORDER.indexOf(s) <= STATUS_ORDER.indexOf(showDetailModal.status) ? 'white' : '#94a3b8'
                                }}>{STATUS_LABELS[s]}</div>
                            ))}
                        </div>

                        {/* 정보 */}
                        <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                            <div>사유: {showDetailModal.issue_description || '-'}</div>
                            <div>수리업체: {showDetailModal.repair_company || '-'}</div>
                            <div>의뢰자: {showDetailModal.requested_by || '-'}</div>
                            <div>경과: D+{getDaysElapsed(showDetailModal.requested_date)}</div>
                        </div>

                        {/* 다음 단계 버튼 */}
                        {getNextStatus(showDetailModal.status) && (
                            <div style={{ marginBottom: '1rem' }}>
                                <select value={logBy} onChange={e => setLogBy(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                                    <option value="">처리자 선택...</option>
                                    {personnelList.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <input placeholder="메모 (선택)" value={logNote} onChange={e => setLogNote(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '0.3rem', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                    <button onClick={() => logPhotoRef.current?.click()} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f8fafc', cursor: 'pointer', fontSize: '0.8rem' }}>📸 사진</button>
                                    {logPhoto && <img src={logPhoto} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />}
                                </div>
                                <input ref={logPhotoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                                    onChange={async (e) => { if (e.target.files[0]) setLogPhoto(await fileToBase64(e.target.files[0])); e.target.value = ''; }} />
                                <button onClick={() => handleStatusChange(getNextStatus(showDetailModal.status))} disabled={processing}
                                    style={{
                                        width: '100%', padding: '0.7rem', borderRadius: '10px', border: 'none',
                                        background: STATUS_COLORS[getNextStatus(showDetailModal.status)], color: 'white',
                                        fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer'
                                    }}>
                                    → {STATUS_LABELS[getNextStatus(showDetailModal.status)]}(으)로 변경
                                </button>
                            </div>
                        )}

                        {/* 메모 추가 */}
                        {showDetailModal.status !== 'COMPLETED' && (
                            <div style={{ marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                                <button onClick={handleAddLog} style={{
                                    width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db',
                                    background: '#f8fafc', cursor: 'pointer', fontSize: '0.85rem'
                                }}>📝 메모/사진 추가</button>
                            </div>
                        )}

                        {message && <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem', color: message.startsWith('✅') ? '#10b981' : '#ef4444' }}>{message}</div>}

                        {/* 타임라인 */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem' }}>📋 타임라인</div>
                            {detailLogs.map(log => (
                                <div key={log.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid #e2e8f0' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8rem' }}>
                                            <strong>{log.status_change}</strong>
                                            {log.logged_by && <span style={{ color: '#6b7280' }}> - {log.logged_by}</span>}
                                        </div>
                                        {log.note && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{log.note}</div>}
                                        {log.photo_url && <img src={log.photo_url} alt="" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px', marginTop: '0.25rem' }} />}
                                        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{new Date(log.created_at).toLocaleString('ko-KR')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <SalesBottomNav />
        </div>
    );
}

export default RepairManagementPage;
