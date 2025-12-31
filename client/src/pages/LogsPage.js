import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, IN, OUT

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/logs');
      setLogs(response.data);
    } catch (error) {
      console.error('로그 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 필터링된 로그
  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    return log.type === filter;
  });

  // 통계 계산
  const stats = {
    total: logs.length,
    inbound: logs.filter(log => log.type === 'IN').length,
    outbound: logs.filter(log => log.type === 'OUT').length,
    today: logs.filter(log => {
      const logDate = new Date(log.created_at).toDateString();
      const today = new Date().toDateString();
      return logDate === today;
    }).length
  };

  // 최근 활동 분석
  const getRecentActivity = () => {
    const recentLogs = logs.slice(0, 10);
    const totalInbound = recentLogs.filter(log => log.type === 'IN').reduce((sum, log) => sum + log.quantity, 0);
    const totalOutbound = recentLogs.filter(log => log.type === 'OUT').reduce((sum, log) => sum + log.quantity, 0);
    
    return {
      totalInbound,
      totalOutbound,
      netChange: totalInbound - totalOutbound
    };
  };

  const recentActivity = getRecentActivity();

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
        <h1 className="page-title">📋 거래 이력</h1>
        <p className="page-description">
          모든 입출고 거래 내역을 확인하고 분석하세요
        </p>
      </div>

      {/* 통계 요약 */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">총 거래 수</div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-value">{stats.inbound}</div>
          <div className="stat-label">입고 건수</div>
        </div>
        
        <div className="stat-card warning">
          <div className="stat-value">{stats.outbound}</div>
          <div className="stat-label">출고 건수</div>
        </div>
        
        <div className="stat-card danger">
          <div className="stat-value">{stats.today}</div>
          <div className="stat-label">오늘 거래</div>
        </div>
      </div>

      {/* 필터 및 새로고침 */}
      <div className="search-container">
        <div className="search-row">
          <div className="search-group">
            <label className="form-label">거래 유형 필터</label>
            <select
              className="form-control"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">전체</option>
              <option value="IN">입고만</option>
              <option value="OUT">출고만</option>
            </select>
          </div>
          
          <div className="search-group">
            <label className="form-label">&nbsp;</label>
            <button 
              onClick={fetchLogs}
              className="btn btn-primary"
              disabled={loading}
            >
              🔄 새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 거래 이력 테이블 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            📋 거래 내역 ({filteredLogs.length}건)
          </h2>
        </div>
        
        {filteredLogs.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>제품명</th>
                  <th>바코드</th>
                  <th style={{ textAlign: 'center' }}>유형</th>
                  <th style={{ textAlign: 'right' }}>수량</th>
                  <th style={{ textAlign: 'right' }}>이전 재고</th>
                  <th style={{ textAlign: 'right' }}>변경 후 재고</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div>{new Date(log.created_at).toLocaleDateString('ko-KR')}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        {new Date(log.created_at).toLocaleTimeString('ko-KR')}
                      </div>
                    </td>
                    <td>
                      <strong>{log.product_name}</strong>
                    </td>
                    <td>
                      <code>{log.barcode}</code>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${log.type === 'IN' ? 'badge-success' : 'badge-warning'}`}>
                        {log.type === 'IN' ? '📦 입고' : '📤 출고'}
                      </span>
                    </td>
                    <td style={{ 
                      textAlign: 'right', 
                      fontWeight: 'bold',
                      color: log.type === 'IN' ? '#4CAF50' : '#ff9800'
                    }}>
                      {log.type === 'IN' ? '+' : '-'}{log.quantity}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {log.previous_stock}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {log.new_stock}
                      {log.new_stock <= 10 && (
                        <div style={{ color: '#f44336', fontSize: '0.8rem' }}>
                          ⚠️ 저재고
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ color: '#666' }}>
                        {log.notes || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
            <h3>거래 내역이 없습니다</h3>
            <p>입고나 출고 처리를 시작하면 여기에 기록됩니다</p>
          </div>
        )}
      </div>

      {/* 이력 분석 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📊 최근 활동 분석 (최근 10건)</h2>
        </div>
        
        <div style={{ padding: '1rem' }}>
          <div className="stats-grid">
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#e8f5e8', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
                +{recentActivity.totalInbound}
              </div>
              <div style={{ color: '#666' }}>최근 입고 수량</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff9800' }}>
                -{recentActivity.totalOutbound}
              </div>
              <div style={{ color: '#666' }}>최근 출고 수량</div>
            </div>
            
            <div style={{ 
              textAlign: 'center', 
              padding: '1rem', 
              backgroundColor: recentActivity.netChange >= 0 ? '#e8f5e8' : '#ffebee',
              borderRadius: '6px'
            }}>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: recentActivity.netChange >= 0 ? '#4CAF50' : '#f44336'
              }}>
                {recentActivity.netChange >= 0 ? '+' : ''}{recentActivity.netChange}
              </div>
              <div style={{ color: '#666' }}>순 재고 변화</div>
            </div>
          </div>
          
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>📈 인사이트</h4>
            <ul style={{ marginLeft: '1rem', color: '#666' }}>
              {recentActivity.netChange > 0 && (
                <li>최근 전체적으로 재고가 증가하고 있습니다 (입고 > 출고)</li>
              )}
              {recentActivity.netChange < 0 && (
                <li>최근 전체적으로 재고가 감소하고 있습니다 (출고 > 입고)</li>
              )}
              {recentActivity.netChange === 0 && (
                <li>최근 입고와 출고가 균형을 이루고 있습니다</li>
              )}
              <li>총 {stats.total}건의 거래가 기록되어 있습니다</li>
              <li>오늘 {stats.today}건의 거래가 있었습니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 사용 팁 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">💡 거래 이력 활용 팁</h2>
        </div>
        
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <div>
              <h4>📈 재고 추세 분석</h4>
              <ul style={{ marginLeft: '1rem', color: '#666', fontSize: '0.9rem' }}>
                <li>입고/출고 패턴을 확인하여 수요 예측</li>
                <li>특정 제품의 회전율 분석</li>
                <li>계절성이나 트렌드 파악</li>
              </ul>
            </div>
            
            <div>
              <h4>🔍 문제 진단</h4>
              <ul style={{ marginLeft: '1rem', color: '#666', fontSize: '0.9rem' }}>
                <li>재고 부족이 자주 발생하는 제품 식별</li>
                <li>과도한 재고 누적 제품 확인</li>
                <li>비정상적인 출고 패턴 감지</li>
              </ul>
            </div>
            
            <div>
              <h4>📊 성과 측정</h4>
              <ul style={{ marginLeft: '1rem', color: '#666', fontSize: '0.9rem' }}>
                <li>재고 회전율 계산</li>
                <li>발주 정확도 평가</li>
                <li>재고 관리 효율성 측정</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogsPage;
