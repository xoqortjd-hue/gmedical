import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../../styles/mobile.css';

function MobileHomePage() {
    const [latestItems, setLatestItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLatestItems();

        // 30초마다 자동 새로고침
        const interval = setInterval(() => {
            fetchLatestItems();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const fetchLatestItems = async () => {
        try {
            const res = await axios.get('/api/lending/items?limit=10');
            // 최신 수정순 정렬 (사진 업로드 시간 > 배치 시간)
            const sorted = res.data.sort((a, b) => {
                const getLatestDate = (item) => {
                    const dates = [
                        item.photo_uploaded_at,
                        item.deploy_date,
                        item.lending_date
                    ].filter(Boolean).map(d => new Date(d));
                    return dates.length > 0 ? Math.max(...dates) : 0;
                };
                return getLatestDate(b) - getLatestDate(a);
            });

            // product_name 기준으로 중복 제거 (최신 항목만 유지)
            const uniqueItems = [];
            const seenProductNames = new Set();
            for (const item of sorted) {
                if (!seenProductNames.has(item.product_name)) {
                    seenProductNames.add(item.product_name);
                    uniqueItems.push(item);
                }
            }

            setLatestItems(uniqueItems.slice(0, 5)); // 최신 5개만
            setLoading(false);
        } catch (error) {
            console.error('최신 현황 조회 실패:', error);
            setLoading(false);
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

    return (
        <div className="mobile-container">
            <div className="mobile-header">
                <h1>📱 모바일 랜딩 관리</h1>
            </div>

            <div className="action-buttons">
                <Link to="/mobile/inbound" className="big-btn" style={{ background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }}>
                    <div className="btn-icon">📦</div>
                    <div className="btn-title">제품 입고</div>
                    <div className="btn-subtitle">바이오로직 입고 처리</div>
                </Link>

                <Link to="/mobile" className="big-btn btn-success">
                    <div className="btn-icon">🆕</div>
                    <div className="btn-title">신규 배치</div>
                    <div className="btn-subtitle">병원에 새 장비 배치</div>
                </Link>

                <Link to="/mobile" className="big-btn btn-info">
                    <div className="btn-icon">🔄</div>
                    <div className="btn-title">이동 / 회수</div>
                    <div className="btn-subtitle">기존 장비 이동/회수</div>
                </Link>

                <Link to="/mobile/equipment" className="big-btn btn-primary">
                    <div className="btn-icon">📋</div>
                    <div className="btn-title">등록 현황</div>
                    <div className="btn-subtitle">기구/장비 조회/편집</div>
                </Link>
            </div>

            <div className="quick-stats">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2>📊 최신 랜딩 현황</h2>
                    <button
                        onClick={fetchLatestItems}
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                    >
                        🔄
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                        로딩 중...
                    </div>
                ) : latestItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                        랜딩 데이터가 없습니다
                    </div>
                ) : (
                    <>
                        {latestItems.map(item => (
                            <div key={item.id} className="status-item" style={{
                                background: 'white',
                                padding: '0.8rem',
                                marginBottom: '0.5rem',
                                borderRadius: '8px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                borderLeft: '4px solid #4CAF50'
                            }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>
                                    {item.product_name}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                    🏥 {item.hospital_name} · 👤 {item.moved_by || '미지정'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.2rem' }}>
                                    📅 {formatDateTime(item.deploy_date || item.lending_date)}
                                </div>
                            </div>
                        ))}

                        <Link to="/mobile/status" className="stats-card" style={{ marginTop: '1rem' }}>
                            <div className="stats-label">전체 현황 보기</div>
                            <div className="stats-arrow">→</div>
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}

export default MobileHomePage;
