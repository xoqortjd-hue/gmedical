import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/main.css';

function ExpirationAlertsPage() {
    const [expiringItems, setExpiringItems] = useState([]);
    const [days, setDays] = useState(720);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchExpiringItems();
    }, [days]);

    const fetchExpiringItems = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/lending/expiring?days=${days}`);
            setExpiringItems(res.data);
            setLoading(false);
        } catch (error) {
            console.error('유통기한 임박 제품 조회 실패:', error);
            setLoading(false);
        }
    };

    // 새로운 기준: 180~365일(긴급), 365~450일(교환필요), 450~540일(교환검토), 540~720일(안전), 720일+(여유)
    const getPriorityClass = (daysUntilExpiry) => {
        if (daysUntilExpiry <= 180) return 'priority-critical';
        if (daysUntilExpiry <= 365) return 'priority-critical';
        if (daysUntilExpiry <= 450) return 'priority-high';
        if (daysUntilExpiry <= 540) return 'priority-medium';
        if (daysUntilExpiry <= 720) return 'priority-low';
        return 'priority-safe';
    };

    const getPriorityLabel = (daysUntilExpiry) => {
        if (daysUntilExpiry <= 0) return '⛔ 만료됨';
        if (daysUntilExpiry < 180) return '🔴 긴급';
        if (daysUntilExpiry <= 365) return '🔴 긴급';
        if (daysUntilExpiry <= 450) return '🟠 교환필요';
        if (daysUntilExpiry <= 540) return '🟡 교환검토';
        if (daysUntilExpiry <= 720) return '🟢 안전';
        return '🔵 여유';
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>⚠️ 유통기한 알림</h1>
                <p>유통기한이 임박한 바이오로직 제품을 확인합니다</p>
            </div>

            <div className="filter-section">
                <label>
                    알림 기준:
                    <select
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        className="filter-select"
                    >
                        <option value="365">365일 이내 (긴급)</option>
                        <option value="450">450일 이내 (교환필요)</option>
                        <option value="540">540일 이내 (교환검토)</option>
                        <option value="720">720일 이내 (안전)</option>
                        <option value="1000">전체 (1000일)</option>
                    </select>
                </label>
                <button onClick={fetchExpiringItems} className="btn btn-primary">🔄 새로고침</button>
            </div>

            {loading ? (
                <div className="loading">로딩 중...</div>
            ) : (
                <>
                    <div className="alert-summary">
                        <div className="summary-card critical">
                            <h3>🔴 긴급 (180~365일)</h3>
                            <p className="count">{expiringItems.filter(i => i.days_until_expiry >= 180 && i.days_until_expiry <= 365).length}</p>
                        </div>
                        <div className="summary-card high">
                            <h3>🟠 교환필요 (365~450일)</h3>
                            <p className="count">{expiringItems.filter(i => i.days_until_expiry > 365 && i.days_until_expiry <= 450).length}</p>
                        </div>
                        <div className="summary-card medium">
                            <h3>🟡 교환검토 (450~540일)</h3>
                            <p className="count">{expiringItems.filter(i => i.days_until_expiry > 450 && i.days_until_expiry <= 540).length}</p>
                        </div>
                        <div className="summary-card low">
                            <h3>🟢 안전 (540~720일)</h3>
                            <p className="count">{expiringItems.filter(i => i.days_until_expiry > 540 && i.days_until_expiry <= 720).length}</p>
                        </div>
                        <div className="summary-card safe" style={{ backgroundColor: '#e3f2fd' }}>
                            <h3>🔵 여유 (720일 이상)</h3>
                            <p className="count">{expiringItems.filter(i => i.days_until_expiry > 720).length}</p>
                        </div>
                    </div>

                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>우선순위</th>
                                    <th>제품명</th>
                                    <th>병원</th>
                                    <th>수량</th>
                                    <th>유통기한</th>
                                    <th>남은 일수</th>
                                    <th>시리얼번호</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expiringItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="no-data">해당 기간 내 제품이 없습니다</td>
                                    </tr>
                                ) : (
                                    expiringItems.map(item => (
                                        <tr key={item.id} className={getPriorityClass(item.days_until_expiry)}>
                                            <td>{getPriorityLabel(item.days_until_expiry)}</td>
                                            <td>{item.product_name}</td>
                                            <td>{item.hospital_name}</td>
                                            <td>{item.quantity}</td>
                                            <td>{new Date(item.expiration_date).toLocaleDateString()}</td>
                                            <td>
                                                <strong>{item.days_until_expiry}일</strong>
                                            </td>
                                            <td>{item.serial_number || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {expiringItems.length > 0 && (
                            <div className="alert-footer">
                                <p>💡 <strong>권장 조치:</strong> 긴급/교환필요 상태의 제품은 교체 또는 회수를 검토하세요.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default ExpirationAlertsPage;
