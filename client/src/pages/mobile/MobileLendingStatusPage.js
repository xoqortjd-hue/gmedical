import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { compressImageToBase64 } from '../../utils/imageCompression';
import EditableProductName from '../../components/EditableProductName';
import '../../styles/mobile.css';

function MobileLendingStatusPage() {
    const [lendingItems, setLendingItems] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [loading, setLoading] = useState(true);
    const [deleteMode, setDeleteMode] = useState(false);
    const [message, setMessage] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // 선택된 아이템 (터치 피드백용)
    const [selectedItemId, setSelectedItemId] = useState(null);

    // 비고/수리 모달 상태
    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const [notesItem, setNotesItem] = useState(null);

    // 사진 관련 상태
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [uploadingId, setUploadingId] = useState(null);
    const [loadingPhotoId, setLoadingPhotoId] = useState(null); // 사진 보기 로딩 상태
    const [photoHistory, setPhotoHistory] = useState({});
    const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
    const [viewerPhotos, setViewerPhotos] = useState([]);
    const [archivedCount, setArchivedCount] = useState(0);
    const [showArchived, setShowArchived] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [viewerItem, setViewerItem] = useState(null);

    // 사진 올리기 드롭다운 상태
    const [uploadDropdownId, setUploadDropdownId] = useState(null);

    // 연속 촬영 모드 상태
    const [captureMode, setCaptureMode] = useState(false);
    const [capturedPhotos, setCapturedPhotos] = useState([]);
    const [captureItemId, setCaptureItemId] = useState(null);
    const [captureUploadMode, setCaptureUploadMode] = useState('replace'); // 'replace' | 'append'
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    useEffect(() => {
        fetchData();
    }, [selectedHospital]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const hospitalsRes = await axios.get('/api/hospitals');
            setHospitals(hospitalsRes.data);

            const params = {};
            if (selectedHospital) params.hospital_id = selectedHospital;

            const itemsRes = await axios.get('/api/lending/items', { params });

            // BIOLOGIC(입고) 제품 제외 - 기구/장비와 이미지 등록 제품만 표시
            const filtered = itemsRes.data.filter(item =>
                item.category !== 'BIOLOGIC' && item.category !== 'biologic'
            );

            const sorted = filtered.sort((a, b) => {
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

            setLendingItems(uniqueItems);
            setCurrentPage(1);
            setLoading(false);
        } catch (error) {
            console.error('데이터 조회 실패:', error);
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(lendingItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = lendingItems.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            let utcDateString = dateString;
            if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
                utcDateString = dateString.replace(' ', 'T') + 'Z';
            }
            const date = new Date(utcDateString);
            if (isNaN(date.getTime())) return '-';

            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            return `${month}/${day} ${hours}:${minutes}`;
        } catch {
            return '-';
        }
    };

    const getStatusBadge = (item) => {
        if (item.alert_status === 'EXPIRING_SOON') {
            return <span style={{ background: '#ffc107', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>만료</span>;
        }
        return <span style={{ background: '#28a745', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>정상</span>;
    };

    // 아이템 선택 핸들러
    const handleItemSelect = (itemId) => {
        setSelectedItemId(selectedItemId === itemId ? null : itemId);
        setUploadDropdownId(null); // 다른 아이템 선택 시 드롭다운 닫기
    };

    // 사진 올리기 드롭다운 토글
    const toggleUploadDropdown = (itemId, e) => {
        e.stopPropagation();
        setUploadDropdownId(uploadDropdownId === itemId ? null : itemId);
    };

    // 앨범에서 바로 등록
    const handleAlbumUpload = (itemId, e, modeArg) => {
        const mode = modeArg === 'append' ? 'append' : 'replace';
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = async (event) => {
            const files = Array.from(event.target.files).slice(0, 10);
            if (files.length === 0) return;

            const uploaderName = window.prompt('담당자 이름을 입력하세요:', localStorage.getItem('lastUploaderName') || '');
            if (!uploaderName || uploaderName.trim() === '') {
                setMessage('❌ 담당자 이름을 입력해주세요');
                return;
            }
            localStorage.setItem('lastUploaderName', uploaderName.trim());

            setUploadingId(itemId);
            setMessage(`📤 ${files.length}장 업로드 중...`);
            setUploadDropdownId(null);

            try {
                // 첫 사진은 mode 그대로 (replace 면 기존 활성 사진 자동 교체), 이후는 append
                const totalFiles = files.length;
                for (let i = 0; i < totalFiles; i++) {
                    setMessage(`📤 업로드 중... (${i + 1}/${totalFiles})`);
                    const base64 = await fileToBase64(files[i]);
                    await axios.put(`/api/lending/items/${itemId}/photo`, {
                        photo_url: base64,
                        uploaded_by: uploaderName.trim(),
                        mode: i === 0 ? mode : 'append'
                    });
                }
                console.log(`✅ [handleAlbumUpload] 업로드 완료 - ${totalFiles}장`);
                setMessage(`✅ ${uploaderName.trim()}님의 사진 ${totalFiles}장이 업로드되었습니다`);
                fetchData();
                // 사진 이력 갱신
                const res = await axios.get(`/api/lending/items/${itemId}/photos`);
                setPhotoHistory(prev => ({ ...prev, [itemId]: res.data }));
            } catch (error) {
                setMessage('❌ 사진 업로드 실패: ' + (error.response?.data?.error || error.message));
            } finally {
                setUploadingId(null);
            }
        };
        input.click();
    };

    // 파일을 Base64로 변환 (1280px·q70 압축 적용)
    const fileToBase64 = (file) => compressImageToBase64(file);

    // 촬영 모드 시작
    const startCaptureMode = (itemId, e, modeArg) => {
        e.stopPropagation();
        setCaptureItemId(itemId);
        setCapturedPhotos([]);
        setCaptureMode(true);
        setCaptureUploadMode(modeArg === 'append' ? 'append' : 'replace');
        setUploadDropdownId(null);
        // 카메라 열기
        setTimeout(() => {
            if (cameraInputRef.current) {
                cameraInputRef.current.click();
            }
        }, 100);
    };

    // 사진 촬영 처리 (다중 선택 지원)
    const handleCameraCapture = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newPhotos = [...capturedPhotos];

        for (const file of files) {
            const base64 = await fileToBase64(file);
            newPhotos.push(base64);
        }

        setCapturedPhotos(newPhotos);
        setMessage(`📷 ${newPhotos.length}장 선택됨 - 추가하려면 "촬영 시작" 다시 클릭`);

        // 입력 초기화
        e.target.value = '';
    };

    // 추가 촬영 (수동)
    const continueCapture = () => {
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };

    // 촬영 완료 (연속 촬영 종료)
    const finishCapture = () => {
        if (capturedPhotos.length === 0) {
            setMessage('❌ 촬영된 사진이 없습니다');
            return;
        }
        setMessage(`✅ ${capturedPhotos.length}장 촬영 완료 - 업로드 버튼을 눌러주세요`);
    };

    // 촬영된 사진 업로드 (진행 상태 표시 개선)
    const uploadCapturedPhotos = async () => {
        if (capturedPhotos.length === 0) {
            setMessage('❌ 촬영된 사진이 없습니다');
            return;
        }

        const uploaderName = window.prompt('담당자 이름을 입력하세요:', localStorage.getItem('lastUploaderName') || '');
        if (!uploaderName || uploaderName.trim() === '') {
            setMessage('❌ 담당자 이름을 입력해주세요');
            return;
        }
        localStorage.setItem('lastUploaderName', uploaderName.trim());

        setUploadingId(captureItemId);
        const totalPhotos = capturedPhotos.length;

        try {
            // 첫 사진은 captureUploadMode (replace=교체, append=추가), 이후는 append
            for (let i = 0; i < totalPhotos; i++) {
                setMessage(`📤 업로드 중... (${i + 1}/${totalPhotos})`);
                await axios.put(`/api/lending/items/${captureItemId}/photo`, {
                    photo_url: capturedPhotos[i],
                    uploaded_by: uploaderName.trim(),
                    mode: i === 0 ? captureUploadMode : 'append'
                });
            }
            setMessage(`✅ ${uploaderName.trim()}님의 사진 ${totalPhotos}장이 업로드되었습니다`);
            fetchData();
            // 사진 이력 갱신
            const res = await axios.get(`/api/lending/items/${captureItemId}/photos`);
            setPhotoHistory(prev => ({ ...prev, [captureItemId]: res.data }));
            setCaptureMode(false);
            setCapturedPhotos([]);
            setCaptureItemId(null);
        } catch (error) {
            setMessage('❌ 사진 업로드 실패: ' + (error.response?.data?.error || error.message));
        } finally {
            setUploadingId(null);
        }
    };

    // 다시 찍기
    const retakePhotos = () => {
        setCapturedPhotos([]);
        setMessage('');
        setTimeout(() => {
            if (cameraInputRef.current) {
                cameraInputRef.current.click();
            }
        }, 100);
    };

    // 촬영 취소
    const cancelCapture = () => {
        setCaptureMode(false);
        setCapturedPhotos([]);
        setCaptureItemId(null);
        setMessage('');
    };

    // 사진 보기 (전체화면 슬라이더) - 기본은 활성만 표시
    const openPhotoViewer = async (itemId, item, e) => {
        e.stopPropagation();
        setLoadingPhotoId(itemId);
        setMessage('📷 사진 로딩 중...');
        try {
            // 활성 사진 + 카운트 병렬 조회
            const [photosRes, countRes] = await Promise.all([
                axios.get(`/api/lending/items/${itemId}/photos`),
                axios.get(`/api/lending/items/${itemId}/photos/counts`).catch(() => ({ data: { archived: 0 } }))
            ]);
            const photos = photosRes.data || [];
            const archived = countRes.data?.archived || 0;
            setPhotoHistory(prev => ({ ...prev, [itemId]: photos }));
            setArchivedCount(archived);
            setShowArchived(false);

            if (photos.length > 0) {
                setViewerPhotos(photos);
                setViewerIndex(0);
                setViewerItem(item);
                setPhotoViewerOpen(true);
                setMessage('');
            } else if (archived > 0) {
                // 활성 0장 + archived 있음 → 안내 + archived 즉시 표시 옵션 제공
                if (window.confirm(`현재 출고 사진은 없습니다.\n이전 출고 이력 사진 ${archived}장이 있습니다. 보시겠습니까?`)) {
                    await loadArchivedPhotos(itemId, item);
                } else {
                    setMessage('');
                }
            } else {
                setMessage('📷 등록된 사진이 없습니다');
            }
        } catch (error) {
            setMessage('❌ 사진 조회 실패');
        } finally {
            setLoadingPhotoId(null);
        }
    };

    // archived 사진 포함해서 다시 로드 (이전 출고 이력 보기)
    const loadArchivedPhotos = async (itemId, item) => {
        try {
            const res = await axios.get(`/api/lending/items/${itemId}/photos?include_archived=true`);
            const all = res.data || [];
            if (all.length > 0) {
                setViewerPhotos(all);
                setViewerIndex(0);
                setViewerItem(item);
                setPhotoViewerOpen(true);
                setShowArchived(true);
                setMessage('');
            } else {
                setMessage('📷 사진 이력이 없습니다');
            }
        } catch (error) {
            setMessage('❌ 이력 조회 실패');
        }
    };

    // 전체 사진 삭제
    const deleteAllPhotos = async (itemId, e) => {
        e.stopPropagation();

        if (!window.confirm('이 장비의 모든 사진을 삭제하시겠습니까?')) {
            return;
        }

        setDeletingId(itemId);
        setMessage('🗑️ 사진 삭제 중...');

        try {
            const res = await axios.delete(`/api/lending/items/${itemId}/photos`);
            setMessage(`✅ ${res.data.deleted_count}장의 사진이 삭제되었습니다`);
            // 사진 이력 캐시 제거
            setPhotoHistory(prev => {
                const newHistory = { ...prev };
                delete newHistory[itemId];
                return newHistory;
            });
            fetchData();
        } catch (error) {
            setMessage('❌ 사진 삭제 실패: ' + (error.response?.data?.error || error.message));
        } finally {
            setDeletingId(null);
        }
    };

    // 개별 사진 삭제 (뷰어에서)
    const deletePhoto = async (itemId, photoId) => {
        if (!window.confirm('이 사진을 삭제하시겠습니까?')) {
            return;
        }

        setMessage('🗑️ 사진 삭제 중...');

        try {
            await axios.delete(`/api/lending/items/${itemId}/photos/${photoId}`);
            setMessage('✅ 사진이 삭제되었습니다');

            // 뷰어에서 사진 제거
            const newPhotos = viewerPhotos.filter(p => p.id !== photoId);
            setViewerPhotos(newPhotos);

            if (newPhotos.length === 0) {
                setPhotoViewerOpen(false);
            } else if (viewerIndex >= newPhotos.length) {
                setViewerIndex(newPhotos.length - 1);
            }

            // 사진 이력 캐시 갱신
            setPhotoHistory(prev => ({ ...prev, [itemId]: newPhotos }));
            fetchData();
        } catch (error) {
            setMessage('❌ 사진 삭제 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    // 뷰어 사진 이동
    const navigateViewer = (direction) => {
        let newIdx = viewerIndex + direction;
        if (newIdx < 0) newIdx = viewerPhotos.length - 1;
        if (newIdx >= viewerPhotos.length) newIdx = 0;
        setViewerIndex(newIdx);
    };

    return (
        <div className="mobile-container">
            <div className="mobile-header" style={{ padding: '0.8rem 1rem' }}>
                <h1 style={{ fontSize: '1.2rem', margin: 0 }}>📦 현황</h1>
            </div>

            {/* 탭 선택 */}
            <div style={{
                display: 'flex',
                background: '#f0f0f0',
                padding: '0.5rem',
                gap: '0.5rem'
            }}>
                <div style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    textAlign: 'center',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                }}>
                    🏥 장비기구배치현황
                </div>
                <Link
                    to="/mobile/biologic-inventory"
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: 'white',
                        color: '#333',
                        textAlign: 'center',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        border: '1px solid #ddd'
                    }}
                >
                    📊 재고현황
                </Link>
            </div>

            {/* 메시지 표시 */}
            {message && (
                <div style={{
                    padding: '0.5rem 1rem',
                    margin: '0.3rem 0.5rem',
                    borderRadius: '6px',
                    backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('📤') || message.includes('📷') ? '#fff3cd' : '#f8d7da',
                    color: message.includes('✅') ? '#155724' : message.includes('📤') || message.includes('📷') ? '#856404' : '#721c24',
                    fontSize: '0.8rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    {message}
                    <button onClick={() => setMessage('')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
            )}

            {/* 필터 바 */}
            <div style={{ display: 'flex', gap: '0.3rem', padding: '0.5rem', background: '#f8f9fa', alignItems: 'center' }}>
                <select
                    value={selectedHospital}
                    onChange={(e) => setSelectedHospital(e.target.value)}
                    style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.85rem' }}
                >
                    <option value="">전체 병원</option>
                    {hospitals.map(hospital => (
                        <option key={hospital.id} value={hospital.id}>
                            {hospital.name}
                        </option>
                    ))}
                </select>
                <button onClick={fetchData} style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: 'none', background: '#667eea', color: 'white', fontSize: '0.8rem' }}>
                    🔄
                </button>
                <button
                    onClick={() => setDeleteMode(!deleteMode)}
                    style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        border: 'none',
                        background: deleteMode ? '#dc3545' : '#6c757d',
                        color: 'white',
                        fontSize: '0.8rem'
                    }}
                    title={deleteMode ? '삭제 모드 종료' : '사진 삭제 모드'}
                >
                    {deleteMode ? '✕ 종료' : '🗑️'}
                </button>
            </div>

            {/* 촬영 모드 UI */}
            {captureMode && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.9)',
                    zIndex: 2000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <h2 style={{ color: 'white', marginBottom: '1rem' }}>📷 촬영 모드</h2>

                    {/* 업로드 진행 상태 표시 */}
                    {uploadingId && (
                        <div style={{
                            background: '#ffc107',
                            color: '#000',
                            padding: '1rem 2rem',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            animation: 'pulse 1.5s infinite'
                        }}>
                            {message || '📤 업로드 중...'}
                        </div>
                    )}

                    <p style={{ color: '#ccc', marginBottom: '1rem' }}>
                        촬영된 사진: {capturedPhotos.length}장
                    </p>

                    {/* 촬영된 사진 미리보기 */}
                    {capturedPhotos.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {capturedPhotos.map((photo, idx) => (
                                <img key={idx} src={photo} alt={`촬영${idx + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #667eea', opacity: uploadingId ? 0.5 : 1 }} />
                            ))}
                        </div>
                    )}

                    {/* 버튼들 */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={continueCapture}
                            disabled={!!uploadingId}
                            style={{
                                padding: '0.8rem 1.5rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: uploadingId ? '#999' : '#17a2b8',
                                color: 'white',
                                fontSize: '1rem',
                                cursor: uploadingId ? 'not-allowed' : 'pointer'
                            }}>
                            📸 {capturedPhotos.length === 0 ? '촬영하기' : '추가 촬영'}
                        </button>
                        {capturedPhotos.length > 0 && (
                            <button
                                onClick={uploadCapturedPhotos}
                                disabled={!!uploadingId}
                                style={{
                                    padding: '0.8rem 1.5rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: uploadingId ? '#ffc107' : '#28a745',
                                    color: uploadingId ? '#000' : 'white',
                                    fontSize: '1rem',
                                    cursor: uploadingId ? 'wait' : 'pointer'
                                }}>
                                {uploadingId ? '⏳ 업로드 중...' : `✅ 올리기 (${capturedPhotos.length}장)`}
                            </button>
                        )}
                        {!uploadingId && (
                            <button onClick={cancelCapture} style={{ padding: '0.8rem 1.5rem', borderRadius: '8px', border: 'none', background: '#dc3545', color: 'white', fontSize: '1rem', cursor: 'pointer' }}>
                                ✕ 취소
                            </button>
                        )}
                    </div>

                    {/* 숨겨진 카메라 입력 */}
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={handleCameraCapture}
                    />
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
            ) : (
                <>
                    {/* 카드 목록 */}
                    <div style={{ padding: '0.5rem' }}>
                        {currentItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                                랜딩 데이터가 없습니다
                            </div>
                        ) : (
                            currentItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemSelect(item.id)}
                                    style={{
                                        background: 'white',
                                        borderRadius: '8px',
                                        padding: '0.6rem',
                                        marginBottom: '0.4rem',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                        border: selectedItemId === item.id ? '3px solid #667eea' : item.photo_exists ? '2px solid #28a745' : '1px solid #eee',
                                        cursor: 'pointer',
                                        transition: 'border 0.2s ease'
                                    }}
                                >
                                    {/* 상단: 제품명 + 상태 + 비고 + 사진 아이콘 */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                            <EditableProductName
                                                productId={item.product_id}
                                                currentName={item.product_name}
                                                labelStyle={{ fontSize: '0.9rem', fontWeight: '700' }}
                                                onSaved={() => fetchData()}
                                            />
                                            {getStatusBadge(item)}
                                            {(item.product_notes || item.product_repair_history) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setNotesItem(item); setNotesModalOpen(true); }}
                                                    style={{
                                                        background: '#6f42c1',
                                                        color: 'white',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.65rem',
                                                        border: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    📝 비고
                                                </button>
                                            )}
                                            {item.photo_exists && <span style={{ fontSize: '0.8rem' }}>📷</span>}
                                        </div>
                                    </div>

                                    {/* 정보 - 가로 배치 */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem', fontSize: '0.75rem', color: '#555' }}>
                                        <span>🏥 {item.hospital_name}</span>
                                        <span>👤 {item.moved_by || '-'}</span>
                                        <span>📅 {formatDateTime(item.deploy_date || item.lending_date)}</span>
                                    </div>

                                    {/* 선택된 아이템 - 액션 버튼 */}
                                    {selectedItemId === item.id && (
                                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', position: 'relative' }}>
                                            {/* 사진 올리기 */}
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <button
                                                    onClick={(e) => toggleUploadDropdown(item.id, e)}
                                                    disabled={uploadingId === item.id}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.5rem',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        background: uploadingId === item.id ? '#ccc' : '#17a2b8',
                                                        color: 'white',
                                                        fontSize: '0.75rem',
                                                        cursor: uploadingId === item.id ? 'wait' : 'pointer'
                                                    }}
                                                >
                                                    {uploadingId === item.id ? '⏳' : '📷 사진 올리기 ▼'}
                                                </button>
                                                {/* 드롭다운 메뉴 */}
                                                {uploadDropdownId === item.id && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        right: 0,
                                                        background: 'white',
                                                        borderRadius: '4px',
                                                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                                                        zIndex: 100,
                                                        marginTop: '2px'
                                                    }}>
                                                        <button
                                                            onClick={(e) => handleAlbumUpload(item.id, e, 'replace')}
                                                            style={{
                                                                width: '100%', padding: '0.6rem', border: 'none',
                                                                background: 'white', textAlign: 'left',
                                                                fontSize: '0.8rem', cursor: 'pointer',
                                                                borderBottom: '1px solid #eee'
                                                            }}
                                                        >
                                                            🖼️ 앨범에서 새로등록 (기존 교체)
                                                        </button>
                                                        <button
                                                            onClick={(e) => startCaptureMode(item.id, e, 'replace')}
                                                            style={{
                                                                width: '100%', padding: '0.6rem', border: 'none',
                                                                background: 'white', textAlign: 'left',
                                                                fontSize: '0.8rem', cursor: 'pointer',
                                                                borderBottom: '1px solid #eee'
                                                            }}
                                                        >
                                                            📸 새로 촬영 (기존 교체)
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleAlbumUpload(item.id, e, 'append')}
                                                            style={{
                                                                width: '100%', padding: '0.6rem', border: 'none',
                                                                background: '#f0fdf4', textAlign: 'left',
                                                                fontSize: '0.8rem', cursor: 'pointer',
                                                                borderBottom: '1px solid #eee', color: '#15803d'
                                                            }}
                                                        >
                                                            ➕ 앨범에서 추가
                                                        </button>
                                                        <button
                                                            onClick={(e) => startCaptureMode(item.id, e, 'append')}
                                                            style={{
                                                                width: '100%', padding: '0.6rem', border: 'none',
                                                                background: '#f0fdf4', textAlign: 'left',
                                                                fontSize: '0.8rem', cursor: 'pointer',
                                                                color: '#15803d'
                                                            }}
                                                        >
                                                            ➕ 촬영해서 추가
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 사진 보기 */}
                                            <button
                                                onClick={(e) => openPhotoViewer(item.id, item, e)}
                                                disabled={loadingPhotoId === item.id}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.5rem',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    background: loadingPhotoId === item.id ? '#ffc107' : item.photo_exists ? '#28a745' : '#6c757d',
                                                    color: loadingPhotoId === item.id ? '#000' : 'white',
                                                    fontSize: '0.75rem',
                                                    cursor: loadingPhotoId === item.id ? 'wait' : 'pointer'
                                                }}
                                            >
                                                {loadingPhotoId === item.id ? '⏳ 로딩 중...' : '🖼️ 사진 보기'}
                                            </button>

                                            {/* 담당자 또는 삭제 버튼 */}
                                            {deleteMode && item.photo_exists ? (
                                                <button
                                                    onClick={(e) => deleteAllPhotos(item.id, e)}
                                                    disabled={deletingId === item.id}
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.5rem',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        background: deletingId === item.id ? '#ccc' : '#dc3545',
                                                        color: 'white',
                                                        fontSize: '0.75rem',
                                                        cursor: deletingId === item.id ? 'wait' : 'pointer'
                                                    }}
                                                >
                                                    {deletingId === item.id ? '⏳' : '🗑️ 사진 삭제'}
                                                </button>
                                            ) : (
                                                <div style={{
                                                    flex: 1,
                                                    padding: '0.5rem',
                                                    borderRadius: '4px',
                                                    background: '#f8f9fa',
                                                    fontSize: '0.7rem',
                                                    textAlign: 'center',
                                                    color: '#666'
                                                }}>
                                                    👤 {item.photo_uploaded_by || item.moved_by || '-'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.2rem',
                            padding: '0.5rem',
                            background: '#f8f9fa'
                        }}>
                            <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}
                                style={{ padding: '0.3rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', background: currentPage === 1 ? '#f0f0f0' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>«</button>
                            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                                style={{ padding: '0.3rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', background: currentPage === 1 ? '#f0f0f0' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>‹</button>
                            <span style={{ padding: '0.3rem 0.6rem', fontWeight: 'bold', fontSize: '0.8rem' }}>{currentPage}/{totalPages}</span>
                            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                                style={{ padding: '0.3rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', background: currentPage === totalPages ? '#f0f0f0' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>›</button>
                            <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}
                                style={{ padding: '0.3rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', background: currentPage === totalPages ? '#f0f0f0' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>»</button>
                        </div>
                    )}
                </>
            )}

            {/* 하단 요약 */}
            <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#666', background: '#f8f9fa' }}>
                총 {lendingItems.length}개 ({currentPage}/{totalPages || 1}페이지)
            </div>

            <Link to="/mobile/home" style={{
                display: 'block',
                textAlign: 'center',
                padding: '0.8rem',
                background: '#667eea',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '8px',
                margin: '0.5rem',
                fontSize: '0.9rem'
            }}>
                ← 홈으로
            </Link>

            {/* 전체화면 사진 뷰어 */}
            {photoViewerOpen && viewerPhotos.length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.95)',
                    zIndex: 1500,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <button
                        onClick={() => setPhotoViewerOpen(false)}
                        style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px'
                        }}
                    >✕</button>

                    <h3 style={{ color: 'white', marginBottom: '0.5rem', fontSize: '1rem', textAlign: 'center' }}>
                        {viewerItem?.product_name}
                    </h3>

                    {/* 슬라이더 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                        {viewerPhotos.length > 1 && (
                            <button onClick={() => navigateViewer(-1)} style={{
                                background: '#667eea',
                                border: 'none',
                                color: 'white',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                borderRadius: '50%',
                                width: '50px',
                                height: '50px'
                            }}>◀</button>
                        )}
                        <img
                            src={viewerPhotos[viewerIndex]?.photo_url}
                            alt="장비 사진"
                            style={{
                                maxWidth: 'calc(100% - 120px)',
                                maxHeight: '60vh',
                                objectFit: 'contain',
                                borderRadius: '8px'
                            }}
                        />
                        {viewerPhotos.length > 1 && (
                            <button onClick={() => navigateViewer(1)} style={{
                                background: '#667eea',
                                border: 'none',
                                color: 'white',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                borderRadius: '50%',
                                width: '50px',
                                height: '50px'
                            }}>▶</button>
                        )}
                    </div>

                    {/* 사진 정보 */}
                    <div style={{ color: '#ccc', marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
                        <p style={{ margin: '0.3rem 0' }}>
                            📷 {viewerPhotos[viewerIndex]?.uploaded_by || '담당자'} | {formatDateTime(viewerPhotos[viewerIndex]?.uploaded_at)}
                        </p>
                        {viewerPhotos.length > 1 && (
                            <p style={{ margin: '0.3rem 0', color: '#667eea', fontWeight: 'bold' }}>
                                {viewerIndex + 1} / {viewerPhotos.length}
                            </p>
                        )}
                        <p style={{ margin: '0.3rem 0', fontSize: '0.8rem' }}>
                            🏥 {viewerItem?.hospital_name}
                        </p>
                        {/* archive 상태 / 만료 / 영구보관 */}
                        {viewerPhotos[viewerIndex]?.archived_at && (() => {
                            const p = viewerPhotos[viewerIndex];
                            const days = p.days_until_delete;
                            const isPerm = !!p.permanent_keep;
                            const dangerColor = days <= 7 ? '#ef4444' : (days <= 30 ? '#f59e0b' : '#9ca3af');
                            return (
                                <div style={{
                                    margin: '0.6rem auto 0',
                                    padding: '0.5rem 0.8rem',
                                    background: isPerm ? '#1e3a5f' : '#3f3f46',
                                    borderRadius: '8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    fontSize: '0.8rem'
                                }}>
                                    <span style={{ color: '#e5e7eb' }}>
                                        📁 보관 (입고 {formatDateTime(p.archived_at)})
                                    </span>
                                    {!isPerm && (
                                        <span style={{ color: dangerColor, fontWeight: 'bold' }}>
                                            ⏰ {days}일 후 자동삭제
                                        </span>
                                    )}
                                    {isPerm && (
                                        <span style={{ color: '#fbbf24' }}>🔒 영구보관</span>
                                    )}
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await axios.put(
                                                    `/api/lending/photos/${p.id}/permanent`,
                                                    { permanent: !isPerm }
                                                );
                                                const updated = viewerPhotos.map(x =>
                                                    x.id === p.id ? { ...x, permanent_keep: res.data.permanent_keep } : x
                                                );
                                                setViewerPhotos(updated);
                                                if (viewerItem) {
                                                    setPhotoHistory(prev => ({ ...prev, [viewerItem.id]: updated }));
                                                }
                                            } catch (err) {
                                                setMessage('❌ 영구보관 설정 실패');
                                            }
                                        }}
                                        style={{
                                            padding: '0.3rem 0.7rem',
                                            background: isPerm ? '#fbbf24' : '#10b981',
                                            color: isPerm ? '#1f2937' : 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {isPerm ? '🔓 보관 해제' : '🔒 영구보관'}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>

                    {/* 썸네일 */}
                    {viewerPhotos.length > 1 && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {viewerPhotos.map((photo, idx) => (
                                <div key={idx} style={{ position: 'relative' }}>
                                    <img
                                        src={photo.photo_url}
                                        alt={`썸네일${idx + 1}`}
                                        onClick={() => setViewerIndex(idx)}
                                        style={{
                                            width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px',
                                            border: viewerIndex === idx ? '3px solid #667eea' : '2px solid transparent',
                                            cursor: 'pointer',
                                            opacity: viewerIndex === idx ? 1 : 0.6,
                                            filter: photo.archived_at ? 'grayscale(40%)' : 'none'
                                        }}
                                    />
                                    {photo.archived_at && (
                                        <span style={{
                                            position: 'absolute', top: 0, right: 0,
                                            background: photo.permanent_keep ? '#fbbf24' : '#9ca3af',
                                            color: 'white', fontSize: '0.55rem', padding: '1px 3px',
                                            borderRadius: '3px', lineHeight: 1
                                        }}>
                                            {photo.permanent_keep ? '🔒' : '📁'}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 이전 출고 이력 보기 버튼 */}
                    {!showArchived && archivedCount > 0 && viewerItem && (
                        <button
                            onClick={() => loadArchivedPhotos(viewerItem.id, viewerItem)}
                            style={{
                                marginTop: '1rem',
                                padding: '0.7rem 1rem',
                                background: 'rgba(99,102,241,0.25)',
                                color: '#cbd5e1',
                                border: '1px solid #4b5563',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            📁 이전 출고 사진 이력 {archivedCount}건 보기
                        </button>
                    )}
                    {showArchived && (
                        <div style={{
                            marginTop: '1rem', padding: '0.5rem 0.8rem',
                            background: 'rgba(251,191,36,0.15)', borderRadius: '6px',
                            fontSize: '0.75rem', color: '#fde68a', textAlign: 'center'
                        }}>
                            📁 이전 출고 이력 포함 표시 중 (📁=90일 보관, 🔒=영구 보관)
                        </div>
                    )}
                </div>
            )}

            {/* 비고/수리 모달 */}
            {notesModalOpen && notesItem && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    zIndex: 1600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        maxWidth: '400px',
                        width: '100%',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📝 비고/수리 내용</h3>
                            <button
                                onClick={() => { setNotesModalOpen(false); setNotesItem(null); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: '#666'
                                }}
                            >✕</button>
                        </div>

                        <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                            <strong style={{ fontSize: '0.9rem' }}>{notesItem.product_name}</strong>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.3rem' }}>
                                🏥 {notesItem.hospital_name}
                            </div>
                        </div>

                        {notesItem.product_notes && (
                            <div style={{
                                padding: '1rem',
                                background: '#e7f3ff',
                                borderRadius: '8px',
                                border: '1px solid #0d6efd',
                                fontSize: '0.9rem',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap',
                                marginBottom: '0.5rem'
                            }}>
                                <strong style={{ color: '#0d6efd' }}>📝 비고</strong>
                                <div style={{ marginTop: '0.5rem' }}>{notesItem.product_notes}</div>
                            </div>
                        )}

                        {notesItem.product_repair_history && (
                            <div style={{
                                padding: '1rem',
                                background: '#fff3cd',
                                borderRadius: '8px',
                                border: '1px solid #ffc107',
                                fontSize: '0.9rem',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap'
                            }}>
                                <strong style={{ color: '#856404' }}>🔧 수리내역</strong>
                                <div style={{ marginTop: '0.5rem' }}>{notesItem.product_repair_history}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MobileLendingStatusPage;
