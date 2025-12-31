import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { parseGS1 } from '../utils/gs1Parser';
import QRCode from 'qrcode';
import '../styles/main.css';

function LendingProductRegistrationPage() {
    const [scanInput, setScanInput] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [productName, setProductName] = useState('');
    const [category, setCategory] = useState('CONSUMABLE');
    const [channels, setChannels] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [selectedHospital, setSelectedHospital] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [purchasePrice, setPurchasePrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [registeredItem, setRegisteredItem] = useState(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [existingProduct, setExistingProduct] = useState(null);
    const [notes, setNotes] = useState('');
    const [scanMode, setScanMode] = useState('CHANNEL');
    const [scannedChannel, setScannedChannel] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        fetchChannels();
        fetchHospitals();
        inputRef.current?.focus();
    }, []);

    const fetchChannels = async () => {
        try {
            const res = await axios.get('/api/channels');
            setChannels(res.data);
            if (res.data.length > 0) setSelectedChannel(res.data[0].id);
        } catch (error) {
            console.error('채널 조회 실패:', error);
        }
    };

    const fetchHospitals = async () => {
        try {
            const res = await axios.get('/api/hospitals');
            setHospitals(res.data);
            if (res.data.length > 0) setSelectedHospital(res.data[0].id);
        } catch (error) {
            console.error('병원 조회 실패:', error);
        }
    };

    const handleScan = async () => {
        const input = scanInput.trim();
        if (!input) {
            setMessage('❌ 바코드를 입력해주세요');
            return;
        }

        // 1. 창구 QR인지 확인 (JSON 형식)
        if (input.startsWith('{')) {
            try {
                const data = JSON.parse(input);
                if (data.type === 'CHANNEL') {
                    // 창구 QR 처리
                    setScannedChannel(data);
                    setScanMode('PRODUCT');
                    setSelectedChannel(data.id);
                    setMessage('✅ 창구 "' + data.name + '" 선택됨 - 이제 제품 바코드를 스캔하세요');
                    setScanInput('');
                    inputRef.current?.focus();
                    return;
                }
            } catch (e) {
                // JSON 파싱 실패 - 제품 바코드로 처리
            }
        }

        // 2. 제품 바코드 처리 (GS1 파싱)
        const result = parseGS1(input);
        if (result.success) {
            setParsedData(result);
            setExistingProduct(null);

            // GTIN으로 기존 제품 조회
            const gtin = result.gtin || result.raw;
            if (gtin) {
                try {
                    setMessage('🔍 기존 제품 조회 중...');
                    const response = await axios.get('/api/lending/product-by-gtin/' + gtin);
                    if (response.data.found) {
                        const product = response.data.product;
                        setExistingProduct(product);
                        setProductName(product.name);
                        setCategory(product.category);
                        setPurchasePrice(product.purchase_price?.toString() || '');
                        setSellingPrice(product.selling_price?.toString() || '');
                        setMessage('✅ 기존 제품 발견! "' + product.name + '" (' + product.total_lending_count + '회 입고됨)');
                    } else {
                        setMessage('✅ 바코드 파싱 성공 - 신규 제품입니다');
                    }
                } catch (error) {
                    if (error.response?.status === 404) {
                        setMessage('✅ 바코드 파싱 성공 - 신규 제품입니다');
                    } else {
                        console.error('제품 조회 실패:', error);
                        setMessage('✅ 바코드 파싱 성공');
                    }
                }
            } else {
                setMessage('✅ 바코드 파싱 성공');
            }
            setScanInput('');
        } else {
            setMessage('❌ 파싱 실패: ' + result.error);
            setParsedData(null);
            setExistingProduct(null);
        }
    };

    // 창구 변경 (스캔 모드 초기화)
    const handleChangeChannel = () => {
        setScannedChannel(null);
        setScanMode('CHANNEL');
        setParsedData(null);
        setProductName('');
        setExistingProduct(null);
        setNotes('');
        setMessage('📷 창구 QR을 먼저 스캔해주세요');
        setScanInput('');
        inputRef.current?.focus();
    };

    const handleRegister = async () => {
        if (!parsedData) {
            setMessage('❌ 먼저 바코드를 스캔해주세요');
            return;
        }
        // 제품명이 없으면 GTIN을 기본 제품명으로 사용
        const finalProductName = productName.trim() || `제품-${parsedData.gtin || parsedData.raw}`;
        if (!selectedChannel || !selectedHospital) {
            setMessage('❌ 창구와 병원을 선택해주세요');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/api/lending/register-product', {
                product_name: finalProductName,
                gtin: parsedData.gtin || parsedData.raw,
                lot_number: parsedData.lotNumber || '',
                expiration_date: parsedData.expirationDateFormatted || null,
                channel_id: selectedChannel,
                hospital_id: selectedHospital,
                quantity: quantity,
                category: category,
                purchase_price: parseFloat(purchasePrice) || 0,
                selling_price: parseFloat(sellingPrice) || 0,
                notes: notes || ('GS1 스캔 등록 - LOT: ' + (parsedData.lotNumber || 'N/A'))
            });

            if (response.data.success) {
                setRegisteredItem(response.data);
                setMessage('✅ 랜딩 제품 등록 완료!');

                // Generate QR Code (2cm x 2cm = ~75px at 96 DPI)
                const qrData = JSON.stringify({
                    type: 'LENDING',
                    id: response.data.lending_item_id
                });
                const url = await QRCode.toDataURL(qrData, {
                    width: 150,  // 2x for print quality
                    margin: 1,
                    errorCorrectionLevel: 'M'
                });
                setQrCodeUrl(url);

                // Reset form (창구는 유지)
                setScanInput('');
                setParsedData(null);
                setProductName('');
                setNotes('');
                setExistingProduct(null);
            }
        } catch (error) {
            console.error('등록 실패:', error);
            setMessage(`❌ 등록 실패: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const channelName = channels.find(c => c.id == selectedChannel)?.name || '';
        printWindow.document.write(`
            <html>
            <head>
                <title>QR Code Print</title>
                <style>
                    body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .qr-container { text-align: center; width: 2cm; height: 2.5cm; }
                    .qr-container img { width: 2cm; height: 2cm; }
                    .qr-container p { font-size: 6pt; margin: 2px 0 0 0; font-family: sans-serif; }
                </style>
            </head>
            <body>
                <div class="qr-container">
                    <img src="${qrCodeUrl}" />
                    <p>${channelName}</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const resetForm = () => {
        setScanInput('');
        setParsedData(null);
        setProductName('');
        setPurchasePrice('');
        setSellingPrice('');
        setRegisteredItem(null);
        setQrCodeUrl('');
        setMessage('');
        setExistingProduct(null);
        setNotes('');
        setScannedChannel(null);
        setScanMode('CHANNEL');
        inputRef.current?.focus();
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📦 랜딩 제품 등록</h1>
                <p>GS1 바코드 스캔으로 소모성 기구/바이오로직을 병원에 랜딩 등록합니다</p>
            </div>

            {message && (
                <div style={{
                    padding: '1rem', borderRadius: '8px', marginBottom: '1rem',
                    backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
                    color: message.includes('✅') ? '#155724' : '#721c24'
                }}>
                    {message}
                </div>
            )}

            {!registeredItem ? (
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="card-title">📷 바코드 스캔 및 제품 정보</h2>
                        {scannedChannel && (
                            <button onClick={handleChangeChannel} className="btn btn-secondary btn-sm">
                                🔄 창구 변경
                            </button>
                        )}
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        {/* 창구 선택 상태 표시 */}
                        {scannedChannel ? (
                            <div style={{
                                backgroundColor: '#e8f5e9', padding: '1rem', borderRadius: '8px',
                                marginBottom: '1rem', border: '2px solid #28a745',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div>
                                    <strong style={{ color: '#155724', fontSize: '1.1rem' }}>
                                        ✅ 창구: {scannedChannel.name}
                                    </strong>
                                    <p style={{ margin: '0.5rem 0 0 0', color: '#155724' }}>
                                        이제 제품 바코드를 연속 스캔하세요
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                backgroundColor: '#fff3cd', padding: '1rem', borderRadius: '8px',
                                marginBottom: '1rem', border: '2px solid #ffc107'
                            }}>
                                <strong style={{ color: '#856404' }}>📱 1단계: 창구 QR을 먼저 스캔하세요</strong>
                                <p style={{ margin: '0.5rem 0 0 0', color: '#856404' }}>
                                    선반에 부착된 창구 QR 코드를 스캔하면 해당 창구로 자동 선택됩니다
                                </p>
                            </div>
                        )}

                        {/* Barcode Input */}
                        <div className="form-group">
                            <label>{scanMode === 'CHANNEL' ? '창구 QR 또는 ' : ''}GS1 바코드 입력 *</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={scanInput}
                                    onChange={(e) => setScanInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                                    placeholder={scanMode === 'CHANNEL' ? '창구 QR 또는 제품 바코드 스캔...' : '제품 바코드 스캔...'}
                                    className="form-input"
                                    style={{ flex: 1 }}
                                />
                                <button onClick={handleScan} className="btn btn-primary">
                                    🔍 파싱
                                </button>
                            </div>
                        </div>

                        {/* Parsed Data Display */}
                        {parsedData && (
                            <div style={{
                                backgroundColor: '#e8f4fd', padding: '1rem', borderRadius: '8px',
                                marginBottom: '1rem', border: '1px solid #b3d7f5'
                            }}>
                                <h4 style={{ margin: '0 0 0.5rem 0' }}>📋 파싱된 정보</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                    {parsedData.gtin && <div><strong>GTIN:</strong> {parsedData.gtin}</div>}
                                    {parsedData.lotNumber && <div><strong>LOT:</strong> {parsedData.lotNumber}</div>}
                                    {parsedData.expirationDateFormatted && (
                                        <div><strong>유효기한:</strong> {parsedData.expirationDateDisplay}</div>
                                    )}
                                    {parsedData.serialNumber && <div><strong>S/N:</strong> {parsedData.serialNumber}</div>}
                                </div>
                            </div>
                        )}

                        {/* 기존 제품 자동 채움 안내 */}
                        {existingProduct && (
                            <div style={{
                                backgroundColor: '#d4edda', padding: '1rem', borderRadius: '8px',
                                marginBottom: '1rem', border: '1px solid #28a745'
                            }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#155724' }}>✅ 기존 제품 정보 자동 채움</h4>
                                <p style={{ margin: 0, color: '#155724' }}>
                                    이전에 {existingProduct.total_lending_count}회 입고된 제품입니다. 정보가 자동으로 채워졌습니다.
                                </p>
                            </div>
                        )}

                        {/* Product Info */}
                        <div className="form-group">
                            <label>제품명 {existingProduct ? '(자동 채움)' : '(선택)'}</label>
                            <input
                                type="text"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                placeholder={existingProduct ? '' : '미입력 시 GTIN이 제품명으로 사용됩니다'}
                                className="form-input"
                                style={existingProduct ? { backgroundColor: '#e8f5e9' } : {}}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                            <div className="form-group">
                                <label>카테고리 *</label>
                                <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-select">
                                    <option value="CONSUMABLE">🔩 소모성 기구</option>
                                    <option value="BIOLOGIC">💉 바이오로직</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>수량</label>
                                <input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} min="1" className="form-input" />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                            {/* 창구 - QR로 선택되면 표시만, 아니면 드롭다운 */}
                            <div className="form-group">
                                <label>창구 (채널) * {scannedChannel && '(QR 스캔)'}</label>
                                {scannedChannel ? (
                                    <input
                                        type="text"
                                        value={scannedChannel.name}
                                        readOnly
                                        className="form-input"
                                        style={{ backgroundColor: '#e8f5e9' }}
                                    />
                                ) : (
                                    <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="form-select">
                                        {channels.map(ch => (
                                            <option key={ch.id} value={ch.id}>{ch.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="form-group">
                                <label>배치 병원 *</label>
                                <select value={selectedHospital} onChange={(e) => setSelectedHospital(e.target.value)} className="form-select">
                                    {hospitals.map(h => (
                                        <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 가격 정보 */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                            <div className="form-group">
                                <label>💰 매입가 (원) {existingProduct && existingProduct.purchase_price > 0 && '(자동 채움)'}</label>
                                <input
                                    type="number"
                                    value={purchasePrice}
                                    onChange={(e) => setPurchasePrice(e.target.value)}
                                    placeholder="예: 50000"
                                    className="form-input"
                                    min="0"
                                    style={existingProduct && existingProduct.purchase_price > 0 ? { backgroundColor: '#e8f5e9' } : {}}
                                />
                            </div>
                            <div className="form-group">
                                <label>💵 판매가 (원)</label>
                                <input
                                    type="number"
                                    value={sellingPrice}
                                    onChange={(e) => setSellingPrice(e.target.value)}
                                    placeholder="예: 100000"
                                    className="form-input"
                                    min="0"
                                />
                            </div>
                        </div>

                        {/* 비고 입력 */}
                        <div className="form-group">
                            <label>📝 비고 (선택)</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="추가 메모가 있으면 입력하세요..."
                                className="form-input"
                            />
                        </div>

                        <button
                            onClick={handleRegister}
                            disabled={loading || !parsedData}
                            className="btn btn-success"
                            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                        >
                            {loading ? '등록 중...' : '📦 랜딩 등록 및 QR 생성'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="card-header" style={{ backgroundColor: '#d4edda' }}>
                        <h2 className="card-title">✅ 등록 완료</h2>
                    </div>
                    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <p><strong>제품 ID:</strong> {registeredItem.product_id}</p>
                            <p><strong>랜딩 ID:</strong> {registeredItem.lending_item_id}</p>
                            <p><strong>창구:</strong> {channels.find(c => c.id == selectedChannel)?.name}</p>
                        </div>

                        {qrCodeUrl && (
                            <div style={{ marginBottom: '1rem' }}>
                                <h3>📱 QR 코드 (2cm × 2cm)</h3>
                                <div style={{
                                    display: 'inline-block', padding: '10px', backgroundColor: 'white',
                                    border: '2px dashed #ccc', borderRadius: '8px'
                                }}>
                                    <img src={qrCodeUrl} alt="QR Code" style={{ width: '75px', height: '75px' }} />
                                    <p style={{ margin: '5px 0 0 0', fontSize: '10px', color: '#666' }}>
                                        {channels.find(c => c.id == selectedChannel)?.name}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button onClick={handlePrint} className="btn btn-primary">
                                🖨️ QR 코드 인쇄
                            </button>
                            <button onClick={resetForm} className="btn btn-secondary">
                                📦 다른 제품 등록
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            <div className="info-box" style={{ marginTop: '2rem' }}>
                <h3>💡 사용 방법</h3>
                <ul>
                    <li><strong>1단계 - 창구 QR 스캔</strong>: 선반에 부착된 창구 QR 코드를 먼저 스캔하세요 (또는 드롭다운 선택)</li>
                    <li><strong>2단계 - 제품 바코드 스캔</strong>: GS1 바코드를 스캔하면 GTIN, LOT, 유효기한이 자동 파싱됩니다</li>
                    <li><strong>기존 제품</strong>: 이전에 입고한 제품은 제품명/가격이 자동으로 채워집니다</li>
                    <li><strong>연속 스캔</strong>: 같은 창구에 여러 제품을 연속으로 입고할 수 있습니다</li>
                    <li><strong>창구 QR 생성</strong>: <a href="/channels/qr">창구 QR 생성 페이지</a>에서 선반용 QR 코드를 출력하세요</li>
                </ul>
            </div>
        </div >
    );
}

export default LendingProductRegistrationPage;
