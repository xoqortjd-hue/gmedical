import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import SalesBottomNav from '../../components/SalesBottomNav';
import { API_BASE_URL } from '../../config';
import '../../styles/mobile.css';

// axios 기본 URL 설정
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

/**
 * SalesStatusDashboard - 영업팀 입출고 현황 대시보드
 * 
 * 3열 그리드 레이아웃으로 기구별 입고/출고 상태 표시
 * - 동일 기구명이 가로로 나열
 * - 입고(부산사무실): 녹색 배지
 * - 출고(그 외 장소): 빨간색 배지
 * - 최초: 기구 수 많은 순 정렬
 */
function SalesStatusDashboard() {
    const [equipmentGroups, setEquipmentGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // 디버그 로그
    console.log('[SalesStatusDashboard] Rendering');

    useEffect(() => {
        fetchEquipmentStatus();

        // 30초마다 자동 새로고침
        const interval = setInterval(() => {
            fetchEquipmentStatus();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    // 기구 현황 조회 및 그룹화
    const fetchEquipmentStatus = async () => {
        try {
            console.log('[fetchEquipmentStatus] Fetching...');
            const res = await axios.get('/api/lending/items');

            // BIOLOGIC 제외
            const filtered = res.data.filter(item =>
                item.category !== 'BIOLOGIC' && item.category !== 'biologic'
            );

            // 기구명에서 번호 추출하여 그룹화
            // 예: "지니어스#1" -> baseName: "지니어스", number: "#1"
            const grouped = {};

            filtered.forEach(item => {
                // 기구명에서 #번호 또는 숫자 추출
                const match = item.product_name?.match(/^(.+?)(#?\d+)$/);
                let baseName, number;

                if (match) {
                    baseName = match[1].trim();
                    number = match[2];
                } else {
                    // 번호가 없는 경우 전체 이름을 baseName으로
                    baseName = item.product_name || '미분류';
                    number = '';
                }

                if (!grouped[baseName]) {
                    grouped[baseName] = [];
                }

                // 입고/출고 상태 판별 (부산사무실 = 입고)
                const isInbound = item.hospital_name?.includes('부산사무실');

                grouped[baseName].push({
                    id: item.id,
                    name: item.product_name,
                    number: number,
                    status: isInbound ? 'inbound' : 'outbound',
                    hospital: item.hospital_name,
                    lastUpdated: item.deploy_date || item.lending_date
                });
            });

            // 배열로 변환 및 정렬 (기구 수 많은 순)
            const groupArray = Object.entries(grouped).map(([baseName, items]) => ({
                baseName,
                items: items.sort((a, b) => {
                    // 번호순 정렬
                    const numA = parseInt(a.number?.replace('#', '') || 0);
                    const numB = parseInt(b.number?.replace('#', '') || 0);
                    return numA - numB;
                }),
                count: items.length
            }));

            // 기구 수 많은 순 정렬
            groupArray.sort((a, b) => b.count - a.count);

            setEquipmentGroups(groupArray);
            setLastUpdated(new Date());
            setLoading(false);
            console.log('[fetchEquipmentStatus] Success:', groupArray.length, 'groups');
        } catch (error) {
            console.error('[fetchEquipmentStatus] Error:', error);
            setLoading(false);
        }
    };

    // 시간 포맷
    const formatTime = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    // 3열 그리드로 나누기
    const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            const chunk = arr.slice(i, i + size);
            // 빈 칸 채우기
            while (chunk.length < size) {
                chunk.push(null);
            }
            chunks.push(chunk);
        }
        return chunks;
    };

    return (
        <div className="mobile-container" style={{ padding: '1rem', minHeight: '100vh', background: '#f8fafc', paddingBottom: '5rem' }}>
            {/* 헤더 */}
            <div style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                marginBottom: '1rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>입출고 현황</h1>
                    </div>
                    <button
                        onClick={fetchEquipmentStatus}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.5rem 1rem',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        🔄 새로고침
                    </button>
                </div>
                {lastUpdated && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' }}>
                        마지막 업데이트: {formatTime(lastUpdated)}
                    </div>
                )}
            </div>

            {/* 범례 */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '2rem',
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        background: '#10b981',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                    }}>입고</span>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>부산사무실</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        background: '#ef4444',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                    }}>출고</span>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>병원 배치</span>
                </div>
            </div>

            {/* 대시보드 그리드 */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    로딩 중...
                </div>
            ) : equipmentGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    등록된 기구가 없습니다
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {equipmentGroups.map((group, groupIndex) => (
                        <div key={groupIndex} style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '1rem',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}>
                            {/* 기구 카테고리 헤더 */}
                            <div style={{
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                color: '#1e293b',
                                marginBottom: '0.75rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid #e2e8f0'
                            }}>
                                {group.baseName} ({group.count}대)
                            </div>

                            {/* 3열 그리드 */}
                            {chunkArray(group.items, 3).map((row, rowIndex) => (
                                <div key={rowIndex} style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '0.5rem',
                                    marginBottom: rowIndex < chunkArray(group.items, 3).length - 1 ? '0.5rem' : 0
                                }}>
                                    {row.map((item, colIndex) => (
                                        <div key={colIndex} style={{
                                            padding: '0.5rem',
                                            borderRadius: '8px',
                                            background: item ? '#f8fafc' : 'transparent',
                                            border: item ? '1px solid #e2e8f0' : 'none',
                                            minHeight: '50px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {item && (
                                                <>
                                                    <div style={{
                                                        fontSize: '0.85rem',
                                                        fontWeight: 'bold',
                                                        color: '#374151',
                                                        marginBottom: '0.25rem'
                                                    }}>
                                                        {item.name}
                                                    </div>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '0.2rem 0.6rem',
                                                        background: item.status === 'inbound' ? '#10b981' : '#ef4444',
                                                        color: 'white',
                                                        borderRadius: '4px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {item.status === 'inbound' ? '입고' : '출고'}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* 하단 네비게이션 */}
            <SalesBottomNav />
        </div>
    );
}

export default SalesStatusDashboard;
