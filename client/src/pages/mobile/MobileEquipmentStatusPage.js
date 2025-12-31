import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../../styles/mobile.css';

function MobileEquipmentStatusPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [adminMode, setAdminMode] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editForm, setEditForm] = useState({ notes: '', repair_history: '' });

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5; // 모바일은 5개씩

    useEffect(() => {
        fetchEquipment();
    }, []);

    const fetchEquipment = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/products');
            const equipmentItems = response.data.filter(
                item => item.category === 'EQUIPMENT' || item.barcode?.startsWith('IMG')
            );
            // 최신 수정순 정렬 (updated_at 우선, 없으면 created_at)
            const sortedItems = equipmentItems.sort((a, b) => {
                const dateA = new Date(a.updated_at || a.created_at || 0);
                const dateB = new Date(b.updated_at || b.created_at || 0);
                return dateB - dateA;
            });
            setItems(sortedItems);
            setCurrentPage(1);
            setLoading(false);
        } catch (error) {
            console.error('등록 현황 조회 실패:', error);
            setMessage('❌ 데이터 조회에 실패했습니다');
            setLoading(false);
        }
    };

    // 페이지네이션 계산
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = items.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleDelete = async (productId, productName) => {
        if (!window.confirm(`"${productName}" 제품을 삭제하시겠습니까?\n\n⚠️ 삭제된 제품은 복구할 수 없습니다.`)) {
            return;
        }

        try {
            await axios.delete(`/api/products/${productId}`);
            setMessage('✅ 삭제되었습니다');
            fetchEquipment();
        } catch (error) {
            console.error('삭제 실패:', error);
            const errorMsg = error.response?.data?.error || error.message;
            if (errorMsg.includes('배치') || errorMsg.includes('사무실')) {
                setMessage(`⚠️ ${errorMsg}`);
            } else {
                setMessage('❌ 삭제 실패: ' + errorMsg);
            }
        }
    };

    const handleForceDelete = async (productId, productName) => {
        if (!window.confirm(`⚠️ 경고: "${productName}" 제품을 강제 삭제합니다.\n\n연관된 모든 랜딩 기록도 함께 삭제됩니다.\n정말 진행하시겠습니까?`)) {
            return;
        }

        try {
            await axios.delete(`/api/products/${productId}/force`);
            setMessage('⚠️ 강제 삭제 완료');
            fetchEquipment();
        } catch (error) {
            console.error('강제 삭제 실패:', error);
            setMessage('❌ 강제 삭제 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleEditClick = (item) => {
        setEditingItem(item);
        setEditForm({
            notes: item.notes || '',
            repair_history: item.repair_history || ''
        });
    };

    const handleSave = async () => {
        if (!editingItem) return;

        try {
            await axios.put(`/api/products/${editingItem.id}`, editForm);
            setMessage('✅ 저장되었습니다');
            setEditingItem(null);
            fetchEquipment();
        } catch (error) {
            console.error('저장 실패:', error);
            setMessage('❌ 저장 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    // 날짜+시간 포맷 (YYYY. MM. DD. HH:mm) - UTC를 로컬시간으로 변환
    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            // SQLite CURRENT_TIMESTAMP는 UTC로 저장됨. 'Z'가 없으면 추가하여 UTC로 해석
            let utcDateString = dateString;
            if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
                utcDateString = dateString.replace(' ', 'T') + 'Z';
            }
            const date = new Date(utcDateString);
            if (isNaN(date.getTime())) return '-';

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            return `${year}. ${month}. ${day}. ${hours}:${minutes}`;
        } catch {
            return '-';
        }
    };

    const formatPrice = (price) => {
        if (!price) return '-';
        return `${Number(price).toLocaleString()}원`;
    };

    const handleAdminModeToggle = () => {
        if (!adminMode) {
            if (!window.confirm('⚠️ 관리자 모드를 활성화하시겠습니까?\n\n강제 삭제가 가능해집니다.')) {
                return;
            }
        }
        setAdminMode(!adminMode);
    };

    return (
        <div className="mobile-container">
            <div className="mobile-header" style={{ backgroundColor: adminMode ? '#8B0000' : undefined }}>
                <Link to="/mobile" style={{ color: 'white', textDecoration: 'none', marginRight: '1rem' }}>←</Link>
                <h1 style={{ margin: 0, fontSize: '1.2rem' }}>
                    {adminMode ? '🔓 관리자 모드' : '📋 등록 현황 - 기구/장비'}
                </h1>
            </div>

            {message && (
                <div style={{
                    padding: '0.8rem',
                    margin: '1rem',
                    borderRadius: '8px',
                    backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('⚠️') ? '#fff3cd' : '#f8d7da',
                    color: message.includes('✅') ? '#155724' : message.includes('⚠️') ? '#856404' : '#721c24',
                    fontSize: '0.9rem'
                }}>
                    {message}
                    <button onClick={() => setMessage('')} style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={fetchEquipment} className="btn btn-secondary" style={{ flex: 1, padding: '0.8rem', minWidth: '80px' }}>
                        🔄
                    </button>
                    <button
                        onClick={() => setEditMode(!editMode)}
                        className={`btn ${editMode ? 'btn-warning' : 'btn-primary'}`}
                        style={{ flex: 2, padding: '0.8rem' }}
                    >
                        {editMode ? '✅ 완료' : '✏️ 편집'}
                    </button>
                    <button
                        onClick={handleAdminModeToggle}
                        className="btn"
                        style={{
                            flex: 2,
                            padding: '0.8rem',
                            backgroundColor: adminMode ? '#8B0000' : '#6c757d',
                            color: 'white',
                            border: 'none'
                        }}
                    >
                        {adminMode ? '🔓 관리자' : '🔒 관리자'}
                    </button>
                </div>

                {adminMode && (
                    <div style={{
                        padding: '0.8rem',
                        marginBottom: '1rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        textAlign: 'center'
                    }}>
                        ⚠️ 관리자 모드: 강제 삭제 활성화
                    </div>
                )}

                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
                    총 {items.length}개 항목 (페이지 {currentPage}/{totalPages || 1})
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>로딩 중...</div>
                ) : items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        <p>등록된 기구/장비가 없습니다</p>
                        <p style={{ fontSize: '0.85rem' }}>제품등록(QR) 메뉴에서 기구/장비를 등록해주세요</p>
                    </div>
                ) : (
                    <>
                        <div>
                            {currentItems.map(item => (
                                <div key={item.id} style={{
                                    background: 'white',
                                    padding: '1rem',
                                    marginBottom: '0.8rem',
                                    borderRadius: '10px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    borderLeft: `4px solid ${adminMode ? '#8B0000' : '#667eea'}`
                                }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                        {item.name}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>
                                        <code style={{ background: '#f0f0f0', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                                            {item.barcode}
                                        </code>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                        💰 {formatPrice(item.unit_price)} · 📦 재고: {item.current_stock ?? 0}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.3rem' }}>
                                        등록일시: {formatDateTime(item.created_at)}
                                    </div>

                                    {(item.notes || item.repair_history) && (
                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f9f9f9', borderRadius: '5px', fontSize: '0.8rem' }}>
                                            {item.notes && <div>📝 {item.notes}</div>}
                                            {item.repair_history && <div style={{ marginTop: '0.3rem' }}>🔧 {item.repair_history}</div>}
                                        </div>
                                    )}

                                    {/* 편집 모드 버튼 */}
                                    {editMode && (
                                        <div style={{ marginTop: '0.8rem' }}>
                                            <button
                                                onClick={() => handleEditClick(item)}
                                                className="btn btn-info btn-sm"
                                                style={{ width: '100%', padding: '0.6rem' }}
                                            >
                                                ✏️ 비고/수리
                                            </button>
                                        </div>
                                    )}

                                    {/* 관리자 모드 강제 삭제 버튼 */}
                                    {adminMode && (
                                        <div style={{ marginTop: '0.8rem' }}>
                                            <button
                                                onClick={() => handleForceDelete(item.id, item.name)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.8rem',
                                                    backgroundColor: '#8B0000',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                ⚠️ 강제 삭제 (연관 데이터 포함)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.3rem',
                                marginTop: '1rem',
                                flexWrap: 'wrap'
                            }}>
                                <button
                                    onClick={() => handlePageChange(1)}
                                    disabled={currentPage === 1}
                                    style={{
                                        padding: '0.5rem 0.8rem',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        background: currentPage === 1 ? '#f0f0f0' : 'white',
                                        color: currentPage === 1 ? '#999' : '#333',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    «
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    style={{
                                        padding: '0.5rem 0.8rem',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        background: currentPage === 1 ? '#f0f0f0' : 'white',
                                        color: currentPage === 1 ? '#999' : '#333',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    ‹
                                </button>

                                <span style={{ padding: '0.5rem 1rem', fontWeight: 'bold' }}>
                                    {currentPage} / {totalPages}
                                </span>

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        padding: '0.5rem 0.8rem',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        background: currentPage === totalPages ? '#f0f0f0' : 'white',
                                        color: currentPage === totalPages ? '#999' : '#333',
                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    ›
                                </button>
                                <button
                                    onClick={() => handlePageChange(totalPages)}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        padding: '0.5rem 0.8rem',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        background: currentPage === totalPages ? '#f0f0f0' : 'white',
                                        color: currentPage === totalPages ? '#999' : '#333',
                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    »
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 편집 모달 */}
            {editingItem && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        width: '100%',
                        maxWidth: '400px',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}>
                        <h3 style={{ marginTop: 0 }}>✏️ {editingItem.name}</h3>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                📝 비고
                            </label>
                            <textarea
                                value={editForm.notes}
                                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                placeholder="비고 입력..."
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '0.8rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    resize: 'vertical',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                🔧 수리내역
                            </label>
                            <textarea
                                value={editForm.repair_history}
                                onChange={(e) => setEditForm({ ...editForm, repair_history: e.target.value })}
                                placeholder="수리내역 입력..."
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '0.8rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    resize: 'vertical',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="btn btn-secondary"
                                style={{ flex: 1, padding: '0.8rem' }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                className="btn btn-success"
                                style={{ flex: 1, padding: '0.8rem' }}
                            >
                                💾 저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 안내 */}
            <div style={{ padding: '1rem', fontSize: '0.8rem', color: '#666' }}>
                <strong>💡 안내</strong>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                    <li>최신 등록순으로 정렬됩니다</li>
                    <li>편집: 비고/수리내역 입력</li>
                    <li>관리자: 위치 무관 강제 삭제 (연관 데이터 포함)</li>
                </ul>
            </div>
        </div>
    );
}

export default MobileEquipmentStatusPage;
