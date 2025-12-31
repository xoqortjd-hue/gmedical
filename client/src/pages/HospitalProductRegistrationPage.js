import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { parseGS1 } from '../utils/gs1Parser';
import '../styles/main.css';

function HospitalProductRegistrationPage() {
    const [scanInput, setScanInput] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [productInfo, setProductInfo] = useState(null);
    const [purchasePrice, setPurchasePrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [registeredItems, setRegisteredItems] = useState([]);
    const inputRef = useRef(null);

    // 병원 및 창구 관련 상태
    const [hospitals, setHospitals] = useState([]);
    const [channels, setChannels] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('');

    // 병원 추가 관련 상태
    const [showAddHospital, setShowAddHospital] = useState(false);
    const [newHospitalName, setNewHospitalName] = useState('');
    const [addingHospital, setAddingHospital] = useState(false);

    // 병원 및 창구 목록 조회
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [hospitalsRes, channelsRes] = await Promise.all([
                    axios.get('/api/hospitals'),
                    axios.get('/api/channels')
                ]);
                setHospitals(hospitalsRes.data);
                setChannels(channelsRes.data);
            } catch (error) {
                console.error('데이터 조회 실패:', error);
            }
        };
        fetchData();
    }, []);

    const handleScan = async () => {
        const input = scanInput.trim();
        if (!input) {
            setMessage('❌ 바코드를 입력해주세요');
            return;
        }

        if (!selectedHospital) {
            setMessage('❌ 먼저 병원을 선택해주세요');
            return;
        }

        const result = parseGS1(input);
        if (result.success) {
            setParsedData(result);
            setProductInfo(null);

            // GTIN으로 제품 마스터 조회
            const gtin = result.gtin || result.raw;
            if (gtin) {
                try {
                    setMessage('🔍 제품 조회 중...');
                    const response = await axios.get('/api/products/' + gtin);
                    if (response.data) {
                        setProductInfo(response.data);
                        setMessage('✅ 제품 확인: "' + response.data.name + '" - 가격을 입력하세요.');
                    }
                } catch (error) {
                    if (error.response?.status === 404) {
                        setMessage('❌ 등록되지 않은 제품입니다. 먼저 "일반 제품 등록"에서 제품을 등록해주세요.');
                        setProductInfo(null);
                    } else {
                        console.error('제품 조회 실패:', error);
                        setMessage('❌ 제품 조회 실패');
                    }
                }
            }
            setScanInput('');
        } else {
            setMessage('❌ 파싱 실패: ' + result.error);
            setParsedData(null);
            setProductInfo(null);
        }
    };

    // 병원별 제품 등록 (lending_items에 추가)
    const handleRegister = async () => {
        if (!productInfo) {
            setMessage('❌ 먼저 제품 바코드를 스캔해주세요');
            return;
        }

        if (!selectedHospital) {
            setMessage('❌ 병원을 선택해주세요');
            return;
        }

        setLoading(true);
        try {
            // lending/register-product API 호출
            const response = await axios.post('/api/lending/register-product', {
                product_name: productInfo.name,
                gtin: productInfo.barcode,
                lot_number: parsedData?.lotNumber || '',
                expiration_date: parsedData?.expirationDateFormatted || null,
                channel_id: selectedChannel ? parseInt(selectedChannel) : null,
                hospital_id: parseInt(selectedHospital),
                quantity: parseInt(quantity) || 1,
                category: productInfo.category,
                purchase_price: parseFloat(purchasePrice) || 0,
                selling_price: parseFloat(sellingPrice) || 0,
                notes: '병원별 제품 등록'
            });

            if (response.data) {
                const hospitalName = hospitals.find(h => h.id.toString() === selectedHospital)?.name || '-';
                const channelName = channels.find(c => c.id.toString() === selectedChannel)?.name || '-';

                setMessage('✅ 등록 완료: "' + productInfo.name + '" → ' + hospitalName);

                setRegisteredItems(prev => [...prev, {
                    id: Date.now(),
                    productName: productInfo.name,
                    barcode: productInfo.barcode,
                    hospital: hospitalName,
                    channel: channelName,
                    purchasePrice: purchasePrice,
                    sellingPrice: sellingPrice,
                    quantity: quantity,
                    time: new Date().toLocaleTimeString('ko-KR')
                }]);

                // 제품 정보만 초기화 (병원/창구는 유지하여 연속 입력 가능)
                resetProductForm();
            }
        } catch (error) {
            console.error('등록 실패:', error);
            setMessage('❌ 등록 실패: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const resetProductForm = () => {
        setScanInput('');
        setParsedData(null);
        setProductInfo(null);
        setPurchasePrice('');
        setSellingPrice('');
        setQuantity('1');
        inputRef.current?.focus();
    };

    const resetAll = () => {
        resetProductForm();
        setSelectedHospital('');
        setSelectedChannel('');
        setMessage('');
        setShowAddHospital(false);
        setNewHospitalName('');
    };

    // 병원 추가 함수
    const handleAddHospital = async () => {
        const name = newHospitalName.trim();
        if (!name) {
            setMessage('❌ 병원명을 입력해주세요');
            return;
        }

        setAddingHospital(true);
        try {
            const response = await axios.post('/api/hospitals', { name });
            if (response.data) {
                // 병원 목록 갱신
                const hospitalsRes = await axios.get('/api/hospitals');
                setHospitals(hospitalsRes.data);

                // 새로 추가된 병원 선택
                const newHospital = hospitalsRes.data.find(h => h.name === name);
                if (newHospital) {
                    setSelectedHospital(newHospital.id.toString());
                }

                setMessage('✅ 병원 추가 완료: "' + name + '"');
                setNewHospitalName('');
                setShowAddHospital(false);
            }
        } catch (error) {
            console.error('병원 추가 실패:', error);
            if (error.response?.status === 409) {
                setMessage('❌ 이미 등록된 병원명입니다');
            } else {
                setMessage('❌ 병원 추가 실패: ' + (error.response?.data?.error || error.message));
            }
        } finally {
            setAddingHospital(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>🏥 병원별 제품 등록</h1>
                <p>병원을 선택하고 제품의 매입가/판매가를 설정합니다</p>
            </div>

            {message && (
                <div style={{
                    padding: '1rem', borderRadius: '8px', marginBottom: '1rem',
                    backgroundColor: message.includes('✅') ? '#d4edda' :
                        message.includes('🔍') ? '#fff3cd' : '#f8d7da',
                    color: message.includes('✅') ? '#155724' :
                        message.includes('🔍') ? '#856404' : '#721c24'
                }}>
                    {message}
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">📍 병원 및 창구 선택</h2>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        <div className="form-group">
                            <label>🏥 병원 선택 * <span style={{ color: 'red' }}>(필수)</span></label>
                            <select
                                value={selectedHospital}
                                onChange={(e) => setSelectedHospital(e.target.value)}
                                className="form-select"
                                style={{
                                    borderColor: selectedHospital ? '#28a745' : '#dc3545',
                                    backgroundColor: selectedHospital ? '#e8f5e9' : '#fff'
                                }}
                            >
                                <option value="">-- 병원 선택 --</option>
                                {hospitals.map(hospital => (
                                    <option key={hospital.id} value={hospital.id}>
                                        {hospital.name}
                                    </option>
                                ))}
                            </select>
                            {/* 병원 추가 버튼 */}
                            <button
                                type="button"
                                onClick={() => setShowAddHospital(!showAddHospital)}
                                className="btn btn-secondary"
                                style={{ marginTop: '0.5rem', width: '100%' }}
                            >
                                {showAddHospital ? '➖ 취소' : '➕ 새 병원 추가'}
                            </button>
                            {/* 병원 추가 입력 폼 */}
                            {showAddHospital && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    padding: '0.75rem',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '8px',
                                    border: '1px solid #dee2e6'
                                }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            value={newHospitalName}
                                            onChange={(e) => setNewHospitalName(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddHospital()}
                                            placeholder="새 병원명 입력..."
                                            className="form-input"
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            onClick={handleAddHospital}
                                            disabled={addingHospital || !newHospitalName.trim()}
                                            className="btn btn-success"
                                        >
                                            {addingHospital ? '추가중...' : '✅ 추가'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label>📍 창구 (채널) - 선택</label>
                            <select
                                value={selectedChannel}
                                onChange={(e) => setSelectedChannel(e.target.value)}
                                className="form-select"
                            >
                                <option value="">-- 창구 선택 (선택사항) --</option>
                                {channels.map(channel => (
                                    <option key={channel.id} value={channel.id}>
                                        {channel.name} ({channel.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedHospital && (
                        <div style={{
                            backgroundColor: '#d4edda', padding: '0.75rem', borderRadius: '8px',
                            marginTop: '1rem', border: '1px solid #28a745'
                        }}>
                            <strong style={{ color: '#155724' }}>
                                ✅ 선택된 병원: {hospitals.find(h => h.id.toString() === selectedHospital)?.name}
                                {selectedChannel && ` | 창구: ${channels.find(c => c.id.toString() === selectedChannel)?.name}`}
                            </strong>
                        </div>
                    )}
                </div>
            </div>

            {/* 제품 스캔 및 가격 입력 */}
            <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                    <h2 className="card-title">📷 제품 스캔 및 가격 설정</h2>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    {/* 바코드 입력 */}
                    <div className="form-group">
                        <label>GS1 바코드 입력 *</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                ref={inputRef}
                                type="text"
                                value={scanInput}
                                onChange={(e) => setScanInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                                placeholder={selectedHospital ? "바코드 스캔..." : "먼저 병원을 선택하세요"}
                                className="form-input"
                                style={{ flex: 1 }}
                                disabled={!selectedHospital}
                            />
                            <button
                                onClick={handleScan}
                                className="btn btn-primary"
                                disabled={!selectedHospital}
                            >
                                🔍 조회
                            </button>
                        </div>
                    </div>

                    {/* 파싱된 정보 */}
                    {parsedData && (
                        <div style={{
                            backgroundColor: '#e8f4fd', padding: '1rem', borderRadius: '8px',
                            marginBottom: '1rem', border: '1px solid #b3d7f5'
                        }}>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>📋 파싱된 정보</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                {parsedData.gtin && <div><strong>GTIN:</strong> {parsedData.gtin}</div>}
                                {parsedData.lotNumber && <div><strong>LOT:</strong> {parsedData.lotNumber}</div>}
                                {parsedData.expirationDateFormatted && (
                                    <div><strong>유효기한:</strong> {parsedData.expirationDateDisplay}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 제품 정보 */}
                    {productInfo && (
                        <div style={{
                            backgroundColor: '#d1ecf1', padding: '1rem', borderRadius: '8px',
                            marginBottom: '1rem', border: '1px solid #17a2b8'
                        }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0c5460' }}>📦 제품 정보</h4>
                            <p style={{ margin: 0, color: '#0c5460' }}>
                                <strong>{productInfo.name}</strong> |
                                카테고리: {productInfo.category === 'BIOLOGIC' ? '💉 바이오로직' :
                                    productInfo.category === 'EQUIPMENT' ? '🔧 기구/장비' : '🔩 소모성 기구'}
                            </p>
                        </div>
                    )}

                    {/* 가격 및 수량 입력 */}
                    {productInfo && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>💰 매입가 (원)</label>
                                    <input
                                        type="number"
                                        value={purchasePrice}
                                        onChange={(e) => setPurchasePrice(e.target.value)}
                                        placeholder="예: 50000"
                                        className="form-input"
                                        min="0"
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
                                <div className="form-group">
                                    <label>📦 수량</label>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder="1"
                                        className="form-input"
                                        min="1"
                                    />
                                </div>
                            </div>

                            {/* 등록 버튼 */}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button
                                    onClick={handleRegister}
                                    disabled={loading || !productInfo || !selectedHospital}
                                    className="btn btn-success"
                                    style={{ flex: 1, padding: '1rem', fontSize: '1.1rem' }}
                                >
                                    {loading ? '등록 중...' : '🏥 병원에 등록'}
                                </button>
                                <button
                                    onClick={resetProductForm}
                                    className="btn btn-secondary"
                                    style={{ padding: '1rem' }}
                                >
                                    🔄 제품 초기화
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 등록 완료 목록 */}
            {registeredItems.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-header">
                        <h2 className="card-title">📋 등록 완료 목록</h2>
                    </div>
                    <div style={{ padding: '1rem', overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>시간</th>
                                    <th>제품명</th>
                                    <th>병원</th>
                                    <th>창구</th>
                                    <th>매입가</th>
                                    <th>판매가</th>
                                    <th>수량</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registeredItems.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.time}</td>
                                        <td><strong>{item.productName}</strong></td>
                                        <td>{item.hospital}</td>
                                        <td>{item.channel}</td>
                                        <td>{item.purchasePrice ? Number(item.purchasePrice).toLocaleString() + '원' : '-'}</td>
                                        <td>{item.sellingPrice ? Number(item.sellingPrice).toLocaleString() + '원' : '-'}</td>
                                        <td>{item.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="info-box" style={{ marginTop: '2rem' }}>
                <h3>💡 사용 방법</h3>
                <ul>
                    <li><strong>1단계</strong>: 병원을 먼저 선택 (필수)</li>
                    <li><strong>2단계</strong>: 창구 선택 (선택사항)</li>
                    <li><strong>3단계</strong>: 제품 바코드 스캔</li>
                    <li><strong>4단계</strong>: 매입가/판매가/수량 입력 후 등록</li>
                    <li><strong>연속 입력</strong>: 같은 병원에 여러 제품을 연속으로 입력 가능</li>
                </ul>
            </div>

            {/* 전체 초기화 버튼 */}
            <button
                onClick={resetAll}
                className="btn btn-secondary"
                style={{ marginTop: '1rem', width: '100%' }}
            >
                🔄 전체 초기화 (병원 선택 포함)
            </button>
        </div>
    );
}

export default HospitalProductRegistrationPage;
