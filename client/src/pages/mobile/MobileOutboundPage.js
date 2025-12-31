import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { parseGS1 } from '../../utils/gs1Parser';
import { API_BASE_URL } from '../../config';
import '../../styles/mobile.css';

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

const MobileOutboundPage = () => {
    const [step, setStep] = useState(1); // 1: 창구선택, 2: 거래처선택, 3: 스캔&출고
    const [channels, setChannels] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [scanInput, setScanInput] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState('1');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [recentOutbound, setRecentOutbound] = useState([]);

    const inputRef = useRef(null);

    // 초기 데이터 로드
    useEffect(() => {
        fetchChannels();
        fetchCustomers();
    }, []);

    // 창구 선택 시 해당 창구 재고 로드
    useEffect(() => {
        if (selectedChannel) {
            fetchInventory(selectedChannel.id);
        }
    }, [selectedChannel]);

    // 스캔 단계에서 자동 포커스
    useEffect(() => {
        if (step === 3 && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
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

    const fetchCustomers = async () => {
        try {
            const res = await axios.get('/api/customers');
            setCustomers(res.data);
        } catch (error) {
            console.error('거래처 조회 실패:', error);
        }
    };

    const fetchInventory = async (channelId) => {
        try {
            const res = await axios.get(`/api/lending/biologic-inventory?channel_id=${channelId}`);
            setInventory(res.data.items || []);
        } catch (error) {
            console.error('재고 조회 실패:', error);
        }
    };

    const handleChannelSelect = (channel) => {
        setSelectedChannel(channel);
        setStep(2);
        setMessage({ type: 'success', text: `✅ ${channel.name} 창구 선택됨` });
    };

    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setNewCustomerName('');
        setStep(3);
        setMessage({ type: 'success', text: `✅ 거래처: ${customer.name}` });
    };

    const handleNewCustomer = () => {
        if (!newCustomerName.trim()) {
            setMessage({ type: 'error', text: '❌ 거래처명을 입력하세요' });
            return;
        }
        setSelectedCustomer({ id: null, name: newCustomerName.trim(), isNew: true });
        setStep(3);
        setMessage({ type: 'success', text: `✅ 신규 거래처: ${newCustomerName}` });
    };

    const handleScan = async () => {
        const input = scanInput.trim();
        if (!input) return;

        setLoading(true);
        setMessage(null);

        try {
            const parsed = parseGS1(input);
            const searchBarcode = parsed.gtin || input;

            // 현재 창구 재고에서 해당 바코드 찾기
            const matchingItem = inventory.find(item => item.barcode === searchBarcode);

            if (matchingItem) {
                setSelectedItem(matchingItem);
                setMessage({
                    type: 'success',
                    text: `✅ ${matchingItem.product_name} (재고: ${matchingItem.quantity}개)`
                });
            } else {
                setMessage({
                    type: 'error',
                    text: '❌ 해당 창구에 재고가 없습니다'
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '❌ 스캔 오류' });
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

    const handleOutbound = async () => {
        if (!selectedItem || !quantity) {
            setMessage({ type: 'error', text: '❌ 제품과 수량을 확인하세요' });
            return;
        }

        if (parseInt(quantity) > selectedItem.quantity) {
            setMessage({ type: 'error', text: `❌ 재고 부족 (현재: ${selectedItem.quantity}개)` });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                lending_item_id: selectedItem.lending_item_id,
                quantity: parseInt(quantity),
                channel_id: selectedChannel?.id,
                notes: `${selectedChannel?.name} → ${selectedCustomer?.name}`
            };

            if (selectedCustomer?.isNew) {
                payload.customer_name = selectedCustomer.name;
            } else {
                payload.customer_id = selectedCustomer?.id;
            }

            const response = await axios.post('/api/lending/outbound', payload);

            setMessage({
                type: 'success',
                text: `✅ 출고 완료! ${selectedItem.product_name} x${quantity}`
            });

            // 최근 출고 목록에 추가
            setRecentOutbound(prev => [{
                name: selectedItem.product_name,
                quantity: parseInt(quantity),
                customer: selectedCustomer?.name,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            }, ...prev.slice(0, 4)]);

            // 재고 새로고침 및 다음 스캔 준비
            fetchInventory(selectedChannel.id);
            resetForNextScan();

        } catch (error) {
            setMessage({
                type: 'error',
                text: '❌ 출고 실패: ' + (error.response?.data?.error || error.message)
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForNextScan = () => {
        setSelectedItem(null);
        setQuantity('1');
        setScanInput('');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const resetAll = () => {
        setSelectedChannel(null);
        setSelectedCustomer(null);
        setSelectedItem(null);
        setNewCustomerName('');
        setQuantity('1');
        setScanInput('');
        setStep(1);
        setMessage(null);
    };

    const getExpiryStyle = (status) => {
        switch (status) {
            case 'EXPIRED': return { background: '#fee2e2', color: '#dc2626' };
            case 'CRITICAL': return { background: '#fef3c7', color: '#d97706' };
            case 'WARNING': return { background: '#fef9c3', color: '#ca8a04' };
            default: return { background: '#dcfce7', color: '#16a34a' };
        }
    };

    const getExpiryIcon = (status) => {
        switch (status) {
            case 'EXPIRED': return '⚫';
            case 'CRITICAL': return '🔴';
            case 'WARNING': return '🟡';
            default: return '🟢';
        }
    };

    return (
        <div className="mobile-inbound-page">
            {/* 헤더 */}
            <div className="mobile-header" style={{ background: 'linear-gradient(135deg, #dc2626, #f97316)' }}>
                <Link to="/mobile/home" style={{ color: 'white', textDecoration: 'none' }}>
                    ← 홈
                </Link>
                <h1>📤 모바일 출고</h1>
                {selectedChannel && (
                    <button className="btn-change-channel" onClick={resetAll}>
                        🔄 처음부터
                    </button>
                )}
            </div>

            {/* 메시지 */}
            {message && (
                <div className={`mobile-message ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Step 1: 창구 선택 */}
            {step === 1 && (
                <div className="step-container">
                    <h2>📍 출고할 창구 선택</h2>
                    <p style={{ color: '#666', marginBottom: '1rem' }}>어느 창구 재고에서 출고하시겠습니까?</p>
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

            {/* Step 2: 거래처 선택 */}
            {step === 2 && (
                <div className="step-container">
                    <div className="selected-channel-badge">
                        ✅ {selectedChannel?.name} 창구
                    </div>

                    <h2>🏢 거래처 선택</h2>

                    {/* 신규 거래처 입력 */}
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f9ff', borderRadius: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                            신규 거래처 등록
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                value={newCustomerName}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                placeholder="거래처명 입력..."
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '1rem'
                                }}
                            />
                            <button
                                onClick={handleNewCustomer}
                                style={{
                                    padding: '0.75rem 1rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600'
                                }}
                            >
                                ➕ 추가
                            </button>
                        </div>
                    </div>

                    {/* 기존 거래처 목록 */}
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                        기존 거래처 선택
                    </label>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {customers.length === 0 ? (
                            <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
                                등록된 거래처가 없습니다. 위에서 신규 등록하세요.
                            </p>
                        ) : (
                            customers.map(customer => (
                                <button
                                    key={customer.id}
                                    onClick={() => handleCustomerSelect(customer)}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '1rem',
                                        marginBottom: '0.5rem',
                                        background: 'white',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '8px',
                                        textAlign: 'left',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ fontWeight: '600' }}>{customer.name}</div>
                                    {customer.phone && (
                                        <div style={{ color: '#666', fontSize: '0.85rem' }}>{customer.phone}</div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Step 3: 스캔 & 출고 */}
            {step === 3 && (
                <div className="step-container">
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div className="selected-channel-badge" style={{ flex: 1 }}>
                            📍 {selectedChannel?.name}
                        </div>
                        <div className="selected-channel-badge" style={{ flex: 1, background: '#dbeafe' }}>
                            🏢 {selectedCustomer?.name}
                        </div>
                    </div>

                    {/* 바코드 스캔 */}
                    <div className="scan-section">
                        <h2>🔍 바코드 스캔</h2>
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

                    {/* 선택된 제품 정보 */}
                    {selectedItem && (
                        <div className="product-card" style={{ marginTop: '1rem' }}>
                            <h2>📦 {selectedItem.product_name}</h2>
                            <div className="product-info">
                                <div className="info-row">
                                    <span>현재 재고</span>
                                    <span style={{ fontWeight: '600', color: '#16a34a' }}>
                                        {selectedItem.quantity}개
                                    </span>
                                </div>
                                <div className="info-row">
                                    <span>유통기한</span>
                                    <span style={getExpiryStyle(selectedItem.expiry_status)}>
                                        {getExpiryIcon(selectedItem.expiry_status)} {selectedItem.expiration_date || '미정'}
                                        {selectedItem.days_until_expiry !== null && (
                                            <span> (D{selectedItem.days_until_expiry >= 0 ? '-' : '+'}{Math.abs(selectedItem.days_until_expiry)})</span>
                                        )}
                                    </span>
                                </div>
                                {selectedItem.lot_number && (
                                    <div className="info-row">
                                        <span>LOT</span>
                                        <span>{selectedItem.lot_number}</span>
                                    </div>
                                )}
                            </div>

                            {/* 수량 입력 */}
                            <div className="quantity-section">
                                <label>출고 수량</label>
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
                                        max={selectedItem.quantity}
                                    />
                                    <button
                                        className="qty-btn"
                                        onClick={() => setQuantity(q => Math.min(selectedItem.quantity, parseInt(q) + 1).toString())}
                                    >
                                        ➕
                                    </button>
                                </div>
                            </div>

                            {/* 출고 버튼 */}
                            <div className="action-buttons">
                                <button
                                    className="btn-inbound"
                                    style={{ background: 'linear-gradient(135deg, #dc2626, #f97316)' }}
                                    onClick={handleOutbound}
                                    disabled={loading}
                                >
                                    {loading ? '처리중...' : '📤 출고 처리'}
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

                    {/* 현재 창구 재고 목록 */}
                    {!selectedItem && inventory.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <h3>📋 {selectedChannel?.name} 재고 ({inventory.length}건)</h3>
                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                {inventory.map(item => (
                                    <div
                                        key={item.lending_item_id}
                                        onClick={() => {
                                            setSelectedItem(item);
                                            setMessage({ type: 'success', text: `✅ ${item.product_name} 선택됨` });
                                        }}
                                        style={{
                                            padding: '0.75rem',
                                            marginBottom: '0.5rem',
                                            background: 'white',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '600' }}>{item.product_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                                {getExpiryIcon(item.expiry_status)} {item.expiration_date || '기한 미정'}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: '600', color: '#16a34a' }}>
                                            {item.quantity}개
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 최근 출고 목록 */}
                    {recentOutbound.length > 0 && (
                        <div className="recent-items" style={{ marginTop: '1.5rem' }}>
                            <h3>📋 최근 출고</h3>
                            {recentOutbound.map((item, idx) => (
                                <div key={idx} className="recent-item">
                                    <span>{item.name}</span>
                                    <span>-{item.quantity}</span>
                                    <span style={{ color: '#666', fontSize: '0.8rem' }}>→ {item.customer}</span>
                                    <span className="time">{item.time}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MobileOutboundPage;
