import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/mobile.css';

function MobileReportPage() {
    const [period, setPeriod] = useState('weekly');
    const [transactionData, setTransactionData] = useState(null);
    const [equipmentData, setEquipmentData] = useState(null);
    const [salesStatusData, setSalesStatusData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReportData();
    }, [period]);

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

    // 이동 경로 표시
    const getMovementPath = (item) => {
        if (!item.previous_hospital && !item.movement_type) {
            return item.current_hospital;
        }
        if (item.is_at_office) {
            return `${item.previous_hospital || '외부'} → 사무실 (입고)`;
        }
        if (item.previous_hospital) {
            return `${item.previous_hospital} → ${item.current_hospital}`;
        }
        return `→ ${item.current_hospital} (배치)`;
    };

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

                        {transactionData && transactionData.hospitals.length > 0 ? (
                            <div className="report-table-container">
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>병원명</th>
                                            <th>수술 건수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactionData.hospitals.map(hospital => (
                                            <tr key={hospital.hospital_id}>
                                                <td className="hospital-name">{hospital.hospital_name}</td>
                                                <td className="count total">{hospital.surgery_count || 0}건</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="totals-row">
                                            <td><strong>합계 ({transactionData.totals.hospital_count}개 병원)</strong></td>
                                            <td className="count total"><strong>{transactionData.totals.total_surgeries}건</strong></td>
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
                                <span className="count-label">총 {equipmentData.items.length}개</span>
                            )}
                        </div>

                        {equipmentData && equipmentData.items.length > 0 ? (
                            <div className="report-table-container">
                                <table className="report-table equipment-table">
                                    <thead>
                                        <tr>
                                            <th>장비명</th>
                                            <th>이동 경로</th>
                                            <th>일자</th>
                                            <th>담당자</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipmentData.items.map(item => (
                                            <tr key={item.lending_item_id} className={item.is_at_office ? 'at-office' : ''}>
                                                <td className="equipment-name">{item.product_name}</td>
                                                <td className="movement-path">
                                                    {getMovementPath(item)}
                                                </td>
                                                <td className="movement-date">{formatDate(item.movement_date)}</td>
                                                <td className="moved-by">{item.moved_by || '-'}</td>
                                            </tr>
                                        ))}
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
                            <h2>📋 영업팀 입출고 현황판</h2>
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
                                            {group.items.map(item => (
                                                <div
                                                    key={item.lending_item_id}
                                                    className={`equipment-item ${item.status}`}
                                                >
                                                    <div className="item-name">{item.product_name}</div>
                                                    <div className={`item-status-badge ${item.status}`}>
                                                        {item.status === 'inbound' ? '입고' : '출고'}
                                                    </div>
                                                    {item.status === 'outbound' && (
                                                        <div className="item-location">{item.hospital_name}</div>
                                                    )}
                                                </div>
                                            ))}
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
