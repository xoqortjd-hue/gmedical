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
 * - 동일 기구명: 최신 상태만 표시 (중복 제거)
 * - 입고(부산사무실): 녹색 배지
 * - 출고(그 외 장소): 빨간색 배지
 * - 정렬: 카테고리명 가나다순 고정
 */
function SalesStatusDashboard() {
    const [equipmentGroups, setEquipmentGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // 상세 팝업 상태
    const [selectedItem, setSelectedItem] = useState(null);
    const [movements, setMovements] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null); // 확대 보기용 사진 인덱스
    const [touchStart, setTouchStart] = useState(null); // 터치 시작 위치

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

            // 기구명 변경 (한글 -> 영문 변환 등)
            filtered.forEach(item => {
                if (!item.product_name) return;

                // 1. 괄호 안 부위명 영문 변환
                item.product_name = item.product_name
                    .replace('(휴머러스)', '(HUMERUS)')
                    .replace('(라디우스)', '(RADIUS)')
                    .replace('(크래비클)', '(CLAVICLE)')
                    .replace('(피블라)', '(FIBULAR)')
                    .replace('(티비아)', '(TIBIA)');

                // 2. 특정 제품명 변경
                if (item.product_name.includes('보아즈 extlif 3D cage')) {
                    item.product_name = item.product_name.replace('보아즈 extlif 3D cage', '엔도비젼 3D cage');
                }
            });

            // 1단계: 각 기구명당 최신 이력만 선택 (중복 제거)
            const latestByName = {};

            filtered.forEach(item => {
                const name = item.product_name;
                const lastDate = item.deploy_date || item.lending_date || '';

                // 기존 항목이 없거나, 현재 항목이 더 최근인 경우에만 업데이트
                if (!latestByName[name] ||
                    (lastDate && (!latestByName[name].lastUpdated || lastDate > latestByName[name].lastUpdated))) {

                    // 입고/출고 상태 판별 (부산사무실 = 입고)
                    const isInbound = item.hospital_name?.includes('부산사무실');

                    latestByName[name] = {
                        id: item.id,
                        name: item.product_name,
                        status: isInbound ? 'inbound' : 'outbound',
                        hospital: item.hospital_name,
                        lastUpdated: lastDate
                    };
                }
            });

            // 2단계: 기구명에서 번호 추출하여 그룹화
            // 예: "지니어스#1" -> baseName: "지니어스", number: "#1"
            const grouped = {};

            Object.values(latestByName).forEach(item => {
                // 기구명에서 #번호 또는 숫자 추출
                const match = item.name?.match(/^(.+?)(#?\d+)$/);
                let baseName, number;

                if (match) {
                    baseName = match[1].trim();
                    number = match[2];
                } else {
                    // 번호가 없는 경우 전체 이름을 baseName으로
                    baseName = item.name || '미분류';
                    number = '';
                }

                if (!grouped[baseName]) {
                    grouped[baseName] = [];
                }

                grouped[baseName].push({
                    ...item,
                    number: number
                });
            });

            // 3단계: 배열로 변환 및 정렬
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

            // 우선 표시 카테고리 정의 (순서대로 상단 배치)
            const priorityOrder = [
                'ZENIUS MIS',
                'ZENIUS CEMENT SCREW',
                'ZENIUS OPEN',
                'ILIAD',
                'OLIF',
                'Lp',            // Lp케이지셋트 등
                '아테나',
                'C7',
                'UNICON',
                '바게라',
                '지니어스리무버',
                'LUMBAR RETRACTOR',
                'MEDYSSEY HOOK',
                '엔도비젼 3D cage',
                'FELIX CAGE',
                'Ace ti cage',
                'U&I peek cage',
                'Dynamic cage',
                'INTRASPINE',
                '포세이돈',
                'ZENIUS MIS(서울)',
                'ZENIUS CEMENT SCREW#3(서울)',
                'LP케이지세트(서울)'
            ];

            // 우선순위 인덱스 반환 함수
            const getPriorityIndex = (baseName) => {
                // 정확히 일치하는 경우
                const exactIndex = priorityOrder.indexOf(baseName);
                if (exactIndex !== -1) return exactIndex;

                // 키워드 포함 확인
                const lowerName = baseName.toLowerCase();
                const keywordIndex = priorityOrder.findIndex(keyword =>
                    lowerName.includes(keyword.toLowerCase())
                );

                return keywordIndex !== -1 ? keywordIndex : 999;
            };

            // 정렬: 우선 카테고리 먼저, 나머지는 기구 수 많은 순
            groupArray.sort((a, b) => {
                const indexA = getPriorityIndex(a.baseName);
                const indexB = getPriorityIndex(b.baseName);

                // 둘 다 우선순위 목록에 있는 경우
                if (indexA !== 999 && indexB !== 999) {
                    return indexA - indexB;
                }

                // 하나만 있는 경우
                if (indexA !== 999) return -1;
                if (indexB !== 999) return 1;

                // 둘 다 없는 경우 - 기구 수 많은 순
                return b.count - a.count;
            });

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

    // 상세 정보 조회 (이동 이력 + 사진)
    const fetchItemDetail = async (item) => {
        setSelectedItem(item);
        setDetailLoading(true);

        try {
            // 이동 이력 조회 (최근 3건)
            const movementsRes = await axios.get(`/api/lending/movements/${item.id}`);
            setMovements(movementsRes.data.slice(0, 3)); // 최근 3건만

            // 사진 조회 (전체)
            const photosRes = await axios.get(`/api/lending/items/${item.id}/photos`);
            setPhotos(photosRes.data);
        } catch (error) {
            console.error('[fetchItemDetail] Error:', error);
            setMovements([]);
            setPhotos([]);
        } finally {
            setDetailLoading(false);
        }
    };

    // 팝업 닫기
    const closeDetailPopup = () => {
        setSelectedItem(null);
        setMovements([]);
        setPhotos([]);
    };

    // 날짜 포맷
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
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
                                                    <button
                                                        onClick={() => fetchItemDetail(item)}
                                                        style={{
                                                            display: 'inline-block',
                                                            padding: '0.2rem 0.6rem',
                                                            background: item.status === 'inbound' ? '#10b981' : '#ef4444',
                                                            color: 'white',
                                                            borderRadius: '4px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 'bold',
                                                            border: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {item.status === 'inbound' ? '입고' : '출고'}
                                                    </button>
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

            {/* 상세 팝업 모달 */}
            {selectedItem && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }} onClick={closeDetailPopup}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '400px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        padding: '1.5rem'
                    }} onClick={(e) => e.stopPropagation()}>
                        {/* 팝업 헤더 */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem',
                            paddingBottom: '1rem',
                            borderBottom: '1px solid #e2e8f0'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {selectedItem.name} {selectedItem.status === 'inbound' ? '입고' : '출고'} 정보
                            </h2>
                            <button onClick={closeDetailPopup} style={{
                                background: 'none', border: 'none', fontSize: '1.5rem',
                                cursor: 'pointer', color: '#64748b'
                            }}>×</button>
                        </div>

                        {detailLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                로딩 중...
                            </div>
                        ) : (
                            <>
                                {/* 현재 상태 */}
                                <div style={{
                                    background: selectedItem.status === 'inbound' ? '#ecfdf5' : '#fef2f2',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                        현재 위치
                                    </div>
                                    <div style={{
                                        fontSize: '1rem', fontWeight: 'bold',
                                        color: selectedItem.status === 'inbound' ? '#059669' : '#dc2626'
                                    }}>
                                        📍 {selectedItem.hospital || '부산사무실'}
                                    </div>
                                </div>

                                {/* 이동 이력 (최근 3건) */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{
                                        fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b',
                                        marginBottom: '0.75rem'
                                    }}>
                                        📜 최근 이동 이력 ({movements.length}건)
                                    </div>
                                    {movements.length === 0 ? (
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                            이동 이력이 없습니다
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {movements.map((move, idx) => (
                                                <div key={idx} style={{
                                                    background: '#f8fafc',
                                                    padding: '0.75rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ fontWeight: 'bold' }}>
                                                            {formatDate(move.movement_date)}
                                                        </span>
                                                        <span style={{ color: '#64748b' }}>
                                                            {move.moved_by || '-'}
                                                        </span>
                                                    </div>
                                                    <div style={{ marginTop: '0.3rem', color: '#374151' }}>
                                                        {move.from_hospital_name || '-'} → {move.to_hospital_name || '-'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 사진 (출고 시만 표시) */}
                                {selectedItem.status === 'outbound' && (
                                    <div>
                                        <div style={{
                                            fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b',
                                            marginBottom: '0.75rem'
                                        }}>
                                            📷 출고 사진 ({photos.length}장)
                                        </div>
                                        {photos.length === 0 ? (
                                            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                                사진이 없습니다
                                            </div>
                                        ) : (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: '0.5rem'
                                            }}>
                                                {photos.map((photo, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={photo.photo_url}
                                                        alt={`사진 ${idx + 1}`}
                                                        style={{
                                                            width: '100%',
                                                            aspectRatio: '1',
                                                            objectFit: 'cover',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => setSelectedPhotoIndex(idx)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 사진 확대 보기 오버레이 - 스와이프 갤러리 */}
            {selectedPhotoIndex !== null && photos.length > 0 && (
                <div
                    onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                        if (!touchStart) return;
                        const touchEnd = e.changedTouches[0].clientX;
                        const diff = touchStart - touchEnd;

                        // 50px 이상 스와이프 시 이동
                        if (Math.abs(diff) > 50) {
                            if (diff > 0 && selectedPhotoIndex < photos.length - 1) {
                                // 왼쪽으로 스와이프 = 다음 사진
                                setSelectedPhotoIndex(selectedPhotoIndex + 1);
                            } else if (diff < 0 && selectedPhotoIndex > 0) {
                                // 오른쪽으로 스와이프 = 이전 사진
                                setSelectedPhotoIndex(selectedPhotoIndex - 1);
                            }
                        }
                        setTouchStart(null);
                    }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.95)',
                        zIndex: 3000,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem',
                        touchAction: 'pan-y'
                    }}
                >
                    {/* 닫기 버튼 */}
                    <button
                        onClick={() => setSelectedPhotoIndex(null)}
                        style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 3001
                        }}
                    >✕</button>

                    {/* 사진 인디케이터 */}
                    <div style={{
                        position: 'absolute',
                        top: '1.5rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '0.5rem 1rem',
                        borderRadius: '20px'
                    }}>
                        {selectedPhotoIndex + 1} / {photos.length}
                    </div>

                    {/* 이전 버튼 */}
                    {selectedPhotoIndex > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPhotoIndex(selectedPhotoIndex - 1);
                            }}
                            style={{
                                position: 'absolute',
                                left: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255,255,255,0.3)',
                                border: 'none',
                                color: 'white',
                                fontSize: '2rem',
                                cursor: 'pointer',
                                borderRadius: '50%',
                                width: '50px',
                                height: '50px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >‹</button>
                    )}

                    {/* 다음 버튼 */}
                    {selectedPhotoIndex < photos.length - 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPhotoIndex(selectedPhotoIndex + 1);
                            }}
                            style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255,255,255,0.3)',
                                border: 'none',
                                color: 'white',
                                fontSize: '2rem',
                                cursor: 'pointer',
                                borderRadius: '50%',
                                width: '50px',
                                height: '50px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >›</button>
                    )}

                    {/* 사진 */}
                    <img
                        src={photos[selectedPhotoIndex]?.photo_url}
                        alt={`사진 ${selectedPhotoIndex + 1}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '90%',
                            maxHeight: '75vh',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            userSelect: 'none',
                            pointerEvents: 'none'
                        }}
                    />

                    {/* 안내 문구 */}
                    <p style={{ color: '#999', marginTop: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>
                        👆 좌우로 스와이프하여 사진 넘기기
                    </p>

                    {/* 하단 썸네일 인디케이터 */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                        overflowX: 'auto',
                        maxWidth: '90%',
                        padding: '0.5rem'
                    }}>
                        {photos.map((photo, idx) => (
                            <div
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPhotoIndex(idx);
                                }}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '4px',
                                    border: idx === selectedPhotoIndex ? '2px solid #3b82f6' : '2px solid transparent',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    cursor: 'pointer'
                                }}
                            >
                                <img
                                    src={photo.photo_url}
                                    alt={`썸네일 ${idx + 1}`}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        opacity: idx === selectedPhotoIndex ? 1 : 0.5
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 하단 네비게이션 */}
            <SalesBottomNav />
        </div>
    );
}

export default SalesStatusDashboard;
