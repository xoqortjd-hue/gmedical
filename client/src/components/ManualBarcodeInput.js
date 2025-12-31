import React from 'react';

const ManualBarcodeInput = ({ value, onChange, onSubmit, placeholder = "990170418714" }) => {
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && onSubmit) {
            onSubmit();
        }
    };

    return (
        <div style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            borderRadius: '12px',
            border: '3px solid #f5576c',
            boxShadow: '0 4px 12px rgba(245,87,108,0.3)'
        }}>
            <p style={{
                margin: '0 0 1rem 0',
                fontSize: '1.3rem',
                color: 'white',
                textAlign: 'center',
                fontWeight: 'bold'
            }}>
                📝 바코드 번호 입력
            </p>
            <p style={{
                margin: '0 0 1rem 0',
                fontSize: '1rem',
                color: 'white',
                textAlign: 'center',
                opacity: 0.95,
                lineHeight: '1.5'
            }}>
                ⚠️ HTTP 환경에서는 카메라 사용 불가<br />
                아래에 바코드 번호를 직접 입력하세요
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    type="text"
                    value={value}
                    onChange={onChange}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    className="mobile-input"
                    style={{
                        flex: 1,
                        margin: 0,
                        fontSize: '1.2rem',
                        padding: '1rem',
                        border: '2px solid white',
                        fontWeight: 'bold',
                        textAlign: 'center'
                    }}
                />
                <button
                    onClick={onSubmit}
                    className="mobile-btn"
                    style={{
                        margin: 0,
                        padding: '1rem 1.5rem',
                        whiteSpace: 'nowrap',
                        background: 'white',
                        color: '#f5576c',
                        fontSize: '1.1rem',
                        fontWeight: 'bold'
                    }}
                >
                    확인
                </button>
            </div>
        </div>
    );
};

export default ManualBarcodeInput;
