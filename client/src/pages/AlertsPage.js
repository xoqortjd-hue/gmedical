import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AlertsPage = () => {
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLowStockAlerts();
  }, []);

  const fetchLowStockAlerts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/alerts/low-stock');
      setLowStockProducts(response.data);
    } catch (error) {
      console.error('저재고 알림 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 우선순위 계산 (재고 비율이 낮을수록 높은 우선순위)
  const getPriorityLevel = (stockRatio) => {
    if (stockRatio <= 25) return { level: 'critical', text: '긴급', color: '#f44336' };
    if (stockRatio <= 50) return { level: 'high', text: '높음', color: '#ff9800' };
    if (stockRatio <= 75) return { level: 'medium', text: '보통', color: '#ff9800' };
    return { level: 'low', text: '낮음', color: '#4CAF50' };
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">⚠️ 안전재고 알림</h1>
        <p className="page-description">
          안전재고 이하로 떨어진 제품들을 확인하고 발주를 계획하세요
        </p>
      </div>

      {/* 알림 요약 */}
      <div className="stats-grid">
        <div className="stat-card danger">
          <div className="stat-value">{lowStockProducts.length}</div>
          <div className="stat-label">저재고 제품</div>
        </div>
        
        <div className="stat-card warning">
          <div className="stat-value">
            {lowStockProducts.filter(p => p.stock_ratio <= 25).length}
          </div>
          <div className="stat-label">긴급 처리 필요</div>
        </div>
        
        <div className="stat-card info">
          <div className="stat-value">
            ₩{lowStockProducts.reduce((sum, p) => sum + (p.recommended_order_qty * p.unit_price), 0).toLocaleString()}
          </div>
          <div className="stat-label">예상 발주 비용</div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-value">
            {lowStockProducts.reduce((sum, p) => sum + p.recommended_order_qty, 0).toLocaleString()}
          </div>
          <div className="stat-label">권장 발주 수량</div>
        </div>
      </div>

      {/* 새로고침 버튼 */}
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={fetchLowStockAlerts}
          className="btn btn-primary"
          disabled={loading}
        >
          🔄 알림 새로고침
        </button>
      </div>

      {/* 저재고 알림 목록 */}
      {lowStockProducts.length > 0 ? (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              📋 저재고 제품 목록 ({lowStockProducts.length}개)
            </h2>
            <p style={{ color: '#666', marginTop: '0.5rem' }}>
              우선순위 순으로 정렬되어 있습니다
            </p>
          </div>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>우선순위</th>
                  <th>제품명</th>
                  <th>바코드</th>
                  <th style={{ textAlign: 'right' }}>현재 재고</th>
                  <th style={{ textAlign: 'right' }}>안전 재고</th>
                  <th style={{ textAlign: 'right' }}>재고 비율</th>
                  <th style={{ textAlign: 'right' }}>권장 발주량</th>
                  <th style={{ textAlign: 'right' }}>예상 비용</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((product) => {
                  const priority = getPriorityLevel(product.stock_ratio);
                  const estimatedCost = product.recommended_order_qty * product.unit_price;
                  
                  return (
                    <tr key={product.id} style={{ 
                      backgroundColor: priority.level === 'critical' ? '#ffebee' : 'transparent'
                    }}>
                      <td>
                        <span 
                          className="badge"
                          style={{ 
                            backgroundColor: priority.color,
                            color: 'white'
                          }}
                        >
                          {priority.text}
                        </span>
                      </td>
                      <td>
                        <strong>{product.name}</strong>
                        {priority.level === 'critical' && (
                          <div style={{ color: '#f44336', fontSize: '0.8rem' }}>
                            🚨 긴급 발주 필요
                          </div>
                        )}
                      </td>
                      <td>
                        <code>{product.barcode}</code>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#f44336' }}>
                        {product.current_stock}개
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {product.safety_stock}개
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ 
                          color: priority.color,
                          fontWeight: 'bold'
                        }}>
                          {product.stock_ratio}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#4CAF50' }}>
                        {product.recommended_order_qty}개
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        ₩{estimatedCost.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                  <td colSpan="6" style={{ textAlign: 'right' }}>
                    <strong>총합:</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {lowStockProducts.reduce((sum, p) => sum + p.recommended_order_qty, 0).toLocaleString()}개
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    ₩{lowStockProducts.reduce((sum, p) => sum + (p.recommended_order_qty * p.unit_price), 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: '#4CAF50', marginBottom: '0.5rem' }}>모든 제품이 안전재고 이상입니다!</h2>
            <p>현재 저재고 알림이 있는 제품이 없습니다.</p>
            <p>정기적으로 확인하여 재고를 관리하세요.</p>
          </div>
        </div>
      )}

      {/* 발주 가이드 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📝 발주 가이드</h2>
        </div>
        
        <div style={{ padding: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>우선순위 기준</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#ffebee', borderRadius: '6px' }}>
              <strong style={{ color: '#f44336' }}>🚨 긴급 (25% 이하)</strong>
              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>즉시 발주 필요</p>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '6px' }}>
              <strong style={{ color: '#ff9800' }}>🔥 높음 (26-50%)</strong>
              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>1주일 내 발주</p>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '6px' }}>
              <strong style={{ color: '#ff9800' }}>⚠️ 보통 (51-75%)</strong>
              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>2주일 내 발주</p>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#e8f5e8', borderRadius: '6px' }}>
              <strong style={{ color: '#4CAF50' }}>📝 낮음 (76-100%)</strong>
              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>계획된 발주</p>
            </div>
          </div>
          
          <h3 style={{ marginBottom: '1rem' }}>발주량 계산</h3>
          <ul style={{ marginLeft: '1rem', color: '#666' }}>
            <li>권장 발주량 = 안전재고 × 2배</li>
            <li>실제 발주시에는 공급업체 최소 발주량을 고려하세요</li>
            <li>유통기한이 있는 제품은 회전율을 고려하여 조정하세요</li>
            <li>계절성이나 특별한 수요 변화를 고려하세요</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AlertsPage;
