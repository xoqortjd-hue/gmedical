import React, { useState } from 'react';
import axios from 'axios';
import BarcodeScanner from '../components/BarcodeScanner';

const OutboundPage = () => {
  const [formData, setFormData] = useState({
    barcode: '',
    quantity: '',
    notes: ''
  });
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [processedItems, setProcessedItems] = useState([]);

  // 바코드 스캔 처리
  const handleBarccodeScan = async (barcode) => {
    try {
      setLoading(true);
      setMessage(null);
      
      const response = await axios.get(`/api/products/${barcode}`);
      
      setFormData({
        ...formData,
        barcode: barcode
      });
      setProduct(response.data);
      
      // 재고 상태 확인
      const stockStatus = response.data.current_stock <= response.data.safety_stock ? 'low' : 'normal';
      
      setMessage({
        type: stockStatus === 'low' ? 'warning' : 'success',
        text: `제품을 찾았습니다: ${response.data.name} (재고: ${response.data.current_stock}개)`
      });
    } catch (error) {
      setProduct(null);
      setMessage({
        type: 'error',
        text: '제품을 찾을 수 없습니다. 바코드를 확인해주세요.'
      });
    } finally {
      setLoading(false);
    }
  };

  // 스캔 오류 처리
  const handleScanError = (error) => {
    setMessage({
      type: 'error',
      text: error
    });
  };

  // 폼 입력 처리
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // 제품 검색 (수동 바코드 입력)
  const handleProductSearch = async () => {
    if (formData.barcode) {
      await handleBarccodeScan(formData.barcode);
    }
  };

  // 출고 처리
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.barcode || !formData.quantity) {
      setMessage({
        type: 'error',
        text: '바코드와 수량을 입력해주세요.'
      });
      return;
    }

    if (parseInt(formData.quantity) <= 0) {
      setMessage({
        type: 'error',
        text: '수량은 0보다 커야 합니다.'
      });
      return;
    }

    if (parseInt(formData.quantity) > product.current_stock) {
      setMessage({
        type: 'error',
        text: `재고가 부족합니다. (현재 재고: ${product.current_stock}개)`
      });
      return;
    }

    try {
      setLoading(true);
      
      const response = await axios.post('/api/inventory/out', {
        barcode: formData.barcode,
        quantity: parseInt(formData.quantity),
        notes: formData.notes
      });

      // 처리된 아이템 목록에 추가
      setProcessedItems([
        ...processedItems,
        {
          id: Date.now(),
          product: product.name,
          barcode: formData.barcode,
          quantity: parseInt(formData.quantity),
          previous_stock: response.data.previous_stock,
          new_stock: response.data.new_stock,
          low_stock_warning: response.data.low_stock_warning,
          time: new Date().toLocaleTimeString('ko-KR')
        }
      ]);

      let messageText = `✅ ${response.data.message} (${response.data.previous_stock} → ${response.data.new_stock})`;
      
      if (response.data.low_stock_warning) {
        messageText += ' ⚠️ 안전재고 이하입니다!';
      }

      setMessage({
        type: response.data.low_stock_warning ? 'warning' : 'success',
        text: messageText
      });

      // 폼 초기화
      setFormData({
        barcode: '',
        quantity: '',
        notes: ''
      });
      setProduct(null);
      
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || '출고 처리 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">📤 제품 출고</h1>
        <p className="page-description">
          바코드를 스캔하거나 직접 입력하여 제품을 출고 처리하세요
        </p>
      </div>

      {/* 메시지 표시 */}
      {message && (
        <div className={`alert alert-${
          message.type === 'error' ? 'danger' : 
          message.type === 'warning' ? 'warning' : 'success'
        }`}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* 바코드 스캐너 */}
        <div className="card">
          <BarcodeScanner 
            onScan={handleBarccodeScan}
            onError={handleScanError}
          />
        </div>

        {/* 출고 폼 */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">📝 출고 정보 입력</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">바코드</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  name="barcode"
                  className="form-control"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  placeholder="바코드를 입력하세요"
                  style={{ flex: 1 }}
                />
                <button 
                  type="button" 
                  onClick={handleProductSearch}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  검색
                </button>
              </div>
            </div>

            {/* 제품 정보 표시 */}
            {product && (
              <div className={`alert ${
                product.current_stock <= product.safety_stock ? 'alert-warning' : 'alert-info'
              }`}>
                <strong>📋 제품 정보</strong><br />
                <strong>제품명:</strong> {product.name}<br />
                <strong>현재 재고:</strong> {product.current_stock}개<br />
                <strong>안전 재고:</strong> {product.safety_stock}개<br />
                {product.current_stock <= product.safety_stock && (
                  <strong style={{ color: '#d32f2f' }}>⚠️ 안전재고 이하입니다!</strong>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">출고 수량</label>
              <input
                type="number"
                name="quantity"
                className="form-control"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="출고할 수량을 입력하세요"
                min="1"
                max={product ? product.current_stock : undefined}
                required
              />
              {product && (
                <small style={{ color: '#666' }}>
                  최대 출고 가능: {product.current_stock}개
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">비고 (선택사항)</label>
              <textarea
                name="notes"
                className="form-control"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="출고 관련 메모를 입력하세요"
                rows="3"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-warning w-100"
              disabled={loading || !product}
            >
              {loading ? '처리 중...' : '📤 출고 처리'}
            </button>
          </form>
        </div>
      </div>

      {/* 처리된 아이템 목록 */}
      {processedItems.length > 0 && (
        <div className="card mt-3">
          <div className="card-header">
            <h2 className="card-title">📋 출고 처리 내역</h2>
          </div>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>제품명</th>
                  <th>바코드</th>
                  <th>수량</th>
                  <th>이전 재고</th>
                  <th>현재 재고</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {processedItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.time}</td>
                    <td>{item.product}</td>
                    <td>{item.barcode}</td>
                    <td style={{ color: '#ff9800', fontWeight: 'bold' }}>
                      -{item.quantity}
                    </td>
                    <td>{item.previous_stock}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.new_stock}</td>
                    <td>
                      {item.low_stock_warning ? (
                        <span className="badge badge-danger">저재고</span>
                      ) : (
                        <span className="badge badge-success">정상</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutboundPage;
