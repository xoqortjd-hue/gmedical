import React, { useState, useRef } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { useReactToPrint } from 'react-to-print';
import '../styles/main.css';
import '../styles/qrcode.css';

function ProductRegistrationPage() {
    const [formData, setFormData] = useState({
        name: '',
        category: 'EQUIPMENT',
        unit_price: ''
    });
    const [generatedProduct, setGeneratedProduct] = useState(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [qrSize, setQrSize] = useState('medium');
    const [message, setMessage] = useState('');
    const [printQueue, setPrintQueue] = useState([]); // 인쇄 대기열
    const printRef = useRef(null);
    const batchPrintRef = useRef(null);

    // 사이즈별 설정 (코팅/커팅 여백 포함)
    const sizeConfig = {
        big: { width: 400, label: '빅사이즈', cellSize: '6cm', perPage: 4, cols: 2, rows: 2 },
        medium: { width: 250, label: '미들사이즈', cellSize: '4cm', perPage: 6, cols: 2, rows: 3 },
        mini: { width: 150, label: '미니사이즈', cellSize: '2.5cm', perPage: 12, cols: 3, rows: 4 }
    };

    const handlePrint = useReactToPrint({ contentRef: printRef });
    const handleBatchPrint = useReactToPrint({ contentRef: batchPrintRef });

    const generateBarcode = () => {
        const categoryCode = formData.category === 'EQUIPMENT' ? '01' : '02';
        const timestamp = Date.now().toString().slice(-8);
        return `99${categoryCode}${timestamp}`;
    };

    const handleSubmit = async (e, size = 'medium') => {
        e.preventDefault();
        setQrSize(size);
        const config = sizeConfig[size];

        try {
            const barcode = generateBarcode();
            const productData = { ...formData, barcode, current_stock: 0 };
            const res = await axios.post('/api/products', productData);

            if (res.data.success) {
                const newProduct = { ...productData, id: res.data.product_id };
                setGeneratedProduct(newProduct);

                const qrData = JSON.stringify({
                    barcode, name: formData.name, category: formData.category, id: res.data.product_id
                });
                const qrUrl = await QRCode.toDataURL(qrData, { width: config.width, margin: 1 });

                setQrCodeUrl(qrUrl);
                setMessage(`✅ ${config.label} QR 등록 완료! 대기열에 추가하거나 바로 인쇄하세요.`);
                setFormData({ name: '', category: 'EQUIPMENT', unit_price: '' });
            }
        } catch (error) {
            setMessage(`❌ 등록 실패: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const addToQueue = () => {
        if (generatedProduct && qrCodeUrl) {
            const config = sizeConfig[qrSize];
            setPrintQueue([...printQueue, {
                product: generatedProduct,
                qrUrl: qrCodeUrl,
                size: qrSize,
                cellSize: config.cellSize
            }]);
            setMessage(`✅ 대기열에 추가됨 (${printQueue.length + 1}/${config.perPage})`);
            setGeneratedProduct(null);
            setQrCodeUrl('');
        }
    };

    const clearQueue = () => {
        setPrintQueue([]);
        setMessage('대기열이 비워졌습니다.');
    };

    const handleNewProduct = () => {
        setGeneratedProduct(null);
        setQrCodeUrl('');
        setMessage('');
    };

    const getCurrentSizeQueue = () => {
        return printQueue.filter(item => item.size === qrSize);
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📝 제품 등록 및 QR 코드 생성</h1>
                <p>새로운 제품을 등록하고 QR 코드를 생성하여 인쇄합니다</p>
            </div>

            {message && (
                <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            {/* 인쇄 대기열 현황 */}
            {printQueue.length > 0 && (
                <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#e3f2fd' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>🖨️ 인쇄 대기열 ({printQueue.length}개)</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        {Object.keys(sizeConfig).map(size => {
                            const count = printQueue.filter(i => i.size === size).length;
                            const config = sizeConfig[size];
                            return count > 0 && (
                                <span key={size} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: size === 'big' ? '#1976d2' : size === 'medium' ? '#388e3c' : '#f57c00', color: 'white', fontSize: '0.85rem' }}>
                                    {config.label}: {count}/{config.perPage}
                                </span>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleBatchPrint} className="btn btn-success">🖨️ A4 일괄 인쇄</button>
                        <button onClick={clearQueue} className="btn btn-secondary">🗑️ 대기열 비우기</button>
                    </div>
                </div>
            )}

            {!generatedProduct ? (
                <div className="form-container">
                    <form className="product-form">
                        <div className="form-group">
                            <label>제품명 *</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="예: 초음파 진단기" required />
                        </div>
                        <div className="form-group">
                            <label>카테고리 *</label>
                            <select name="category" value={formData.category} onChange={handleChange} required>
                                <option value="EQUIPMENT">기구/장비</option>
                                <option value="BIOLOGIC">바이오로직</option>
                                <option value="CONSUMABLE">소모성 기구</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>단가 (원)</label>
                            <input type="number" name="unit_price" value={formData.unit_price} onChange={handleChange} placeholder="예: 5000000" min="0" />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={(e) => handleSubmit(e, 'big')} className="btn btn-primary" style={{ flex: 1 }}>
                                🟦 빅(4개/A4)
                            </button>
                            <button type="button" onClick={(e) => handleSubmit(e, 'medium')} className="btn btn-success" style={{ flex: 1 }}>
                                🟩 미들(6개/A4)
                            </button>
                            <button type="button" onClick={(e) => handleSubmit(e, 'mini')} className="btn btn-warning" style={{ flex: 1 }}>
                                🟨 미니(12개/A4)
                            </button>
                        </div>
                    </form>
                    <div className="info-box">
                        <h3>💡 A4 인쇄 안내</h3>
                        <ul>
                            <li><strong>빅사이즈</strong>: 6cm (여백포함) × 4개/A4</li>
                            <li><strong>미들사이즈</strong>: 4cm (여백포함) × 6개/A4</li>
                            <li><strong>미니사이즈</strong>: 2.5cm (여백포함) × 12개/A4</li>
                            <li>등록 후 <strong>대기열에 추가</strong> → A4에 맞춰 일괄 인쇄</li>
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="qr-result-container">
                    <div className="result-card">
                        <h2>✅ 제품 등록 완료!</h2>
                        <div className="product-info-card">
                            <h3>제품 정보</h3>
                            <div className="info-grid">
                                <div><strong>제품명:</strong> {generatedProduct.name}</div>
                                <div><strong>바코드:</strong> <code>{generatedProduct.barcode}</code></div>
                                <div><strong>카테고리:</strong> {generatedProduct.category === 'EQUIPMENT' ? '기구/장비' : generatedProduct.category === 'BIOLOGIC' ? '바이오로직' : '소모성 기구'}</div>
                                <div><strong>QR 사이즈:</strong> {sizeConfig[qrSize].label}</div>
                            </div>
                        </div>
                        <div ref={printRef} className="print-area">
                            <div className={`qr-label size-${qrSize}`}>
                                <h2>{generatedProduct.name}</h2>
                                <img src={qrCodeUrl} alt="QR Code" className="qr-code-image" />
                                <p className="barcode-text">{generatedProduct.barcode}</p>
                            </div>
                        </div>
                        <div className="qr-display">
                            <h3>생성된 QR 코드 ({sizeConfig[qrSize].label})</h3>
                            <img src={qrCodeUrl} alt="QR Code" className="qr-code-large" />
                        </div>
                        <div className="action-buttons">
                            <button onClick={addToQueue} className="btn btn-primary btn-large">
                                📥 대기열에 추가 ({getCurrentSizeQueue().length + 1}/{sizeConfig[qrSize].perPage})
                            </button>
                            <button onClick={handlePrint} className="btn btn-success">🖨️ 바로 인쇄</button>
                            <button onClick={handleNewProduct} className="btn btn-secondary">➕ 새 제품</button>
                        </div>
                    </div>
                </div>
            )}

            {/* A4 일괄 인쇄 영역 (숨김) */}
            <div ref={batchPrintRef} className="print-area">
                {Object.keys(sizeConfig).map(size => {
                    const items = printQueue.filter(i => i.size === size);
                    if (items.length === 0) return null;
                    const config = sizeConfig[size];
                    return (
                        <div key={size} className="a4-page" style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${config.cols}, ${config.cellSize})`,
                            gridTemplateRows: `repeat(${config.rows}, ${config.cellSize})`,
                            gap: '2mm',
                            padding: '10mm',
                            width: '210mm',
                            height: '297mm',
                            boxSizing: 'border-box'
                        }}>
                            {items.map((item, idx) => (
                                <div key={idx} style={{
                                    width: config.cellSize,
                                    height: config.cellSize,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px dashed #999',
                                    boxSizing: 'border-box',
                                    padding: '1mm'
                                }}>
                                    <p style={{
                                        fontSize: size === 'mini' ? '8pt' : size === 'medium' ? '10pt' : '12pt',
                                        margin: '0 0 1mm 0',
                                        padding: 0,
                                        lineHeight: 1.2,
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        color: '#000',
                                        maxWidth: '100%'
                                    }}>{item.product.name}</p>
                                    <img src={item.qrUrl} alt="QR" style={{
                                        width: size === 'mini' ? '1.8cm' : size === 'medium' ? '2.8cm' : '4.5cm',
                                        height: size === 'mini' ? '1.8cm' : size === 'medium' ? '2.8cm' : '4.5cm'
                                    }} />
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ProductRegistrationPage;

