import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/main.css';

function LendingPage({ category }) {
    const [lendingItems, setLendingItems] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        fetchData();
    }, [category, selectedHospital]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 병원 목록 조회
            const hospitalsRes = await axios.get('/api/hospitals');
            setHospitals(hospitalsRes.data);

            // 랜딩 현황 조회
            const params = {};
            if (category) params.category = category;
            if (selectedHospital) params.hospital_id = selectedHospital;

            const itemsRes = await axios.get('/api/lending/items', { params });
            setLendingItems(itemsRes.data);

            setLoading(false);
        } catch (error) {
            console.error('데이터 조회 실패:', error);
            setLoading(false);
        }
    };

    const getStatusBadge = (item) => {
        if (item.alert_status === 'EXPIRING_SOON') {
            return <span className="badge badge-warning">유통기한 임박 ({item.days_until_expiry}일)</span>;
        }
        return <span className="badge badge-success">정상</span>;
    };

    const getCategoryName = (cat) => {
        const names = {
            'EQUIPMENT': '기구/장비',
            'BIOLOGIC': '바이오로직',
            'CONSUMABLE': '소모성 기구'
        };
        return names[cat] || cat;
    };

    const handleDelete = async (itemId, productName) => {
        if (!window.confirm(`"${productName}" 항목을 삭제하시겠습니까?`)) {
            return;
        }

        try {
            await axios.delete(`/api/lending/items/${itemId}`);
            alert('삭제되었습니다');
            fetchData(); // 목록 새로고침
        } catch (error) {
            console.error('삭제 실패:', error);
            alert('삭제 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>🏥 랜딩 현황 - {category ? getCategoryName(category) : '전체'}</h1>
                <p>병원에 랜딩된 제품 현황을 확인합니다</p>
            </div>

            <div className="filter-section">
                <label>
                    병원 필터:
                    <select
                        value={selectedHospital}
                        onChange={(e) => setSelectedHospital(e.target.value)}
                        className="filter-select"
                    >
                        <option value="">전체 병원</option>
                        {hospitals.map(hospital => (
                            <option key={hospital.id} value={hospital.id}>
                                {hospital.name}
                            </option>
                        ))}
                    </select>
                </label>
                <button onClick={fetchData} className="btn btn-primary">🔄 새로고침</button>
                <button
                    onClick={() => setEditMode(!editMode)}
                    className={`btn ${editMode ? 'btn-warning' : 'btn-secondary'}`}
                >
                    {editMode ? '✅ 완료' : '✏️ 편집'}
                </button>
            </div>

            {loading ? (
                <div className="loading">로딩 중...</div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>제품명</th>
                                <th>담당자</th>
                                <th>카테고리</th>
                                <th>최초 배치 장소</th>
                                <th>시리얼번호</th>
                                <th>수량</th>
                                <th>유통기한</th>
                                <th>상태</th>
                                <th>등록일</th>
                                {editMode && <th>삭제</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {lendingItems.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="no-data">랜딩 데이터가 없습니다</td>
                                </tr>
                            ) : (
                                lendingItems.map(item => (
                                    <tr key={item.id} className={item.alert_status === 'EXPIRING_SOON' ? 'row-warning' : ''}>
                                        <td>{item.product_name}</td>
                                        <td>{item.moved_by || '미지정'}</td>
                                        <td>{getCategoryName(item.category)}</td>
                                        <td>{item.hospital_name}</td>
                                        <td>{item.serial_number || '-'}</td>
                                        <td>{item.quantity}</td>
                                        <td>
                                            {item.expiration_date
                                                ? new Date(item.expiration_date).toLocaleDateString('ko-KR')
                                                : '-'
                                            }
                                        </td>
                                        <td>{getStatusBadge(item)}</td>
                                        <td>
                                            {(item.deploy_date || item.lending_date)
                                                ? new Date(item.deploy_date || item.lending_date).toLocaleDateString('ko-KR')
                                                : '-'
                                            }
                                        </td>
                                        {editMode && (
                                            <td>
                                                <button
                                                    onClick={() => handleDelete(item.id, item.product_name)}
                                                    className="btn btn-danger btn-sm"
                                                >
                                                    🗑️ 삭제
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="summary">
                        총 {lendingItems.length}개 항목
                    </div>
                </div>
            )}
        </div>
    );
}

export default LendingPage;
