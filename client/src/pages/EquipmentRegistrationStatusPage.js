import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/main.css';

function EquipmentRegistrationStatusPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [adminMode, setAdminMode] = useState(false);
    const [editedItems, setEditedItems] = useState({});

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        fetchEquipment();
    }, []);

    const fetchEquipment = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/products');
            const equipmentItems = response.data.filter(
                item => item.category === 'EQUIPMENT'
            );
            // 최신순 정렬 (created_at 기준 내림차순)
            const sortedItems = equipmentItems.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB - dateA; // 최신이 먼저
            });
            setItems(sortedItems);
            setCurrentPage(1); // 데이터 새로고침 시 첫 페이지로
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
        try {
            await axios.delete(`/api/products/${productId}/force`);
            setMessage(`✅ "${productName}" 삭제 완료`);
            fetchEquipment();
        } catch (error) {
            console.error('삭제 실패:', error);
            setMessage('❌ 삭제 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleFieldChange = (productId, field, value) => {
        setEditedItems(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [field]: value
            }
        }));
    };

    const handleSave = async (productId) => {
        const editedData = editedItems[productId];
        if (!editedData) return;

        try {
            await axios.put(`/api/products/${productId}`, editedData);
            setMessage('✅ 저장되었습니다');

            setItems(prev => prev.map(item =>
                item.id === productId
                    ? { ...item, ...editedData }
                    : item
            ));

            setEditedItems(prev => {
                const updated = { ...prev };
                delete updated[productId];
                return updated;
            });
        } catch (error) {
            console.error('저장 실패:', error);
            setMessage('❌ 저장 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    const getFieldValue = (item, field) => {
        if (editedItems[item.id] && editedItems[item.id][field] !== undefined) {
            return editedItems[item.id][field];
        }
        return item[field] || '';
    };

    const hasChanges = (productId) => {
        return editedItems[productId] && Object.keys(editedItems[productId]).length > 0;
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

    const handleEditModeToggle = () => {
        if (editMode) {
            if (Object.keys(editedItems).length > 0) {
                if (!window.confirm('저장되지 않은 변경사항이 있습니다. 편집 모드를 종료하시겠습니까?')) {
                    return;
                }
                setEditedItems({});
            }
        }
        // 관리자 모드가 활성화되어 있으면 비활성화
        if (adminMode) setAdminMode(false);
        setEditMode(!editMode);
    };

    const handleAdminModeToggle = () => {
        // 편집 모드가 활성화되어 있으면 비활성화
        if (editMode) {
            setEditedItems({});
            setEditMode(false);
        }
        setAdminMode(!adminMode);
    };

    // 페이지 번호 배열 생성
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📋 등록 현황 - 기구/장비</h1>
                <p>등록된 기구/장비 제품을 확인합니다 (구입/보유 현황)</p>
            </div>

            {message && (
                <div className={`message ${message.includes('✅') ? 'success' : message.includes('⚠️') ? 'warning' : 'error'}`}
                    style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('⚠️') ? '#fff3cd' : '#f8d7da',
                        color: message.includes('✅') ? '#155724' : message.includes('⚠️') ? '#856404' : '#721c24',
                        border: `1px solid ${message.includes('✅') ? '#c3e6cb' : message.includes('⚠️') ? '#ffeeba' : '#f5c6cb'}`
                    }}>
                    {message}
                </div>
            )}

            <div className="table-controls">
                <button onClick={fetchEquipment} className="btn btn-secondary">
                    🔄 새로고침
                </button>
                <button
                    onClick={handleEditModeToggle}
                    className={`btn ${editMode ? 'btn-warning' : 'btn-secondary'}`}
                >
                    {editMode ? '✅ 완료' : '✏️ 편집'}
                </button>
                <button
                    onClick={handleAdminModeToggle}
                    className={`btn ${adminMode ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ marginLeft: '0.5rem' }}
                >
                    {adminMode ? '🔓 관리자 ON' : '🔒 관리자'}
                </button>
                <span style={{ marginLeft: '1rem', color: '#666' }}>
                    총 {items.length}개 항목 (페이지 {currentPage}/{totalPages || 1})
                </span>
            </div>

            {adminMode && (
                <div style={{
                    padding: '0.8rem',
                    marginBottom: '1rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '0.9rem'
                }}>
                    ⚠️ <strong>관리자 모드</strong>: 강제 삭제 버튼이 활성화되었습니다. 주의하세요!
                </div>
            )}

            {loading ? (
                <div className="loading">로딩 중...</div>
            ) : items.length === 0 ? (
                <div className="empty-state">
                    <p>등록된 기구/장비가 없습니다</p>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                        제품등록(QR) 메뉴에서 기구/장비를 등록해주세요
                    </p>
                </div>
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
                                        <td>
                                            <strong>{item.name}</strong>
                                        </td>
                                        <td>
                                            <code>{item.barcode}</code>
                                        </td>
                                        <td>
                                            <span className="badge badge-primary">기구/장비</span>
                                        </td>
                                        <td>{formatPrice(item.unit_price)}</td>
                                        <td>{item.current_stock ?? 0}</td>
                                        <td>{formatDateTime(item.created_at)}</td>
                                        {editMode && (
                                            <td>
                                                <textarea
                                                    value={getFieldValue(item, 'notes')}
                                                    onChange={(e) => handleFieldChange(item.id, 'notes', e.target.value)}
                                                    placeholder="비고 입력..."
                                                    style={{
                                                        width: '100%',
                                                        minHeight: '60px',
                                                        padding: '0.5rem',
                                                        border: '1px solid #ddd',
                                                        borderRadius: '4px',
                                                        resize: 'vertical'
                                                    }}
                                                />
                                            </td>
                                        )}
                                        {editMode && (
                                            <td>
                                                <textarea
                                                    value={getFieldValue(item, 'repair_history')}
                                                    onChange={(e) => handleFieldChange(item.id, 'repair_history', e.target.value)}
                                                    placeholder="수리내역 입력..."
                                                    style={{
                                                        width: '100%',
                                                        minHeight: '60px',
                                                        padding: '0.5rem',
                                                        border: '1px solid #ddd',
                                                        borderRadius: '4px',
                                                        resize: 'vertical'
                                                    }}
                                                />
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
                                                <button
                                                    onClick={() => handleForceDelete(item.id, item.name)}
                                                    className="btn btn-danger btn-sm"
                                                >
                                                    🗑️ 삭제
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: '1.5rem',
                            flexWrap: 'wrap'
                        }}>
                            <button
                                onClick={() => handlePageChange(1)}
                                disabled={currentPage === 1}
                                className="btn btn-sm btn-secondary"
                                style={{ minWidth: '40px' }}
                            >
                                «
                            </button>
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="btn btn-sm btn-secondary"
                                style={{ minWidth: '60px' }}
                            >
                                ‹ 이전
                            </button>

                            {getPageNumbers().map(page => (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ minWidth: '40px' }}
                                >
                                    {page}
                                </button>
                            ))}

                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="btn btn-sm btn-secondary"
                                style={{ minWidth: '60px' }}
                            >
                                다음 ›
                            </button>
                            <button
                                onClick={() => handlePageChange(totalPages)}
                                disabled={currentPage === totalPages}
                                className="btn btn-sm btn-secondary"
                                style={{ minWidth: '40px' }}
                            >
                                »
                            </button>
                        </div>
                    )}
                </>
            )}

            <div className="info-box" style={{ marginTop: '2rem' }}>
                <h3>💡 안내</h3>
                <ul>
                    <li><strong>등록 현황</strong>: 구입/보유한 기구/장비 목록입니다 (최신 등록순)</li>
                    <li><strong>편집 모드</strong>: 비고와 수리내역을 입력할 수 있습니다</li>
                    <li><strong>관리자 모드</strong>: 배치 위치와 관계없이 삭제할 수 있습니다 (주의!)</li>
                    <li><strong>주의</strong>: 삭제된 제품은 복구할 수 없으며, 연관된 모든 데이터가 함께 삭제됩니다</li>
                </ul>
            </div>
        </div>
    );
}

export default EquipmentRegistrationStatusPage;
