import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BarcodeScanner from '../components/BarcodeScanner';
import { parseGS1, generateLotNumber } from '../utils/gs1Parser';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

const InboundPage = () => {
  // 오늘 날짜 (YYYY-MM-DD 형식)
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    barcode: '',
    productName: '',
    quantity: '',
    lotNumber: '',
    expirationDate: '',
    inboundDate: today,
    notes: ''
  });
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [gs1Data, setGs1Data] = useState(null);

  // 창구 관련 상태
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelCodes, setChannelCodes] = useState({}); // {id: {qr: dataUrl, barcode: dataUrl}}
  const barcodeRefs = useRef({});

  // 창구 목록 조회
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await axios.get('/api/channels');
        setChannels(res.data);

        // 각 채널별 QR 코드 + 바코드 생성
        const codes = {};
        for (const channel of res.data) {
          const qrData = JSON.stringify({
            type: 'CHANNEL',
            id: channel.id,
            code: channel.code,
            name: channel.name
          });

          // QR 코드 생성
          const qrUrl = await QRCode.toDataURL(qrData, {
            width: 100,
            margin: 1,
            errorCorrectionLevel: 'M'
          });

          // 바코드용 데이터 (간단한 형식)
          const barcodeData = 'CH' + channel.id.toString().padStart(3, '0');

          codes[channel.id] = { qr: qrUrl, barcodeData };
        }
        setChannelCodes(codes);
      } catch (error) {
        console.error('채널 조회 실패:', error);
      }
    };
    fetchChannels();
  }, []);

  // 바코드 SVG 생성 (useEffect로 DOM 렌더링 후)
  useEffect(() => {
    channels.forEach(channel => {
      const ref = barcodeRefs.current[channel.id];
      if (ref && channelCodes[channel.id]) {
        try {
          JsBarcode(ref, channelCodes[channel.id].barcodeData, {
            format: 'CODE128',
            width: 1.5,
            height: 30,
            displayValue: false,
            margin: 0
          });
        } catch (e) {
          console.error('바코드 생성 실패:', e);
        }
      }
    });
  }, [channels, channelCodes]);

  // 창구 선택 핸들러
  const handleChannelSelect = useCallback((channel) => {
    setSelectedChannel(channel);
    setMessage({
      type: 'success',
      text: '✅ 창구 "' + channel.name + '" 선택됨 - 이제 제품 바코드를 스캔하세요'
    });
    // 창구 선택 후 바코드 스캔 영역으로 자동 포커스 (약간의 딜레이 후)
    setTimeout(() => {
      const scanArea = document.querySelector('.scan-area');
      if (scanArea) scanArea.focus();
    }, 100);
  }, []);

  // GS1 바코드에서 GTIN 추출 (제품 조회용)
  const extractProductCode = (gs1Result) => {
    if (gs1Result.gtin) {
      // GTIN에서 선행 0 제거하고 반환
      return gs1Result.gtin.replace(/^0+/, '');
    }
    return gs1Result.raw;
  };

  // 바코드 스캔 처리
  const handleBarccodeScan = async (scannedData) => {
    try {
      setLoading(true);
      setMessage(null);

      // 1. 창구 바코드 체크 (CH001 형식)
      if (scannedData.startsWith('CH') && scannedData.length === 5) {
        const channelId = parseInt(scannedData.substring(2), 10);
        const channel = channels.find(c => c.id === channelId);
        if (channel) {
          handleChannelSelect(channel);
          setLoading(false);
          return;
        }
      }

      // 2. 창구 QR 체크 (JSON 형식)
      if (scannedData.startsWith('{')) {
        try {
          const data = JSON.parse(scannedData);
          if (data.type === 'CHANNEL') {
            const channel = channels.find(c => c.id === data.id);
            if (channel) {
              handleChannelSelect(channel);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          // JSON 파싱 실패 - 제품 바코드로 계속 처리
        }
      }

      // 3. GS1 제품 바코드 파싱
      const parsed = parseGS1(scannedData);
      setGs1Data(parsed);

      console.log('GS1 파싱 결과:', parsed);

      // 폼 데이터 업데이트 (GS1에서 추출된 정보로)
      const newFormData = {
        ...formData,
        barcode: parsed.gtin || scannedData,
        lotNumber: parsed.lotNumber || generateLotNumber(),
        expirationDate: parsed.expirationDateFormatted || ''
      };
      setFormData(newFormData);

      // 제품 조회 시도 (GTIN으로)
      const searchBarcode = parsed.gtin || scannedData;

      try {
        const response = await axios.get(`/api/products/${searchBarcode}`);
        setProduct(response.data);
        setMessage({
          type: 'success',
          text: `✅ 제품 인식: ${response.data.name}` +
            (parsed.lotNumber ? ` | 로트: ${parsed.lotNumber}` : '') +
            (parsed.expirationDateDisplay ? ` | 유효기한: ${parsed.expirationDateDisplay}` : '')
        });
      } catch (err) {
        // GTIN으로 제품을 찾지 못한 경우
        setProduct(null);
        setMessage({
          type: 'warning',
          text: `등록되지 않은 제품입니다` +
            (parsed.lotNumber ? ` | 로트: ${parsed.lotNumber}` : '') +
            (parsed.expirationDateDisplay ? ` | 유효기한: ${parsed.expirationDateDisplay}` : ''),
          showRegisterLink: true,
          gtin: searchBarcode
        });
      }
    } catch (error) {
      setProduct(null);
      setMessage({
        type: 'error',
        text: '스캔 처리 중 오류가 발생했습니다.'
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

  // 입고 처리
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

    try {
      setLoading(true);

      const response = await axios.post('/api/inventory/in', {
        barcode: formData.barcode,
        quantity: parseInt(formData.quantity),
        lotNumber: formData.lotNumber,
        expirationDate: formData.expirationDate,
        notes: formData.notes
      });

      // 스캔된 아이템 목록에 추가
      setScannedItems([
        ...scannedItems,
        {
          id: Date.now(),
          product: product?.name || '알 수 없음',
          barcode: formData.barcode,
          quantity: parseInt(formData.quantity),
          lotNumber: formData.lotNumber,
          expirationDate: formData.expirationDate,
          previous_stock: response.data.previous_stock,
          new_stock: response.data.new_stock,
          time: new Date().toLocaleTimeString('ko-KR')
        }
      ]);

      setMessage({
        type: 'success',
        text: `✅ ${response.data.message} (${response.data.previous_stock} → ${response.data.new_stock})`
      });

      // 폼 초기화
      setFormData({
        barcode: '',
        quantity: '',
        lotNumber: '',
        expirationDate: '',
        notes: ''
      });
      setProduct(null);
      setGs1Data(null);

    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || '입고 처리 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">📦 제품 입고</h1>
        <p className="page-description">
          GS1 DataMatrix QR코드를 스캔하면 제품정보, 로트번호, 유효기한이 자동 입력됩니다
        </p>
      </div>

      {/* 창구 선택 섹션 */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">📍 창구 선택 (QR/바코드 클릭 또는 스캔)</h2>
          {selectedChannel && (
            <button
              onClick={() => setSelectedChannel(null)}
              className="btn btn-secondary btn-sm"
            >
              🔄 창구 변경
            </button>
          )}
        </div>
        <div style={{ padding: '1rem' }}>
          {selectedChannel ? (
            <div style={{
              backgroundColor: '#e8f5e9', padding: '1rem', borderRadius: '8px',
              border: '2px solid #28a745', textAlign: 'center'
            }}>
              <strong style={{ color: '#155724', fontSize: '1.2rem' }}>
                ✅ 선택된 창구: {selectedChannel.name}
              </strong>
              <p style={{ margin: '0.5rem 0 0 0', color: '#155724' }}>
                이제 제품 바코드를 스캔하세요
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              {channels.map(channel => (
                <div
                  key={channel.id}
                  onClick={() => handleChannelSelect(channel)}
                  style={{
                    border: '2px solid #ddd',
                    borderRadius: '12px',
                    padding: '1rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: '#fafafa',
                    minWidth: '120px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = '#7e57c2'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = '#ddd'}
                >
                  {/* QR 코드 */}
                  {channelCodes[channel.id]?.qr && (
                    <img
                      src={channelCodes[channel.id].qr}
                      alt={channel.name + ' QR'}
                      style={{ width: '80px', height: '80px' }}
                    />
                  )}

                  {/* 1D 바코드 */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <svg
                      ref={el => barcodeRefs.current[channel.id] = el}
                      style={{ maxWidth: '100px', height: '30px' }}
                    />
                  </div>

                  <p style={{
                    margin: '0.5rem 0 0 0',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    {channel.name}
                  </p>
                  <small style={{ color: '#666' }}>{channel.code}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 메시지 표시 */}
      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : message.type === 'warning' ? 'warning' : 'success'}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{message.text}</span>
            {message.showRegisterLink && (
              <Link
                to={`/products/general?barcode=${message.gtin || formData.barcode}`}
                className="btn btn-primary"
                style={{ marginLeft: '1rem' }}
              >
                📝 신규 제품 등록
              </Link>
            )}
          </div>
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

        {/* 입고 폼 */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">📝 입고 정보 입력</h2>
          </div>

          <form onSubmit={handleSubmit}>
            {/* 제품코드 */}
            <div className="form-group">
              <label className="form-label">제품코드 (GTIN)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  name="barcode"
                  className="form-control"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  placeholder="QR코드를 스캔하세요"
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
              <div className="alert alert-info">
                <strong>📋 제품 정보</strong><br />
                <strong>제품명:</strong> {product.name}<br />
                <strong>현재 재고:</strong> {product.current_stock}개<br />
                <strong>안전 재고:</strong> {product.safety_stock}개
              </div>
            )}

            {/* 로트번호 - 자동생성 또는 스캔 */}
            <div className="form-group">
              <label className="form-label">
                로트번호
                <span style={{ color: '#4CAF50', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                  {gs1Data?.lotNumber ? '✓ 스캔에서 자동입력' : '✓ 자동생성'}
                </span>
              </label>
              <input
                type="text"
                name="lotNumber"
                className="form-control"
                value={formData.lotNumber}
                onChange={handleInputChange}
                placeholder="스캔 시 자동입력됩니다"
                style={{ backgroundColor: formData.lotNumber ? '#e8f5e9' : '' }}
              />
            </div>

            {/* 유효기한 - 스캔에서 추출 */}
            <div className="form-group">
              <label className="form-label">
                유효기한
                {gs1Data?.expirationDateFormatted ? (
                  <span style={{ color: '#4CAF50', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    ✓ 스캔에서 자동입력 {gs1Data?.expirationCalculated && '(제조일+24개월)'}
                  </span>
                ) : formData.expirationDate ? (
                  <span style={{ color: '#4CAF50', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    ✓ 수동입력됨
                  </span>
                ) : (
                  <span style={{ color: '#f44336', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    ⚠️ 수동입력 필요
                  </span>
                )}
              </label>
              <input
                type="date"
                name="expirationDate"
                className="form-control"
                value={formData.expirationDate}
                onChange={handleInputChange}
                placeholder="유효기한을 선택하세요"
                style={{
                  backgroundColor: formData.expirationDate ? '#e8f5e9' : '#fff3e0',
                  borderColor: formData.expirationDate ? '' : '#ff9800'
                }}
              />
            </div>

            {/* 입고일자 - 오늘 날짜 자동입력 */}
            <div className="form-group">
              <label className="form-label">
                입고일자
                <span style={{ color: '#4CAF50', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                  ✓ 오늘 날짜 자동입력
                </span>
              </label>
              <input
                type="date"
                name="inboundDate"
                className="form-control"
                value={formData.inboundDate}
                onChange={handleInputChange}
                style={{ backgroundColor: '#e8f5e9' }}
              />
            </div>

            {/* 수량 */}
            <div className="form-group">
              <label className="form-label">입고 수량 *</label>
              <input
                type="number"
                name="quantity"
                className="form-control"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="입고할 수량을 입력하세요"
                min="1"
                required
              />
            </div>

            {/* 제품명 입력 */}
            <div className="form-group">
              <label className="form-label">
                제품명
                {product && (
                  <span style={{ color: '#4CAF50', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    ✓ 조회됨
                  </span>
                )}
              </label>
              <input
                type="text"
                name="productName"
                className="form-control"
                value={product?.name || formData.productName}
                onChange={handleInputChange}
                placeholder="제품명을 입력하세요"
                style={{ backgroundColor: product?.name ? '#e8f5e9' : '' }}
                disabled={product !== null}
              />
            </div>

            {/* 비고 */}
            <div className="form-group">
              <label className="form-label">비고 (선택사항)</label>
              <textarea
                name="notes"
                className="form-control"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="입고 관련 메모를 입력하세요"
                rows="2"
              />
            </div>

            <button
              type="submit"
              className="btn btn-success w-100"
              disabled={loading || !formData.barcode || !formData.quantity}
            >
              {loading ? '처리 중...' : '📦 입고 처리'}
            </button>
          </form>
        </div>
      </div>

      {/* 스캔된 아이템 목록 */}
      {scannedItems.length > 0 && (
        <div className="card mt-3">
          <div className="card-header">
            <h2 className="card-title">📋 입고 처리 내역</h2>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>제품명</th>
                  <th>로트번호</th>
                  <th>유효기한</th>
                  <th>수량</th>
                  <th>이전→현재</th>
                </tr>
              </thead>
              <tbody>
                {scannedItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.time}</td>
                    <td>{item.product}</td>
                    <td><code>{item.lotNumber}</code></td>
                    <td>{item.expirationDate || '-'}</td>
                    <td style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                      +{item.quantity}
                    </td>
                    <td>{item.previous_stock} → <strong>{item.new_stock}</strong></td>
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

export default InboundPage;
