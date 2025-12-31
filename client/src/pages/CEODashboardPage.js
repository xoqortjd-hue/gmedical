import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/main.css';

function CEODashboardPage() {
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [hospitalSummary, setHospitalSummary] = useState(null);
    const [allHospitalsSummary, setAllHospitalsSummary] = useState(null);
    const [lendingItems, setLendingItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('SINGLE');
    const [equipmentSummary, setEquipmentSummary] = useState(null);
    const [biologicSummary, setBiologicSummary] = useState(null);
    const [consumableSummary, setConsumableSummary] = useState(null);

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;


    useEffect(() => {
        fetchHospitals();
        fetchAllHospitalsSummary();
        fetchEquipmentSummary();
        fetchBiologicSummary();
        fetchConsumableSummary();
    }, []);

    useEffect(() => {
        if (selectedHospital) {
            fetchHospitalData();
        }
    }, [selectedHospital, selectedCategory]);

    const fetchHospitals = async () => {
        try {
            const res = await axios.get('/api/hospitals');
            setHospitals(res.data);
            if (res.data.length > 0) {
                setSelectedHospital(res.data[0].id);
            }
        } catch (error) {
            console.error('병원 목록 조회 실패:', error);
        }
    };

    const fetchAllHospitalsSummary = async () => {
        try {
            const res = await axios.get('/api/lending/all-hospitals-summary');
            setAllHospitalsSummary(res.data);
        } catch (error) {
            console.error('전체 병원 요약 조회 실패:', error);
        }
    };

    const fetchEquipmentSummary = async () => {
        try {
            const res = await axios.get('/api/lending/product-summary', {
                params: { category: 'EQUIPMENT' }
            });
            setEquipmentSummary(res.data);
        } catch (error) {
            console.error('장비별 요약 조회 실패:', error);
        }
    };

    const fetchBiologicSummary = async () => {
        try {
            const res = await axios.get('/api/lending/product-summary', {
                params: { category: 'BIOLOGIC' }
            });
            setBiologicSummary(res.data);
        } catch (error) {
            console.error('바이오로직별 요약 조회 실패:', error);
        }
    };

    const fetchConsumableSummary = async () => {
        try {
            const res = await axios.get('/api/lending/product-summary', {
                params: { category: 'CONSUMABLE' }
            });
            setConsumableSummary(res.data);
        } catch (error) {
            console.error('소모성 기구별 요약 조회 실패:', error);
        }
    };

    const fetchHospitalData = async () => {
        try {
            setLoading(true);
            const summaryRes = await axios.get('/api/lending/summary', {
                params: { hospital_id: selectedHospital }
            });
            if (summaryRes.data.length > 0) {
                setHospitalSummary(summaryRes.data[0]);
            } else {
                setHospitalSummary({ equipment_count: 0, biologic_count: 0, consumable_count: 0, total_count: 0 });
            }
            const itemsParams = { hospital_id: selectedHospital };
            if (selectedCategory !== 'ALL') {
                itemsParams.category = selectedCategory;
            }
            const itemsRes = await axios.get('/api/lending/items', { params: itemsParams });

            // 최신 배치일 순으로 정렬 (가장 최근이 맨 위)
            const sortedItems = itemsRes.data.sort((a, b) => {
                const dateA = new Date(a.deploy_date || 0);
                const dateB = new Date(b.deploy_date || 0);
                return dateB - dateA;
            });

            setLendingItems(sortedItems);
            setCurrentPage(1); // 필터 변경 시 첫 페이지로
            setLoading(false);
        } catch (error) {
            console.error('병원 데이터 조회 실패:', error);
            setLoading(false);
        }
    };

    const getCategoryIcon = (category) => {
        const icons = { 'EQUIPMENT': '🔧', 'BIOLOGIC': '💉', 'CONSUMABLE': '🔩' };
        return icons[category] || '📦';
    };

    const getCategoryName = (category) => {
        const names = { 'EQUIPMENT': '장비/기구', 'BIOLOGIC': '바이오로직', 'CONSUMABLE': '소모성 기구' };
        return names[category] || category;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
    };

    const getSelectedHospitalName = () => {
        const hospital = hospitals.find(h => h.id == selectedHospital);
        return hospital ? hospital.name : '';
    };

    // 유효기간 상태 라벨 (새 기준)
    const getExpiryStatusLabel = (daysUntilExpiry) => {
        if (daysUntilExpiry === null || daysUntilExpiry === undefined) return { label: '-', color: '#888', bg: '#333' };
        if (daysUntilExpiry <= 0) return { label: '⛔ 만료', color: '#fff', bg: '#dc3545' };
        if (daysUntilExpiry < 180) return { label: '🔴 긴급', color: '#fff', bg: '#dc3545' };
        if (daysUntilExpiry <= 365) return { label: '🔴 긴급', color: '#fff', bg: '#dc3545' };
        if (daysUntilExpiry <= 450) return { label: '🟠 교환필요', color: '#fff', bg: '#fd7e14' };
        if (daysUntilExpiry <= 540) return { label: '🟡 교환검토', color: '#333', bg: '#ffc107' };
        if (daysUntilExpiry <= 720) return { label: '🟢 안전', color: '#fff', bg: '#28a745' };
        return { label: '🔵 여유', color: '#fff', bg: '#17a2b8' };
    };

    // 제품별 현황 렌더링 (장비별/바이오로직별 공통)
    const renderProductSummary = (data, categoryIcon, categoryLabel, color) => {
        if (!data || !data.summary) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>데이터 로딩 중...</div>;
        return (
            <>
                <div className="card" style={{ marginBottom: '1.5rem', background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
                    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                            {categoryIcon} {data.summary.total_deployed || 0}개
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.9)' }}>
                            전체 {categoryLabel} 배치 현황
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">📦 {categoryLabel}별 보유 현황</h2>
                    </div>
                    {data.products.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                            배치된 {categoryLabel} 항목이 없습니다
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>제품명</th>
                                        <th>총 수량</th>
                                        <th>병원별 분포</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.products.map(product => (
                                        <tr key={product.product_id}>
                                            <td><strong>{categoryIcon} {product.product_name}</strong></td>
                                            <td style={{ color: color, fontWeight: 'bold' }}>{product.total_count}개</td>
                                            <td style={{ fontSize: '0.9rem' }}>
                                                {product.hospitals.map((h, idx) => (
                                                    <span key={h.hospital_id}>
                                                        {h.hospital_name}: {h.quantity}개
                                                        {idx < product.hospitals.length - 1 ? ' | ' : ''}
                                                    </span>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <h1>📊 CEO 배치 현황 대시보드</h1>
                <p>병원별 장비/기구/바이오로직 배치 현황을 실시간으로 확인합니다</p>
            </div>

            {/* 뷰 모드 전환 */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setViewMode('ALL')} className={`btn ${viewMode === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}>
                        🌐 전체비교
                    </button>
                    <button onClick={() => setViewMode('SINGLE')} className={`btn ${viewMode === 'SINGLE' ? 'btn-primary' : 'btn-secondary'}`}>
                        🏥 병원별
                    </button>
                    <button onClick={() => setViewMode('EQUIPMENT')} className={`btn ${viewMode === 'EQUIPMENT' ? 'btn-warning' : 'btn-secondary'}`}>
                        🔧 장비별
                    </button>
                    <button onClick={() => setViewMode('CONSUMABLE')} className={`btn ${viewMode === 'CONSUMABLE' ? 'btn-info' : 'btn-secondary'}`}>
                        🔩 소모성별
                    </button>
                    <button onClick={() => setViewMode('BIOLOGIC')} className={`btn ${viewMode === 'BIOLOGIC' ? 'btn-danger' : 'btn-secondary'}`}>
                        💉 바이오별
                    </button>
                </div>
            </div>

            {/* 병원별 상세 뷰 */}
            {viewMode === 'SINGLE' && (
                <>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header"><h2 className="card-title">📍 배치 현황</h2></div>
                        <div style={{ padding: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span>▼ 병원 선택:</span>
                                <select value={selectedHospital} onChange={(e) => setSelectedHospital(e.target.value)} className="filter-select" style={{ flex: 1, maxWidth: '300px', padding: '0.75rem', fontSize: '1rem' }}>
                                    {hospitals.map(hospital => (
                                        <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                    {hospitalSummary && (
                        <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: '#2d2d44' }}>
                            <div className="card-header"><h2 className="card-title">📊 {getSelectedHospitalName()} 현황 요약</h2></div>
                            <div style={{ padding: '1rem' }}>
                                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                    <div className="stat-card" onClick={() => setSelectedCategory('EQUIPMENT')} style={{ cursor: 'pointer', border: selectedCategory === 'EQUIPMENT' ? '2px solid #4a9eff' : 'none' }}>
                                        <div className="stat-value" style={{ color: '#ffcc66' }}>🔧 {hospitalSummary.equipment_count || 0}개</div>
                                        <div className="stat-label">장비/기구</div>
                                    </div>
                                    <div className="stat-card" onClick={() => setSelectedCategory('CONSUMABLE')} style={{ cursor: 'pointer', border: selectedCategory === 'CONSUMABLE' ? '2px solid #4a9eff' : 'none' }}>
                                        <div className="stat-value" style={{ color: '#66ccff' }}>🔩 {hospitalSummary.consumable_count || 0}개</div>
                                        <div className="stat-label">소모성 기구</div>
                                    </div>
                                    <div className="stat-card" onClick={() => setSelectedCategory('BIOLOGIC')} style={{ cursor: 'pointer', border: selectedCategory === 'BIOLOGIC' ? '2px solid #4a9eff' : 'none' }}>
                                        <div className="stat-value" style={{ color: '#ff99cc' }}>💉 {hospitalSummary.biologic_count || 0}개</div>
                                        <div className="stat-label">바이오로직</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', flexWrap: 'wrap' }}>
                            <button onClick={() => setSelectedCategory('ALL')} className={`btn ${selectedCategory === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}>📦 전체</button>
                            <button onClick={() => setSelectedCategory('EQUIPMENT')} className={`btn ${selectedCategory === 'EQUIPMENT' ? 'btn-warning' : 'btn-secondary'}`}>🔧 장비/기구</button>
                            <button onClick={() => setSelectedCategory('CONSUMABLE')} className={`btn ${selectedCategory === 'CONSUMABLE' ? 'btn-info' : 'btn-secondary'}`}>🔩 소모성 기구</button>
                            <button onClick={() => setSelectedCategory('BIOLOGIC')} className={`btn ${selectedCategory === 'BIOLOGIC' ? 'btn-danger' : 'btn-secondary'}`}>💉 바이오로직</button>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="card-title">📋 상세 목록</h2>
                            <span style={{ color: '#888', fontSize: '0.9rem' }}>
                                총 {lendingItems.length}개 항목 (페이지 {currentPage}/{Math.ceil(lendingItems.length / ITEMS_PER_PAGE) || 1})
                            </span>
                        </div>
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner"></div></div>
                        ) : (
                            <>
                                <div className="table-container">
                                    {lendingItems.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>배치된 항목이 없습니다</div>
                                    ) : (
                                        <table className="table">
                                            <thead><tr><th>제품명</th><th>카테고리</th><th>창구</th><th>매입가</th><th>판매가</th><th>유효기간</th><th>배치일</th><th>수량</th><th>상태</th></tr></thead>
                                            <tbody>
                                                {lendingItems
                                                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                                    .map(item => (
                                                        <tr key={item.id}>
                                                            <td>{getCategoryIcon(item.category)} {item.product_name}</td>
                                                            <td><span className="badge">{getCategoryName(item.category)}</span></td>
                                                            <td>{item.channel_name || '-'}</td>
                                                            <td style={{ color: '#ffcc66' }}>{item.purchase_price ? `₩${item.purchase_price.toLocaleString()}` : '-'}</td>
                                                            <td style={{ color: '#66ff99', fontWeight: 'bold' }}>{item.selling_price ? `₩${item.selling_price.toLocaleString()}` : '-'}</td>
                                                            <td>{item.expiration_date ? formatDate(item.expiration_date) : '-'}</td>
                                                            <td>📅 {formatDate(item.deploy_date)}</td>
                                                            <td>{item.quantity}</td>
                                                            <td>
                                                                {(() => {
                                                                    const status = getExpiryStatusLabel(item.days_until_expiry);
                                                                    return <span className="badge" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</span>;
                                                                })()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                {/* 페이지네이션 */}
                                {lendingItems.length > ITEMS_PER_PAGE && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #333' }}>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            style={{ padding: '0.5rem 0.75rem' }}
                                        >«</button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            style={{ padding: '0.5rem 0.75rem' }}
                                        >‹</button>
                                        <span style={{ padding: '0 1rem', color: '#fff' }}>
                                            {currentPage} / {Math.ceil(lendingItems.length / ITEMS_PER_PAGE)}
                                        </span>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(lendingItems.length / ITEMS_PER_PAGE), p + 1))}
                                            disabled={currentPage >= Math.ceil(lendingItems.length / ITEMS_PER_PAGE)}
                                            style={{ padding: '0.5rem 0.75rem' }}
                                        >›</button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setCurrentPage(Math.ceil(lendingItems.length / ITEMS_PER_PAGE))}
                                            disabled={currentPage >= Math.ceil(lendingItems.length / ITEMS_PER_PAGE)}
                                            style={{ padding: '0.5rem 0.75rem' }}
                                        >»</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {/* 전체 병원 비교 뷰 */}
            {viewMode === 'ALL' && allHospitalsSummary && (
                <>
                    <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #1a1a2e, #2d2d44)' }}>
                        <div className="card-header"><h2 className="card-title">🌐 전체 배치 현황</h2></div>
                        <div style={{ padding: '1rem' }}>
                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                                <div className="stat-card"><div className="stat-value" style={{ color: '#4a9eff' }}>{allHospitalsSummary.summary.total_hospitals || 0}</div><div className="stat-label">운영 병원</div></div>
                                <div className="stat-card"><div className="stat-value">{allHospitalsSummary.summary.total_items || 0}</div><div className="stat-label">총 배치 수</div></div>
                                <div className="stat-card"><div className="stat-value" style={{ color: '#ffcc66' }}>{allHospitalsSummary.summary.equipment_count || 0}</div><div className="stat-label">🔧 장비/기구</div></div>
                                <div className="stat-card"><div className="stat-value" style={{ color: '#ff99cc' }}>{allHospitalsSummary.summary.biologic_count || 0}</div><div className="stat-label">💉 바이오로직</div></div>
                                <div className="stat-card danger"><div className="stat-value">{allHospitalsSummary.summary.expiring_soon_count || 0}</div><div className="stat-label">⚠️ 만료임박</div></div>
                            </div>
                        </div>
                    </div>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header"><h2 className="card-title">🏥 병원별 비교</h2></div>
                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>병원명</th><th>🔧 장비/기구</th><th>💉 바이오로직</th><th>🔩 소모성 기구</th><th>총계</th><th>⚠️ 만료임박</th></tr></thead>
                                <tbody>
                                    {allHospitalsSummary.hospitals.map(hospital => (
                                        <tr key={hospital.hospital_id} onClick={() => { setSelectedHospital(hospital.hospital_id); setViewMode('SINGLE'); }} style={{ cursor: 'pointer' }}>
                                            <td><strong>{hospital.hospital_name}</strong></td>
                                            <td style={{ color: '#ffcc66' }}>{hospital.equipment_count || 0}</td>
                                            <td style={{ color: '#ff99cc' }}>{hospital.biologic_count || 0}</td>
                                            <td style={{ color: '#66ccff' }}>{hospital.consumable_count || 0}</td>
                                            <td><strong>{hospital.total_items || 0}</strong></td>
                                            <td>{hospital.expiring_soon_count > 0 ? <span className="badge badge-warning">{hospital.expiring_soon_count}</span> : <span className="badge badge-success">0</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><h2 className="card-title">📋 최근 배치 현황 (최근 10건)</h2></div>
                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>제품명</th><th>카테고리</th><th>병원</th><th>배치일</th><th>수량</th></tr></thead>
                                <tbody>
                                    {allHospitalsSummary.recent_items.map(item => (
                                        <tr key={item.id}>
                                            <td>{getCategoryIcon(item.category)} {item.product_name}</td>
                                            <td>{getCategoryName(item.category)}</td>
                                            <td>{item.hospital_name}</td>
                                            <td>📅 {formatDate(item.deploy_date)}</td>
                                            <td>{item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* 장비별 현황 뷰 */}
            {viewMode === 'EQUIPMENT' && renderProductSummary(equipmentSummary, '🔧', '장비/기구', '#ffcc66')}

            {/* 소모성 기구별 현황 뷰 */}
            {viewMode === 'CONSUMABLE' && renderProductSummary(consumableSummary, '🔩', '소모성 기구', '#66ccff')}

            {/* 바이오로직별 현황 뷰 */}
            {viewMode === 'BIOLOGIC' && renderProductSummary(biologicSummary, '💉', '바이오로직', '#ff99cc')}
        </div>
    );
}

export default CEODashboardPage;
