import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import CameraScanner from '../../components/CameraScanner';
import ManualBarcodeInput from '../../components/ManualBarcodeInput';
import { API_BASE_URL } from '../../config';
import { compressImageToBase64 } from '../../utils/imageCompression';
import '../../styles/mobile.css';

// axios 기본 URL 설정
axios.defaults.baseURL = API_BASE_URL;
// ngrok 무료 버전 경고 페이지 우회용 헤더
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

function MobileLendingPage() {
    const [step, setStep] = useState(0); // 0: 모드 선택, 1: 병원 선택(신규배치) or 스캔(이동/회수), 2: 스캔(신규배치) or 유형선택(이동/회수), 3: 정보입력
    const [workMode, setWorkMode] = useState(''); // 'NEW_DEPLOY' or 'MOVE_RETURN'
    const [scanMode, setScanMode] = useState(''); // 'barcode' or 'qr'
    const [lendingItem, setLendingItem] = useState(null);
    const [movementType, setMovementType] = useState('');
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [selectedHospitalFirst, setSelectedHospitalFirst] = useState(''); // 신규 배치 시 먼저 선택한 병원
    const [hospitalInput, setHospitalInput] = useState(''); // 신규 병원 이름 입력
    const [useNewHospital, setUseNewHospital] = useState(false); // 신규 병원 입력 모드
    const [movedBy, setMovedBy] = useState('');
    const [notes, setNotes] = useState('');
    const [message, setMessage] = useState('');
    const [scanning, setScanning] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [latestItems, setLatestItems] = useState([]);
    const [loadingLatest, setLoadingLatest] = useState(true);

    // 이미지 기반 배치 상태
    const [deployMode, setDeployMode] = useState(''); // 'QR' or 'IMAGE'
    const [imageProductName, setImageProductName] = useState('');
    const [productImage, setProductImage] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const cameraInputRef = useRef(null);
    const albumInputRef = useRef(null); // 앨범 선택용

    // 이동/회수 모드 선택 상태
    const [moveReturnMode, setMoveReturnMode] = useState(''); // 'QR' or 'LIST'
    const [deployedItems, setDeployedItems] = useState([]);
    const [selectedDeployedItem, setSelectedDeployedItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    useEffect(() => {
        fetchHospitals();
        fetchLatestItems();
    }, []);

    const fetchHospitals = async () => {
        try {
            const res = await axios.get('/api/hospitals');
            setHospitals(res.data);
        } catch (error) {
            console.error('병원 목록 조회 실패:', error);
        }
    };

    const fetchLatestItems = async () => {
        try {
            const res = await axios.get('/api/lending/items');

            // 1. BIOLOGIC(입고) 제품 제외 - 기구/장비와 이미지 등록 제품만 표시
            const filtered = res.data.filter(item =>
                item.category !== 'BIOLOGIC' && item.category !== 'biologic'
            );

            // 2. 최신순 정렬 (deploy_date 또는 lending_date 기준)
            const sorted = filtered.sort((a, b) => {
                const dateA = new Date(a.deploy_date || a.lending_date || 0);
                const dateB = new Date(b.deploy_date || b.lending_date || 0);
                return dateB - dateA;
            });

            // 3. 동일 제품명은 최신 1개만 유지 (중복 제거)
            const uniqueByName = [];
            const seenNames = new Set();
            for (const item of sorted) {
                const name = item.product_name?.toLowerCase();
                if (!seenNames.has(name)) {
                    seenNames.add(name);
                    uniqueByName.push(item);
                }
            }

            setLatestItems(uniqueByName);
            setCurrentPage(1);
            setLoadingLatest(false);
        } catch (error) {
            console.error('최신 현황 조회 실패:', error);
            setLoadingLatest(false);
        }
    };

    // 페이지네이션 계산
    const totalPages = Math.ceil(latestItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = latestItems.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
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

    const startScanning = (mode) => {
        setScanMode(mode);
        if (workMode === 'NEW_DEPLOY') {
            setStep(2); // 신규 배치: 병원 선택 후 스캔
        } else {
            setStep(1); // 이동/회수: 바로 스캔
        }
        setScanning(true);
        setMessage('');
    };

    // 신규 배치: QR 스캔 후 자동 배치
    const handleNewDeploymentScan = async (barcode) => {
        try {
            console.log('🔍 Scanned barcode:', barcode);
            console.log('🔍 Barcode type:', typeof barcode);
            console.log('🔍 Barcode length:', barcode.length);

            setScanning(false);
            setMessage('⏳ 제품 조회 중...');

            // 1. 제품 조회
            console.log('📡 Calling API:', `/api/products/${barcode}`);
            const productRes = await axios.get(`/api/products/${barcode}`);
            console.log('✅ Product found:', productRes.data);
            const product = productRes.data;

            // 2. 병원 처리 (신규 또는 기존)
            let hospitalId = selectedHospitalFirst;

            if (useNewHospital && hospitalInput.trim()) {
                // 신규 병원 등록
                setMessage('⏳ 병원 등록 중...');
                console.log('🏥 Registering new hospital:', hospitalInput);
                try {
                    const hospitalRes = await axios.post('/api/hospitals', {
                        name: hospitalInput.trim(),
                        code: `H${Date.now()}`, // 자동 생성 코드
                        address: '',
                        contact_person: movedBy || '',
                        phone: ''
                    });
                    hospitalId = hospitalRes.data.hospital_id;
                    console.log('✅ Hospital registered, ID:', hospitalId);

                    // 병원 목록 새로고침
                    await fetchHospitals();
                } catch (hospitalError) {
                    // 409 에러: 중복 병원
                    if (hospitalError.response?.status === 409) {
                        const existingHospital = hospitalError.response.data.existing_hospital;
                        console.log('⚠️ Duplicate hospital, using existing:', existingHospital.name);
                        setMessage(`ℹ️ "${existingHospital.name}"이(가) 이미 존재합니다. 해당 병원으로 배치합니다.`);
                        hospitalId = existingHospital.id;
                        // 신규 병원 모드 해제하고 기존 병원 ID 설정
                        setUseNewHospital(false);
                        setSelectedHospitalFirst(existingHospital.id.toString());
                    } else {
                        throw hospitalError;
                    }
                }
            }

            // 3. 자동 배치
            setMessage('⏳ 배치 처리 중...');
            console.log('📦 Deploying product:', { product_id: product.id, hospital_id: hospitalId });
            const deployRes = await axios.post('/api/lending/deploy', {
                product_id: product.id,
                hospital_id: hospitalId,
                quantity: 1,
                moved_by: movedBy || '영업팀',
                notes: notes || `모바일 앱에서 배치 - ${new Date().toLocaleString('ko-KR')}`
            });
            console.log('✅ Deployment successful:', deployRes.data);

            // 4. 성공 메시지
            const hospitalName = useNewHospital ? hospitalInput :
                hospitals.find(h => h.id == hospitalId)?.name || '병원';

            setMessage(`✅ ${product.name}을(를) ${hospitalName}에 배치했습니다!`);

            // 5. 폼 리셋
            setTimeout(() => {
                resetForm();
            }, 2000);

        } catch (error) {
            console.error('❌ Error:', error);
            console.error('❌ Error response:', error.response);
            setScanning(false);
            if (error.response?.status === 404) {
                setMessage(`❌ 등록되지 않은 제품입니다\n스캔된 바코드: ${barcode}`);
            } else {
                setMessage(`❌ 배치 실패: ${error.response?.data?.error || error.message}`);
            }
        }
    };

    // 이동/회수: 기존 로직
    const handleBarcodeDetected = async (barcode) => {
        console.log('📥 Raw barcode detected:', barcode);
        console.log('📥 Type:', typeof barcode);

        // QR 코드가 JSON 형식인 경우 파싱
        let actualBarcode = barcode;
        if (typeof barcode === 'string') {
            try {
                const parsed = JSON.parse(barcode);
                if (parsed.barcode) {
                    actualBarcode = parsed.barcode;
                    console.log('✅ Parsed barcode from JSON:', actualBarcode);
                }
            } catch (e) {
                // JSON이 아니면 그대로 사용
                actualBarcode = barcode;
            }
        }

        console.log('🎯 Final barcode:', actualBarcode);

        if (workMode === 'NEW_DEPLOY') {
            return handleNewDeploymentScan(actualBarcode);
        }

        // 이동/회수 로직: 랜딩된 제품 조회
        try {
            setMessage('⏳ 제품 조회 중...');
            const res = await axios.get(`/api/lending/items/barcode/${actualBarcode}`);
            console.log('✅ Lending item found:', res.data);

            if (res.data && res.data.is_deployed) {
                // 랜딩된 제품 정보 설정
                setLendingItem({
                    id: res.data.id,
                    product_name: res.data.product_name,
                    hospital_id: res.data.hospital_id,
                    hospital_name: res.data.hospital_name,
                    barcode: actualBarcode
                });
                setScanning(false);
                setStep(2);
                setMessage('');
            } else {
                setMessage('❌ 이 제품은 현재 랜딩되어 있지 않습니다');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            setMessage('❌ 등록되지 않았거나 랜딩되지 않은 제품입니다');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleMovementTypeSelect = (type) => {
        setMovementType(type);
        setStep(3);
    };

    const handleMove = async () => {
        if (!selectedHospital) {
            setMessage('❌ 목적지 병원을 선택해주세요');
            return;
        }

        try {
            const res = await axios.post('/api/lending/move', {
                lending_item_id: lendingItem.id,
                to_hospital_id: selectedHospital,
                moved_by: movedBy,
                notes: notes
            });

            setMessage(`✅ ${res.data.message}`);
            resetForm();
        } catch (error) {
            setMessage(`❌ 이동 실패: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleReturn = async () => {
        try {
            const res = await axios.post('/api/lending/return', {
                lending_item_id: lendingItem.id,
                moved_by: movedBy,
                notes: notes
            });

            setMessage(`✅ ${res.data.message}`);
            resetForm();
        } catch (error) {
            setMessage(`❌ 처리 실패: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleManualSubmit = () => {
        if (manualInput.trim()) {
            handleBarcodeDetected(manualInput.trim());
            setManualInput('');
        }
    };

    // 파일을 Base64로 변환 (1280px·q70 압축 적용)
    const fileToBase64 = (file) => compressImageToBase64(file);

    // 이미지 촬영 처리
    const handleImageCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            console.log('📷 [handleImageCapture] 사진 촬영:', file.name);
            const base64 = await fileToBase64(file);
            setProductImage(base64);
            setMessage('📷 사진이 촬영되었습니다');
        } catch (error) {
            console.error('❌ [handleImageCapture] 사진 촬영 실패:', error);
            setMessage('❌ 사진 촬영 실패');
        }
        e.target.value = '';
    };

    // 앨범에서 이미지 선택 처리
    const handleAlbumSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            console.log('🖼️ [handleAlbumSelect] 앨범에서 이미지 선택:', file.name);
            const base64 = await fileToBase64(file);
            setProductImage(base64);
            setMessage('🖼️ 앨범에서 사진이 선택되었습니다');
            console.log('✅ [handleAlbumSelect] 이미지 Base64 변환 완료');
        } catch (error) {
            console.error('❌ [handleAlbumSelect] 이미지 선택 실패:', error);
            setMessage('❌ 이미지 선택 실패');
        }
        e.target.value = '';
    };

    // 이미지 기반 배치 처리
    const handleImageDeploy = async () => {
        if (!imageProductName.trim()) {
            setMessage('❌ 제품명을 입력해주세요');
            return;
        }
        if (!productImage) {
            setMessage('❌ 제품 사진을 촬영해주세요');
            return;
        }

        try {
            setUploadingImage(true);
            setMessage('⏳ 배치 처리 중...');

            // 1. 병원 처리
            let hospitalId = selectedHospitalFirst;
            if (useNewHospital && hospitalInput.trim()) {
                try {
                    const hospitalRes = await axios.post('/api/hospitals', {
                        name: hospitalInput.trim(),
                        code: `H${Date.now()}`,
                        address: '',
                        contact_person: movedBy || '',
                        phone: ''
                    });
                    hospitalId = hospitalRes.data.hospital_id;
                    await fetchHospitals();
                } catch (hospitalError) {
                    // 409 에러: 중복 병원
                    if (hospitalError.response?.status === 409) {
                        const existingHospital = hospitalError.response.data.existing_hospital;
                        console.log('⚠️ Duplicate hospital, using existing:', existingHospital.name);
                        setMessage(`ℹ️ "${existingHospital.name}"이(가) 이미 존재합니다. 해당 병원으로 배치합니다.`);
                        hospitalId = existingHospital.id;
                        setUseNewHospital(false);
                        setSelectedHospitalFirst(existingHospital.id.toString());
                    } else {
                        throw hospitalError;
                    }
                }
            }

            // 2. 임시 제품 생성 (이미지 기반) - 자동으로 부산사무실에 초기 배치됨
            const productRes = await axios.post('/api/products', {
                name: imageProductName.trim(),
                barcode: `IMG${Date.now()}`, // 임시 바코드
                category: 'EQUIPMENT', // 기구/장비 카테고리 (등록현황에 표시되도록)
                description: `이미지로 등록된 제품 - ${new Date().toLocaleString('ko-KR')}`
            });

            const lendingItemId = productRes.data.lending_item_id;

            // 3. 사용자가 선택한 병원으로 이동 (부산사무실에서)
            if (hospitalId && hospitalId != 2) { // 2 = 부산사무실
                await axios.post('/api/lending/move', {
                    lending_item_id: lendingItemId,
                    to_hospital_id: hospitalId,
                    moved_by: movedBy || '영업팀',
                    notes: `이미지 등록으로 배치 - ${new Date().toLocaleString('ko-KR')}`
                });
            }

            // 4. 사진 업로드
            if (lendingItemId) {
                await axios.put(`/api/lending/items/${lendingItemId}/photo`, {
                    photo_url: productImage,
                    uploaded_by: movedBy || '영업팀'
                });
            }

            const hospitalName = useNewHospital ? hospitalInput :
                hospitals.find(h => h.id == hospitalId)?.name || '병원';

            setMessage(`✅ ${imageProductName}을(를) ${hospitalName}에 배치했습니다!`);
            resetForm();
        } catch (error) {
            console.error('배치 실패:', error);
            setMessage(`❌ 배치 실패: ${error.response?.data?.error || error.message}`);
        } finally {
            setUploadingImage(false);
        }
    };

    const resetForm = () => {
        fetchLatestItems();
        setTimeout(() => {
            setStep(0);
            setWorkMode('');
            setScanMode('');
            setLendingItem(null);
            setMovementType('');
            setSelectedHospital('');
            setSelectedHospitalFirst('');
            setHospitalInput('');
            setUseNewHospital(false);
            setMovedBy('');
            setNotes('');
            setScanning(false);
            setMessage('');
            setManualInput('');
            // 이미지 기반 배치 상태 초기화
            setDeployMode('');
            setImageProductName('');
            setProductImage(null);
            setUploadingImage(false);
            // 이동/회수 모드 상태 초기화
            setMoveReturnMode('');
            setDeployedItems([]);
            setSelectedDeployedItem(null);
            setSearchQuery('');
        }, 2000);
    };

    return (
        <div className="mobile-container">
            <div className="mobile-header">
                <h1>🚚 기구 이동 등록</h1>
                {step > 0 && (
                    <button
                        onClick={() => setStep(0)}
                        className="mobile-btn-text"
                        style={{ position: 'absolute', right: '1rem', top: '1.2rem', color: 'white', background: 'none', border: 'none' }}
                    >
                        처음으로
                    </button>
                )}
            </div>

            {message && (
                <div className={`mobile-message ${message.includes('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            {/* Step 0: 모드 선택 */}
            {step === 0 && (
                <div className="mobile-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
                    <button
                        onClick={() => {
                            setWorkMode('NEW_DEPLOY');
                            setStep(1); // 병원 선택으로 이동
                        }}
                        className="mobile-btn"
                        style={{
                            padding: '3rem 1rem',
                            fontSize: '1.5rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🆕</div>
                        신규 배치
                        <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>병원에 장비 처음 배치</div>
                    </button>

                    <button
                        onClick={() => {
                            setWorkMode('MOVE_RETURN');
                            setStep(1); // 스캔 모드 선택으로 이동
                        }}
                        className="mobile-btn"
                        style={{
                            padding: '3rem 1rem',
                            fontSize: '1.5rem',
                            background: 'linear-gradient(135deg, #2af598 0%, #009efd 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>�</div>
                        이동 / 회수
                        <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>기존 장비 이동 또는 회수</div>
                    </button>

                    {/* 최신 랜딩 현황 위젯 */}
                    <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>📊 최신 랜딩 현황</h3>
                            <button
                                onClick={fetchLatestItems}
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', border: 'none', borderRadius: '6px', background: '#6c757d', color: 'white' }}
                            >
                                🔄
                            </button>
                        </div>

                        {loadingLatest ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                                로딩 중...
                            </div>
                        ) : latestItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                                랜딩 데이터가 없습니다
                            </div>
                        ) : (
                            <>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>
                                    총 {latestItems.length}개 항목 (페이지 {currentPage}/{totalPages})
                                </div>
                                {currentItems.map(item => (
                                    <div key={item.id} style={{
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

                                {/* 페이지네이션 */}
                                {totalPages > 1 && (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        marginTop: '0.8rem'
                                    }}>
                                        <button
                                            onClick={() => handlePageChange(1)}
                                            disabled={currentPage === 1}
                                            style={{
                                                padding: '0.4rem 0.6rem',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                background: currentPage === 1 ? '#f0f0f0' : 'white',
                                                color: currentPage === 1 ? '#999' : '#333',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            «
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            style={{
                                                padding: '0.4rem 0.6rem',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                background: currentPage === 1 ? '#f0f0f0' : 'white',
                                                color: currentPage === 1 ? '#999' : '#333',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            ‹
                                        </button>

                                        <span style={{ padding: '0.4rem 0.8rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                            {currentPage} / {totalPages}
                                        </span>

                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                padding: '0.4rem 0.6rem',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                background: currentPage === totalPages ? '#f0f0f0' : 'white',
                                                color: currentPage === totalPages ? '#999' : '#333',
                                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            ›
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(totalPages)}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                padding: '0.4rem 0.6rem',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                background: currentPage === totalPages ? '#f0f0f0' : 'white',
                                                color: currentPage === totalPages ? '#999' : '#333',
                                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            »
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Step 1: 병원 선택 (신규 배치) 또는 스캔 모드 선택 (이동/회수) */}
            {step === 1 && workMode === 'NEW_DEPLOY' && (
                <div className="mobile-content">
                    <h3 style={{ marginBottom: '1rem' }}>🏥 병원 선택</h3>

                    {/* 기존 병원 선택 */}
                    {!useNewHospital && (
                        <>
                            <select
                                value={selectedHospitalFirst}
                                onChange={(e) => setSelectedHospitalFirst(e.target.value)}
                                className="mobile-select"
                                style={{ marginBottom: '1rem' }}
                            >
                                <option value="">기존 병원 선택</option>
                                {hospitals.map(hospital => (
                                    <option key={hospital.id} value={hospital.id}>
                                        {hospital.name}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={() => setUseNewHospital(true)}
                                className="mobile-btn mobile-btn-outline"
                                style={{ marginBottom: '1rem' }}
                            >
                                + 신규 병원 입력
                            </button>
                        </>
                    )}

                    {/* 신규 병원 입력 */}
                    {useNewHospital && (
                        <>
                            <input
                                type="text"
                                value={hospitalInput}
                                onChange={(e) => setHospitalInput(e.target.value)}
                                placeholder="병원 이름 입력"
                                className="mobile-input"
                                style={{ marginBottom: '1rem' }}
                            />

                            <button
                                onClick={() => {
                                    setUseNewHospital(false);
                                    setHospitalInput('');
                                }}
                                className="mobile-btn mobile-btn-outline"
                                style={{ marginBottom: '1rem' }}
                            >
                                ← 기존 병원 선택으로
                            </button>
                        </>
                    )}

                    {/* 담당자 입력 */}
                    <input
                        type="text"
                        value={movedBy}
                        onChange={(e) => setMovedBy(e.target.value)}
                        placeholder="담당자 이름 (선택)"
                        className="mobile-input"
                        style={{ marginBottom: '1rem' }}
                    />

                    {/* 다음 버튼들 */}
                    {!deployMode && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                            <button
                                onClick={() => {
                                    if (!useNewHospital && !selectedHospitalFirst) {
                                        setMessage('❌ 병원을 선택해주세요');
                                        return;
                                    }
                                    if (useNewHospital && !hospitalInput.trim()) {
                                        setMessage('❌ 병원 이름을 입력해주세요');
                                        return;
                                    }
                                    setMessage('');
                                    setDeployMode('QR');
                                    setStep(2);
                                    setScanning(true);
                                }}
                                className="mobile-btn mobile-btn-primary"
                                style={{
                                    padding: '1rem',
                                    fontSize: '1rem',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                }}
                            >
                                📱 장비: QR스캔으로배치
                            </button>
                            <button
                                onClick={() => {
                                    if (!useNewHospital && !selectedHospitalFirst) {
                                        setMessage('❌ 병원을 선택해주세요');
                                        return;
                                    }
                                    if (useNewHospital && !hospitalInput.trim()) {
                                        setMessage('❌ 병원 이름을 입력해주세요');
                                        return;
                                    }
                                    setMessage('');
                                    setDeployMode('IMAGE');
                                }}
                                className="mobile-btn"
                                style={{
                                    padding: '1rem',
                                    fontSize: '1rem',
                                    background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px'
                                }}
                            >
                                📷 이미지 등록으로배치
                            </button>
                        </div>
                    )}

                    {/* 이미지 등록 폼 */}
                    {deployMode === 'IMAGE' && (
                        <div style={{
                            background: '#f8f9fa',
                            padding: '1rem',
                            borderRadius: '12px',
                            marginTop: '1rem'
                        }}>
                            <h4 style={{ marginBottom: '1rem', color: '#17a2b8' }}>📷 이미지로 제품 등록</h4>

                            {/* 제품명 입력 */}
                            <input
                                type="text"
                                value={imageProductName}
                                onChange={(e) => setImageProductName(e.target.value)}
                                placeholder="제품명 입력 *"
                                className="mobile-input"
                                style={{ marginBottom: '1rem' }}
                            />

                            {/* 사진 등록 버튼들 */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <button
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="mobile-btn"
                                    style={{
                                        flex: 1,
                                        padding: '1rem',
                                        background: productImage ? '#28a745' : '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {productImage ? '✅ 다시 촬영' : '📸 촬영하기'}
                                </button>
                                <button
                                    onClick={() => albumInputRef.current?.click()}
                                    className="mobile-btn"
                                    style={{
                                        flex: 1,
                                        padding: '1rem',
                                        background: productImage ? '#28a745' : '#17a2b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {productImage ? '✅ 다시 선택' : '🖼️ 앨범에서 선택'}
                                </button>
                            </div>

                            {/* 촬영된 사진 미리보기 */}
                            {productImage && (
                                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                                    <img
                                        src={productImage}
                                        alt="제품 사진"
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '200px',
                                            borderRadius: '8px',
                                            border: '2px solid #28a745'
                                        }}
                                    />
                                </div>
                            )}

                            {/* 숨겨진 카메라 입력 */}
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={handleImageCapture}
                            />

                            {/* 숨겨진 앨범 선택 입력 */}
                            <input
                                ref={albumInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleAlbumSelect}
                            />

                            {/* 등록 버튼 */}
                            <button
                                onClick={handleImageDeploy}
                                disabled={uploadingImage || !imageProductName.trim() || !productImage}
                                className="mobile-btn mobile-btn-primary mobile-btn-large"
                                style={{
                                    width: '100%',
                                    opacity: (!imageProductName.trim() || !productImage) ? 0.5 : 1
                                }}
                            >
                                {uploadingImage ? '⏳ 등록 중...' : '✅ 등록하기'}
                            </button>

                            {/* 취소 버튼 */}
                            <button
                                onClick={() => {
                                    setDeployMode('');
                                    setImageProductName('');
                                    setProductImage(null);
                                }}
                                className="mobile-btn mobile-btn-outline"
                                style={{ width: '100%', marginTop: '0.5rem' }}
                            >
                                ← 뒤로가기
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Step 1: 이동/회수 방법 선택 */}
            {step === 1 && workMode === 'MOVE_RETURN' && (
                <div className="mobile-content">
                    {/* 선택 화면 */}
                    {!moveReturnMode && (
                        <>
                            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>📦 이동/회수 방법 선택</h3>

                            <button
                                onClick={() => {
                                    setMoveReturnMode('QR');
                                    setScanning(true);
                                }}
                                className="mobile-btn"
                                style={{
                                    width: '100%',
                                    padding: '1.5rem',
                                    marginBottom: '1rem',
                                    fontSize: '1.1rem',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px'
                                }}
                            >
                                📱 QR코드로 스캔해서 이동/회수
                                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '0.3rem' }}>
                                    카메라로 QR 스캔
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    setMoveReturnMode('LIST');
                                    setMessage('⏳ 배치된 제품 조회 중...');
                                    try {
                                        const res = await axios.get('/api/lending/items');
                                        // 이미지로 등록된 제품만 필터 (product_barcode가 "IMG"로 시작)
                                        const imageRegistered = res.data.filter(item =>
                                            item.product_barcode?.startsWith('IMG')
                                        );
                                        setDeployedItems(imageRegistered);
                                        setMessage(imageRegistered.length > 0 ? '' : '📷 이미지 등록 제품이 없습니다');
                                    } catch (error) {
                                        setMessage('❌ 제품 목록 조회 실패');
                                        // 실패 시 latestItems 사용
                                        setDeployedItems(latestItems);
                                    }
                                }}
                                className="mobile-btn"
                                style={{
                                    width: '100%',
                                    padding: '1.5rem',
                                    fontSize: '1.1rem',
                                    background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px'
                                }}
                            >
                                📷 이미지 등록 제품 선택해서 이동/회수
                                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '0.3rem' }}>
                                    이미지로 배치한 제품 목록
                                </div>
                            </button>

                            <button
                                onClick={() => setStep(0)}
                                className="mobile-btn mobile-btn-outline"
                                style={{ width: '100%', marginTop: '1rem' }}
                            >
                                ← 처음으로
                            </button>
                        </>
                    )}

                    {/* QR 스캔 모드 */}
                    {moveReturnMode === 'QR' && scanning && (
                        <div className="mobile-scanner">
                            <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#333' }}>
                                📱 QR 코드 스캔
                            </h3>
                            <p style={{ textAlign: 'center', color: '#666', marginBottom: '1.5rem' }}>
                                이동할 장비의 QR 코드를 스캔하세요
                            </p>
                            <CameraScanner onDetected={handleBarcodeDetected} />
                            <button
                                onClick={() => {
                                    setMoveReturnMode('');
                                    setScanning(false);
                                }}
                                className="mobile-btn mobile-btn-outline"
                                style={{ width: '100%', marginTop: '1rem' }}
                            >
                                ← 뒤로가기
                            </button>
                        </div>
                    )}

                    {/* 제품 목록 선택 모드 */}
                    {moveReturnMode === 'LIST' && (
                        <div>
                            <h3 style={{ marginBottom: '1rem' }}>📷 이미지 등록 제품 선택</h3>

                            {/* 검색 */}
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="🔍 제품명 검색..."
                                className="mobile-input"
                                style={{ marginBottom: '1rem' }}
                            />

                            {/* 제품 목록 */}
                            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
                                {deployedItems
                                    .filter(item =>
                                        !searchQuery ||
                                        item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        item.hospital_name?.toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                    .map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                setSelectedDeployedItem(item);
                                                setLendingItem({
                                                    id: item.id,
                                                    product_name: item.product_name,
                                                    hospital_id: item.hospital_id,
                                                    hospital_name: item.hospital_name,
                                                    barcode: item.barcode
                                                });
                                                setStep(2);
                                            }}
                                            style={{
                                                padding: '0.8rem',
                                                marginBottom: '0.5rem',
                                                background: 'white',
                                                borderRadius: '8px',
                                                border: '1px solid #ddd',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>
                                                {item.product_name}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                🏥 {item.hospital_name} · 👤 {item.moved_by || '-'}
                                            </div>
                                        </div>
                                    ))
                                }
                                {deployedItems.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                                        배치된 제품이 없습니다
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    setMoveReturnMode('');
                                    setDeployedItems([]);
                                    setSearchQuery('');
                                }}
                                className="mobile-btn mobile-btn-outline"
                                style={{ width: '100%' }}
                            >
                                ← 뒤로가기
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: 스캔 (신규 배치 또는 이동/회수) */}
            {((step === 2 && workMode === 'NEW_DEPLOY') || (step === 1 && workMode === 'MOVE_RETURN')) && scanning && (
                <div className="mobile-scanner">
                    {/* 신규 배치: 선택된 병원 표시 */}
                    {workMode === 'NEW_DEPLOY' && (
                        <div style={{
                            padding: '1rem',
                            marginBottom: '1rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            borderRadius: '8px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                🏥 {useNewHospital ? hospitalInput : hospitals.find(h => h.id == selectedHospitalFirst)?.name}
                            </div>
                            <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '0.3rem' }}>
                                {useNewHospital ? '(신규 병원)' : '(기존 병원)'}
                            </div>
                        </div>
                    )}

                    {/* 수동 입력 - 상단으로 이동 */}
                    <ManualBarcodeInput
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        onSubmit={handleManualSubmit}
                        placeholder="990170418714"
                    />

                    {/* 카메라 스캐너 - 기본으로 열림 */}
                    <details open style={{ marginBottom: '1rem' }}>
                        <summary style={{
                            padding: '1rem',
                            background: '#e3f2fd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            border: '2px solid #1976d2',
                            color: '#1976d2'
                        }}>
                            📷 카메라 스캔
                        </summary>
                        <div style={{ marginTop: '1rem' }}>
                            <CameraScanner onDetected={handleBarcodeDetected} />
                            <p className="scanner-hint" style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                {workMode === 'NEW_DEPLOY'
                                    ? '장비의 QR 코드를 스캔하세요'
                                    : (scanMode === 'barcode' ? '제품의 바코드를 비춰주세요' : '제품의 QR코드를 비춰주세요')
                                }
                            </p>
                        </div>
                    </details>


                    <button
                        onClick={() => setStep(0)}
                        className="mobile-btn mobile-btn-outline"
                        style={{ marginTop: '1rem' }}
                    >
                        취소
                    </button>
                </div>
            )}

            {/* Step 2: 병원 선택 및 자동 이동 (이동/회수만) */}
            {step === 2 && lendingItem && workMode === 'MOVE_RETURN' && (
                <div className="mobile-content">
                    <div className="item-card">
                        <h3>📦 {lendingItem.product_name}</h3>
                        <p>현재 위치: <strong>{lendingItem.hospital_name}</strong></p>
                    </div>

                    <h3 style={{ marginTop: '1.5rem' }}>🏥 목적지 병원 선택</h3>
                    <select
                        value={selectedHospital}
                        onChange={(e) => setSelectedHospital(e.target.value)}
                        className="mobile-select"
                        style={{ marginBottom: '1rem' }}
                    >
                        <option value="">병원을 선택하세요</option>
                        {hospitals
                            .filter(h => h.id !== lendingItem?.hospital_id)
                            .map(hospital => (
                                <option key={hospital.id} value={hospital.id}>
                                    {hospital.name}
                                </option>
                            ))
                        }
                    </select>

                    <input
                        type="text"
                        value={movedBy}
                        onChange={(e) => setMovedBy(e.target.value)}
                        placeholder="담당자 이름 (선택)"
                        className="mobile-input"
                        style={{ marginBottom: '1rem' }}
                    />

                    <button
                        onClick={handleMove}
                        className="mobile-btn mobile-btn-primary mobile-btn-large"
                        disabled={!selectedHospital}
                    >
                        ✅ 이동 처리
                    </button>

                    <button
                        onClick={() => setStep(1)}
                        className="mobile-btn mobile-btn-outline"
                        style={{ marginTop: '0.5rem' }}
                    >
                        ← 다시 스캔
                    </button>
                </div>
            )}

            {/* Step 3: 정보 입력 (수리/회수/무빙) */}
            {step === 3 && movementType !== 'move' && (
                <div className="mobile-content">
                    <h3>
                        {movementType === 'repair' && '🔧 수리 입고'}
                        {movementType === 'return' && '🏢 사무실 입고'}
                        {movementType === 'return_moving' && '🚚 본사무빙 반납'}
                    </h3>

                    <input
                        type="text"
                        value={movedBy}
                        onChange={(e) => setMovedBy(e.target.value)}
                        placeholder="담당자 이름"
                        className="mobile-input"
                    />

                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={
                            movementType === 'repair' ? '고장 증상 입력' :
                                movementType === 'return_moving' ? '반납 사유 입력' : '비고'
                        }
                        className="mobile-textarea"
                        rows="3"
                    />

                    <button
                        onClick={handleReturn}
                        className="mobile-btn mobile-btn-large"
                        style={{
                            backgroundColor:
                                movementType === 'repair' ? '#6c757d' :
                                    movementType === 'return' ? '#ffc107' : '#28a745',
                            color: movementType === 'return' ? 'black' : 'white'
                        }}
                    >
                        ✅ 등록 완료
                    </button>
                </div>
            )}
        </div>
    );
}

export default MobileLendingPage;
