import React, { useState, useEffect } from 'react';
import axios from 'axios';

const InventoryPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      console.error('제품 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 검색 필터링
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.includes(searchTerm)
  );

  // 정렬
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // 재고 상태 표시
  const getStockStatus = (product) => {
    if (product.current_stock <= product.safety_stock) {
      return { class: 'stock-low', text: '위험' };
    } else if (product.current_stock <= product.safety_stock * 1.5) {
      return { class: 'stock-warning', text: '주의' };
    } else {
      return { class: 'stock-normal', text: '정상' };
    }
  };

  // 정렬 핸들러
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // 총 재고 가치 계산
  const totalValue = products.reduce((sum, product) => 
    sum + (product.current_stock * product.unit_price), 0
  );

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
        <h1 className="page-title">📊 재고 현황</h1>
        <p className="page-description">
          전체 제품의 재고 현황을 확인하고 관리하세요
        </p>
      </div>

      {/* 통계 요약 */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-value">{products.length}</div>
          <div className="stat-label">총 제품 수</div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-value">
            {products.reduce((sum, p) => sum + p.current_stock, 0).toLocaleString()}
          </div>
          <div className="stat-label">총 재고 수량</div>
        </div>
        
        <div className="stat-card warning">
          <div className="stat-value">
            ₩{totalValue.toLocaleString()}
          </div>
          <div className="stat-label">총 재고 가치</div>
        </div>
        
        <div className="stat-card danger">
          <div className="stat-value">
            {products.filter(p => p.current_stock <= p.safety_stock).length}
          </div>
          <div className="stat-label">저재고 제품</div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="search-container">
        <div className="search-row">
          <div className="search-group">
            <label className="form-label">🔍 제품 검색</label>
            <input
              type="text"
              className="form-control"
              placeholder="제품명 또는 바코드로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="search-group">
            <label className="form-label">정렬 기준</label>
            <select
              className="form-control"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">제품명</option>
              <option value="current_stock">현재 재고</option>
              <option value="safety_stock">안전 재고</option>
              <option value="unit_price">단가</option>
            </select>
          </div>
          
          <div className="search-group">
            <label className="form-label">정렬 순서</label>
            <select
              className="form-control"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="asc">오름차순</option>
              <option value="desc">내림차순</option>
            </select>
          </div>
          
          <div className="search-group">
            <label className="form-label">&nbsp;</label>
            <button 
              onClick={fetchProducts}
              className="btn btn-primary"
              disabled={loading}
            >
              🔄 새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 재고 목록 테이블 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            📋 재고 목록 ({sortedProducts.length}개 제품)
          </h2>
        </div>
        
        {sortedProducts.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('name')}
                    style={{ cursor: 'pointer' }}
                  >
                    제품명 {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>바코드</th>
                  <th 
                    onClick={() => handleSort('current_stock')}
                    style={{ cursor: 'pointer', textAlign: 'right' }}
                  >
                    현재 재고 {sortBy === 'current_stock' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('safety_stock')}
                    style={{ cursor: 'pointer', textAlign: 'right' }}
                  >
                    안전 재고 {sortBy === 'safety_stock' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('unit_price')}
                    style={{ cursor: 'pointer', textAlign: 'right' }}
                  >
                    단가 {sortBy === 'unit_price' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ textAlign: 'right' }}>재고 가치</th>
                  <th style={{ textAlign: 'center' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((product) => {
                  const stockStatus = getStockStatus(product);
                  const stockValue = product.current_stock * product.unit_price;
                  
                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>
                        <code>{product.barcode}</code>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {product.current_stock.toLocaleString()}개
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {product.safety_stock.toLocaleString()}개
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        ₩{product.unit_price.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        ₩{stockValue.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`stock-status ${stockStatus.class}`}>
                          {stockStatus.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
            <h3>검색 결과가 없습니다</h3>
            <p>다른 검색어를 시도해보세요</p>
          </div>
        )}
      </div>

      {/* 재고 상태 범례 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📈 재고 상태 범례</h2>
        </div>
        
        <div style={{ padding: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="stock-status stock-normal">정상</span>
            <span>안전재고 1.5배 이상</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="stock-status stock-warning">주의</span>
            <span>안전재고 ~ 1.5배</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="stock-status stock-low">위험</span>
            <span>안전재고 이하</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
