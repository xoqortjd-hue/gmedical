import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import CameraScanner from '../../components/CameraScanner';
import SalesBottomNav from '../../components/SalesBottomNav';
import { API_BASE_URL } from '../../config';
import '../../styles/mobile.css';

// axios 기본 URL 설정
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

/**
 * SalesInOutRegisterPage - 영업팀 입출고 등록 페이지
 * 
 * 드롭다운 옵션: 입고, 출고, 신규등록
 * - 입고: 출고 상태인 기구 목록 표시 → 입고처리 버튼
 * - 출고: 입고 상태인 기구 목록 표시 → 출고 폼 (병원, 담당자, 사진)
 * - 신규등록: 기구명 + 번호 + 사진 등록
 *   - 촬영/앨범: 사진과 함께 등록
 *   - 간편: 사진 없이 텍스트만으로 등록
 */
function SalesInOutRegisterPage() {
    // URL에서 mode 파라미터 읽기
    const [searchParams] = useSearchParams();
    const urlMode = searchParams.get('mode');

    // 현재 모드: 'inbound' | 'outbound' | 'new'
    const [activeMode, setActiveMode] = useState(urlMode || '');

    // 공통 상태
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [processing, setProcessing] = useState(false);

    // 출고 폼 상태 - 다중 선택 지원
    const [selectedItems, setSelectedItems] = useState([]); // 다중 선택 배열
    const [showOutboundForm, setShowOutboundForm] = useState(false); // 출고 폼 표시 여부
    const [hospitals, setHospitals] = useState([]);
    const [personnelList, setPersonnelList] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [newHospitalName, setNewHospitalName] = useState('');
    const [selectedPersonnel, setSelectedPersonnel] = useState('');
    const [newPersonnelName, setNewPersonnelName] = useState('');
    const [photos, setPhotos] = useState([]); // Base64 배열

    // 신규등록 상태
    const [newEquipmentName, setNewEquipmentName] = useState('');
    const [newEquipmentNumber, setNewEquipmentNumber] = useState('');
    const [newEquipmentPhoto, setNewEquipmentPhoto] = useState(null);
    const [quickRegisterMode, setQuickRegisterMode] = useState(false); // 간편 등록 모드 (사진 없이)

    // 파일 입력 ref
    const cameraInputRef = useRef(null);
    const albumInputRef = useRef(null);
    const newEquipCameraRef = useRef(null);
    const newEquipAlbumRef = useRef(null);

    // 연속 촬영 모드 상태
    const [showContinuePrompt, setShowContinuePrompt] = useState(false);

    // 디버그 로그
    console.log('[SalesInOutRegisterPage] Render - activeMode:', activeMode);

    useEffect(() => {
        fetchHospitals();
        fetchPersonnelList();
    }, []);

    // URL mode 변경시 activeMode 업데이트
    useEffect(() => {
        if (urlMode && ['inbound', 'outbound', 'new'].includes(urlMode)) {
            setActiveMode(urlMode);
        }
    }, [urlMode]);

    useEffect(() => {
        if (activeMode === 'inbound') {
            fetchOutboundItems(); // 출고 상태 → 입고 처리 대상
        } else if (activeMode === 'outbound') {
            fetchInboundItems(); // 입고 상태 → 출고 처리 대상
        }
    }, [activeMode]);

    // 병원 목록 조회
    const fetchHospitals = async () => {
        try {
            console.log('[fetchHospitals] Fetching...');
            const res = await axios.get('/api/hospitals');
            setHospitals(res.data);
            console.log('[fetchHospitals] Success:', res.data.length, 'hospitals');
        } catch (error) {
            console.error('[fetchHospitals] Error:', error);
        }
    };

    // 담당자 목록 조회 (기존 moved_by 값에서 추출)
    const fetchPersonnelList = async () => {
        try {
            console.log('[fetchPersonnelList] Fetching...');
            const res = await axios.get('/api/lending/items');
            const uniquePersonnel = [...new Set(
                res.data
                    .map(item => item.moved_by)
                    .filter(name => name && name.trim())
            )];
            setPersonnelList(uniquePersonnel);
            console.log('[fetchPersonnelList] Success:', uniquePersonnel.length, 'personnel');
        } catch (error) {
            console.error('[fetchPersonnelList] Error:', error);
        }
    };

    // 기구 목록 조회 및 중복 제거 (최신 상태만 유지)
    const fetchAndDeduplicateItems = async () => {
        const res = await axios.get('/api/lending/items');

        // BIOLOGIC 제외
        const equipmentOnly = res.data.filter(item =>
            item.category !== 'BIOLOGIC' && item.category !== 'biologic'
        );

        // 기구명 변경 (한글 -> 영문 변환 등) - 대시보드와 동일한 로직 적용
        equipmentOnly.forEach(item => {
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

        // 중복 제거: 기구명 기준 최신 이력만 선택
        const latestByName = {};
        equipmentOnly.forEach(item => {
            const name = item.product_name;
            const lastDate = item.deploy_date || item.lending_date || '';

            // 기존 항목이 없거나, 현재 항목이 더 최근인 경우에만 업데이트
            if (!latestByName[name] ||
                (lastDate && (!latestByName[name].lastUpdated || lastDate > latestByName[name].lastUpdated))) {
                latestByName[name] = {
                    ...item,
                    lastUpdated: lastDate
                };
            }
        });

        return Object.values(latestByName);
    };

    // 출고 상태 기구 조회 (입고 처리 대상)
    // 부산사무실이 아닌 곳 = 출고 상태
    const fetchOutboundItems = async () => {
        setLoading(true);
        try {
            console.log('[fetchOutboundItems] Fetching...');

            // 중복 제거된 유니크한 기구 목록 가져오기
            const uniqueItems = await fetchAndDeduplicateItems();

            // 부산사무실(hospital_name에 "부산사무실" 포함)이 아닌 항목 필터링
            // hospital_name이 없는 경우(null)도 출고된 것으로 간주할 수 있으나, 
            // 데이터 무결성을 위해 hospital_name이 있는 것 중 부산사무실이 아닌 것만 필터링
            const outboundItems = uniqueItems.filter(item =>
                item.hospital_name && !item.hospital_name.includes('부산사무실')
            );

            // 기구명 기준 중복 제거 후 최신순 정렬
            const sorted = outboundItems.sort((a, b) =>
                new Date(b.deploy_date || b.lending_date || 0) - new Date(a.deploy_date || a.lending_date || 0)
            );
            setItems(sorted);
            console.log('[fetchOutboundItems] Success:', sorted.length, 'items');
        } catch (error) {
            console.error('[fetchOutboundItems] Error:', error);
            setMessage('❌ 데이터 조회 실패');
        } finally {
            setLoading(false);
        }
    };

    // 입고 상태 기구 조회 (출고 처리 대상)
    // 부산사무실 = 입고 상태
    const fetchInboundItems = async () => {
        setLoading(true);
        try {
            console.log('[fetchInboundItems] Fetching...');

            // 중복 제거된 유니크한 기구 목록 가져오기
            const uniqueItems = await fetchAndDeduplicateItems();

            // 부산사무실인 항목만 필터링
            const inboundItems = uniqueItems.filter(item =>
                item.hospital_name && item.hospital_name.includes('부산사무실')
            );

            const sorted = inboundItems.sort((a, b) =>
                new Date(b.deploy_date || b.lending_date || 0) - new Date(a.deploy_date || a.lending_date || 0)
            );
            setItems(sorted);
            console.log('[fetchInboundItems] Success:', sorted.length, 'items');
        } catch (error) {
            console.error('[fetchInboundItems] Error:', error);
            setMessage('❌ 데이터 조회 실패');
        } finally {
            setLoading(false);
        }
    };

    // 기구명에서 기본명과 번호 분리하여 그룹화
    const groupByEquipment = (itemList) => {
        const grouped = {};
        itemList.forEach(item => {
            const match = item.product_name?.match(/^(.+?)(#?\d+)$/);
            let baseName, number;
            if (match) {
                baseName = match[1].trim();
                number = match[2];
            } else {
                baseName = item.product_name || '미분류';
                number = '';
            }
            if (!grouped[baseName]) {
                grouped[baseName] = [];
            }
            grouped[baseName].push({
                ...item,
                baseName,
                number
            });
        });

        // 우선 표시 카테고리 정의 (순서대로 상단 배치) - 대시보드와 동일하게 유지
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

        // 배열로 변환
        const groupArray = Object.entries(grouped)
            .map(([baseName, items]) => ({
                baseName,
                items: items.sort((a, b) => {
                    const numA = parseInt(a.number?.replace('#', '') || 0);
                    const numB = parseInt(b.number?.replace('#', '') || 0);
                    return numA - numB;
                }),
                count: items.length
            }));

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

        return groupArray;
    };

    // 3열로 나누기
    const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            const chunk = arr.slice(i, i + size);
            while (chunk.length < size) chunk.push(null);
            chunks.push(chunk);
        }
        return chunks;
    };

    // 입고 처리 확인 후 실행
    const confirmAndInbound = (item) => {
        if (window.confirm(`"${item.product_name}"을(를) 입고 처리하시겠습니까?\n\n현재 위치: ${item.hospital_name}\n→ 부산사무실로 이동`)) {
            handleInbound(item);
        }
    };

    // 입고 처리 (출고 → 부산사무실로 이동)
    const handleInbound = async (item) => {
        if (processing) return;
        setProcessing(true);
        setMessage('⏳ 입고 처리 중...');

        try {
            console.log('[handleInbound] Processing item:', item.id);

            // 부산사무실 ID 찾기
            const busanOffice = hospitals.find(h => h.name.includes('부산사무실'));
            if (!busanOffice) {
                setMessage('❌ 부산사무실이 등록되어 있지 않습니다');
                return;
            }

            // 사진 아카이브 처리 (기존 사진을 archived_photos로 이동)
            // TODO: 아카이브 API 구현 필요

            // 이동 API 호출
            await axios.post('/api/lending/move', {
                lending_item_id: item.id,
                to_hospital_id: busanOffice.id,
                moved_by: '영업팀',
                notes: `입고 처리 - ${new Date().toLocaleString('ko-KR')}`
            });

            setMessage(`✅ ${item.product_name} 입고 완료!`);
            console.log('[handleInbound] Success');

            // 목록 새로고침
            setTimeout(() => {
                fetchOutboundItems();
                setMessage('');
            }, 1500);
        } catch (error) {
            console.error('[handleInbound] Error:', error);
            setMessage(`❌ 입고 실패: ${error.response?.data?.error || error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    // 출고 아이템 선택 (다중 선택 토글)
    const handleSelectForOutbound = (item) => {
        console.log('[handleSelectForOutbound] Toggling:', item.product_name);
        setSelectedItems(prev => {
            const isAlreadySelected = prev.some(i => i.id === item.id);
            if (isAlreadySelected) {
                // 이미 선택됨 → 제거
                return prev.filter(i => i.id !== item.id);
            } else {
                // 새로 선택 → 추가
                return [...prev, item];
            }
        });
    };

    // 선택된 장비 개별 제거
    const handleRemoveSelectedItem = (itemId) => {
        setSelectedItems(prev => prev.filter(i => i.id !== itemId));
    };

    // 출고 폼 열기
    const openOutboundForm = () => {
        if (selectedItems.length === 0) {
            setMessage('❌ 출고할 장비를 선택해주세요');
            return;
        }
        setShowOutboundForm(true);
        setSelectedHospital('');
        setNewHospitalName('');
        setSelectedPersonnel('');
        setNewPersonnelName('');
        setPhotos([]);
    };

    // 출고 폼 닫기 및 초기화
    const closeOutboundForm = () => {
        setShowOutboundForm(false);
        setSelectedItems([]);
        setPhotos([]);
        setMessage('');
    };

    // 파일을 Base64로 변환
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // 사진 촬영/선택 핸들러
    const handlePhotoCapture = async (e, isCamera = false) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            console.log('[handlePhotoCapture] Processing', files.length, 'files, isCamera:', isCamera);

            // 여러 파일 처리 중 진행 상태 표시
            setMessage(`⏳ 사진 처리 중... (0/${files.length})`);

            const base64Photos = [];
            for (let i = 0; i < files.length; i++) {
                setMessage(`⏳ 사진 처리 중... (${i + 1}/${files.length})`);
                const base64 = await fileToBase64(files[i]);
                base64Photos.push(base64);
            }

            // 항상 기존 사진에 추가 (카메라, 앨범 모두)
            setPhotos(prev => [...prev, ...base64Photos]);
            const totalCount = photos.length + base64Photos.length;
            setMessage(`📷 ${files.length}장 추가됨 (총 ${totalCount}장)`);

            // 카메라/앨범 모두 연속 추가 프롬프트 표시
            setShowContinuePrompt(true);
        } catch (error) {
            console.error('[handlePhotoCapture] Error:', error);
            setMessage('❌ 사진 처리 실패');
        }
        e.target.value = '';
    };

    // 사진 삭제
    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    // 출고 처리 (다중 장비 일괄 처리)
    const handleOutbound = async () => {
        if (selectedItems.length === 0) {
            setMessage('❌ 기구를 선택해주세요');
            return;
        }
        if (!selectedHospital && !newHospitalName.trim()) {
            setMessage('❌ 병원을 선택하거나 입력해주세요');
            return;
        }
        if (photos.length === 0) {
            setMessage('❌ 사진을 최소 1장 첨부해주세요 (필수)');
            return;
        }

        setProcessing(true);
        setMessage(`⏳ ${selectedItems.length}개 장비 출고 처리 중...`);

        try {
            let hospitalId = selectedHospital;

            // 신규 병원 등록
            if (newHospitalName.trim() && !selectedHospital) {
                console.log('[handleOutbound] Registering new hospital:', newHospitalName);
                try {
                    const hospitalRes = await axios.post('/api/hospitals', {
                        name: newHospitalName.trim(),
                        code: `H${Date.now()}`,
                        address: '',
                        contact_person: selectedPersonnel || newPersonnelName || '',
                        phone: ''
                    });
                    hospitalId = hospitalRes.data.hospital_id;
                    await fetchHospitals();
                } catch (hospitalError) {
                    if (hospitalError.response?.status === 409) {
                        hospitalId = hospitalError.response.data.existing_hospital.id;
                    } else {
                        throw hospitalError;
                    }
                }
            }

            // 담당자 결정
            const movedBy = selectedPersonnel || newPersonnelName || '영업팀';

            // 담당자 목록에 신규 추가
            if (newPersonnelName.trim() && !personnelList.includes(newPersonnelName.trim())) {
                setPersonnelList(prev => [...prev, newPersonnelName.trim()]);
            }

            const hospitalName = newHospitalName.trim() ||
                hospitals.find(h => h.id.toString() === hospitalId.toString())?.name || '병원';

            // 각 장비에 대해 일괄 처리
            const totalItems = selectedItems.length;
            const successItems = [];
            const failedItems = [];

            for (let i = 0; i < totalItems; i++) {
                const item = selectedItems[i];
                setMessage(`⏳ 출고 처리 중... (${i + 1}/${totalItems}) - ${item.product_name}`);

                try {
                    // 이동 API 호출
                    console.log('[handleOutbound] Moving item:', item.id, 'to hospital:', hospitalId);
                    await axios.post('/api/lending/move', {
                        lending_item_id: item.id,
                        to_hospital_id: hospitalId,
                        moved_by: movedBy,
                        notes: `출고 처리 - ${new Date().toLocaleString('ko-KR')}`
                    });

                    // 기존 사진 삭제 후 새 사진 업로드
                    console.log('[handleOutbound] Deleting existing photos for item:', item.id);
                    try {
                        await axios.delete(`/api/lending/items/${item.id}/photos`);
                    } catch (deleteError) {
                        console.log('[handleOutbound] No existing photos or delete failed:', deleteError.message);
                    }

                    // 새 사진 업로드 (모든 장비에 동일한 사진 적용)
                    console.log('[handleOutbound] Uploading', photos.length, 'new photos for item:', item.id);
                    for (let j = 0; j < photos.length; j++) {
                        await axios.put(`/api/lending/items/${item.id}/photo`, {
                            photo_url: photos[j],
                            uploaded_by: movedBy
                        });
                    }

                    successItems.push(item.product_name);
                } catch (itemError) {
                    console.error('[handleOutbound] Error for item:', item.id, itemError);
                    failedItems.push(item.product_name);
                }
            }

            // 결과 메시지
            if (failedItems.length === 0) {
                setMessage(`✅ ${successItems.length}개 장비 → ${hospitalName} 출고 완료!`);
            } else {
                setMessage(`⚠️ 완료: ${successItems.length}개, 실패: ${failedItems.length}개 (${failedItems.join(', ')})`);
            }
            console.log('[handleOutbound] Success:', successItems.length, 'Failed:', failedItems.length);

            // 폼 초기화 및 목록 새로고침
            setTimeout(() => {
                setShowOutboundForm(false);
                setSelectedItems([]);
                setPhotos([]);
                fetchInboundItems();
                setMessage('');
            }, 2000);

        } catch (error) {
            console.error('[handleOutbound] Error:', error);
            setMessage(`❌ 출고 실패: ${error.response?.data?.error || error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    // 신규 기구 등록
    const handleNewEquipmentRegister = async () => {
        if (!newEquipmentName.trim()) {
            setMessage('❌ 기구명을 입력해주세요');
            return;
        }
        if (!newEquipmentNumber.trim()) {
            setMessage('❌ 기구 번호를 입력해주세요 (예: #1, #2)');
            return;
        }
        if (!newEquipmentPhoto && !quickRegisterMode) {
            setMessage('❌ 사진을 촬영해주세요 (또는 간편 등록 사용)');
            return;
        }

        setProcessing(true);
        setMessage('⏳ 기구 등록 중...');

        try {
            const fullName = `${newEquipmentName.trim()}${newEquipmentNumber.trim()}`;
            console.log('[handleNewEquipmentRegister] Registering:', fullName);

            // 제품 등록 (자동으로 부산사무실에 배치됨)
            const productRes = await axios.post('/api/products', {
                name: fullName,
                barcode: `EQ${Date.now()}`,
                category: 'EQUIPMENT',
                description: `영업팀 신규등록 - ${new Date().toLocaleString('ko-KR')}`
            });

            const lendingItemId = productRes.data.lending_item_id;

            // 사진 업로드 (간편 등록이 아닌 경우에만)
            if (lendingItemId && newEquipmentPhoto) {
                console.log('[handleNewEquipmentRegister] Uploading photo');
                await axios.put(`/api/lending/items/${lendingItemId}/photo`, {
                    photo_url: newEquipmentPhoto,
                    uploaded_by: '영업팀'
                });
            }

            setMessage(`✅ ${fullName} 등록 완료! (부산사무실 입고)`);
            console.log('[handleNewEquipmentRegister] Success');

            // 폼 초기화
            setTimeout(() => {
                setNewEquipmentName('');
                setNewEquipmentNumber('');
                setNewEquipmentPhoto(null);
                setQuickRegisterMode(false);
                setMessage('');
            }, 1500);

        } catch (error) {
            console.error('[handleNewEquipmentRegister] Error:', error);
            setMessage(`❌ 등록 실패: ${error.response?.data?.error || error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    // 신규 기구 사진 핸들러
    const handleNewEquipPhoto = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const base64 = await fileToBase64(file);
            setNewEquipmentPhoto(base64);
            setMessage('📷 사진 촬영 완료');
        } catch (error) {
            console.error('[handleNewEquipPhoto] Error:', error);
            setMessage('❌ 사진 처리 실패');
        }
        e.target.value = '';
    };

    return (
        <div className="mobile-container" style={{ padding: '1rem', minHeight: '100vh', background: '#f8fafc', paddingBottom: '5rem' }}>
            {/* 헤더 */}
            <div style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                marginBottom: '1rem',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>입출고 등록</h1>
            </div>

            {/* 메시지 표시 */}
            {message && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    background: message.includes('✅') ? '#d1fae5' : message.includes('⏳') ? '#fef3c7' : '#fee2e2',
                    color: message.includes('✅') ? '#065f46' : message.includes('⏳') ? '#92400e' : '#991b1b',
                    textAlign: 'center'
                }}>
                    {message}
                </div>
            )}

            {/* 모드 선택 드롭다운 */}
            <div style={{ marginBottom: '1rem' }}>
                <select
                    value={activeMode}
                    onChange={(e) => {
                        setActiveMode(e.target.value);
                        setSelectedItems([]);
                        setShowOutboundForm(false);
                        setPhotos([]);
                        setMessage('');
                    }}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1rem',
                        borderRadius: '12px',
                        border: '2px solid #e2e8f0',
                        background: 'white'
                    }}
                >
                    <option value="">-- 작업 선택 --</option>
                    <option value="inbound">📥 입고 처리</option>
                    <option value="outbound">📤 출고 처리</option>
                    <option value="new">➕ 신규 기구 등록</option>
                </select>
            </div>

            {/* 입고 처리 - 3열 그리드 */}
            {activeMode === 'inbound' && (
                <div>
                    <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>📥 출고 목록 (입고 처리 대상)</h3>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>로딩 중...</div>
                    ) : items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>출고된 기구가 없습니다</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {groupByEquipment(items).map((group, groupIndex) => (
                                <div key={groupIndex} style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                }}>
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
                                                    minHeight: '60px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {item && (
                                                        <>
                                                            <div style={{
                                                                fontSize: '0.8rem',
                                                                fontWeight: 'bold',
                                                                color: '#374151',
                                                                marginBottom: '0.25rem',
                                                                textAlign: 'center'
                                                            }}>
                                                                {item.product_name}
                                                            </div>
                                                            <div style={{
                                                                fontSize: '0.65rem',
                                                                color: '#64748b',
                                                                marginBottom: '0.3rem'
                                                            }}>
                                                                {item.hospital_name}
                                                            </div>
                                                            <button
                                                                onClick={() => confirmAndInbound(item)}
                                                                disabled={processing}
                                                                style={{
                                                                    padding: '0.2rem 0.6rem',
                                                                    background: processing ? '#94a3b8' : '#10b981',
                                                                    color: 'white',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 'bold',
                                                                    border: 'none',
                                                                    cursor: processing ? 'not-allowed' : 'pointer'
                                                                }}
                                                            >
                                                                입고
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
                </div>
            )}

            {/* 출고 처리 - 다중 선택 3열 그리드 */}
            {activeMode === 'outbound' && !showOutboundForm && (
                <div>
                    <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>📤 입고 목록 (출고 처리 대상)</h3>

                    {/* 선택된 장비 목록 표시 */}
                    {selectedItems.length > 0 && (
                        <div style={{
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            borderRadius: '12px',
                            padding: '1rem',
                            marginBottom: '1rem',
                            border: '2px solid #f59e0b'
                        }}>
                            <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '0.5rem' }}>
                                ✅ 선택된 장비 ({selectedItems.length}개)
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                {selectedItems.map(item => (
                                    <div key={item.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        background: 'white',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '16px',
                                        fontSize: '0.85rem',
                                        fontWeight: '500',
                                        color: '#1e293b',
                                        border: '1px solid #d97706'
                                    }}>
                                        <span>{item.product_name}</span>
                                        <button
                                            onClick={() => handleRemoveSelectedItem(item.id)}
                                            style={{
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '18px',
                                                height: '18px',
                                                fontSize: '0.7rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >✕</button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={openOutboundForm}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                📤 선택한 {selectedItems.length}개 장비 출고 정보 입력
                            </button>
                        </div>
                    )}

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>로딩 중...</div>
                    ) : items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>입고된 기구가 없습니다</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {groupByEquipment(items).map((group, groupIndex) => (
                                <div key={groupIndex} style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                }}>
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
                                    {chunkArray(group.items, 3).map((row, rowIndex) => (
                                        <div key={rowIndex} style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                            gap: '0.5rem',
                                            marginBottom: rowIndex < chunkArray(group.items, 3).length - 1 ? '0.5rem' : 0
                                        }}>
                                            {row.map((item, colIndex) => {
                                                const isSelected = item && selectedItems.some(i => i.id === item.id);
                                                return (
                                                    <div key={colIndex} style={{
                                                        padding: '0.5rem',
                                                        borderRadius: '8px',
                                                        background: item ? (isSelected ? '#fef3c7' : '#f8fafc') : 'transparent',
                                                        border: item ? (isSelected ? '2px solid #f59e0b' : '1px solid #e2e8f0') : 'none',
                                                        minHeight: '60px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: item ? 'pointer' : 'default',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onClick={() => item && handleSelectForOutbound(item)}
                                                    >
                                                        {item && (
                                                            <>
                                                                {isSelected && (
                                                                    <div style={{
                                                                        fontSize: '0.9rem',
                                                                        marginBottom: '0.15rem'
                                                                    }}>✅</div>
                                                                )}
                                                                <div style={{
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 'bold',
                                                                    color: isSelected ? '#92400e' : '#374151',
                                                                    textAlign: 'center'
                                                                }}>
                                                                    {item.product_name}
                                                                </div>
                                                                {!isSelected && (
                                                                    <div style={{
                                                                        fontSize: '0.65rem',
                                                                        color: '#94a3b8',
                                                                        marginTop: '0.15rem'
                                                                    }}>
                                                                        탭하여 선택
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 출고 폼 - 다중 장비 일괄 입력 */}
            {activeMode === 'outbound' && showOutboundForm && (
                <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: '#1e293b' }}>📤 출고 정보 입력</h3>
                        <button onClick={closeOutboundForm} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                    </div>

                    {/* 선택된 장비 목록 표시 */}
                    <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '8px', marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                            선택된 장비 ({selectedItems.length}개)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {selectedItems.map(item => (
                                <span key={item.id} style={{
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    fontWeight: '500'
                                }}>
                                    {item.product_name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* 병원 선택 */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>🏥 병원 선택</label>
                        <select
                            value={selectedHospital}
                            onChange={(e) => { setSelectedHospital(e.target.value); setNewHospitalName(''); }}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}
                        >
                            <option value="">기존 병원 선택...</option>
                            {hospitals.filter(h => !h.name.includes('부산사무실')).map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={newHospitalName}
                            onChange={(e) => { setNewHospitalName(e.target.value); setSelectedHospital(''); }}
                            placeholder="또는 신규 병원 입력"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                        />
                    </div>

                    {/* 담당자 선택 */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>👤 담당자</label>
                        <select
                            value={selectedPersonnel}
                            onChange={(e) => { setSelectedPersonnel(e.target.value); setNewPersonnelName(''); }}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}
                        >
                            <option value="">기존 담당자 선택...</option>
                            {personnelList.map((name, idx) => (
                                <option key={idx} value={name}>{name}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={newPersonnelName}
                            onChange={(e) => { setNewPersonnelName(e.target.value); setSelectedPersonnel(''); }}
                            placeholder="또는 신규 담당자 입력"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                        />
                    </div>

                    {/* 사진 첨부 (필수) */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>
                            📷 사진 첨부 <span style={{ color: '#ef4444' }}>(필수)</span>
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                onClick={() => cameraInputRef.current?.click()}
                                style={{ flex: 1, padding: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                📷 촬영
                            </button>
                            <button
                                onClick={() => albumInputRef.current?.click()}
                                style={{ flex: 1, padding: '0.75rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                🖼️ 앨범 (다중선택)
                            </button>
                        </div>
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoCapture(e, true)} style={{ display: 'none' }} />
                        <input ref={albumInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/*" onChange={(e) => handlePhotoCapture(e, false)} style={{ display: 'none' }} multiple />

                        {photos.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {photos.map((photo, idx) => (
                                    <div key={idx} style={{ position: 'relative' }}>
                                        <img src={photo} alt={`photo-${idx}`} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                                        <button
                                            onClick={() => removePhoto(idx)}
                                            style={{ position: 'absolute', top: '-5px', right: '-5px', width: '20px', height: '20px', borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}
                                        >✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 연속 촬영 프롬프트 */}
                    {showContinuePrompt && (
                        <div style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2000,
                            padding: '1rem'
                        }}>
                            <div style={{
                                background: 'white',
                                borderRadius: '16px',
                                padding: '1.5rem',
                                width: '100%',
                                maxWidth: '320px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>
                                    사진 {photos.length}장 추가됨
                                </h3>
                                <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                    더 추가하시겠습니까?
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => {
                                                setShowContinuePrompt(false);
                                                setTimeout(() => cameraInputRef.current?.click(), 100);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                background: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            📷 촬영
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowContinuePrompt(false);
                                                setTimeout(() => albumInputRef.current?.click(), 100);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                background: '#8b5cf6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            🖼️ 앨범
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowContinuePrompt(false)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✅ 완료
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 출고 버튼 */}
                    <button
                        onClick={handleOutbound}
                        disabled={processing}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: processing ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            cursor: processing ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {processing ? '처리 중...' : `📤 ${selectedItems.length}개 장비 일괄 출고`}
                    </button>
                </div>
            )}

            {/* 신규 기구 등록 */}
            {activeMode === 'new' && (
                <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>➕ 신규 기구 등록</h3>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>기구명</label>
                        <input
                            type="text"
                            value={newEquipmentName}
                            onChange={(e) => setNewEquipmentName(e.target.value)}
                            placeholder="예: 지니어스, 엘리아드"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>기구 번호</label>
                        <input
                            type="text"
                            value={newEquipmentNumber}
                            onChange={(e) => setNewEquipmentNumber(e.target.value)}
                            placeholder="예: #1, #2, #3"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>
                            📷 사진 {!quickRegisterMode && <span style={{ color: '#ef4444' }}>(필수)</span>}
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                onClick={() => { setQuickRegisterMode(false); newEquipCameraRef.current?.click(); }}
                                style={{ flex: 1, padding: '0.75rem', background: quickRegisterMode ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                📷 촬영
                            </button>
                            <button
                                onClick={() => { setQuickRegisterMode(false); newEquipAlbumRef.current?.click(); }}
                                style={{ flex: 1, padding: '0.75rem', background: quickRegisterMode ? '#94a3b8' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                🖼️ 앨범
                            </button>
                            <button
                                onClick={() => { setQuickRegisterMode(true); setNewEquipmentPhoto(null); setMessage('✍️ 간편 등록 모드 - 사진 없이 등록'); }}
                                style={{ flex: 1, padding: '0.75rem', background: quickRegisterMode ? '#f97316' : '#64748b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: quickRegisterMode ? 'bold' : 'normal' }}
                            >
                                ✍️ 간편
                            </button>
                        </div>
                        <input ref={newEquipCameraRef} type="file" accept="image/*" capture="environment" onChange={handleNewEquipPhoto} style={{ display: 'none' }} />
                        <input ref={newEquipAlbumRef} type="file" accept="image/*" onChange={handleNewEquipPhoto} style={{ display: 'none' }} />

                        {newEquipmentPhoto && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <img src={newEquipmentPhoto} alt="new-equip" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                            </div>
                        )}
                        {quickRegisterMode && !newEquipmentPhoto && (
                            <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📋</div>
                                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>사진없음 - 텍스트만 등록</div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleNewEquipmentRegister}
                        disabled={processing}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: processing ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            cursor: processing ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {processing ? '등록 중...' : '✅ 기구 등록'}
                    </button>
                </div>
            )}

            {/* 하단 네비게이션 */}
            <SalesBottomNav />
        </div>
    );
}

export default SalesInOutRegisterPage;
