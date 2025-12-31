import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/main.css';

function MobileCEODashboardPage() {
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [hospitalSummary, setHospitalSummary] = useState(null);
    const [allHospitalsSummary, setAllHospitalsSummary] = useState(null);
    const [lendingItems, setLendingItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('EQUIPMENT');
    const [equipmentSummary, setEquipmentSummary] = useState(null);
    const [biologicSummary, setBiologicSummary] = useState(null);
    // 장비별/바이오별 카테고리 드릴다운 상태
    const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState(null);
    const [selectedBiologicCategory, setSelectedBiologicCategory] = useState(null);

    useEffect(() => {
        fetchHospitals();
        fetchAllHospitalsSummary();
        fetchEquipmentSummary();
        fetchBiologicSummary();
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
            // 최신 배치순으로 정렬 (deploy_date 내림차순)
            const sortedItems = itemsRes.data.sort((a, b) => {
                const dateA = new Date(a.deploy_date || 0);
                const dateB = new Date(b.deploy_date || 0);
                return dateB - dateA;
            });
            setLendingItems(sortedItems);
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

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
    };

    const getSelectedHospitalName = () => {
        const hospital = hospitals.find(h => h.id == selectedHospital);
        return hospital ? hospital.name : '';
    };

    const mobileStyles = {
        container: { padding: '1rem', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' },
        header: { textAlign: 'center', marginBottom: '1.5rem', color: '#fff' },
        title: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' },
        viewToggle: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' },
        toggleBtn: (active) => ({ padding: '0.75rem', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', background: active ? '#4a9eff' : '#2d2d44', color: '#fff' }),
        toggleBtnWarning: (active) => ({ padding: '0.75rem', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', background: active ? '#ffcc66' : '#2d2d44', color: active ? '#000' : '#fff' }),
        toggleBtnDanger: (active) => ({ padding: '0.75rem', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', background: active ? '#ff99cc' : '#2d2d44', color: active ? '#000' : '#fff' }),
        card: { background: '#2d2d44', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' },
        cardTitle: { fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
        select: { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #4a4a6a', background: '#1a1a2e', color: '#fff', fontSize: '1rem' },
        summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' },
        summaryCard: (color) => ({ background: '#1a1a2e', borderRadius: '8px', padding: '0.75rem', textAlign: 'center', borderLeft: `3px solid ${color}` }),
        summaryValue: (color) => ({ fontSize: '1.5rem', fontWeight: 'bold', color: color }),
        summaryLabel: { fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' },
        itemCard: { background: '#1a1a2e', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem' },
        itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
        itemName: { fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' },
        itemInfo: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' },
        hospitalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#1a1a2e', borderRadius: '8px', marginBottom: '0.5rem' },
        hospitalName: { fontWeight: 'bold', color: '#fff' },
        hospitalStats: { display: 'flex', gap: '0.5rem', fontSize: '0.8rem' },
        totalCard: (color) => ({ background: `linear-gradient(135deg, ${color}, ${color}99)`, borderRadius: '12px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }),
        totalValue: { fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' },
        totalLabel: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' },
        productRow: { background: '#1a1a2e', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem' },
        productName: { fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' },
        productHospitals: { fontSize: '0.8rem', color: '#888' }
    };

    // 제품명에서 카테고리 추출 (# 앞부분)
    const extractCategoryFromName = (productName) => {
        if (!productName) return 'Unknown';
        // # 앞부분 추출 (없으면 전체 이름 사용)
        const match = productName.match(/^([^#]+)/);
        return match ? match[1].trim() : productName;
    };

    // 제품 목록을 카테고리별로 그룹화
    const groupProductsByCategory = (products) => {
        const groups = {};
        products.forEach(product => {
            const category = extractCategoryFromName(product.product_name);
            if (!groups[category]) {
                groups[category] = { count: 0, items: [] };
            }
            groups[category].count += product.total_count;
            groups[category].items.push(product);
        });
        return groups;
    };

    // 카테고리 카드 스타일
    const categoryCardStyle = {
        background: 'linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)',
        borderRadius: '12px',
        padding: '1.25rem',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        border: '1px solid #4a4a6a'
    };

    // 제품별 현황 렌더링 (장비별/바이오로직별 공통) - 2단계 계층 구조
    const renderProductSummary = (data, categoryIcon, categoryLabel, color, selectedCat, setSelectedCat) => {
        if (!data || !data.summary) {
            return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>데이터 로딩 중...</div>;
        }

        const groupedProducts = groupProductsByCategory(data.products);
        const categoryKeys = Object.keys(groupedProducts).sort();

        // 2단계: 특정 카테고리 선택됨 - 개별 장비 목록 표시
        if (selectedCat) {
            const categoryData = groupedProducts[selectedCat];
            if (!categoryData) {
                setSelectedCat(null);
                return null;
            }

            return (
                <>
                    {/* 뒤로가기 버튼 */}
                    <button
                        onClick={() => setSelectedCat(null)}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            background: '#2d2d44',
                            border: '1px solid #4a4a6a',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        ← 카테고리 목록으로
                    </button>

                    {/* 선택된 카테고리 헤더 */}
                    <div style={mobileStyles.totalCard(color)}>
                        <div style={mobileStyles.totalValue}>{categoryIcon} {selectedCat}</div>
                        <div style={mobileStyles.totalLabel}>총 {categoryData.count}대 보유</div>
                    </div>

                    {/* 개별 장비 목록 */}
                    <div style={mobileStyles.card}>
                        <div style={mobileStyles.cardTitle}>📋 {selectedCat} 장비 상세</div>
                        {categoryData.items.map(product => (
                            <div key={product.product_id} style={{
                                ...mobileStyles.productRow,
                                borderLeft: `3px solid ${color}`,
                                marginBottom: '0.75rem'
                            }}>
                                <div style={mobileStyles.productName}>{categoryIcon} {product.product_name}</div>

                                {/* 개별 아이템 상세 정보 (배치일자, 담당자, 위치) */}
                                {product.items && product.items.length > 0 ? (
                                    <div style={{ marginTop: '0.75rem' }}>
                                        {product.items.map((item, idx) => (
                                            <div key={item.item_id || idx} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '0.5rem',
                                                background: '#1a1a2e',
                                                borderRadius: '6px',
                                                marginTop: idx > 0 ? '0.5rem' : 0,
                                                fontSize: '0.85rem'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <span style={{ color: '#fff', fontWeight: 'bold' }}>
                                                        📍 {item.hospital_name || '미배치'}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '0.75rem', color: '#888' }}>
                                                        <span>📅 {item.deploy_date ? formatDate(item.deploy_date) : '-'}</span>
                                                        <span>👤 {item.deployed_by || '영업팀'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                        <span style={{ color: color, fontWeight: 'bold', fontSize: '1.1rem' }}>{product.total_count}대</span>
                                        <span style={mobileStyles.productHospitals}>
                                            {product.hospitals.map((h, idx) => (
                                                <span key={h.hospital_id} style={{
                                                    background: '#1a1a2e',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '4px',
                                                    marginLeft: idx > 0 ? '0.25rem' : 0
                                                }}>
                                                    {h.hospital_name}
                                                </span>
                                            ))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            );
        }

        // 1단계: 카테고리 카드 목록 표시
        return (
            <>
                <div style={mobileStyles.totalCard(color)}>
                    <div style={mobileStyles.totalValue}>{categoryIcon} {data.summary.total_deployed || 0}개</div>
                    <div style={mobileStyles.totalLabel}>전체 {categoryLabel} 배치 현황</div>
                </div>
                <div style={mobileStyles.card}>
                    <div style={mobileStyles.cardTitle}>📦 {categoryLabel} 카테고리별 현황</div>
                    {categoryKeys.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>배치된 {categoryLabel} 항목이 없습니다</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                            {categoryKeys.map(catName => {
                                const catData = groupedProducts[catName];
                                return (
                                    <div
                                        key={catName}
                                        onClick={() => setSelectedCat(catName)}
                                        style={categoryCardStyle}
                                    >
                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{categoryIcon}</div>
                                        <div style={{
                                            fontSize: '1rem',
                                            fontWeight: 'bold',
                                            color: '#fff',
                                            marginBottom: '0.25rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {catName}
                                        </div>
                                        <div style={{
                                            fontSize: '1.5rem',
                                            fontWeight: 'bold',
                                            color: color
                                        }}>
                                            {catData.count}대
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </>
        );
    };

    return (
        <div style={mobileStyles.container}>
            <div style={mobileStyles.header}>
                <div style={mobileStyles.title}>📊 CEO 대시보드</div>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>배치 현황 실시간 모니터링</div>
            </div>

            {/* 뷰 모드 전환 - 2x2 그리드 */}
            <div style={mobileStyles.viewToggle}>
                <button style={mobileStyles.toggleBtn(viewMode === 'SINGLE')} onClick={() => { setViewMode('SINGLE'); setSelectedEquipmentCategory(null); setSelectedBiologicCategory(null); }}>🏥 병원별</button>
                <button style={mobileStyles.toggleBtn(viewMode === 'ALL')} onClick={() => { setViewMode('ALL'); setSelectedEquipmentCategory(null); setSelectedBiologicCategory(null); }}>🌐 전체비교</button>
                <button style={mobileStyles.toggleBtnWarning(viewMode === 'EQUIPMENT')} onClick={() => { setViewMode('EQUIPMENT'); setSelectedEquipmentCategory(null); setSelectedBiologicCategory(null); }}>🔧 장비별</button>
                <button style={mobileStyles.toggleBtnDanger(viewMode === 'BIOLOGIC')} onClick={() => { setViewMode('BIOLOGIC'); setSelectedEquipmentCategory(null); setSelectedBiologicCategory(null); }}>💉 바이오별</button>
            </div>

            {/* 병원별 상세 뷰 */}
            {viewMode === 'SINGLE' && (
                <>
                    <div style={mobileStyles.card}>
                        <div style={mobileStyles.cardTitle}>📍 배치 현황</div>
                        <select value={selectedHospital} onChange={(e) => setSelectedHospital(e.target.value)} style={mobileStyles.select}>
                            {hospitals.map(hospital => (<option key={hospital.id} value={hospital.id}>{hospital.name}</option>))}
                        </select>
                    </div>
                    {hospitalSummary && (
                        <div style={mobileStyles.card}>
                            <div style={mobileStyles.cardTitle}>📊 {getSelectedHospitalName()} 현황</div>
                            <div style={mobileStyles.summaryGrid}>
                                <div style={mobileStyles.summaryCard('#ffcc66')} onClick={() => setSelectedCategory('EQUIPMENT')}>
                                    <div style={mobileStyles.summaryValue('#ffcc66')}>{hospitalSummary.equipment_count || 0}</div>
                                    <div style={mobileStyles.summaryLabel}>🔧 장비</div>
                                </div>
                                <div style={mobileStyles.summaryCard('#66ccff')} onClick={() => setSelectedCategory('CONSUMABLE')}>
                                    <div style={mobileStyles.summaryValue('#66ccff')}>{hospitalSummary.consumable_count || 0}</div>
                                    <div style={mobileStyles.summaryLabel}>🔩 소모성</div>
                                </div>
                                <div style={mobileStyles.summaryCard('#ff99cc')} onClick={() => setSelectedCategory('BIOLOGIC')}>
                                    <div style={mobileStyles.summaryValue('#ff99cc')}>{hospitalSummary.biologic_count || 0}</div>
                                    <div style={mobileStyles.summaryLabel}>💉 바이오</div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div style={mobileStyles.card}>
                        <div style={mobileStyles.cardTitle}>📋 상세 목록 ({lendingItems.length}개)</div>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>로딩 중...</div>
                        ) : lendingItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>배치 항목 없음</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #444', color: '#888' }}>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'left' }}>제품명</th>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>매입가</th>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>판매가</th>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>유효기간</th>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>수량</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lendingItems.map(item => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid #333', color: '#fff' }}>
                                                <td style={{ padding: '0.5rem 0.25rem' }}>{getCategoryIcon(item.category)} {item.product_name}</td>
                                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#ffcc66' }}>{item.purchase_price ? `₩${item.purchase_price.toLocaleString()}` : '-'}</td>
                                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#66ff99', fontWeight: 'bold' }}>{item.selling_price ? `₩${item.selling_price.toLocaleString()}` : '-'}</td>
                                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>{item.expiration_date ? formatDate(item.expiration_date) : '-'}</td>
                                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>{item.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 전체 병원 비교 뷰 */}
            {viewMode === 'ALL' && allHospitalsSummary && (
                <>
                    <div style={mobileStyles.totalCard('#4a9eff')}>
                        <div style={mobileStyles.totalValue}>{allHospitalsSummary.summary.total_items || 0}</div>
                        <div style={mobileStyles.totalLabel}>총 배치 현황 ({allHospitalsSummary.summary.total_hospitals || 0}개 병원)</div>
                    </div>
                    <div style={mobileStyles.card}>
                        <div style={mobileStyles.summaryGrid}>
                            <div style={mobileStyles.summaryCard('#ffcc66')}>
                                <div style={mobileStyles.summaryValue('#ffcc66')}>{allHospitalsSummary.summary.equipment_count || 0}</div>
                                <div style={mobileStyles.summaryLabel}>🔧 장비</div>
                            </div>
                            <div style={mobileStyles.summaryCard('#ff99cc')}>
                                <div style={mobileStyles.summaryValue('#ff99cc')}>{allHospitalsSummary.summary.biologic_count || 0}</div>
                                <div style={mobileStyles.summaryLabel}>💉 바이오</div>
                            </div>
                            <div style={mobileStyles.summaryCard('#ff6b6b')}>
                                <div style={mobileStyles.summaryValue('#ff6b6b')}>{allHospitalsSummary.summary.expiring_soon_count || 0}</div>
                                <div style={mobileStyles.summaryLabel}>⚠️ 만료임박</div>
                            </div>
                        </div>
                    </div>
                    <div style={mobileStyles.card}>
                        <div style={mobileStyles.cardTitle}>🏥 병원별 현황</div>
                        {allHospitalsSummary.hospitals.map(hospital => (
                            <div key={hospital.hospital_id} style={mobileStyles.hospitalRow} onClick={() => { setSelectedHospital(hospital.hospital_id); setViewMode('SINGLE'); }}>
                                <span style={mobileStyles.hospitalName}>{hospital.hospital_name}</span>
                                <div style={mobileStyles.hospitalStats}>
                                    <span style={{ color: '#ffcc66' }}>🔧{hospital.equipment_count || 0}</span>
                                    <span style={{ color: '#66ccff' }}>🔩{hospital.consumable_count || 0}</span>
                                    <span style={{ color: '#ff99cc' }}>💉{hospital.biologic_count || 0}</span>
                                    <span style={{ fontWeight: 'bold' }}>{hospital.total_items}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* 장비별 현황 뷰 */}
            {viewMode === 'EQUIPMENT' && renderProductSummary(equipmentSummary, '🔧', '장비/기구', '#ffcc66', selectedEquipmentCategory, setSelectedEquipmentCategory)}

            {/* 바이오로직별 현황 뷰 */}
            {viewMode === 'BIOLOGIC' && renderProductSummary(biologicSummary, '💉', '바이오로직', '#ff99cc', selectedBiologicCategory, setSelectedBiologicCategory)}
        </div>
    );
}

export default MobileCEODashboardPage;
