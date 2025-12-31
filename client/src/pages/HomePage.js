import React, { useState, useEffect } from 'react';
import axios from 'axios';

const HomePage = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    lowStockCount: 0,
    recentLogs: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // 병렬로 데이터 가져오기
      const [productsRes, alertsRes, logsRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/alerts/low-stock'),
        axios.get('/api/logs')
      ]);

      const products = productsRes.data;
      const totalStock = products.reduce((sum, product) => sum + product.current_stock, 0);

      setStats({
        totalProducts: products.length,
        totalStock: totalStock,
        lowStockCount: alertsRes.data.length,
        recentLogs: logsRes.data.slice(0, 5) // 최근 5개만
      });
    } catch (error) {
      console.error('통계 데이터 가져오기 실패:', error);
    } finally {
      setLoading(false);
    }
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
        <h1 className="page-title">🏥 의약품 재고관리 시스템</h1>
        <p className="page-description">
          실시간 재고 현황을 확인하고 효율적으로 의약품을 관리하세요
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-value">{stats.totalProducts}</div>
          <div className="stat-label">등록 제품 수</div>
        </div>

        <div className="stat-card success">
          <div className="stat-value">{stats.totalStock.toLocaleString()}</div>
          <div className="stat-label">총 재고 수량</div>
        </div>

        <div className={`stat-card ${stats.lowStockCount > 0 ? 'danger' : 'success'}`}>
          <div className="stat-value">{stats.lowStockCount}</div>
          <div className="stat-label">저재고 알림</div>
        </div>

        <div className="stat-card warning">
          <div className="stat-value">{stats.recentLogs.length}</div>
          <div className="stat-label">최근 거래</div>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">⚡ 빠른 작업</h2>
        </div>

        <div className="stats-grid">
          <a href="/inbound" className="btn btn-success" style={{ textDecoration: 'none', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
            <div>제품 입고</div>
          </a>

          <a href="/outbound" className="btn btn-warning" style={{ textDecoration: 'none', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📤</div>
            <div>제품 출고</div>
          </a>

          <a href="/inventory" className="btn btn-primary" style={{ textDecoration: 'none', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
            <div>재고 현황</div>
          </a>

          <a href="/alerts" className="btn btn-danger" style={{ textDecoration: 'none', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div>알림 확인</div>
          </a>
        </div>
      </div>

      {/* 최근 거래 내역 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 최근 거래 내역</h2>
        </div>

        {stats.recentLogs.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>제품명</th>
                  <th>유형</th>
                  <th>수량</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                    <td>{log.product_name}</td>
                    <td>
                      <span className={`badge ${log.type === 'IN' ? 'badge-success' : 'badge-warning'}`}>
                        {log.type === 'IN' ? '입고' : '출고'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {log.type === 'IN' ? '+' : '-'}{log.quantity}
                    </td>
                    <td>{log.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
            <p>아직 거래 내역이 없습니다</p>
          </div>
        )}
      </div>

      {/* 시스템 정보 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">ℹ️ 시스템 정보</h2>
        </div>

        <div style={{ padding: '1rem' }}>
          <p><strong>버전:</strong> 1.0.0 MVP</p>
          <p><strong>개발:</strong> Claude Code CLI</p>
          <p><strong>기술 스택:</strong> React + Node.js + SQLite</p>
          <p><strong>지원 기능:</strong> 바코드 스캔, 입출고 관리, 재고 현황, 안전재고 알림</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
