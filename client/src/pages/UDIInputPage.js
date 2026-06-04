import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/main.css';

function UDIInputPage() {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [supplyDate, setSupplyDate] = useState(
        new Date().toISOString().slice(0, 10)
    );
    const [supplyDivision, setSupplyDivision] = useState('출고');
    const [supplyType, setSupplyType] = useState('의료기관에 공급');
    const [manualInput, setManualInput] = useState('');
    const [decoding, setDecoding] = useState(false);
    const [parsedPreview, setParsedPreview] = useState(null);
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState({ total: 0, ok: 0, warn: 0, error: 0 });
    const [message, setMessage] = useState('');
    const [scannerMode, setScannerMode] = useState(true); // 기본 ON — 스캐너 연속 입력
    const fileInputRef = useRef(null);
    const scanInputRef = useRef(null);

    const reportMonth = supplyDate.slice(0, 7);

    useEffect(() => {
        loadCustomers();
        loadItems();
        // 페이지 진입 시 텍스트박스 자동 포커스 — 스캐너 즉시 사용 가능
        setTimeout(() => scanInputRef.current?.focus(), 200);
    }, []);

    useEffect(() => {
        loadItems();
    }, [reportMonth]);

    const loadCustomers = async () => {
        try {
            const res = await axios.get('/api/udi/customers');
            setCustomers(res.data);
            if (res.data.length > 0) setSelectedCustomerId(res.data[0].id);
        } catch (e) {
            console.error(e);
        }
    };

    const loadItems = async () => {
        try {
            const res = await axios.get(`/api/udi/items?month=${reportMonth}`);
            setItems(res.data);
            const stRes = await axios.get(`/api/udi/stats/${reportMonth}`);
            setStats(stRes.data);
        } catch (e) {
            console.error(e);
        }
    };

    const decodeFile = async (file) => {
        setDecoding(true);
        setMessage('🔍 사진 분석 중... (DataMatrix/QR/1D 자동 인식)');
        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = reject;
                r.readAsDataURL(file);
            });
            const res = await axios.post('/api/udi/decode-image', {
                imageBase64: dataUrl,
            });
            if (!res.data.codes || res.data.codes.length === 0) {
                setMessage(`❌ 사진 인식 안 됨 — 박스를 USB 스캐너로 직접 찍거나 키보드 입력하세요 (자동 포커스됨)`);
                setParsedPreview(null);
                // 텍스트박스 자동 포커스 — 스캐너 바로 사용 가능
                setTimeout(() => scanInputRef.current?.focus(), 100);
                return;
            }
            const raw = res.data.codes[0];
            setManualInput(raw);
            const parsed = res.data.parsed;
            setParsedPreview(parsed);
            if (parsed.is_valid) {
                setMessage(`✅ 사진 인식 성공: GTIN=${parsed.gtin}` +
                    (res.data.codes.length > 1 ? ` (+${res.data.codes.length - 1}개 추가 코드 감지됨, 첫 번째 사용)` : ''));
            } else {
                setMessage(`⚠ 인식했으나 검증 오류: ${parsed.errors.join('; ')}`);
            }
        } catch (e) {
            console.error(e);
            setMessage(`❌ 디코딩 실패: ${e.response?.data?.error || e.message}`);
            setParsedPreview(null);
        } finally {
            setDecoding(false);
        }
    };

    const previewParse = async (raw) => {
        try {
            const res = await axios.post('/api/udi/parse', { raw });
            setParsedPreview(res.data);
            setManualInput(raw);
            if (res.data.is_valid) {
                setMessage(`✅ 인식 성공: GTIN=${res.data.gtin}`);
            } else {
                setMessage(`⚠ 검증 오류: ${res.data.errors.join('; ')}`);
            }
            return res.data;
        } catch (e) {
            console.error(e);
            setMessage(`❌ 파싱 실패: ${e.message}`);
            return null;
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) decodeFile(file);
    };

    const handleManualParse = async () => {
        if (!manualInput.trim()) return;
        const raw = manualInput.trim();
        const parsed = await previewParse(raw);
        // 스캐너 모드 + 정상 인식이면 자동 저장
        if (scannerMode && parsed && parsed.is_valid) {
            await saveAndContinue(parsed);
        }
    };

    const saveAndContinue = async (parsed) => {
        if (!selectedCustomerId) {
            setMessage('거래처를 먼저 선택하세요');
            return;
        }
        try {
            await axios.post('/api/udi/items', {
                raw: parsed.raw,
                공급구분: supplyDivision,
                공급형태: supplyType,
                customer_id: parseInt(selectedCustomerId, 10),
                공급일자: supplyDate,
                공급수량: 1,
            });
            setMessage(`✅ 자동 저장 완료. GTIN=${parsed.gtin} — 다음 박스 스캔 가능`);
            setParsedPreview(null);
            setManualInput('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadItems();
            // 다음 스캔 대기 — 텍스트박스 다시 포커스
            setTimeout(() => scanInputRef.current?.focus(), 100);
        } catch (e) {
            console.error(e);
            setMessage(`❌ 자동 저장 실패: ${e.response?.data?.error || e.message}`);
        }
    };

    const handleSave = async () => {
        if (!parsedPreview) {
            setMessage('먼저 사진 또는 텍스트로 UDI 인식하세요');
            return;
        }
        await saveAndContinue(parsedPreview);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('이 항목을 삭제하시겠습니까?')) return;
        try {
            await axios.delete(`/api/udi/items/${id}`);
            loadItems();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDownloadExcel = async () => {
        try {
            const res = await axios.get(`/api/udi/excel/${reportMonth}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `udi_${reportMonth}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            setMessage(`✅ 엑셀 다운로드 완료 — udi_${reportMonth}.xlsx`);
        } catch (e) {
            console.error(e);
            setMessage(`❌ 다운로드 실패: ${e.message}`);
        }
    };

    const verdictColor = (v) =>
        v === 'OK' ? '#4CAF50' : v === 'WARN' ? '#ff9800' : '#f44336';

    return (
        <div className="page-container" style={{ padding: '2rem' }}>
            <div className="page-header" style={{ background: 'white', padding: '2rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <h1 className="page-title" style={{ fontSize: '2rem', color: '#333', margin: 0 }}>
                    📋 UDI 입력 (의료기기 공급내역 보고)
                </h1>
                <p style={{ color: '#666', marginTop: '0.5rem' }}>
                    박스 라벨 사진을 업로드하거나 바코드 스캐너·키보드로 직접 입력 →
                    자동 디코딩 → MFDS 일괄등록 양식 17컬럼 엑셀 자동 생성.
                </p>
            </div>

            {/* 상단 입력 영역 */}
            <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginTop: 0 }}>1. 공급 정보 (이번 보고)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">거래처 *</label>
                        <select className="form-select" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                            <option value="">선택...</option>
                            {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.site_code})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">공급일자 *</label>
                        <input type="date" className="form-input" value={supplyDate} onChange={(e) => setSupplyDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">공급구분</label>
                        <select className="form-select" value={supplyDivision} onChange={(e) => setSupplyDivision(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                            <option>출고</option>
                            <option>반품</option>
                            <option>폐기</option>
                            <option>임대</option>
                            <option>회수</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">공급형태</label>
                        <select className="form-select" value={supplyType} onChange={(e) => setSupplyType(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                            <option>의료기관에 공급</option>
                            <option>제조ㆍ수입ㆍ판매(임대)에 공급</option>
                            <option>약국개설자 또는 의약품 도매상에 공급</option>
                            <option>견본품/기부용 또는 군납용</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* UDI 인식 영역 */}
            <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h2 style={{ margin: 0 }}>2. UDI 인식</h2>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', padding: '0.5rem 1rem', background: scannerMode ? '#dcfce7' : '#f1f5f9', border: `2px solid ${scannerMode ? '#16a34a' : '#cbd5e1'}`, borderRadius: '6px' }}>
                        <input
                            type="checkbox"
                            checked={scannerMode}
                            onChange={(e) => setScannerMode(e.target.checked)}
                        />
                        <span style={{ fontWeight: 600, color: scannerMode ? '#15803d' : '#475569' }}>
                            {scannerMode ? '🔥 스캐너 연속 모드 ON' : '스캐너 연속 모드 OFF'}
                        </span>
                    </label>
                </div>
                <div style={{ background: scannerMode ? '#f0fdf4' : '#fafafa', border: `1px solid ${scannerMode ? '#86efac' : '#e2e8f0'}`, borderRadius: '6px', padding: '0.75rem', fontSize: '0.85rem', color: '#475569', marginBottom: '1rem' }}>
                    {scannerMode ? (
                        <>
                            <strong style={{color:'#15803d'}}>연속 스캔 사용법:</strong> USB 바코드 스캐너로 박스 찍기 →
                            텍스트박스에 자동 입력 → 자동 인식 → <strong>자동 저장</strong> → 다음 박스 대기.
                            거래처와 공급일자만 미리 선택하면 박스 100개도 1분에 처리.
                        </>
                    ) : (
                        <>
                            수동 모드: 인식 후 [저장] 버튼 직접 클릭. 단발 입력에 적합.
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                    <label className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '6px', cursor: 'pointer', display: 'inline-block' }}>
                        📷 박스 사진 업로드
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                    </label>
                    {decoding && <span style={{color:'#7c3aed'}}>인식 중...</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                        ref={scanInputRef}
                        type="text"
                        autoFocus
                        placeholder={scannerMode
                            ? "🔥 스캐너로 박스 찍으세요 — 자동 인식·저장됩니다"
                            : "스캐너·키보드 직접 입력 — 예: (01)07640139342966(17)281231(10)8-5595"}
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        style={{ flex: 1, padding: '0.75rem', border: scannerMode ? '2px solid #16a34a' : '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.95rem' }}
                        onKeyDown={(e) => e.key === 'Enter' && handleManualParse()}
                    />
                    <button onClick={handleManualParse} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {scannerMode ? '인식·저장' : '인식'}
                    </button>
                </div>
                {message && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: message.includes('✅') ? '#f0fdf4' : message.includes('❌') ? '#fef2f2' : '#fffbeb', borderRadius: '4px', border: `1px solid ${message.includes('✅') ? '#86efac' : message.includes('❌') ? '#fca5a5' : '#fde68a'}` }}>
                        {message}
                    </div>
                )}
            </div>

            {/* 미리보기 + 저장 */}
            {parsedPreview && (
                <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ marginTop: 0 }}>3. 인식 결과 미리보기</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee', width: '180px' }}>표준코드(UDI)</th>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>{parsedPreview.raw}</td></tr>
                            <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>GTIN</th>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{parsedPreview.gtin || '-'}</td></tr>
                            <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>품목명 (마스터)</th>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{parsedPreview.product?.품목명 || <span style={{color: '#ff9800'}}>마스터 미매핑</span>}</td></tr>
                            <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>로트번호</th>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{parsedPreview.lot || '-'}</td></tr>
                            <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>일련번호</th>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{parsedPreview.serial || '-'}</td></tr>
                            <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>제조연월 (YYMMDD)</th>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{parsedPreview.prod_date_yymmdd || '-'}</td></tr>
                            <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>사용기한 (YYMMDD)</th>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{parsedPreview.exp_date_yymmdd || '-'}</td></tr>
                            <tr><th style={{ textAlign: 'left', padding: '0.5rem' }}>검증</th>
                                <td style={{ padding: '0.5rem' }}>
                                    {parsedPreview.is_valid ? (
                                        <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✅ OK</span>
                                    ) : (
                                        <span style={{ color: '#f44336', fontWeight: 'bold' }}>
                                            ❌ {parsedPreview.errors.join('; ')}
                                        </span>
                                    )}
                                </td></tr>
                        </tbody>
                    </table>
                    <button
                        onClick={handleSave}
                        className="btn btn-success"
                        style={{ marginTop: '1rem', background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', color: 'white', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
                    >
                        💾 저장 (이 거래처·날짜로)
                    </button>
                </div>
            )}

            {/* 이번 달 누적 */}
            <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>4. 이번 달 누적 ({reportMonth})</h2>
                    <button
                        onClick={handleDownloadExcel}
                        className="btn btn-warning"
                        style={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', color: 'white', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        📥 사이트 업로드용 엑셀 다운로드
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div>총 <b>{stats.total}</b>건</div>
                    <div style={{ color: '#4CAF50' }}>정상 <b>{stats.ok || 0}</b></div>
                    <div style={{ color: '#ff9800' }}>경고 <b>{stats.warn || 0}</b></div>
                    <div style={{ color: '#f44336' }}>오류 <b>{stats.error || 0}</b></div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5' }}>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>#</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>거래처</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>품목</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>GTIN</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>로트</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>유효기한</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>공급일자</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>검증</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr><td colSpan="9" style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                                    이번 달 입력된 항목 없음
                                </td></tr>
                            )}
                            {items.map((it, idx) => (
                                <tr key={it.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                                    <td style={{ padding: '0.5rem' }}>{it.customer_name || '-'}</td>
                                    <td style={{ padding: '0.5rem' }}>{it.product_name || '-'}</td>
                                    <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{it.gtin}</td>
                                    <td style={{ padding: '0.5rem' }}>{it.로트번호}</td>
                                    <td style={{ padding: '0.5rem' }}>{it.사용기한}</td>
                                    <td style={{ padding: '0.5rem' }}>{it.공급일자}</td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <span style={{ color: verdictColor(it.검증결과), fontWeight: 'bold' }}>
                                            {it.검증결과}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <button
                                            onClick={() => handleDelete(it.id)}
                                            style={{ background: '#f44336', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default UDIInputPage;
