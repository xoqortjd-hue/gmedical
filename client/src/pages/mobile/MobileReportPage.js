import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/mobile.css';

function MobileReportPage() {
    const [period, setPeriod] = useState('weekly');
    const [transactionData, setTransactionData] = useState(null);
    const [equipmentData, setEquipmentData] = useState(null);
    const [salesStatusData, setSalesStatusData] = useState(null);
    const [loading, setLoading] = useState(true);

    // 제외할 병원 ID 목록
    const [excludedHospitals, setExcludedHospitals] = useState(() => {
        const saved = localStorage.getItem('mobileReportExcludedHospitals');
        return saved ? JSON.parse(saved) : [];
    });
    const [hospitalFilterEnabled, setHospitalFilterEnabled] = useState(true);

    // 제외할 장비 ID 목록
    const [excludedEquipments, setExcludedEquipments] = useState(() => {
        const saved = localStorage.getItem('mobileReportExcludedEquipments');
        return saved ? JSON.parse(saved) : [];
    });
    const [equipmentFilterEnabled, setEquipmentFilterEnabled] = useState(true);

    useEffect(() => {
        fetchReportData();
    }, [period]);

    // 제외 설정 로컬스토리지 저장
    useEffect(() => {
        localStorage.setItem('mobileReportExcludedHospitals', JSON.stringify(excludedHospitals));
    }, [excludedHospitals]);

    useEffect(() => {
        localStorage.setItem('mobileReportExcludedEquipments', JSON.stringify(excludedEquipments));
    }, [excludedEquipments]);

    // 병원 토글/선택/해제 함수
    const toggleHospitalExclusion = (hospitalId) => {
        setExcludedHospitals(prev =>
            prev.includes(hospitalId) ? prev.filter(id => id !== hospitalId) : [...prev, hospitalId]
        );
    };
    const selectAllHospitals = () => setExcludedHospitals([]);
    const deselectAllHospitals = () => {
        if (transactionData?.hospitals) {
            setExcludedHospitals(transactionData.hospitals.map(h => h.hospital_id));
        }
    };

    // 장비 토글/선택/해제 함수
    const toggleEquipmentExclusion = (equipmentId) => {
        setExcludedEquipments(prev =>
            prev.includes(equipmentId) ? prev.filter(id => id !== equipmentId) : [...prev, equipmentId]
        );
    };
    const selectAllEquipments = () => setExcludedEquipments([]);
    const deselectAllEquipments = () => {
        if (equipmentData?.items) {
            setExcludedEquipments(equipmentData.items.map(e => e.lending_item_id));
        }
    };

    // 필터링된 목록
    const getFilteredHospitals = () => {
        if (!transactionData?.hospitals) return [];
        if (!hospitalFilterEnabled) return transactionData.hospitals;
        return transactionData.hospitals.filter(h => !excludedHospitals.includes(h.hospital_id));
    };
    const getFilteredEquipments = () => {
        if (!equipmentData?.items) return [];
        if (!equipmentFilterEnabled) return equipmentData.items;
        return equipmentData.items.filter(e => !excludedEquipments.includes(e.lending_item_id));
    };
    const getFilteredHospitalTotals = () => {
        const filtered = getFilteredHospitals();
        return {
            hospital_count: filtered.length,
            total_surgeries: filtered.reduce((sum, h) => sum + (h.surgery_count || 0), 0)
        };
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const [transRes, equipRes, salesRes] = await Promise.all([
                axios.get(`/api/lending/report/transaction-summary?period=${period}`),
                axios.get('/api/lending/report/equipment-status?category=EQUIPMENT'),
                axios.get('/api/lending/report/sales-status')
            ]);
            setTransactionData(transRes.data);
            setEquipmentData(equipRes.data);
            setSalesStatusData(salesRes.data);
        } catch (error) {
            console.error('리포트 데이터 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // 날짜 포맷 (MM-DD)
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${month}-${day}`;
        } catch {
            return '-';
        }
    };

    // 전체 날짜 포맷 (YYYY-MM-DD)
    const formatFullDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ko-KR');
        } catch {
            return '-';
        }
    };

    // 이동 경로는 API에서 movement_path로 제공됨 (날짜 포함)

    return (
        <div className="mobile-container report-page">
            {/* 헤더 (인쇄 시 숨김) */}
            <div className="mobile-header no-print">
                <h1>📊 리포트</h1>
                <button
                    onClick={handlePrint}
                    className="print-btn"
                    title="인쇄하기"
                >
                    🖨️ 인쇄
                </button>
            </div>

            {/* 인쇄용 헤더 */}
            <div className="print-header print-only">
                <h1>금양메디칼 - 장비 관리 보고서</h1>
                <p>출력일: {new Date().toLocaleDateString('ko-KR')}</p>
            </div>

            {/* 기간 선택 탭 */}
            <div className="period-tabs no-print">
                <button
                    className={`tab-btn ${period === 'weekly' ? 'active' : ''}`}
                    onClick={() => setPeriod('weekly')}
                >
                    📅 주간 (7일)
                </button>
                <button
                    className={`tab-btn ${period === 'monthly' ? 'active' : ''}`}
                    onClick={() => setPeriod('monthly')}
                >
                    📅 월간 (30일)
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>데이터 로딩 중...</p>
                </div>
            ) : (
                <>
                    {/* 거래 이력 섹션 (수술 건수) */}
                    <section className="report-section">
                        <div className="section-header">
                            <h2>🏥 병원별 수술 건수</h2>
                            {transactionData && (
                                <span className="period-label">
                                    {formatFullDate(transactionData.start_date)} ~ {formatFullDate(transactionData.end_date)}
                                </span>
                            )}
                        </div>

                        {/* 병원 필터 컨트롤 */}
                        {transactionData && transactionData.hospitals.length > 0 && (
                            <div className="no-print" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                marginBottom: '0.5rem',
                                flexWrap: 'wrap',
                                fontSize: '0.85rem'
                            }}>
                                <button onClick={selectAllHospitals} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white' }}>전체선택</button>
                                <button onClick={deselectAllHospitals} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white' }}>전체해제</button>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto', fontSize: '0.75rem' }}>
                                    <input type="checkbox" checked={hospitalFilterEnabled} onChange={(e) => setHospitalFilterEnabled(e.target.checked)} />
                                    필터적용
                                </label>
                                {excludedHospitals.length > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: '#ef4444', background: '#fef2f2', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        {excludedHospitals.length}개 제외
                                    </span>
                                )}
                            </div>
                        )}

                        {transactionData && transactionData.hospitals.length > 0 ? (
                            <div className="report-table-container">
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th className="no-print" style={{ width: '40px' }}>선택</th>
                                            <th>병원명</th>
                                            <th>수술 건수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactionData.hospitals.map(hospital => {
                                            const isExcluded = excludedHospitals.includes(hospital.hospital_id);
                                            if (hospitalFilterEnabled && isExcluded) return null;
                                            return (
                                                <tr key={hospital.hospital_id} style={isExcluded ? { opacity: 0.5 } : {}}>
                                                    <td className="no-print" style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!isExcluded}
                                                            onChange={() => toggleHospitalExclusion(hospital.hospital_id)}
                                                            style={{ width: '16px', height: '16px' }}
                                                        />
                                                    </td>
                                                    <td className="hospital-name">{hospital.hospital_name}</td>
                                                    <td className="count total">{hospital.surgery_count || 0}건</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="totals-row">
                                            <td className="no-print"></td>
                                            <td><strong>합계 ({getFilteredHospitalTotals().hospital_count}개 병원)</strong></td>
                                            <td className="count total"><strong>{getFilteredHospitalTotals().total_surgeries}건</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>해당 기간에 수술 이력이 없습니다.</p>
                            </div>
                        )}
                    </section>

                    {/* 장비 입출고 현황 섹션 */}
                    <section className="report-section">
                        <div className="section-header">
                            <h2>🔄 장비 입출고 현황</h2>
                            {equipmentData && (
                                <span className="count-label">총 {getFilteredEquipments().length}개</span>
                            )}
                        </div>

                        {/* 장비 필터 컨트롤 */}
                        {equipmentData && equipmentData.items.length > 0 && (
                            <div className="no-print" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                marginBottom: '0.5rem',
                                flexWrap: 'wrap',
                                fontSize: '0.85rem'
                            }}>
                                <button onClick={selectAllEquipments} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white' }}>전체선택</button>
                                <button onClick={deselectAllEquipments} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white' }}>전체해제</button>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto', fontSize: '0.75rem' }}>
                                    <input type="checkbox" checked={equipmentFilterEnabled} onChange={(e) => setEquipmentFilterEnabled(e.target.checked)} />
                                    필터적용
                                </label>
                                {excludedEquipments.length > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: '#ef4444', background: '#fef2f2', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        {excludedEquipments.length}개 제외
                                    </span>
                                )}
                            </div>
                        )}

                        {equipmentData && equipmentData.items.length > 0 ? (
                            <div className="report-table-container">
                                <table className="report-table equipment-table">
                                    <thead>
                                        <tr>
                                            <th className="no-print" style={{ width: '40px' }}>선택</th>
                                            <th>장비명</th>
                                            <th>이동 경로</th>
                                            <th>일자</th>
                                            <th>담당자</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipmentData.items.map(item => {
                                            const isExcluded = excludedEquipments.includes(item.lending_item_id);
                                            if (equipmentFilterEnabled && isExcluded) return null;
                                            return (
                                                <tr key={item.lending_item_id} className={item.is_at_office ? 'at-office' : ''} style={isExcluded ? { opacity: 0.5 } : {}}>
                                                    <td className="no-print" style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!isExcluded}
                                                            onChange={() => toggleEquipmentExclusion(item.lending_item_id)}
                                                            style={{ width: '16px', height: '16px' }}
                                                        />
                                                    </td>
                                                    <td className="equipment-name">{item.product_name}</td>
                                                    <td className="movement-path">
                                                        {item.movement_path || item.current_hospital}
                                                    </td>
                                                    <td className="movement-date">{formatDate(item.movement_date)}</td>
                                                    <td className="moved-by">{item.moved_by || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>등록된 장비가 없습니다.</p>
                            </div>
                        )}
                    </section>

                    {/* 영업팀 입출고 현황판 섹션 */}
                    <section className="report-section sales-status-section">
                        <div className="section-header">
                            <h2>📋 영업팀 장비 입출고 현황판</h2>
                            {salesStatusData && (
                                <span className="count-label">
                                    입고 {salesStatusData.summary.inbound_count} / 출고 {salesStatusData.summary.outbound_count}
                                </span>
                            )}
                        </div>

                        {salesStatusData && salesStatusData.groups.length > 0 ? (
                            <div className="sales-grid-container">
                                {salesStatusData.groups.map(group => (
                                    <div key={group.baseName} className="equipment-group">
                                        <div className="group-header">
                                            <span className="group-name">{group.baseName}</span>
                                            <span className="group-stats">
                                                <span className="stat-inbound">입고 {group.inboundCount}</span>
                                                <span className="stat-outbound">출고 {group.outboundCount}</span>
                                            </span>
                                        </div>
                                        <div className="equipment-items-grid">
                                            {group.items.map(item => {
                                                const isConsigned = item.ownership === 'CONSIGNED';
                                                return (
                                                <div
                                                    key={item.lending_item_id}
                                                    className={`equipment-item ${item.status}`}
                                                    style={{
                                                        background: isConsigned ? '#fef9e7' : '#e8f4fd',
                                                        borderColor: isConsigned ? '#f59e0b' : '#3b82f6'
                                                    }}
                                                >
                                                    <div className="item-name">{item.product_name}</div>
                                                    <div className={`item-status-badge ${item.status}`}>
                                                        {item.status === 'inbound' ? '입고' : '출고'}
                                                    </div>
                                                    {item.status === 'outbound' && (
                                                        <div className="item-location">{item.hospital_name}</div>
                                                    )}
                                                    <div style={{
                                                        fontSize: '0.55rem', fontWeight: '600', marginTop: '2px',
                                                        padding: '1px 4px', borderRadius: '2px', display: 'inline-block',
                                                        background: isConsigned ? '#fbbf24' : '#e2e8f0',
                                                        color: isConsigned ? '#92400e' : '#64748b'
                                                    }}>{isConsigned ? '타사' : '자사'}</div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>등록된 장비가 없습니다.</p>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

export default MobileReportPage;
