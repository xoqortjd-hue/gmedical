import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { parseGS1 } from '../utils/gs1Parser';
import '../styles/main.css';

function GeneralProductRegistrationPage() {
    const [scanInput, setScanInput] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [productName, setProductName] = useState('');
    const [category, setCategory] = useState('BIOLOGIC');
    const [safetyStock, setSafetyStock] = useState('8');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [registeredProducts, setRegisteredProducts] = useState([]);
    const [existingProduct, setExistingProduct] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const inputRef = useRef(null);

    // 페이지 로드 시 바코드 입력란에 자동 포커스
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);


    const handleScan = async () => {
        const input = scanInput.trim();
        if (!input) {
            setMessage('❌ 바코드를 입력해주세요');
            return;
        }

        const result = parseGS1(input);
        if (result.success) {
            setParsedData(result);
            setExistingProduct(null);
            setIsEditMode(false);

            // GTIN으로 기존 제품 조회
            const gtin = result.gtin || result.raw;
            if (gtin) {
                try {
                    setMessage('🔍 기존 제품 조회 중...');
                    const response = await axios.get('/api/products/' + gtin);
                    if (response.data) {
                        setExistingProduct(response.data);
                        setProductName(response.data.name);
                        setCategory(response.data.category || 'CONSUMABLE');
                        setSafetyStock(response.data.safety_stock?.toString() || '10');
                        setIsEditMode(true);
                        setMessage('✅ 등록된 제품입니다. 정보를 수정하고 저장하세요.');
                    }
                } catch (error) {
                    if (error.response?.status === 404) {
                        setMessage('✅ 바코드 파싱 성공 - 신규 제품입니다. 정보를 입력하세요.');
                        setIsEditMode(false);
                    } else {
                        console.error('제품 조회 실패:', error);
                        setMessage('✅ 바코드 파싱 성공 - 정보를 입력하세요.');
                    }
                }
            } else {
                setMessage('✅ 바코드 파싱 성공 - 정보를 입력하세요.');
            }
            setScanInput('');
        } else {
            setMessage('❌ 파싱 실패: ' + result.error);
            setParsedData(null);
            setExistingProduct(null);
            setIsEditMode(false);
        }
    };

    // 신규 등록
    const handleRegister = async () => {
        if (!parsedData) {
            setMessage('❌ 먼저 바코드를 스캔해주세요');
            return;
        }

        const finalProductName = productName.trim();
        if (!finalProductName) {
            setMessage('❌ 제품명을 입력해주세요');
            return;
        }

        setLoading(true);
        try {
            const barcode = parsedData.gtin || parsedData.raw;

            const response = await axios.post('/api/products', {
                name: finalProductName,
                barcode: barcode,
                category: category,
                safety_stock: (category === 'CONSUMABLE' || category === 'BIOLOGIC') ? parseInt(safetyStock) || 10 : 0,
                current_stock: 0
            });

            if (response.data) {
                setMessage('✅ 제품 등록 완료: "' + finalProductName + '"');

                setRegisteredProducts(prev => [...prev, {
                    id: Date.now(),
                    name: finalProductName,
                    barcode: barcode,
                    category: category,
                    safetyStock: safetyStock,
                    time: new Date().toLocaleTimeString('ko-KR'),
                    action: '신규등록'
                }]);

                resetForm();
            }
        } catch (error) {
            console.error('등록 실패:', error);
            if (error.response?.status === 409) {
                setMessage('❌ 이미 등록된 바코드입니다');
            } else {
                setMessage('❌ 등록 실패: ' + (error.response?.data?.error || error.message));
            }
        } finally {
            setLoading(false);
        }
    };

    // 기존 제품 수정
    const handleUpdate = async () => {
        if (!existingProduct) {
            setMessage('❌ 수정할 제품이 없습니다');
            return;
        }

        const finalProductName = productName.trim();
        if (!finalProductName) {
            setMessage('❌ 제품명을 입력해주세요');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.put('/api/products/' + existingProduct.id, {
                name: finalProductName,
                category: category,
                safety_stock: (category === 'CONSUMABLE' || category === 'BIOLOGIC') ? parseInt(safetyStock) || 10 : 0
            });

            if (response.data) {
                setMessage('✅ 제품 수정 완료: "' + finalProductName + '"');

                setRegisteredProducts(prev => [...prev, {
                    id: Date.now(),
                    name: finalProductName,
                    barcode: existingProduct.barcode,
                    category: category,
                    safetyStock: safetyStock,
                    time: new Date().toLocaleTimeString('ko-KR'),
                    action: '수정'
                }]);

                resetForm();
            }
        } catch (error) {
            console.error('수정 실패:', error);
            setMessage('❌ 수정 실패: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setScanInput('');
        setParsedData(null);
        setProductName('');
        setSafetyStock('10');
        setExistingProduct(null);
        setIsEditMode(false);
        inputRef.current?.focus();
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📋 일반 제품 등록</h1>
                <p>제품 마스터 정보를 등록합니다 (병원별 가격은 별도 페이지에서 설정)</p>
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
                    <h2 className="card-title">📷 바코드 스캔 및 제품 정보</h2>
                    {isEditMode && (
                        <span style={{
                            backgroundColor: '#17a2b8', color: 'white',
                            padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.9rem'
                        }}>
                            ✏️ 수정 모드
                        </span>
                    )}
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
                                placeholder="바코드 스캔 또는 수동 입력..."
                                className="form-input"
                                style={{ flex: 1 }}
                            />
                            <button onClick={handleScan} className="btn btn-primary">
                                🔍 파싱
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

                    {/* 기존 제품 정보 */}
                    {existingProduct && (
                        <div style={{
                            backgroundColor: '#d1ecf1', padding: '1rem', borderRadius: '8px',
                            marginBottom: '1rem', border: '1px solid #17a2b8'
                        }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0c5460' }}>✏️ 수정할 제품</h4>
                            <p style={{ margin: 0, color: '#0c5460' }}>
                                제품명: <strong>{existingProduct.name}</strong> |
                                현재 재고: {existingProduct.current_stock}개 |
                                제품ID: {existingProduct.id}
                            </p>
                        </div>
                    )}

                    {/* 제품명 입력 */}
                    <div className="form-group">
                        <label>제품명 * <span style={{ color: '#666', fontSize: '0.9rem' }}>(필수 입력)</span></label>
                        <input
                            type="text"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="제품명을 입력하세요"
                            className="form-input"
                        />
                    </div>

                    {/* 카테고리 선택 */}
                    <div className="form-group">
                        <label>카테고리 *</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="form-select"
                        >
                            <option value="CONSUMABLE">🔩 소모성 기구</option>
                            <option value="BIOLOGIC">💉 바이오로직</option>
                            <option value="EQUIPMENT">🔧 기구/장비</option>
                        </select>
                    </div>

                    {/* 안전재고 - 소모성 기구/바이오로직만 */}
                    {(category === 'CONSUMABLE' || category === 'BIOLOGIC') && (
                        <div className="form-group">
                            <label>📦 안전재고 (최소 보유 수량)</label>
                            <input
                                type="number"
                                value={safetyStock}
                                onChange={(e) => setSafetyStock(e.target.value)}
                                placeholder="예: 10"
                                className="form-input"
                                min="0"
                            />
                        </div>
                    )}

                    {/* 버튼 */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        {isEditMode ? (
                            <button
                                onClick={handleUpdate}
                                disabled={loading || !productName.trim()}
                                className="btn btn-warning"
                                style={{ flex: 1, padding: '1rem', fontSize: '1.1rem' }}
                            >
                                {loading ? '저장 중...' : '✏️ 수정 저장'}
                            </button>
                        ) : (
                            <button
                                onClick={handleRegister}
                                disabled={loading || !parsedData || !productName.trim()}
                                className="btn btn-success"
                                style={{ flex: 1, padding: '1rem', fontSize: '1.1rem' }}
                            >
                                {loading ? '등록 중...' : '📋 제품 등록'}
                            </button>
                        )}
                        <button
                            onClick={resetForm}
                            className="btn btn-secondary"
                            style={{ padding: '1rem' }}
                        >
                            🔄 초기화
                        </button>
                    </div>
                </div>
            </div>

            {/* 등록/수정 완료 목록 */}
            {registeredProducts.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-header">
                        <h2 className="card-title">📋 처리 완료 목록</h2>
                    </div>
                    <div style={{ padding: '1rem', overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>시간</th>
                                    <th>작업</th>
                                    <th>제품명</th>
                                    <th>바코드</th>
                                    <th>카테고리</th>
                                    <th>안전재고</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registeredProducts.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.time}</td>
                                        <td>
                                            <span style={{
                                                backgroundColor: item.action === '수정' ? '#ffc107' : '#28a745',
                                                color: item.action === '수정' ? '#000' : '#fff',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.85rem'
                                            }}>
                                                {item.action}
                                            </span>
                                        </td>
                                        <td><strong>{item.name}</strong></td>
                                        <td><code>{item.barcode}</code></td>
                                        <td>{item.category === 'BIOLOGIC' ? '💉 바이오로직' :
                                            item.category === 'EQUIPMENT' ? '🔧 기구/장비' : '🔩 소모성 기구'}</td>
                                        <td>{item.safetyStock}</td>
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
                    <li><strong>용도</strong>: 제품 마스터 정보 등록 (제품명, 카테고리, 안전재고)</li>
                    <li><strong>신규 등록</strong>: 바코드 스캔 → 정보 입력 → "제품 등록" 클릭</li>
                    <li><strong>수정</strong>: 기존 제품 바코드 스캔 → 정보 수정 → "수정 저장" 클릭</li>
                    <li><strong>병원별 가격 설정</strong>: 등록 후 "🏥 병원별 제품 등록" 페이지에서 설정</li>
                </ul>
            </div>
        </div>
    );
}

export default GeneralProductRegistrationPage;
