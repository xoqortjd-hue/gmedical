import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import EditableProductName from '../../components/EditableProductName';
import EditableGroupName, { getFamilyOverride } from '../../components/EditableGroupName';
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
    const [ownershipEditMode, setOwnershipEditMode] = useState(false); // 자사/타사 수정 모드
    const [manageMode, setManageMode] = useState(false); // 등록/삭제 버튼 노출
    const [registerModal, setRegisterModal] = useState(null); // { baseName, suggestedNumber }
    const [registering, setRegistering] = useState(false);
    const [registerError, setRegisterError] = useState('');
    const [registerNumber, setRegisterNumber] = useState('');
    const [deletingId, setDeletingId] = useState(null);

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

                // 2. 특정 제품명 변경 (보아즈 계열은 패밀리 그룹핑을 위해 원래 이름 유지)
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
                        product_id: item.product_id,
                        name: item.product_name,
                        status: isInbound ? 'inbound' : 'outbound',
                        hospital: item.hospital_name,
                        ownership: item.ownership || 'OWN',
                        lastUpdated: lastDate
                    };
                }
            });

            // 2단계: 기구명에서 #식별자 추출하여 그룹화
            // 예: "ZENIUS MIS#1" -> baseName: "ZENIUS MIS", number: "#1"
            // 예: "TAURUS CADI#32-2번" -> baseName: "TAURUS CADI", number: "#32-2번"
            const grouped = {};

            Object.values(latestByName).forEach(item => {
                // #을 기준으로 분리 (# 뒤에 자유 텍스트 허용)
                const hashIndex = item.name?.indexOf('#');
                let baseName, number;

                if (hashIndex !== -1 && hashIndex > 0) {
                    baseName = item.name.substring(0, hashIndex).trim();
                    number = '#' + item.name.substring(hashIndex + 1);
                } else {
                    // #이 없는 경우: 끝의 숫자만 분리 시도
                    const numMatch = item.name?.match(/^(.+?)(\d+)$/);
                    if (numMatch) {
                        baseName = numMatch[1].trim();
                        number = numMatch[2];
                    } else {
                        baseName = item.name || '미분류';
                        number = '';
                    }
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
                    // 숫자 부분 추출하여 정렬, 숫자 없으면 문자열 정렬
                    const numA = parseFloat(a.number?.replace(/^#/, '') || '');
                    const numB = parseFloat(b.number?.replace(/^#/, '') || '');
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    if (!isNaN(numA)) return -1;
                    if (!isNaN(numB)) return 1;
                    return (a.number || '').localeCompare(b.number || '');
                }),
                count: items.length
            }));

            // 상위 장비군(Family) 정의 - 키워드로 시작하는 서브그룹을 하나로 묶음
            const equipmentFamilies = [
                { keyword: 'ZENIUS', label: 'ZENIUS 계열' },
                { keyword: 'ILIAD', label: 'ILIAD 계열' },
                { keywords: ['Lp케이지', 'LP케이지', 'LP25케디', '케이지기구'], label: 'LP케이지 계열' },
                { keyword: 'Taurus케디', label: 'Taurus케디 계열' },
                { keyword: '보아즈', label: '보아즈 계열' },
                { keyword: '제일트라우마', label: '제일트라우마 계열' },
                { keyword: 'UBE', label: 'UBE 계열' },
                { keyword: 'Ace Ti', label: 'Ace Ti 계열', caseSensitive: true },
            ];

            // 우선 표시 카테고리 정의 (패밀리 내부 서브그룹 순서)
            const subGroupOrder = [
                'ZENIUS MIS', 'ZENIUS MIS(서울)', 'ZENIUS CEMENT SCREW', 'ZENIUS CEMENT SCREW(서울)', 'ZENIUS OPEN',
                'ILIAD', 'ILIAD CEMENT SCREW', 'ILIAD MINISIGE SCREW',
                '케이지기구세트', '케이지기구세트(서울)', 'LP25케디',
                'Taurus케디',
                '보아즈 extlif 세트', '보아즈 extlif 3D cage', '보아즈 extrif 세트(서울)',
                '제일트라우마세트(휴머러스)', '제일트라우마세트(라디우스)', '제일트라우마세트(크래비클)', '제일트라우마세트(티비아)', '제일트라우마세트(피블라)',
                'UBE 툴셋(대형)', 'UBE 툴셋(소형)',
                'Ace Ti 3D cage', 'Ace Ti C type 3D felix',
            ];

            // 패밀리에 속하지 않는 일반 그룹의 우선순위
            const standaloneOrder = [
                'OLIF',
                '아테나',
                'C7',
                'UNICON',
                '바게라',
                '지니어스리무버',
                'LUMBAR RETRACTOR',
                'MEDYSSEY HOOK',
                'FELIX CAGE',
                'U&I peek cage',
                'Dynamic cage',
                'INTRASPINE',
                '포세이돈',
                '델파이',
            ];

            // 4단계: 패밀리 그룹 생성
            const familyGroups = [];
            const usedBaseNames = new Set();

            // 패밀리 그룹 처리
            equipmentFamilies.forEach(family => {
                const familyKeywords = family.keywords || [family.keyword];
                const matchingGroups = groupArray.filter(g => {
                    return familyKeywords.some(kw => {
                        if (family.caseSensitive) return g.baseName.startsWith(kw);
                        return g.baseName.toUpperCase().startsWith(kw.toUpperCase());
                    });
                });

                if (matchingGroups.length > 0) {
                    // 서브그룹 내부 정렬
                    matchingGroups.sort((a, b) => {
                        const idxA = subGroupOrder.findIndex(k => a.baseName.includes(k) || k.includes(a.baseName));
                        const idxB = subGroupOrder.findIndex(k => b.baseName.includes(k) || k.includes(b.baseName));
                        const pA = idxA !== -1 ? idxA : 999;
                        const pB = idxB !== -1 ? idxB : 999;
                        return pA - pB;
                    });

                    familyGroups.push({
                        familyName: family.label,
                        familyKeyword: family.keyword || (family.keywords && family.keywords[0]) || family.label,
                        isFamily: true,
                        subGroups: matchingGroups,
                        totalCount: matchingGroups.reduce((sum, g) => sum + g.count, 0)
                    });
                    matchingGroups.forEach(g => usedBaseNames.add(g.baseName));
                }
            });

            // 나머지 일반 그룹 처리
            const standaloneGroups = groupArray
                .filter(g => !usedBaseNames.has(g.baseName))
                .map(g => ({
                    familyName: g.baseName,
                    isFamily: false,
                    subGroups: [g],
                    totalCount: g.count
                }));

            // 일반 그룹 정렬
            const getStandaloneIndex = (name) => {
                const exact = standaloneOrder.indexOf(name);
                if (exact !== -1) return exact;
                const keyword = standaloneOrder.findIndex(k =>
                    name.toLowerCase().includes(k.toLowerCase())
                );
                return keyword !== -1 ? keyword : 999;
            };

            standaloneGroups.sort((a, b) => {
                const idxA = getStandaloneIndex(a.familyName);
                const idxB = getStandaloneIndex(b.familyName);
                if (idxA !== 999 && idxB !== 999) return idxA - idxB;
                if (idxA !== 999) return -1;
                if (idxB !== 999) return 1;
                return b.totalCount - a.totalCount;
            });

            // 패밀리 그룹을 최상단에, 나머지 그룹 뒤에 배치
            const finalGroups = [...familyGroups, ...standaloneGroups];

            setEquipmentGroups(finalGroups);
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

    // 등록 모달 열기 - subGroup 의 baseName 으로 다음 번호 자동 추천
    const openRegisterModal = (subGroup) => {
        let maxNum = 0;
        subGroup.items.forEach(it => {
            const m = (it.number || it.name || '').match(/#(\d+)/);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
        });
        const suggested = `#${maxNum + 1}`;
        setRegisterModal({ baseName: subGroup.baseName, suggestedNumber: suggested });
        setRegisterNumber(suggested);
        setRegisterError('');
    };

    // 등록 실행
    const handleRegister = async () => {
        if (!registerModal) return;
        const number = (registerNumber || '').trim();
        if (!number) { setRegisterError('번호를 입력하세요 (예: #9)'); return; }
        const fullName = `${registerModal.baseName}${number.startsWith('#') ? number : '#' + number}`;
        setRegistering(true);
        setRegisterError('');
        try {
            await axios.post('/api/products', {
                name: fullName,
                barcode: `EQ${Date.now()}`,
                category: 'EQUIPMENT'
            });
            setRegisterModal(null);
            setRegisterNumber('');
            await fetchEquipmentStatus();
        } catch (e) {
            setRegisterError(e.response?.data?.error || e.message || '등록 실패');
        } finally {
            setRegistering(false);
        }
    };

    // 장비 삭제 (제품 + 모든 lending_items + 이동 이력 cascade)
    const handleDelete = async (item) => {
        if (!window.confirm(
            `[${item.name}] 을(를) 완전 삭제하시겠습니까?\n\n` +
            `• 제품 + 모든 이동 이력 + 사진 메타데이터 함께 삭제\n` +
            `• 출고 상태면 먼저 입고 처리 필요\n` +
            `• 되돌릴 수 없음`
        )) return;
        setDeletingId(item.id);
        try {
            await axios.delete(`/api/products/${item.product_id}`);
            await fetchEquipmentStatus();
        } catch (e) {
            alert(`삭제 실패: ${e.response?.data?.error || e.message}`);
        } finally {
            setDeletingId(null);
        }
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

            {/* 자사/타사 수정 모드 토글 */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: ownershipEditMode ? '#fef3c7' : 'white',
                borderRadius: '8px',
                border: ownershipEditMode ? '1px solid #f59e0b' : '1px solid #e5e7eb',
                transition: 'all 0.2s'
            }}>
                <span style={{ fontSize: '0.8rem', color: ownershipEditMode ? '#92400e' : '#64748b' }}>
                    {ownershipEditMode ? '🔓 자사/타사 수정 가능' : '🔒 자사/타사 잠금'}
                </span>
                <button
                    onClick={() => setOwnershipEditMode(!ownershipEditMode)}
                    style={{
                        position: 'relative',
                        width: '44px', height: '24px',
                        borderRadius: '12px', border: 'none', cursor: 'pointer',
                        background: ownershipEditMode ? '#f59e0b' : '#d1d5db',
                        transition: 'background 0.2s'
                    }}
                >
                    <span style={{
                        position: 'absolute',
                        top: '2px', left: ownershipEditMode ? '22px' : '2px',
                        width: '20px', height: '20px',
                        borderRadius: '50%', background: 'white',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                </button>
            </div>

            {/* 등록/삭제 관리 모드 토글 */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: manageMode ? '#dbeafe' : 'white',
                borderRadius: '8px',
                border: manageMode ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                transition: 'all 0.2s'
            }}>
                <span style={{ fontSize: '0.8rem', color: manageMode ? '#1e40af' : '#64748b' }}>
                    {manageMode ? '🛠 등록/삭제 활성' : '🔒 등록/삭제 잠금'}
                </span>
                <button
                    onClick={() => setManageMode(!manageMode)}
                    style={{
                        position: 'relative',
                        width: '44px', height: '24px',
                        borderRadius: '12px', border: 'none', cursor: 'pointer',
                        background: manageMode ? '#3b82f6' : '#d1d5db',
                        transition: 'background 0.2s'
                    }}
                >
                    <span style={{
                        position: 'absolute',
                        top: '2px', left: manageMode ? '22px' : '2px',
                        width: '20px', height: '20px',
                        borderRadius: '50%', background: 'white',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                </button>
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
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            border: group.isFamily ? '2px solid #06b6d4' : 'none'
                        }}>
                            {/* 상위 그룹 헤더 */}
                            <div style={{
                                fontWeight: 'bold',
                                fontSize: group.isFamily ? '1.1rem' : '1rem',
                                color: group.isFamily ? '#0891b2' : '#1e293b',
                                marginBottom: '0.75rem',
                                paddingBottom: '0.5rem',
                                borderBottom: group.isFamily ? '3px solid #06b6d4' : '2px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                {group.isFamily && <span style={{ fontSize: '0.9rem' }}>📦</span>}
                                {manageMode && group.isFamily ? (
                                    <EditableGroupName
                                        mode="family"
                                        currentName={getFamilyOverride(group.familyKeyword || group.familyName) || group.familyName}
                                        familyKey={group.familyKeyword || group.familyName}
                                        labelStyle={{ fontWeight: 'bold' }}
                                        onSaved={() => fetchEquipmentStatus()}
                                    />
                                ) : (
                                    <span>{getFamilyOverride(group.familyKeyword || group.familyName) || group.familyName}</span>
                                )}
                                {' '}({group.totalCount}대)
                            </div>

                            {/* 서브그룹 렌더링 */}
                            {group.subGroups.map((subGroup, subIndex) => (
                                <div key={subIndex} style={{
                                    marginBottom: subIndex < group.subGroups.length - 1 ? '0.75rem' : 0
                                }}>
                                    {/* 패밀리인 경우 서브그룹 헤더 표시 */}
                                    {group.isFamily && (
                                        <div style={{
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            color: '#475569',
                                            marginBottom: '0.5rem',
                                            paddingLeft: '0.25rem',
                                            borderLeft: '3px solid #0891b2',
                                            paddingBottom: '0.15rem',
                                            marginLeft: '0.25rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            flexWrap: 'wrap'
                                        }}>
                                            {manageMode ? (
                                                <EditableGroupName
                                                    mode="subgroup"
                                                    currentName={subGroup.baseName}
                                                    labelStyle={{ fontWeight: 'bold' }}
                                                    onSaved={(newName, count) => {
                                                        fetchEquipmentStatus();
                                                    }}
                                                />
                                            ) : (
                                                <span>{subGroup.baseName}</span>
                                            )}
                                            {' '}({subGroup.count}대)
                                        </div>
                                    )}

                                    {/* 3열 그리드 */}
                                    {chunkArray(subGroup.items, 3).map((row, rowIndex) => (
                                        <div key={rowIndex} style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                            gap: '0.5rem',
                                            marginBottom: rowIndex < chunkArray(subGroup.items, 3).length - 1 ? '0.5rem' : 0,
                                            marginLeft: group.isFamily ? '0.5rem' : 0
                                        }}>
                                            {row.map((item, colIndex) => (
                                                <div key={colIndex} style={{
                                                    padding: '0.5rem',
                                                    borderRadius: '8px',
                                                    background: item ? (item.ownership === 'CONSIGNED' ? '#fef9e7' : '#e8f4fd') : 'transparent',
                                                    border: item ? `1.5px solid ${item.ownership === 'CONSIGNED' ? '#f59e0b' : '#3b82f6'}` : (manageMode ? '1px dashed #cbd5e1' : 'none'),
                                                    minHeight: '50px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    position: 'relative'
                                                }}>
                                                    {/* 삭제 버튼 (관리 모드에서만 노출) */}
                                                    {item && manageMode && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                                                            disabled={deletingId === item.id}
                                                            title="삭제"
                                                            style={{
                                                                position: 'absolute', top: '2px', right: '2px',
                                                                width: '18px', height: '18px', borderRadius: '50%',
                                                                background: deletingId === item.id ? '#fca5a5' : '#ef4444',
                                                                color: 'white', border: 'none',
                                                                cursor: deletingId === item.id ? 'wait' : 'pointer',
                                                                fontSize: '0.6rem', fontWeight: 'bold',
                                                                padding: 0, lineHeight: 1,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                zIndex: 2
                                                            }}
                                                        >
                                                            {deletingId === item.id ? '...' : '✕'}
                                                        </button>
                                                    )}
                                                    {item && (
                                                        <>
                                                            <div style={{
                                                                fontSize: '0.85rem',
                                                                fontWeight: 'bold',
                                                                color: '#374151',
                                                                marginBottom: '0.25rem',
                                                                textAlign: 'center',
                                                                wordBreak: 'break-word'
                                                            }}>
                                                                <EditableProductName
                                                                    productId={item.product_id}
                                                                    currentName={item.name}
                                                                    labelStyle={{ fontWeight: 'bold' }}
                                                                    onSaved={() => fetchEquipmentStatus()}
                                                                    compact
                                                                />
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
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!ownershipEditMode) return;
                                                                    const newOwn = item.ownership === 'CONSIGNED' ? 'OWN' : 'CONSIGNED';
                                                                    try { await axios.put(`/api/products/${item.product_id}/ownership`, { ownership: newOwn }); fetchEquipmentStatus(); } catch(err) {}
                                                                }}
                                                                style={{
                                                                    display: 'block', margin: '0.2rem auto 0', padding: '1px 5px',
                                                                    borderRadius: '3px', border: 'none',
                                                                    cursor: ownershipEditMode ? 'pointer' : 'default',
                                                                    fontSize: '0.5rem', fontWeight: '600',
                                                                    background: item.ownership === 'CONSIGNED' ? '#fbbf24' : '#e2e8f0',
                                                                    color: item.ownership === 'CONSIGNED' ? '#92400e' : '#64748b',
                                                                    opacity: ownershipEditMode ? 1 : 0.6
                                                                }}
                                                            >{item.ownership === 'CONSIGNED' ? '타사' : '자사'}</button>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    {/* + 등록 버튼 (관리 모드에서만) */}
                                    {manageMode && (
                                        <button
                                            onClick={() => openRegisterModal(subGroup)}
                                            style={{
                                                marginTop: '0.4rem',
                                                marginLeft: group.isFamily ? '0.5rem' : 0,
                                                padding: '0.5rem 0.8rem',
                                                background: '#dbeafe',
                                                color: '#1e40af',
                                                border: '1.5px dashed #3b82f6',
                                                borderRadius: '8px',
                                                fontSize: '0.78rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                width: '100%'
                                            }}
                                        >
                                            ➕ {subGroup.baseName} 새 번호 등록
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* 등록 모달 */}
            {registerModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', zIndex: 9998,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div style={{ background: 'white', borderRadius: '12px', padding: '1.4rem', width: '100%', maxWidth: '420px' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                            ➕ 새 기구 등록
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.8rem' }}>
                            계열: <b>{registerModal.baseName}</b>
                        </div>

                        <label style={{ fontSize: '0.8rem', color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                            번호 (예: #9, #15-2번)
                        </label>
                        <input
                            type="text"
                            value={registerNumber}
                            onChange={(e) => setRegisterNumber(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !registering) handleRegister();
                                if (e.key === 'Escape') setRegisterModal(null);
                            }}
                            disabled={registering}
                            autoFocus
                            placeholder={registerModal.suggestedNumber}
                            style={{
                                width: '100%',
                                padding: '0.6rem',
                                fontSize: '1rem',
                                border: '1.5px solid #6366f1',
                                borderRadius: '8px',
                                marginBottom: '0.5rem',
                                boxSizing: 'border-box'
                            }}
                        />
                        <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.8rem' }}>
                            저장될 이름: <b>{registerModal.baseName}{(registerNumber || '').startsWith('#') ? registerNumber : '#' + registerNumber}</b>
                            <br/>
                            ※ 등록 시 자동으로 부산사무실(입고)로 배치됩니다. 자사/타사는 등록 후 토글로 변경 가능.
                        </div>

                        {registerError && (
                            <div style={{
                                padding: '0.5rem', background: '#fef2f2', color: '#991b1b',
                                borderRadius: '6px', fontSize: '0.78rem', marginBottom: '0.8rem'
                            }}>{registerError}</div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={handleRegister}
                                disabled={registering}
                                style={{
                                    flex: 1, padding: '0.7rem',
                                    background: registering ? '#9ca3af' : '#10b981',
                                    color: 'white', border: 'none', borderRadius: '8px',
                                    fontWeight: '700', cursor: registering ? 'wait' : 'pointer',
                                    fontSize: '0.92rem'
                                }}
                            >
                                {registering ? '등록 중...' : '✓ 등록'}
                            </button>
                            <button
                                onClick={() => { setRegisterModal(null); setRegisterError(''); }}
                                disabled={registering}
                                style={{
                                    padding: '0.7rem 1rem',
                                    background: '#f3f4f6', color: '#374151',
                                    border: '1px solid #d1d5db', borderRadius: '8px',
                                    cursor: 'pointer', fontSize: '0.9rem'
                                }}
                            >
                                취소
                            </button>
                        </div>
                    </div>
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
