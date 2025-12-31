import React, { useRef, useEffect, useState } from 'react';

const BarcodeScanner = ({ onScan, onError }) => {
  const inputRef = useRef(null);
  const [manualCode, setManualCode] = useState('');
  const [scanBuffer, setScanBuffer] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  // HID 바코드 스캐너 감지
  useEffect(() => {
    const handleKeyPress = (event) => {
      const currentTime = Date.now();

      // Enter 키로 스캔 완료 감지
      if (event.key === 'Enter' && scanBuffer.length > 0) {
        event.preventDefault();

        // 빠른 연속 입력은 바코드 스캐너로 판단
        if (currentTime - lastScanTime < 100) {
          if (onScan) {
            onScan(scanBuffer);
          }
          setScanBuffer('');
          setManualCode('');
          return;
        }
      }

      // 일반 문자 입력
      if (event.key.length === 1) {
        const timeDiff = currentTime - lastScanTime;

        // 빠른 연속 입력 감지 (바코드 스캐너 특성)
        if (timeDiff < 50) {
          setScanBuffer(prev => prev + event.key);
        } else {
          // 느린 입력은 수동 입력으로 판단
          setScanBuffer(event.key);
        }

        setLastScanTime(currentTime);
      }
    };

    // 글로벌 키보드 이벤트 리스너
    document.addEventListener('keypress', handleKeyPress);

    return () => {
      document.removeEventListener('keypress', handleKeyPress);
    };
  }, [scanBuffer, lastScanTime, onScan]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      if (onScan) {
        onScan(manualCode.trim());
      }
      setManualCode('');
    }
  };

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      setIsFocused(true);
    }
  };

  return (
    <div className="barcode-scanner">
      <div className="card-header">
        <h3 className="card-title">🔍 바코드 스캔</h3>
        <p>하드웨어 스캐너로 스캔하거나 직접 입력하세요</p>
      </div>

      {/* 하드웨어 스캐너 상태 */}
      <div style={{
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#e8f5e8',
        borderRadius: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#4CAF50', fontSize: '1.2rem' }}>●</span>
          <strong>하드웨어 스캐너 대기 중</strong>
        </div>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
          바코드를 스캔하면 자동으로 인식됩니다
        </p>
      </div>

      {/* 스캔 버퍼 표시 */}
      {scanBuffer && (
        <div className="alert alert-info">
          <strong>스캔 중:</strong> {scanBuffer}
        </div>
      )}

      {/* 포커스 영역 */}
      <div
        onClick={focusInput}
        style={{
          height: '200px',
          backgroundColor: isFocused ? '#e8f5e9' : '#f8f9fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          border: isFocused ? '3px solid #4CAF50' : '2px dashed #667eea',
          cursor: 'pointer',
          marginBottom: '1rem',
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{ textAlign: 'center', color: isFocused ? '#2e7d32' : '#666' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{isFocused ? '✅' : '📱'}</div>
          <p><strong>{isFocused ? '스캐너 활성화됨! 바코드를 스캔하세요' : '하드웨어 스캐너 사용 준비됨'}</strong></p>
          <p>{isFocused ? '포커스됨 - 스캔 대기 중...' : '이 영역을 클릭하고 바코드를 스캔하세요'}</p>
        </div>
      </div>

      {/* 숨겨진 입력 필드 (포커스용) */}
      <input
        ref={inputRef}
        type="text"
        style={{
          position: 'absolute',
          left: '-9999px',
          opacity: 0
        }}
        value=""
        onChange={() => { }} // 컨트롤된 컴포넌트로 만들기 위해
        placeholder="하드웨어 스캐너 입력 감지"
      />

      {/* 수동 입력 */}
      <div className="manual-input">
        <form onSubmit={handleManualSubmit}>
          <div className="form-group">
            <label className="form-label">📝 수동 바코드 입력</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-control"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="바코드 번호를 직접 입력하세요"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-success">
                확인
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 설정 가이드 */}
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#fff3e0',
        borderRadius: '6px',
        fontSize: '0.9rem'
      }}>
        <strong>🔧 하드웨어 스캐너 설정:</strong>
        <ol style={{ margin: '0.5rem 0', paddingLeft: '1rem' }}>
          <li>USB 바코드 스캐너를 컴퓨터에 연결</li>
          <li>위의 파란색 영역을 클릭하여 포커스</li>
          <li>바코드를 스캔하면 자동으로 인식됩니다</li>
          <li>Enter 키와 함께 스캔이 완료됩니다</li>
        </ol>
        <p style={{ margin: '0.5rem 0 0 0', color: '#e65100' }}>
          <strong>참고:</strong> 대부분의 USB 바코드 스캐너는 별도 드라이버 없이 작동합니다
        </p>
      </div>
    </div>
  );
};

export default BarcodeScanner;
