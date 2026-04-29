import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SalesBottomNav from '../../components/SalesBottomNav';
import { API_BASE_URL } from '../../config';
import '../../styles/mobile.css';

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

const CATEGORY_ORDER = [
    'ZENIUS MIS', 'ZENIUS MIS(서울)',
    'ZENIUS CEMENT SCREW', 'ZENIUS CEMENT SCREW#3(서울)', 'ZENIUS OPEN',
    'ILIAD CEMENT SCREW', 'ILIAD MINISIGE SCREW',
    'OLIF', '케이지기구세트', '케이지기구세트(서울)',
    '아테나', 'C7', 'UNICON', '바게라', '지니어스리무버',
    'LUMBAR RETRACTOR', 'MEDYSSEY HOOK',
    '엔도비젼 3D cage', 'FELIX CAGE', 'Ace ti cage',
    'U&I peek cage', 'Dynamic cage', 'INTRASPINE', '포세이돈'
];

function getCategoryIndex(baseName) {
    const exact = CATEGORY_ORDER.indexOf(baseName);
    if (exact !== -1) return exact;
    const lower = baseName.toLowerCase();
    const keyword = CATEGORY_ORDER.findIndex(k => lower.includes(k.toLowerCase()));
    return keyword !== -1 ? keyword : 999;
}

function SalesEquipmentQuickPage() {
    const [equipmentGroups, setEquipmentGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [mode, setMode] = useState('status');

    // 다중 선택 상태 (출고용)
    const [selectedItems, setSelectedItems] = useState([]);

    // 모달 상태
    const [modalItem, setModalItem] = useState(null); // 단일 입고용
    const [modalType, setModalType] = useState(null); // 'inbound' | 'outbound'
    const [showOutboundModal, setShowOutboundModal] = useState(false); // 다중 출고 모달
    const [hospitals, setHospitals] = useState([]);
    const [personnelList, setPersonnelList] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [newHospitalName, setNewHospitalName] = useState('');
    const [selectedPersonnel, setSelectedPersonnel] = useState('');
    const [newPersonnelName, setNewPersonnelName] = useState('');
    const [photos, setPhotos] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState('');

    const cameraInputRef = useRef(null);
    const albumInputRef = useRef(null);

    useEffect(() => {
        fetchEquipmentStatus();
        fetchHospitals();
        fetchPersonnelList();
    }, []);

    const fetchHospitals = async () => {
        try {
            const res = await axios.get('/api/hospitals');
            setHospitals(res.data);
        } catch (e) { console.error('병원 조회 실패:', e); }
    };

    const fetchPersonnelList = async () => {
        try {
            const res = await axios.get('/api/staff');
            setPersonnelList(res.data.map(s => s.name));
        } catch (e) { console.error('담당자 조회 실패:', e); }
    };

    const fetchEquipmentStatus = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/lending/items');
            const filtered = res.data.filter(item =>
                item.category !== 'BIOLOGIC' && item.category !== 'biologic'
            );
            filtered.forEach(item => {
                if (!item.product_name) return;
                item.product_name = item.product_name
                    .replace('(휴머러스)', '(HUMERUS)').replace('(라디우스)', '(RADIUS)')
                    .replace('(크래비클)', '(CLAVICLE)').replace('(피블라)', '(FIBULAR)')
                    .replace('(티비아)', '(TIBIA)');
                if (item.product_name.includes('보아즈 extlif 3D cage'))
                    item.product_name = item.product_name.replace('보아즈 extlif 3D cage', '엔도비젼 3D cage');
            });

            const latestByName = {};
            filtered.forEach(item => {
                const name = item.product_name;
                if (!latestByName[name] || new Date(item.deploy_date) > new Date(latestByName[name].deploy_date))
                    latestByName[name] = item;
            });

            const grouped = {};
            Object.values(latestByName).forEach(item => {
                const match = item.product_name.match(/^(.+?)(?:#?\d+)?$/);
                const baseName = match ? match[1].trim() : item.product_name;
                if (!grouped[baseName]) grouped[baseName] = [];
                grouped[baseName].push(item);
            });

            const groups = Object.entries(grouped)
                .map(([baseName, items]) => ({
                    baseName,
                    items: items.sort((a, b) => {
                        const numA = parseInt((a.product_name.match(/#(\d+)/) || [])[1] || '0');
                        const numB = parseInt((b.product_name.match(/#(\d+)/) || [])[1] || '0');
                        return numA - numB;
                    }),
                    inboundCount: items.filter(i => i.hospital_name === '부산사무실' || i.hospital_id === 2).length,
                    outboundCount: items.filter(i => i.hospital_name !== '부산사무실' && i.hospital_id !== 2).length
                }))
                .sort((a, b) => getCategoryIndex(a.baseName) - getCategoryIndex(b.baseName));

            setEquipmentGroups(groups);
            if (groups.length > 0 && !selectedCategory) setSelectedCategory(groups[0].baseName);
        } catch (error) {
            console.error('장비 현황 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // 장비 클릭 핸들러
    const handleItemClick = (item) => {
        const isInbound = item.hospital_name === '부산사무실' || item.hospital_id === 2;
        if (isInbound) {
            // 입고 상태 → 출고 대상: 다중 선택 토글
            toggleSelectItem(item);
        } else {
            // 출고 상태 → 입고 처리: 단일 모달
            setModalItem(item);
            setModalType('inbound');
            setSelectedPersonnel('');
            setNewPersonnelName('');
            setMessage('');
        }
    };

    // 다중 선택 토글
    const toggleSelectItem = (item) => {
        setSelectedItems(prev => {
            const exists = prev.some(i => i.id === item.id);
            return exists ? prev.filter(i => i.id !== item.id) : [...prev, item];
        });
    };

    // 자사/타사 토글
    const toggleOwnership = async (item, e) => {
        e.stopPropagation();
        const newOwnership = item.ownership === 'CONSIGNED' ? 'OWN' : 'CONSIGNED';
        try {
            await axios.put(`/api/products/${item.product_id}/ownership`, { ownership: newOwnership });
            fetchEquipmentStatus();
        } catch (err) { console.error('소유 구분 변경 실패:', err); }
    };

    // 일괄 출고 모달 열기
    const openOutboundModal = () => {
        if (selectedItems.length === 0) return;
        setShowOutboundModal(true);
        setSelectedHospital('');
        setNewHospitalName('');
        setSelectedPersonnel('');
        setNewPersonnelName('');
        setPhotos([]);
        setMessage('');
    };

    const closeModal = () => {
        setModalItem(null);
        setModalType(null);
        setShowOutboundModal(false);
        setPhotos([]);
        setMessage('');
    };

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handlePhotoCapture = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        try {
            const base64Photos = [];
            for (const file of files) {
                base64Photos.push(await fileToBase64(file));
            }
            setPhotos(prev => [...prev, ...base64Photos]);
        } catch (error) {
            console.error('사진 처리 실패:', error);
        }
        e.target.value = '';
    };

    // 입고 처리
    const handleInbound = async () => {
        if (!modalItem) return;
        setProcessing(true);
        setMessage('⏳ 입고 처리 중...');
        try {
            const busanOffice = hospitals.find(h => h.name.includes('부산사무실'));
            if (!busanOffice) { setMessage('❌ 부산사무실이 등록되어 있지 않습니다'); return; }

            const movedBy = selectedPersonnel || newPersonnelName || '영업팀';

            await axios.post('/api/lending/move', {
                lending_item_id: modalItem.id,
                to_hospital_id: busanOffice.id,
                moved_by: movedBy,
                notes: `입고 처리 - ${new Date().toLocaleString('ko-KR')}`
            });

            // 신규 담당자 DB 저장
            if (newPersonnelName.trim() && !personnelList.includes(newPersonnelName.trim())) {
                try { await axios.post('/api/staff', { name: newPersonnelName.trim() }); } catch (e) {}
                setPersonnelList(prev => [...prev, newPersonnelName.trim()]);
            }

            setMessage(`✅ ${modalItem.product_name} 입고 완료!`);
            setTimeout(() => { closeModal(); fetchEquipmentStatus(); }, 1500);
        } catch (error) {
            setMessage(`❌ 입고 실패: ${error.response?.data?.error || error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    // 다중 출고 처리
    const handleOutbound = async () => {
        if (selectedItems.length === 0) return;
        if (!selectedHospital && !newHospitalName.trim()) {
            setMessage('❌ 병원을 선택하거나 입력해주세요');
            return;
        }
        if (photos.length === 0) {
            setMessage('❌ 사진을 최소 1장 첨부해주세요');
            return;
        }

        setProcessing(true);
        setMessage(`⏳ ${selectedItems.length}개 장비 출고 처리 중...`);
        try {
            let hospitalId = selectedHospital;

            if (newHospitalName.trim() && !selectedHospital) {
                try {
                    const hospitalRes = await axios.post('/api/hospitals', {
                        name: newHospitalName.trim(),
                        code: `H${Date.now()}`,
                        address: '', contact_person: '', phone: ''
                    });
                    hospitalId = hospitalRes.data.hospital_id;
                    await fetchHospitals();
                } catch (hospitalError) {
                    if (hospitalError.response?.status === 409)
                        hospitalId = hospitalError.response.data.existing_hospital.id;
                    else throw hospitalError;
                }
            }

            const movedBy = selectedPersonnel || newPersonnelName || '영업팀';
            const hospitalName = newHospitalName.trim() ||
                hospitals.find(h => h.id.toString() === hospitalId.toString())?.name || '병원';

            if (newPersonnelName.trim() && !personnelList.includes(newPersonnelName.trim())) {
                try { await axios.post('/api/staff', { name: newPersonnelName.trim() }); } catch (e) {}
                setPersonnelList(prev => [...prev, newPersonnelName.trim()]);
            }

            const successItems = [];
            const failedItems = [];

            for (let i = 0; i < selectedItems.length; i++) {
                const item = selectedItems[i];
                setMessage(`⏳ 출고 처리 중... (${i + 1}/${selectedItems.length}) - ${item.product_name}`);
                try {
                    await axios.post('/api/lending/move', {
                        lending_item_id: item.id,
                        to_hospital_id: hospitalId,
                        moved_by: movedBy,
                        notes: `출고 처리 - ${new Date().toLocaleString('ko-KR')}`
                    });
                    try { await axios.delete(`/api/lending/items/${item.id}/photos`); } catch (e) {}
                    for (const photo of photos) {
                        await axios.put(`/api/lending/items/${item.id}/photo`, {
                            photo_url: photo, uploaded_by: movedBy
                        });
                    }
                    successItems.push(item.product_name);
                } catch (e) {
                    failedItems.push(item.product_name);
                }
            }

            if (failedItems.length === 0) {
                setMessage(`✅ ${successItems.length}개 장비 → ${hospitalName} 출고 완료!`);
            } else {
                setMessage(`⚠️ 완료: ${successItems.length}개, 실패: ${failedItems.length}개`);
            }
            setTimeout(() => { closeModal(); setSelectedItems([]); fetchEquipmentStatus(); }, 2000);
        } catch (error) {
            setMessage(`❌ 출고 실패: ${error.response?.data?.error || error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const selectedGroup = equipmentGroups.find(g => g.baseName === selectedCategory);

    return (
        <div style={{ paddingBottom: '80px', minHeight: '100vh', background: '#f8fafc' }}>
            {/* 헤더 */}
            <div style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white', padding: '1.5rem 1rem 1rem', borderRadius: '0 0 16px 16px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700' }}>⚡ 핵심기구 빠른 접근</h1>
                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', opacity: 0.85, lineHeight: '1.4' }}>
                            좌측 카테고리 선택 → 장비 카드 클릭으로 바로 처리<br/>
                            <span style={{ opacity: 0.7 }}>
                                입고(녹색): 여러 장비 탭하여 다중 선택 → 일괄 출고 | 출고(빨간): 탭하여 바로 입고
                            </span>
                        </p>
                    </div>
                    <button onClick={fetchEquipmentStatus} style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                        padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem'
                    }}>🔄 새로고침</button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    {[
                        { key: 'status', label: '전체 현황', icon: '📊' },
                        { key: 'inbound', label: '입고 장비', icon: '📥' },
                        { key: 'outbound', label: '출고 장비', icon: '📤' }
                    ].map(m => (
                        <button key={m.key} onClick={() => setMode(m.key)} style={{
                            flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: mode === m.key ? '700' : '400',
                            background: mode === m.key ? 'white' : 'rgba(255,255,255,0.15)',
                            color: mode === m.key ? '#6366f1' : 'white'
                        }}>{m.icon} {m.label}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>로딩 중...</div>
            ) : (
                <div style={{ display: 'flex', minHeight: 'calc(100vh - 200px)' }}>
                    {/* 좌측 카테고리 */}
                    <div style={{
                        width: '120px', minWidth: '120px', background: 'white',
                        borderRight: '1px solid #e2e8f0', overflowY: 'auto',
                        maxHeight: 'calc(100vh - 200px)', position: 'sticky', top: 0
                    }}>
                        {equipmentGroups.map(group => {
                            const isSelected = selectedCategory === group.baseName;
                            return (
                                <button key={group.baseName} onClick={() => setSelectedCategory(group.baseName)} style={{
                                    width: '100%', padding: '0.7rem 0.5rem', border: 'none',
                                    borderLeft: isSelected ? '3px solid #6366f1' : '3px solid transparent',
                                    background: isSelected ? '#f0f0ff' : 'white', cursor: 'pointer',
                                    textAlign: 'left', fontSize: '0.7rem', fontWeight: isSelected ? '700' : '400',
                                    color: isSelected ? '#6366f1' : '#374151', borderBottom: '1px solid #f1f5f9',
                                    lineHeight: '1.3', transition: 'all 0.15s ease'
                                }}>
                                    <div style={{ marginBottom: '2px' }}>{group.baseName}</div>
                                    <div style={{ fontSize: '0.6rem', color: '#9ca3af' }}>
                                        <span style={{ color: '#10b981' }}>{group.inboundCount}입</span>
                                        {' / '}
                                        <span style={{ color: '#ef4444' }}>{group.outboundCount}출</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* 우측 장비 목록 */}
                    <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                        {selectedGroup ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1f2937' }}>
                                        {selectedGroup.baseName}
                                        <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#6b7280', marginLeft: '0.5rem' }}>
                                            ({selectedGroup.items.length}대)
                                        </span>
                                    </h2>
                                    <div style={{ fontSize: '0.8rem' }}>
                                        <span style={{ color: '#10b981', fontWeight: '600' }}>입고 {selectedGroup.inboundCount}</span>
                                        <span style={{ margin: '0 0.3rem', color: '#d1d5db' }}>|</span>
                                        <span style={{ color: '#ef4444', fontWeight: '600' }}>출고 {selectedGroup.outboundCount}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                    {selectedGroup.items
                                        .filter(item => {
                                            if (mode === 'status') return true;
                                            const isInbound = item.hospital_name === '부산사무실' || item.hospital_id === 2;
                                            return mode === 'inbound' ? isInbound : !isInbound;
                                        })
                                        .map(item => {
                                            const isInbound = item.hospital_name === '부산사무실' || item.hospital_id === 2;
                                            const isConsigned = item.ownership === 'CONSIGNED';
                                            const isSelected = selectedItems.some(i => i.id === item.id);
                                            const cardColors = isConsigned
                                                ? { border: isInbound ? '#bfdbfe' : '#fed7aa', bg: isInbound ? '#eff6ff' : '#fff7ed', badge: isInbound ? '#3b82f6' : '#f97316' }
                                                : { border: isInbound ? '#d1fae5' : '#fecaca', bg: isInbound ? '#f0fdf4' : '#fef2f2', badge: isInbound ? '#10b981' : '#ef4444' };
                                            return (
                                                <div key={item.id} onClick={() => handleItemClick(item)} style={{
                                                    padding: '0.75rem', borderRadius: '10px',
                                                    border: isSelected ? '2px solid #6366f1' : `1px solid ${cardColors.border}`,
                                                    background: isSelected ? '#eef2ff' : cardColors.bg,
                                                    cursor: 'pointer', textAlign: 'center',
                                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                                    boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.3)' : 'none',
                                                    position: 'relative'
                                                }}>
                                                    {isSelected && (
                                                        <div style={{
                                                            position: 'absolute', top: '-6px', right: '-6px',
                                                            width: '22px', height: '22px', borderRadius: '50%',
                                                            background: '#6366f1', color: 'white', fontSize: '0.7rem',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700'
                                                        }}>✓</div>
                                                    )}
                                                    <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#1f2937', marginBottom: '0.3rem' }}>
                                                        {item.product_name}
                                                    </div>
                                                    <span style={{
                                                        display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                                                        fontSize: '0.7rem', fontWeight: '700', color: 'white',
                                                        background: cardColors.badge
                                                    }}>
                                                        {isInbound ? '입고' : '출고'}
                                                    </span>
                                                    {!isInbound && item.hospital_name && (
                                                        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.3rem' }}>{item.hospital_name}</div>
                                                    )}
                                                    {isInbound && !isConsigned && (
                                                        <div style={{ fontSize: '0.6rem', color: '#6366f1', marginTop: '0.3rem' }}>탭하여 선택</div>
                                                    )}
                                                    <button onClick={(e) => toggleOwnership(item, e)} style={{
                                                        marginTop: '0.3rem', padding: '1px 6px', borderRadius: '3px',
                                                        border: 'none', cursor: 'pointer', fontSize: '0.55rem', fontWeight: '600',
                                                        background: isConsigned ? '#fbbf24' : '#e2e8f0',
                                                        color: isConsigned ? '#92400e' : '#64748b'
                                                    }}>{isConsigned ? '타사' : '자사'}</button>
                                                </div>
                                            );
                                        })}
                                </div>

                                {selectedGroup.items.filter(item => {
                                    if (mode === 'status') return true;
                                    const isInbound = item.hospital_name === '부산사무실' || item.hospital_id === 2;
                                    return mode === 'inbound' ? isInbound : !isInbound;
                                }).length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        {mode === 'inbound' ? '입고된 장비가 없습니다' : '출고된 장비가 없습니다'}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>좌측에서 카테고리를 선택하세요</div>
                        )}
                    </div>
                </div>
            )}

            {/* 선택된 장비 하단 바 */}
            {selectedItems.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: '70px', left: 0, right: 0,
                    background: 'white', borderTop: '1px solid #e2e8f0',
                    padding: '0.75rem 1rem', zIndex: 1500,
                    boxShadow: '0 -4px 12px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                        선택된 장비 ({selectedItems.length}개):
                        {selectedItems.map(i => (
                            <span key={i.id} style={{
                                display: 'inline-block', margin: '2px 4px', padding: '2px 8px',
                                background: '#eef2ff', borderRadius: '4px', fontSize: '0.75rem', color: '#4338ca'
                            }}>
                                {i.product_name}
                                <span onClick={(e) => { e.stopPropagation(); toggleSelectItem(i); }}
                                    style={{ marginLeft: '4px', cursor: 'pointer', color: '#9ca3af' }}>✕</span>
                            </span>
                        ))}
                    </div>
                    <button onClick={openOutboundModal} style={{
                        width: '100%', padding: '0.7rem', borderRadius: '10px', border: 'none',
                        background: '#ef4444', color: 'white', fontSize: '1rem', fontWeight: '700', cursor: 'pointer'
                    }}>
                        📤 {selectedItems.length}개 장비 일괄 출고
                    </button>
                </div>
            )}

            {/* 입고 모달 (단일) */}
            {modalItem && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 2000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }} onClick={(e) => { if (e.target === e.currentTarget && !processing) closeModal(); }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px',
                        maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem'
                    }}>
                        {/* 모달 헤더 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📥 입고 처리</h3>
                            <button onClick={closeModal} disabled={processing} style={{
                                background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af'
                            }}>✕</button>
                        </div>

                        {/* 장비 정보 */}
                        <div style={{
                            background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem'
                        }}>
                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>{modalItem.product_name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                현재: {modalItem.hospital_name || '미지정'} → 부산사무실 (입고)
                            </div>
                        </div>

                        {/* 담당자 선택 */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontWeight: '600', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>👤 담당자</label>
                            <select value={selectedPersonnel} onChange={(e) => { setSelectedPersonnel(e.target.value); setNewPersonnelName(''); }}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                <option value="">기존 담당자 선택...</option>
                                {personnelList.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="text" placeholder="또는 신규 담당자 입력" value={newPersonnelName}
                                onChange={(e) => { setNewPersonnelName(e.target.value); setSelectedPersonnel(''); }}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        </div>

                        {/* 메시지 */}
                        {message && (
                            <div style={{
                                padding: '0.6rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center',
                                fontSize: '0.85rem', fontWeight: '500',
                                background: message.startsWith('✅') ? '#f0fdf4' : message.startsWith('❌') ? '#fef2f2' : '#f8fafc',
                                color: message.startsWith('✅') ? '#10b981' : message.startsWith('❌') ? '#ef4444' : '#6b7280'
                            }}>{message}</div>
                        )}

                        {/* 처리 버튼 */}
                        <button onClick={handleInbound} disabled={processing} style={{
                            width: '100%', padding: '0.8rem', borderRadius: '10px', border: 'none',
                            fontSize: '1rem', fontWeight: '700', cursor: processing ? 'not-allowed' : 'pointer',
                            color: 'white', background: processing ? '#9ca3af' : '#10b981'
                        }}>
                            {processing ? '처리 중...' : `📥 ${modalItem.product_name} 입고 처리`}
                        </button>
                    </div>
                </div>
            )}

            {/* 다중 출고 모달 */}
            {showOutboundModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 2000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }} onClick={(e) => { if (e.target === e.currentTarget && !processing) { setShowOutboundModal(false); setMessage(''); } }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px',
                        maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📤 일괄 출고 처리</h3>
                            <button onClick={() => { setShowOutboundModal(false); setMessage(''); }} disabled={processing} style={{
                                background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af'
                            }}>✕</button>
                        </div>

                        {/* 선택된 장비 목록 */}
                        <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.5rem' }}>선택된 장비 ({selectedItems.length}개)</div>
                            {selectedItems.map(item => (
                                <span key={item.id} style={{
                                    display: 'inline-block', margin: '2px', padding: '3px 8px',
                                    background: '#eef2ff', borderRadius: '4px', fontSize: '0.75rem', color: '#4338ca'
                                }}>{item.product_name}</span>
                            ))}
                        </div>

                        {/* 병원 선택 */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontWeight: '600', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>🏥 병원 선택</label>
                            <select value={selectedHospital} onChange={(e) => { setSelectedHospital(e.target.value); setNewHospitalName(''); }}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                <option value="">기존 병원 선택...</option>
                                {hospitals.filter(h => h.id !== 2).map(h => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                            </select>
                            <input type="text" placeholder="또는 신규 병원 입력" value={newHospitalName}
                                onChange={(e) => { setNewHospitalName(e.target.value); setSelectedHospital(''); }}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        </div>

                        {/* 담당자 */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontWeight: '600', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>👤 담당자</label>
                            <select value={selectedPersonnel} onChange={(e) => { setSelectedPersonnel(e.target.value); setNewPersonnelName(''); }}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                <option value="">기존 담당자 선택...</option>
                                {personnelList.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="text" placeholder="또는 신규 담당자 입력" value={newPersonnelName}
                                onChange={(e) => { setNewPersonnelName(e.target.value); setSelectedPersonnel(''); }}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        </div>

                        {/* 사진 */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontWeight: '600', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
                                📷 사진 첨부 <span style={{ color: '#ef4444' }}>(필수)</span>
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <button onClick={() => cameraInputRef.current?.click()} style={{
                                    flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db',
                                    background: '#f8fafc', cursor: 'pointer', fontSize: '0.85rem'
                                }}>📸 촬영</button>
                                <button onClick={() => albumInputRef.current?.click()} style={{
                                    flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db',
                                    background: '#f8fafc', cursor: 'pointer', fontSize: '0.85rem'
                                }}>🖼️ 앨범</button>
                            </div>
                            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} style={{ display: 'none' }} />
                            <input ref={albumInputRef} type="file" accept="image/*" multiple onChange={handlePhotoCapture} style={{ display: 'none' }} />
                            {photos.length > 0 && (
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {photos.map((photo, idx) => (
                                        <div key={idx} style={{ position: 'relative', width: '60px', height: '60px' }}>
                                            <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                                            <button onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))} style={{
                                                position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px',
                                                borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none',
                                                fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {message && (
                            <div style={{
                                padding: '0.6rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center',
                                fontSize: '0.85rem', fontWeight: '500',
                                background: message.startsWith('✅') ? '#f0fdf4' : message.startsWith('❌') ? '#fef2f2' : '#f8fafc',
                                color: message.startsWith('✅') ? '#10b981' : message.startsWith('❌') ? '#ef4444' : '#6b7280'
                            }}>{message}</div>
                        )}

                        <button onClick={handleOutbound} disabled={processing} style={{
                            width: '100%', padding: '0.8rem', borderRadius: '10px', border: 'none',
                            fontSize: '1rem', fontWeight: '700', cursor: processing ? 'not-allowed' : 'pointer',
                            color: 'white', background: processing ? '#9ca3af' : '#ef4444'
                        }}>
                            {processing ? '처리 중...' : `📤 ${selectedItems.length}개 장비 일괄 출고`}
                        </button>
                    </div>
                </div>
            )}

            <SalesBottomNav />
        </div>
    );
}

export default SalesEquipmentQuickPage;
