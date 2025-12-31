import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BarcodeScanner from '../components/BarcodeScanner';
import '../styles/main.css';

function LendingDeployPage() {
    const [hospitals, setHospitals] = useState([]);
    const [products, setProducts] = useState([]);
    const [formData, setFormData] = useState({
        product_id: '',
        hospital_id: '',
        serial_number: '',
        quantity: 1,
        expiration_date: '',
        notes: '',
        moved_by: ''
    });
    const [scanning, setScanning] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchHospitals();
        fetchProducts();
    }, []);

    const fetchHospitals = async () => {
        try {
            const res = await axios.get('/api/hospitals');
            setHospitals(res.data);
        } catch (error) {
            console.error('병원 목록 조회 실패:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/products');
            // 기구/장비 및 바이오로직만 필터링
            const lendingProducts = res.data.filter(p =>
                p.category === 'EQUIPMENT' || p.category === 'BIOLOGIC'
            );
            setProducts(lendingProducts);
        } catch (error) {
            console.error('제품 목록 조회 실패:', error);
        }
    };

    const handleBarcodeDetected = async (barcode) => {
        try {
            const res = await axios.get(`/api/products/${barcode}`);
            if (res.data) {
                setFormData(prev => ({ ...prev, product_id: res.data.id }));
                setMessage(`제품 찾음: ${res.data.name}`);
                setScanning(false);
            }
        } catch (error) {
            setMessage('제품을 찾을 수 없습니다');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.product_id || !formData.hospital_id || !formData.quantity) {
            setMessage('❌ 제품, 병원, 수량은 필수입니다');
            return;
        }

        try {
            const res = await axios.post('/api/lending/deploy', formData);
            setMessage(`✅ ${res.data.message}`);

            // 폼 초기화
            setFormData({
                product_id: '',
                hospital_id: '',
                serial_number: '',
                quantity: 1,
                expiration_date: '',
                notes: '',
                moved_by: ''
            });
        } catch (error) {
            setMessage(`❌ 배치 실패: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📦 랜딩 배치</h1>
                <p>병원에 기구/장비 또는 바이오로직 제품을 배치합니다</p>
            </div>

            {message && (
                <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            <div className="form-container">
                <button
                    onClick={() => setScanning(!scanning)}
                    className="btn btn-secondary"
                >
                    {scanning ? '📷 스캔 중지' : '📷 바코드 스캔'}
                </button>

                {scanning && (
                    <div className="scanner-container">
                        <BarcodeScanner onDetected={handleBarcodeDetected} />
                    </div>
                )}

                <form onSubmit={handleSubmit} className="deploy-form">
                    <div className="form-group">
                        <label>제품 선택 *</label>
                        <select
                            name="product_id"
                            value={formData.product_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">제품을 선택하세요</option>
                            {products.map(product => (
                                <option key={product.id} value={product.id}>
                                    {product.name} ({product.category === 'EQUIPMENT' ? '기구/장비' : '바이오로직'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>병원 선택 *</label>
                        <select
                            name="hospital_id"
                            value={formData.hospital_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">병원을 선택하세요</option>
                            {hospitals.map(hospital => (
                                <option key={hospital.id} value={hospital.id}>
                                    {hospital.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>시리얼번호</label>
                        <input
                            type="text"
                            name="serial_number"
                            value={formData.serial_number}
                            onChange={handleChange}
                            placeholder="예: EQ-2024-001"
                        />
                    </div>

                    <div className="form-group">
                        <label>수량 *</label>
                        <input
                            type="number"
                            name="quantity"
                            value={formData.quantity}
                            onChange={handleChange}
                            min="1"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>유통기한 (바이오로직)</label>
                        <input
                            type="date"
                            name="expiration_date"
                            value={formData.expiration_date}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>담당자</label>
                        <input
                            type="text"
                            name="moved_by"
                            value={formData.moved_by}
                            onChange={handleChange}
                            placeholder="예: 김영업"
                        />
                    </div>

                    <div className="form-group">
                        <label>비고</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="3"
                            placeholder="추가 메모사항"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-large">
                        📦 랜딩 배치
                    </button>
                </form>
            </div>
        </div>
    );
}

export default LendingDeployPage;
