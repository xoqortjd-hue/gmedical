import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BarcodeScanner from '../components/BarcodeScanner';
import '../styles/main.css';

function LendingMovementPage() {
    const [hospitals, setHospitals] = useState([]);
    const [lendingItem, setLendingItem] = useState(null);
    const [movementType, setMovementType] = useState('');
    const [formData, setFormData] = useState({
        to_hospital_id: '',
        moved_by: '',
        notes: ''
    });
    const [scanning, setScanning] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchHospitals();
    }, []);

    const fetchHospitals = async () => {
        try {
            const res = await axios.get('/api/hospitals');
            setHospitals(res.data);
        } catch (error) {
            console.error('병원 목록 조회 실패:', error);
        }
    };

    const handleBarcodeDetected = async (barcode) => {
        try {
            const res = await axios.get(`/api/lending/items/barcode/${barcode}`);
            if (res.data) {
                setLendingItem(res.data);
                setMessage(`✅ 제품 찾음: ${res.data.product_name} (현재 위치: ${res.data.hospital_name})`);
                setScanning(false);
            }
        } catch (error) {
            setMessage('❌ 랜딩 제품을 찾을 수 없습니다');
            setLendingItem(null);
        }
    };

    const handleMove = async () => {
        if (!lendingItem || !formData.to_hospital_id) {
            setMessage('❌ 목적지 병원을 선택해주세요');
            return;
        }

        try {
            const res = await axios.post('/api/lending/move', {
                lending_item_id: lendingItem.id,
                to_hospital_id: formData.to_hospital_id,
                moved_by: formData.moved_by,
                notes: formData.notes
            });

            setMessage(`✅ ${res.data.message}`);
            setLendingItem(null);
            setMovementType('');
            setFormData({ to_hospital_id: '', moved_by: '', notes: '' });
        } catch (error) {
            setMessage(`❌ 이동 실패: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleReturn = async () => {
        if (!lendingItem) return;

        try {
            const res = await axios.post('/api/lending/return', {
                lending_item_id: lendingItem.id,
                moved_by: formData.moved_by,
                notes: formData.notes
            });

            setMessage(`✅ ${res.data.message}`);
            setLendingItem(null);
            setMovementType('');
            setFormData({ to_hospital_id: '', moved_by: '', notes: '' });
        } catch (error) {
            setMessage(`❌ 회수 실패: ${error.response?.data?.error || error.message}`);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>🚚 랜딩 이동 관리</h1>
                <p>병원 간 제품 이동 또는 회수를 처리합니다</p>
            </div>

            {message && (
                <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            <div className="form-container">
                <button
                    onClick={() => setScanning(!scanning)}
                    className="btn btn-secondary btn-large"
                >
                    {scanning ? '📷 스캔 중지' : '📷 바코드 스캔'}
                </button>

                {scanning && (
                    <div className="scanner-container">
                        <BarcodeScanner onDetected={handleBarcodeDetected} />
                    </div>
                )}

                {lendingItem && (
                    <div className="item-info">
                        <h3>📦 제품 정보</h3>
                        <div className="info-grid">
                            <div><strong>제품명:</strong> {lendingItem.product_name}</div>
                            <div><strong>바코드:</strong> {lendingItem.barcode}</div>
                            <div><strong>현재 위치:</strong> {lendingItem.hospital_name}</div>
                            <div><strong>수량:</strong> {lendingItem.quantity}</div>
                            <div><strong>시리얼번호:</strong> {lendingItem.serial_number || '-'}</div>
                        </div>

                        <h3>🔄 이동 유형 선택</h3>
                        <div className="movement-buttons">
                            <button
                                onClick={() => setMovementType('move')}
                                className={`btn ${movementType === 'move' ? 'btn-primary' : 'btn-outline'}`}
                            >
                                🏥 다른 병원으로 이동
                            </button>
                            <button
                                onClick={() => setMovementType('return')}
                                className={`btn ${movementType === 'return' ? 'btn-primary' : 'btn-outline'}`}
                            >
                                🏢 본사로 회수
                            </button>
                        </div>

                        {movementType === 'move' && (
                            <div className="movement-form">
                                <div className="form-group">
                                    <label>목적지 병원 *</label>
                                    <select
                                        value={formData.to_hospital_id}
                                        onChange={(e) => setFormData({ ...formData, to_hospital_id: e.target.value })}
                                        required
                                    >
                                        <option value="">병원을 선택하세요</option>
                                        {hospitals
                                            .filter(h => h.id !== lendingItem.hospital_id)
                                            .map(hospital => (
                                                <option key={hospital.id} value={hospital.id}>
                                                    {hospital.name}
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>담당자</label>
                                    <input
                                        type="text"
                                        value={formData.moved_by}
                                        onChange={(e) => setFormData({ ...formData, moved_by: e.target.value })}
                                        placeholder="예: 김영업"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>비고</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows="3"
                                        placeholder="이동 사유 등"
                                    />
                                </div>

                                <button onClick={handleMove} className="btn btn-primary btn-large">
                                    🚚 이동 처리
                                </button>
                            </div>
                        )}

                        {movementType === 'return' && (
                            <div className="movement-form">
                                <div className="form-group">
                                    <label>담당자</label>
                                    <input
                                        type="text"
                                        value={formData.moved_by}
                                        onChange={(e) => setFormData({ ...formData, moved_by: e.target.value })}
                                        placeholder="예: 김영업"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>회수 사유</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows="3"
                                        placeholder="회수 사유를 입력하세요"
                                    />
                                </div>

                                <button onClick={handleReturn} className="btn btn-warning btn-large">
                                    🏢 회수 처리
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LendingMovementPage;
