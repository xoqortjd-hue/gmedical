import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

/**
 * 장비 이름 인라인 편집 컴포넌트.
 *
 * Props:
 *   productId   — products.id
 *   currentName — 현재 표시 중인 이름
 *   onSaved(newName) — 저장 성공 시 콜백 (부모 리스트 새로고침 등)
 *   labelStyle  — 비편집 상태 텍스트 스타일 (선택)
 *   compact     — true 면 ✎ 아이콘만 (작은 화면용)
 */
function EditableProductName({ productId, currentName, onSaved, labelStyle, compact }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(currentName || '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const inputRef = useRef(null);

    useEffect(() => { setValue(currentName || ''); }, [currentName]);
    useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    const startEdit = (e) => {
        e.stopPropagation();
        setErr('');
        setEditing(true);
    };

    const cancel = (e) => {
        if (e) e.stopPropagation();
        setValue(currentName || '');
        setErr('');
        setEditing(false);
    };

    const save = async (e) => {
        if (e) e.stopPropagation();
        const trimmed = (value || '').trim();
        if (!trimmed) { setErr('이름을 입력하세요'); return; }
        if (trimmed === currentName) { setEditing(false); return; }
        if (!productId) { setErr('product_id 가 없습니다'); return; }
        setSaving(true);
        try {
            await axios.put(`/api/products/${productId}`, { name: trimmed });
            setEditing(false);
            onSaved && onSaved(trimmed);
        } catch (e2) {
            setErr(e2.response?.data?.error || e2.message || '저장 실패');
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') save();
                        else if (e.key === 'Escape') cancel();
                    }}
                    disabled={saving}
                    style={{
                        padding: '0.25rem 0.5rem',
                        border: '1.5px solid #6366f1',
                        borderRadius: '4px',
                        fontSize: 'inherit',
                        minWidth: '120px',
                        fontFamily: 'inherit'
                    }}
                />
                <button
                    onClick={save}
                    disabled={saving}
                    style={{
                        padding: '0.2rem 0.55rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                    }}
                >
                    {saving ? '...' : '✓ 저장'}
                </button>
                <button
                    onClick={cancel}
                    disabled={saving}
                    style={{
                        padding: '0.2rem 0.5rem',
                        background: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                >
                    취소
                </button>
                {err && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{err}</span>}
            </span>
        );
    }

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={labelStyle}>{currentName}</span>
            <button
                onClick={startEdit}
                title="이름 변경"
                style={{
                    padding: compact ? '0' : '0.15rem 0.35rem',
                    background: 'transparent',
                    border: compact ? 'none' : '1px solid #e5e7eb',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: '#6366f1',
                    lineHeight: 1
                }}
            >
                ✎
            </button>
        </span>
    );
}

export default EditableProductName;
