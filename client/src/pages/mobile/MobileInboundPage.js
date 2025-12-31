import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { parseGS1, generateLotNumber } from '../../utils/gs1Parser';
import { API_BASE_URL } from '../../config';
import '../../styles/mobile.css';

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

const MobileInboundPage = () => {
    const today = new Date().toISOString().split('T')[0];

    const [step, setStep] = useState(1); // 1: 창구선택, 2: 스캔, 3: 확인
    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [scanInput, setScanInput] = useState('');
    const [product, setProduct] = useState(null);
    const [gs1Data, setGs1Data] = useState(null);
    const [quantity, setQuantity] = useState('1');
    const [manualExpirationDate, setManualExpirationDate] = useState(''); // 수동 유통기한 입력
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [recentItems, setRecentItems] = useState([]);

    const inputRef = useRef(null);

    // 창구 목록 조회
    useEffect(() => {
        fetchChannels();
    }, []);

    // 스캔 단계에서 자동 포커스
    useEffect(() => {
        if (step === 2 && inputRef.current) {
            setTimeout(() => {
                inputRef.current.focus();
            }, 100);
        }
    }, [step]);

    const fetchChannels = async () => {
        try {
            const res = await axios.get('/api/channels');
            setChannels(res.data);
        } catch (error) {
            console.error('채널 조회 실패:', error);
        }
    };

    const handleChannelSelect = (channel) => {
        setSelectedChannel(channel);
        setStep(2);
        setMessage({ type: 'success', text: `✅ ${channel.name} 선택됨` });
    };

    const handleScan = async () => {
        const input = scanInput.trim();
        if (!input) return;

        setLoading(true);
        setMessage(null);

        try {
            // GS1 파싱
            const parsed = parseGS1(input);
            setGs1Data(parsed);

            // 제품 조회
            const searchBarcode = parsed.gtin || input;
            try {
                const response = await axios.get(`/api/products/${searchBarcode}`);
                setProduct(response.data);
                setStep(3);
                setMessage({
                    type: 'success',
                    text: `✅ ${response.data.name}`
                });
            } catch (err) {
                // 미등록 제품
                setProduct(null);
                setMessage({
                    type: 'warning',
                    text: '⚠️ 미등록 제품',
                    showRegisterLink: true,
                    gtin: searchBarcode
                });
            }
        } catch (error) {
            setMessage({
                type: 'error',
                text: '❌ 스캔 오류'
            });
        } finally {
            setLoading(false);
            setScanInput('');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleScan();
        }
    };

    const handleInbound = async () => {
        if (!product || !quantity) {
            setMessage({ type: 'error', text: '❌ 수량을 입력하세요' });
            return;
        }

        // 창구 필수 검증
        if (!selectedChannel) {
            setMessage({ type: 'error', text: '❌ 창구를 먼저 선택하세요' });
            return;
        }

        // 유통기한 결정: 수동 입력 > GS1 추출 > 빈값
        const finalExpirationDate = manualExpirationDate || gs1Data?.expirationDateFormatted || '';

        setLoading(true);
        try {
            // lending API 호출 - CEO 대시보드에 반영됨
            const response = await axios.post('/api/lending/register-product', {
                product_name: product.name,
                gtin: product.barcode,
                lot_number: gs1Data?.lotNumber || generateLotNumber(),
                expiration_date: finalExpirationDate,
                channel_id: selectedChannel.id,
                hospital_id: 2, // 부산사무실 (창고)
                quantity: parseInt(quantity),
                category: product.category || 'BIOLOGIC',
                notes: `모바일 입고 - ${selectedChannel.name}`
            });

            setMessage({
                type: 'success',
                text: `✅ 입고 완료! - ${product.name} x${quantity}`
            });

            // 최근 입고 목록에 추가
            setRecentItems(prev => [{
                name: product.name,
                quantity: parseInt(quantity),
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            }, ...prev.slice(0, 4)]);

            // 다음 스캔 준비
            resetForNextScan();
        } catch (error) {
            setMessage({
                type: 'error',
                text: '❌ 입고 실패: ' + (error.response?.data?.error || error.message)
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForNextScan = () => {
        setProduct(null);
        setGs1Data(null);
        setQuantity('1');
        setManualExpirationDate('');
        setScanInput('');
        setStep(2);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const resetAll = () => {
        setSelectedChannel(null);
        setProduct(null);
        setGs1Data(null);
        setQuantity('1');
        setManualExpirationDate('');
        setScanInput('');
        setStep(1);
        setMessage(null);
    };

    return (
        <div className="mobile-inbound-page">
            {/* 헤더 */}
            <div className="mobile-header">
                <Link to="/mobile/home" style={{ color: 'white', textDecoration: 'none' }}>
                    ← 홈
                </Link>
                <h1>📦 모바일 입고</h1>
                {selectedChannel && (
                    <button className="btn-change-channel" onClick={resetAll}>
                        🔄 창구변경
                    </button>
                )}
            </div>

            {/* 메시지 */}
            {message && (
                <div className={`mobile-message ${message.type}`}>
                    <div>{message.text}</div>
                    {message.showRegisterLink && (
                        <Link
                            to={`/products/general?barcode=${message.gtin}`}
                            className="btn-register-link"
                            style={{
                                display: 'inline-block',
                                marginTop: '0.5rem',
                                padding: '0.5rem 1rem',
                                background: '#4f46e5',
                                color: 'white',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontSize: '0.9rem'
                            }}
                        >
                            📝 제품 등록하러 가기
                        </Link>
                    )}
                </div>
            )}

            {/* Step 1: 창구 선택 */}
            {step === 1 && (
                <div className="step-container">
                    <h2>📍 창구를 선택하세요</h2>
                    <div className="channel-grid">
                        {channels.map(channel => (
                            <button
                                key={channel.id}
                                className="channel-btn"
                                onClick={() => handleChannelSelect(channel)}
                            >
                                <span className="channel-name">{channel.name}</span>
                                <span className="channel-code">{channel.code}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 2: 스캔 대기 */}
            {step === 2 && (
                <div className="step-container">
                    <div className="selected-channel-badge">
                        ✅ {selectedChannel?.name}
                    </div>

                    <div className="scan-section">
                        <h2>🔍 바코드 스캔</h2>
                        <p className="scan-hint">블루투스 스캐너로 바코드를 스캔하세요</p>

                        <input
                            ref={inputRef}
                            type="text"
                            className="scan-input"
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="바코드 스캔 대기중..."
                            autoComplete="off"
                            autoFocus
                        />

                        <button
                            className="btn-search"
                            onClick={handleScan}
                            disabled={loading || !scanInput}
                        >
                            {loading ? '조회중...' : '🔎 검색'}
                        </button>
                    </div>

                    {/* 최근 입고 목록 */}
                    {recentItems.length > 0 && (
                        <div className="recent-items">
                            <h3>📋 최근 입고</h3>
                            {recentItems.map((item, idx) => (
                                <div key={idx} className="recent-item">
                                    <span>{item.name}</span>
                                    <span>+{item.quantity}</span>
                                    <span className="time">{item.time}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: 입고 확인 */}
            {step === 3 && product && (
                <div className="step-container">
                    <div className="selected-channel-badge">
                        ✅ {selectedChannel?.name}
                    </div>

                    <div className="product-card">
                        <h2>📦 {product.name}</h2>
                        <div className="product-info">
                            <div className="info-row">
                                <span>바코드</span>
                                <span>{product.barcode}</span>
                            </div>
                            <div className="info-row">
                                <span>현재고</span>
                                <span>{product.current_stock}개</span>
                            </div>
                            {gs1Data?.lotNumber && (
                                <div className="info-row">
                                    <span>LOT</span>
                                    <span>{gs1Data.lotNumber}</span>
                                </div>
                            )}
                            {gs1Data?.expirationDateDisplay && (
                                <div className="info-row">
                                    <span>유효기한</span>
                                    <span>{gs1Data.expirationDateDisplay}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="quantity-section">
                        <label>입고 수량</label>
                        <div className="quantity-controls">
                            <button
                                className="qty-btn"
                                onClick={() => setQuantity(q => Math.max(1, parseInt(q) - 1).toString())}
                            >
                                ➖
                            </button>
                            <input
                                type="number"
                                className="qty-input"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                min="1"
                            />
                            <button
                                className="qty-btn"
                                onClick={() => setQuantity(q => (parseInt(q) + 1).toString())}
                            >
                                ➕
                            </button>
                        </div>
                    </div>

                    {/* 유통기한 수동 입력 (GS1에서 추출 안 됐거나 수정 필요 시) */}
                    <div className="expiration-section" style={{ marginTop: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                            📅 유통기한 {gs1Data?.expirationDateDisplay ? '(자동추출됨)' : '(직접입력)'}
                        </label>
                        <input
                            type="date"
                            value={manualExpirationDate || gs1Data?.expirationDateFormatted || ''}
                            onChange={(e) => setManualExpirationDate(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: gs1Data?.expirationDateFormatted ? '2px solid #10b981' : '2px solid #f59e0b',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                background: gs1Data?.expirationDateFormatted ? '#ecfdf5' : '#fffbeb'
                            }}
                        />
                        {!gs1Data?.expirationDateFormatted && !manualExpirationDate && (
                            <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                ⚠️ 유통기한을 입력해주세요
                            </p>
                        )}
                    </div>
                    <div className="action-buttons">
                        <button
                            className="btn-inbound"
                            onClick={handleInbound}
                            disabled={loading}
                        >
                            {loading ? '처리중...' : '📥 입고 처리'}
                        </button>
                        <button
                            className="btn-cancel"
                            onClick={resetForNextScan}
                        >
                            ❌ 취소
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileInboundPage;
