import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/main.css';

function ConsumableRegistrationStatusPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [adminMode, setAdminMode] = useState(false);
    const [editedItems, setEditedItems] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/products');
            const filteredItems = response.data.filter(item => item.category === 'CONSUMABLE');
            const sortedItems = filteredItems.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            setItems(sortedItems);
            setCurrentPage(1);
            setLoading(false);
        } catch (error) {
            console.error('등록 현황 조회 실패:', error);
            setMessage('❌ 데이터 조회에 실패했습니다');
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    const handleDelete = async (productId, productName) => {
        if (!window.confirm(`"${productName}" 제품을 삭제하시겠습니까?`)) return;
        try {
            await axios.delete(`/api/products/${productId}`);
            setMessage('✅ 삭제되었습니다');
            fetchItems();
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            setMessage('❌ 삭제 실패: ' + errorMsg);
        }
    };

    const handleForceDelete = async (productId, productName) => {
        try {
            await axios.delete(`/api/products/${productId}/force`);
            setMessage(`✅ "${productName}" 삭제 완료`);
            fetchItems();
        } catch (error) {
            setMessage('❌ 삭제 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleFieldChange = (productId, field, value) => {
        setEditedItems(prev => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));
    };

    const handleSave = async (productId) => {
        const editedData = editedItems[productId];
        if (!editedData) return;
        try {
            await axios.put(`/api/products/${productId}`, editedData);
            setMessage('✅ 저장되었습니다');
            setItems(prev => prev.map(item => item.id === productId ? { ...item, ...editedData } : item));
            setEditedItems(prev => { const updated = { ...prev }; delete updated[productId]; return updated; });
        } catch (error) {
            setMessage('❌ 저장 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    const getFieldValue = (item, field) => editedItems[item.id]?.[field] !== undefined ? editedItems[item.id][field] : (item[field] || '');
    const hasChanges = (productId) => editedItems[productId] && Object.keys(editedItems[productId]).length > 0;

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            let utcDateString = dateString;
            if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
                utcDateString = dateString.replace(' ', 'T') + 'Z';
            }
            const date = new Date(utcDateString);
            if (isNaN(date.getTime())) return '-';
            return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}. ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        } catch { return '-'; }
    };

    const formatPrice = (price) => price ? `${Number(price).toLocaleString()}원` : '-';

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>🔩 등록 현황 - 소모성 기구</h1>
                <p>등록된 소모성 기구 제품을 확인합니다 (카테터, 전극 등)</p>
            </div>

            {message && (
                <div style={{
                    padding: '1rem', borderRadius: '8px', marginBottom: '1rem',
                    backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('⚠️') ? '#fff3cd' : '#f8d7da',
                    color: message.includes('✅') ? '#155724' : message.includes('⚠️') ? '#856404' : '#721c24'
                }}>
                    {message}
                </div>
            )}

            <div className="table-controls">
                <button onClick={fetchItems} className="btn btn-secondary">🔄 새로고첨</button>
                <button
                    onClick={() => {
                        if (editMode && Object.keys(editedItems).length > 0) {
                            if (!window.confirm('저장되지 않은 변경사항이 있습니다. 편집 모드를 종료하시겠습니까?')) return;
                            setEditedItems({});
                        }
                        if (adminMode) setAdminMode(false);
                        setEditMode(!editMode);
                    }}
                    className={`btn ${editMode ? 'btn-warning' : 'btn-secondary'}`}
                >
                    {editMode ? '✅ 완료' : '✏️ 편집'}
                </button>
                <button
                    onClick={() => {
                        // 편집 모드가 활성화되어 있으면 비활성화
                        if (editMode) {
                            setEditedItems({});
                            setEditMode(false);
                        }
                        setAdminMode(!adminMode);
                    }}
                    className={`btn ${adminMode ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ marginLeft: '0.5rem' }}
                >
                    {adminMode ? '🔓 관리자 ON' : '🔒 관리자'}
                </button>
                <span style={{ marginLeft: '1rem', color: '#666' }}>총 {items.length}개 항목 (페이지 {currentPage}/{totalPages || 1})</span>
            </div>

            {adminMode && <div style={{ padding: '0.8rem', marginBottom: '1rem', backgroundColor: '#dc3545', color: 'white', borderRadius: '8px' }}>⚠️ <strong>관리자 모드</strong>: 강제 삭제 버튼이 활성화되었습니다.</div>}

            {loading ? (
                <div className="loading">로딩 중...</div>
            ) : items.length === 0 ? (
                <div className="empty-state"><p>등록된 소모성 기구가 없습니다</p></div>
            ) : (
                <>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>제품명</th>
                                    <th>바코드</th>
                                    <th>카테고리</th>
                                    <th>단가</th>
                                    <th>현재 재고</th>
                                    <th>등록일시</th>
                                    {editMode && <th style={{ minWidth: '150px' }}>비고</th>}
                                    {editMode && <th style={{ minWidth: '150px' }}>수리내역</th>}
                                    {editMode && <th>저장</th>}
                                    {adminMode && <th>삭제</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.map(item => (
                                    <tr key={item.id}>
                                        <td><strong>{item.name}</strong></td>
                                        <td><code>{item.barcode}</code></td>
                                        <td><span className="badge badge-info">🔩 소모성 기구</span></td>
                                        <td>{formatPrice(item.unit_price)}</td>
                                        <td>{item.current_stock ?? 0}</td>
                                        <td>{formatDateTime(item.created_at)}</td>
                                        {editMode && (
                                            <td>
                                                <textarea value={getFieldValue(item, 'notes')} onChange={(e) => handleFieldChange(item.id, 'notes', e.target.value)} placeholder="비고 입력..." style={{ width: '100%', minHeight: '60px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                                            </td>
                                        )}
                                        {editMode && (
                                            <td>
                                                <textarea value={getFieldValue(item, 'repair_history')} onChange={(e) => handleFieldChange(item.id, 'repair_history', e.target.value)} placeholder="수리내역 입력..." style={{ width: '100%', minHeight: '60px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                                            </td>
                                        )}
                                        {editMode && (
                                            <td>
                                                <button
                                                    onClick={() => handleSave(item.id)}
                                                    className="btn btn-success btn-sm"
                                                    disabled={!hasChanges(item.id)}
                                                    style={{ opacity: hasChanges(item.id) ? 1 : 0.5 }}
                                                >
                                                    💾 저장
                                                </button>
                                            </td>
                                        )}
                                        {adminMode && (
                                            <td>
                                                <button onClick={() => handleForceDelete(item.id, item.name)} className="btn btn-danger btn-sm">🗑️ 삭제</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                            <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="btn btn-sm btn-secondary">«</button>
                            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="btn btn-sm btn-secondary">‹ 이전</button>
                            {getPageNumbers().map(page => <button key={page} onClick={() => handlePageChange(page)} className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}>{page}</button>)}
                            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn btn-sm btn-secondary">다음 ›</button>
                            <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="btn btn-sm btn-secondary">»</button>
                        </div>
                    )}
                </>
            )}

            <div className="info-box" style={{ marginTop: '2rem' }}>
                <h3>💡 안내</h3>
                <ul>
                    <li><strong>소모성 기구</strong>: 카테터, 수술용 전극 등 일회성 부속품</li>
                    <li><strong>편집 모드</strong>: 비고와 수리내역을 입력할 수 있습니다</li>
                    <li><strong>관리자 모드</strong>: 제품을 삭제할 수 있습니다 (주의!)</li>
                </ul>
            </div>
        </div>
    );
}

export default ConsumableRegistrationStatusPage;
