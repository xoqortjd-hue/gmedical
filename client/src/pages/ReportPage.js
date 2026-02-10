import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/main.css';

// 인쇄용 스타일 (인라인으로 추가하여 캐시 문제 방지)
const printStyles = `
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body, .app, .main-content, .page-container {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: none !important;
  }
  .navigation, .no-print, .table-controls, .info-box, .page-header {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
  .report-sections, .report-card, .table-container, .sales-grid-desktop {
    display: block !important;
    width: 100% !important;
  }
  .report-card {
    border: 1px solid #333 !important;
    margin-bottom: 1rem !important;
    page-break-inside: avoid;
  }
  .report-card h2 {
    background: #eee !important;
    padding: 0.5rem 1rem !important;
    margin: 0 !important;
    border-bottom: 1px solid #333 !important;
    font-size: 14px !important;
  }
  .data-table {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: 11px !important;
  }
  .data-table th, .data-table td {
    padding: 4px 8px !important;
    border: 1px solid #ccc !important;
    color: #000 !important;
  }
  .data-table th {
    background: #f0f0f0 !important;
  }
  .equipment-group-desktop {
    border: 1px solid #ccc !important;
    margin-bottom: 0.5rem !important;
    page-break-inside: avoid;
  }
  .group-header-desktop {
    background: #f0f0f0 !important;
    padding: 0.5rem !important;
  }
  .equipment-items-desktop {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 4px !important;
    padding: 0.5rem !important;
  }
  .equipment-item-desktop {
    width: calc(25% - 4px) !important;
    padding: 4px !important;
    border: 1px solid #999 !important;
    font-size: 10px !important;
    text-align: center !important;
  }
  .equipment-item-desktop.inbound {
    background: #e8f5e9 !important;
  }
  .equipment-item-desktop.outbound {
    background: #ffebee !important;
  }
  .status-badge-desktop {
    font-size: 9px !important;
    padding: 2px 4px !important;
  }
  .status-badge-desktop.inbound {
    background: #4caf50 !important;
    color: white !important;
  }
  .status-badge-desktop.outbound {
    background: #f44336 !important;
    color: white !important;
  }
  @page {
    size: A4 portrait;
    margin: 0.5cm;
  }
}
`;

function ReportPage() {
    const [period, setPeriod] = useState('weekly');
    const [transactionData, setTransactionData] = useState(null);
    const [equipmentData, setEquipmentData] = useState(null);
    const [salesStatusData, setSalesStatusData] = useState(null);
    const [loading, setLoading] = useState(true);

    // 제외할 병원 ID 목록 (체크 해제된 항목)
    const [excludedHospitals, setExcludedHospitals] = useState(() => {
        // 로컬스토리지에서 저장된 설정 불러오기
        const saved = localStorage.getItem('reportExcludedHospitals');
        return saved ? JSON.parse(saved) : [];
    });

    // 필터 모드: true = 제외 적용, false = 전체 보기
    const [filterEnabled, setFilterEnabled] = useState(true);

    // 제외할 장비 ID 목록 (체크 해제된 항목)
    const [excludedEquipments, setExcludedEquipments] = useState(() => {
        const saved = localStorage.getItem('reportExcludedEquipments');
        return saved ? JSON.parse(saved) : [];
    });

    // 장비 필터 모드
    const [equipmentFilterEnabled, setEquipmentFilterEnabled] = useState(true);

    useEffect(() => {
        fetchReportData();
    }, [period]);

    // 제외 설정 변경 시 로컬스토리지에 저장
    useEffect(() => {
        localStorage.setItem('reportExcludedHospitals', JSON.stringify(excludedHospitals));
    }, [excludedHospitals]);

    // 장비 제외 설정 변경 시 로컬스토리지에 저장
    useEffect(() => {
        localStorage.setItem('reportExcludedEquipments', JSON.stringify(excludedEquipments));
    }, [excludedEquipments]);

    // 병원 제외/포함 토글
    const toggleHospitalExclusion = (hospitalId) => {
        setExcludedHospitals(prev => {
            if (prev.includes(hospitalId)) {
                return prev.filter(id => id !== hospitalId);
            } else {
                return [...prev, hospitalId];
            }
        });
    };

    // 전체 선택
    const selectAllHospitals = () => {
        setExcludedHospitals([]);
    };

    // 전체 해제
    const deselectAllHospitals = () => {
        if (transactionData && transactionData.hospitals) {
            setExcludedHospitals(transactionData.hospitals.map(h => h.hospital_id));
        }
    };

    // 필터링된 병원 목록 (제외된 항목 제거)
    const getFilteredHospitals = () => {
        if (!transactionData || !transactionData.hospitals) return [];
        if (!filterEnabled) return transactionData.hospitals;
        return transactionData.hospitals.filter(h => !excludedHospitals.includes(h.hospital_id));
    };

    // 필터링된 합계 계산
    const getFilteredTotals = () => {
        const filtered = getFilteredHospitals();
        return {
            hospital_count: filtered.length,
            total_surgeries: filtered.reduce((sum, h) => sum + (h.surgery_count || 0), 0)
        };
    };

    // 장비 제외/포함 토글
    const toggleEquipmentExclusion = (equipmentId) => {
        setExcludedEquipments(prev => {
            if (prev.includes(equipmentId)) {
                return prev.filter(id => id !== equipmentId);
            } else {
                return [...prev, equipmentId];
            }
        });
    };

    // 장비 전체 선택
    const selectAllEquipments = () => {
        setExcludedEquipments([]);
    };

    // 장비 전체 해제
    const deselectAllEquipments = () => {
        if (equipmentData && equipmentData.items) {
            setExcludedEquipments(equipmentData.items.map(e => e.lending_item_id));
        }
    };

    // 필터링된 장비 목록
    const getFilteredEquipments = () => {
        if (!equipmentData || !equipmentData.items) return [];
        if (!equipmentFilterEnabled) return equipmentData.items;
        return equipmentData.items.filter(e => !excludedEquipments.includes(e.lending_item_id));
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
        const printWindow = window.open('', '_blank');

        // 필터링된 병원 목록과 합계 사용
        const filteredHospitals = getFilteredHospitals();
        const filteredTotals = getFilteredTotals();

        // 업체/병원 이행 완료건수 테이블 HTML 생성
        let hospitalTableHtml = '';
        if (filteredHospitals.length > 0) {
            hospitalTableHtml = `
                <table>
                    <thead>
                        <tr><th>업체/병원명</th><th>이행완료건수</th></tr>
                    </thead>
                    <tbody>
                        ${filteredHospitals.map(h => `
                            <tr><td>${h.hospital_name}</td><td style="text-align:center;color:#6366f1;font-weight:bold;">${h.surgery_count || 0}건</td></tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background:#f8f9fa;">
                            <td><strong>합계 (${filteredTotals.hospital_count}개 업체/병원)</strong></td>
                            <td style="text-align:center;color:#6366f1;font-weight:bold;">${filteredTotals.total_surgeries}건</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        } else {
            hospitalTableHtml = '<p style="text-align:center;color:#666;">해당 기간에 이행 완료 이력이 없습니다.</p>';
        }

        // 필터링된 장비 목록 사용
        const filteredEquipments = getFilteredEquipments();

        // 장비 입출고 현황 테이블 HTML 생성
        let equipmentTableHtml = '';
        if (filteredEquipments.length > 0) {
            equipmentTableHtml = `
                <table>
                    <thead>
                        <tr><th>장비명</th><th>이동 경로</th><th>일자</th><th>담당자</th></tr>
                    </thead>
                    <tbody>
                        ${filteredEquipments.map(item => {
                const path = item.movement_path || item.current_hospital;
                const bgColor = item.is_at_office ? 'background:#f0fdf4;' : '';
                return `<tr style="${bgColor}"><td><strong>${item.product_name}</strong></td><td>${path}</td><td style="text-align:center;">${formatDate(item.movement_date)}</td><td style="text-align:center;">${item.moved_by || '-'}</td></tr>`;
            }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            equipmentTableHtml = '<p style="text-align:center;color:#666;">등록된 장비가 없습니다.</p>';
        }

        // 영업팀 현황판 HTML 생성
        let salesGridHtml = '';
        if (salesStatusData && salesStatusData.groups.length > 0) {
            salesGridHtml = salesStatusData.groups.map(group => `
                <div class="equipment-group">
                    <div class="group-header">
                        <span style="font-weight:bold;">${group.baseName}</span>
                        <span>입고 <span style="color:#10b981;">${group.inboundCount}</span> / 출고 <span style="color:#ef4444;">${group.outboundCount}</span></span>
                    </div>
                    <div class="equipment-items">
                        ${group.items.map(item => `
                            <div class="equipment-item ${item.status}">
                                <div style="font-weight:600;font-size:10px;">${item.product_name}</div>
                                <span class="status-badge ${item.status}">${item.status === 'inbound' ? '입고' : '출고'}</span>
                                ${item.status === 'outbound' ? `<div style="font-size:9px;color:#666;">${item.hospital_name}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } else {
            salesGridHtml = '<p style="text-align:center;color:#666;">등록된 장비가 없습니다.</p>';
        }

        const periodText = transactionData
            ? `${formatFullDate(transactionData.start_date)} ~ ${formatFullDate(transactionData.end_date)}`
            : '';

        printWindow.document.write(`
            <html>
            <head>
                <title>금양메디칼 - 장비 관리 보고서</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Malgun Gothic', sans-serif; margin: 20px; font-size: 12px; }
                    h1 { text-align: center; margin-bottom: 5px; font-size: 18px; }
                    .date-info { text-align: center; color: #666; margin-bottom: 20px; font-size: 11px; }
                    .section { margin-bottom: 20px; border: 1px solid #333; }
                    .section-header { background: #f0f0f0; padding: 8px 12px; border-bottom: 1px solid #333; font-weight: bold; font-size: 13px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th, td { padding: 6px 8px; border: 1px solid #ccc; text-align: left; }
                    th { background: #f5f5f5; }
                    .equipment-group { border: 1px solid #ccc; margin: 10px; page-break-inside: avoid; }
                    .group-header { display: flex; justify-content: space-between; padding: 6px 10px; background: #f0f0f0; border-bottom: 1px solid #ccc; font-size: 11px; }
                    .equipment-items { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; }
                    .equipment-item { width: calc(25% - 4px); padding: 5px; border: 1px solid #999; text-align: center; font-size: 9px; }
                    .equipment-item.inbound { background: #e8f5e9; }
                    .equipment-item.outbound { background: #ffebee; }
                    .status-badge { display: inline-block; padding: 1px 4px; font-size: 8px; font-weight: bold; border-radius: 2px; margin-top: 2px; }
                    .status-badge.inbound { background: #4caf50; color: white; }
                    .status-badge.outbound { background: #f44336; color: white; }
                    @page { size: A4 portrait; margin: 0.5cm; }
                </style>
            </head>
            <body>
                <h1>📊 금양메디칼 - 장비 관리 보고서</h1>
                <p class="date-info">출력일: ${new Date().toLocaleDateString('ko-KR')} | 조회기간: ${periodText}</p>
                
                <div class="section">
                    <div class="section-header">🏥 업체/병원 이행 완료건수</div>
                    ${hospitalTableHtml}
                </div>
                
                <div class="section">
                    <div class="section-header">🔄 장비 입출고 현황 (총 ${equipmentData?.items?.length || 0}개)</div>
                    ${equipmentTableHtml}
                </div>
                
                <div class="section">
                    <div class="section-header">📋 영업팀 장비 입출고 현황판 (입고 ${salesStatusData?.summary?.inbound_count || 0} / 출고 ${salesStatusData?.summary?.outbound_count || 0})</div>
                    ${salesGridHtml}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
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

    // 전체 날짜 포맷
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
        <div className="page-container">
            {/* 인쇄용 스타일 인라인 주입 */}
            <style dangerouslySetInnerHTML={{ __html: printStyles }} />

            <div className="page-header no-print">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>📊 리포트 - 장비 관리 보고서</h1>
                        <p>병원별 수술 건수 및 장비 입출고 현황을 조회하고 인쇄합니다</p>
                    </div>
                    <button onClick={handlePrint} className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>
                        🖨️ 인쇄하기
                    </button>
                </div>
            </div>

            {/* 인쇄용 헤더 */}
            <div className="print-header print-only">
                <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>금양메디칼 - 장비 관리 보고서</h1>
                <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>출력일: {new Date().toLocaleDateString('ko-KR')}</p>
            </div>

            {/* 기간 선택 */}
            <div className="table-controls no-print">
                <button
                    onClick={() => setPeriod('weekly')}
                    className={`btn ${period === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
                >
                    📅 주간 (7일)
                </button>
                <button
                    onClick={() => setPeriod('monthly')}
                    className={`btn ${period === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ marginLeft: '0.5rem' }}
                >
                    📅 월간 (30일)
                </button>
                <button onClick={fetchReportData} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
                    🔄 새로고침
                </button>
                {transactionData && (
                    <span style={{ marginLeft: '1rem', color: '#666' }}>
                        기간: {formatFullDate(transactionData.start_date)} ~ {formatFullDate(transactionData.end_date)}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="loading">로딩 중...</div>
            ) : (
                <div className="report-sections">
                    {/* 업체/병원 이행 완료건수 */}
                    <div className="report-card">
                        <h2>🏥 업체/병원 이행 완료건수</h2>

                        {/* 필터 컨트롤 */}
                        {transactionData && transactionData.hospitals.length > 0 && (
                            <div className="no-print" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1rem',
                                backgroundColor: '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                                flexWrap: 'wrap'
                            }}>
                                <span style={{ fontSize: '0.9rem', color: '#64748b', marginRight: '0.5rem' }}>
                                    📋 인쇄 항목 선택:
                                </span>
                                <button
                                    onClick={selectAllHospitals}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                >
                                    전체 선택
                                </button>
                                <button
                                    onClick={deselectAllHospitals}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                >
                                    전체 해제
                                </button>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    marginLeft: 'auto',
                                    fontSize: '0.85rem',
                                    color: '#475569',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={filterEnabled}
                                        onChange={(e) => setFilterEnabled(e.target.checked)}
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                    제외 필터 적용
                                </label>
                                {excludedHospitals.length > 0 && (
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: '#ef4444',
                                        backgroundColor: '#fef2f2',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px'
                                    }}>
                                        {excludedHospitals.length}개 제외됨
                                    </span>
                                )}
                            </div>
                        )}

                        {transactionData && transactionData.hospitals.length > 0 ? (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="no-print" style={{ width: '50px', textAlign: 'center' }}>선택</th>
                                            <th>업체/병원명</th>
                                            <th style={{ textAlign: 'center' }}>이행완료건수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactionData.hospitals.map(hospital => {
                                            const isExcluded = excludedHospitals.includes(hospital.hospital_id);
                                            // 필터 적용 시 제외된 항목은 표시하지 않음
                                            if (filterEnabled && isExcluded) return null;
                                            return (
                                                <tr
                                                    key={hospital.hospital_id}
                                                    style={isExcluded ? { opacity: 0.5, backgroundColor: '#f8f8f8' } : {}}
                                                >
                                                    <td className="no-print" style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!isExcluded}
                                                            onChange={() => toggleHospitalExclusion(hospital.hospital_id)}
                                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td><strong>{hospital.hospital_name}</strong></td>
                                                    <td style={{ textAlign: 'center', color: '#6366f1', fontWeight: 'bold' }}>
                                                        {hospital.surgery_count || 0}건
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                                            <td className="no-print"></td>
                                            <td><strong>합계 ({getFilteredTotals().hospital_count}개 업체/병원)</strong></td>
                                            <td style={{ textAlign: 'center', color: '#6366f1', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                {getFilteredTotals().total_surgeries}건
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>해당 기간에 수술 이력이 없습니다.</p>
                            </div>
                        )}
                    </div>

                    {/* 장비 입출고 현황 */}
                    <div className="report-card">
                        <h2>🔄 장비 입출고 현황 {equipmentData && `(총 ${getFilteredEquipments().length}개)`}</h2>

                        {/* 장비 필터 컨트롤 */}
                        {equipmentData && equipmentData.items.length > 0 && (
                            <div className="no-print" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1rem',
                                backgroundColor: '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                                flexWrap: 'wrap'
                            }}>
                                <span style={{ fontSize: '0.9rem', color: '#64748b', marginRight: '0.5rem' }}>
                                    📋 인쇄 항목 선택:
                                </span>
                                <button
                                    onClick={selectAllEquipments}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                >
                                    전체 선택
                                </button>
                                <button
                                    onClick={deselectAllEquipments}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                >
                                    전체 해제
                                </button>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    marginLeft: 'auto',
                                    fontSize: '0.85rem',
                                    color: '#475569',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={equipmentFilterEnabled}
                                        onChange={(e) => setEquipmentFilterEnabled(e.target.checked)}
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                    제외 필터 적용
                                </label>
                                {excludedEquipments.length > 0 && (
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: '#ef4444',
                                        backgroundColor: '#fef2f2',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px'
                                    }}>
                                        {excludedEquipments.length}개 제외됨
                                    </span>
                                )}
                            </div>
                        )}

                        {equipmentData && equipmentData.items.length > 0 ? (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="no-print" style={{ width: '50px', textAlign: 'center' }}>선택</th>
                                            <th>장비명</th>
                                            <th>이동 경로</th>
                                            <th style={{ textAlign: 'center' }}>일자</th>
                                            <th style={{ textAlign: 'center' }}>담당자</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipmentData.items.map(item => {
                                            const isExcluded = excludedEquipments.includes(item.lending_item_id);
                                            if (equipmentFilterEnabled && isExcluded) return null;
                                            return (
                                                <tr
                                                    key={item.lending_item_id}
                                                    style={item.is_at_office ? { backgroundColor: '#f0fdf4' } : (isExcluded ? { opacity: 0.5, backgroundColor: '#f8f8f8' } : {})}
                                                >
                                                    <td className="no-print" style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!isExcluded}
                                                            onChange={() => toggleEquipmentExclusion(item.lending_item_id)}
                                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td><strong>{item.product_name}</strong></td>
                                                    <td style={{ color: '#4b5563' }}>{item.movement_path || item.current_hospital}</td>
                                                    <td style={{ textAlign: 'center', color: '#6b7280' }}>{formatDate(item.movement_date)}</td>
                                                    <td style={{ textAlign: 'center', color: '#6b7280' }}>{item.moved_by || '-'}</td>
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
                    </div>

                    {/* 영업팀 장비 입출고 현황판 */}
                    <div className="report-card">
                        <h2>
                            📋 영업팀 장비 입출고 현황판
                            {salesStatusData && (
                                <span style={{ fontSize: '0.9rem', fontWeight: 'normal', marginLeft: '1rem', color: '#666' }}>
                                    입고 <span style={{ color: '#10b981', fontWeight: 'bold' }}>{salesStatusData.summary.inbound_count}</span> /
                                    출고 <span style={{ color: '#ef4444', fontWeight: 'bold' }}> {salesStatusData.summary.outbound_count}</span>
                                </span>
                            )}
                        </h2>
                        {salesStatusData && salesStatusData.groups.length > 0 ? (
                            <div className="sales-grid-desktop">
                                {salesStatusData.groups.map(group => (
                                    <div key={group.baseName} className="equipment-group-desktop">
                                        <div className="group-header-desktop">
                                            <span className="group-name-desktop">{group.baseName}</span>
                                            <span className="group-stats-desktop">
                                                <span style={{ color: '#10b981' }}>입고 {group.inboundCount}</span>
                                                <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>출고 {group.outboundCount}</span>
                                            </span>
                                        </div>
                                        <div className="equipment-items-desktop">
                                            {group.items.map(item => (
                                                <div
                                                    key={item.lending_item_id}
                                                    className={`equipment-item-desktop ${item.status}`}
                                                >
                                                    <div className="item-name-desktop">{item.product_name}</div>
                                                    <span className={`status-badge-desktop ${item.status}`}>
                                                        {item.status === 'inbound' ? '입고' : '출고'}
                                                    </span>
                                                    {item.status === 'outbound' && (
                                                        <div className="item-location-desktop">{item.hospital_name}</div>
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
                    </div>
                </div>
            )}

            <div className="info-box no-print" style={{ marginTop: '2rem' }}>
                <h3>💡 안내</h3>
                <ul>
                    <li><strong>수술 건수</strong>: 장비가 병원에서 사용 후 사무실로 입고된 횟수 (출고→입고 = 1건)</li>
                    <li><strong>입출고 현황</strong>: 모든 장비의 현재 위치와 최근 이동 경로</li>
                    <li><strong>영업팀 현황판</strong>: 장비별 입고/출고 상태를 한눈에 확인</li>
                    <li><strong>인쇄</strong>: 🖨️ 버튼을 클릭하여 A4 용지로 출력</li>
                </ul>
            </div>
        </div>
    );
}

export default ReportPage;
