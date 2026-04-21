import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faCircleUser, faDoorOpen, faCreditCard } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { colors, typography, radius, shadows } from '../design-system/tokens.js';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PageHeader({ title, subtitle, icon, actions, sidebarOpen, setSidebarOpen, sidebarExpanded, setSidebarExpanded }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const initials = getInitials(usuario?.nome);

  return (
    <div style={{
      background: colors.white,
      borderBottom: `1px solid ${colors.border}`,
      padding: isMobile ? '10px 16px' : '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Esquerda: hamburger + título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
        {setSidebarOpen && (
          <button
            onClick={() => {
              if (!sidebarOpen) { setSidebarOpen(true); setSidebarExpanded(true); }
              else setSidebarExpanded(v => !v);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: colors.neutral600, fontSize: '16px', flexShrink: 0 }}
            aria-label="Toggle sidebar"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: isMobile ? typography.sizes.lg : typography.sizes.xl,
            fontWeight: typography.weights.semibold,
            color: colors.neutral800,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {icon && <span>{icon}</span>}
            {title}
          </p>
          {subtitle && !isMobile && (
            <p style={{ margin: 0, fontSize: typography.sizes.xs, color: colors.neutral500 }}>{subtitle}</p>
          )}
        </div>
      </div>

      {/* Direita: actions + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', flexShrink: 0 }}>
        {/* Actions — esconde no mobile se tiver muitos */}
        {actions && !isMobile && actions}

        {/* Avatar / Dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            title={usuario?.nome || ''}
            style={{
              width: isMobile ? '32px' : '36px',
              height: isMobile ? '32px' : '36px',
              borderRadius: radius.full,
              background: colors.primary,
              color: colors.white,
              border: 'none',
              cursor: 'pointer',
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.bold,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {initials}
          </button>
          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '44px',
              background: colors.white,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              boxShadow: shadows.md,
              minWidth: '180px',
              zIndex: 200,
            }}>
              <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${colors.border}` }}>
                <p style={{ margin: 0, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.neutral800 }}>{usuario?.nome || 'Usuário'}</p>
                <p style={{ margin: '2px 0 0', fontSize: typography.sizes.xs, color: colors.neutral500 }}>{usuario?.email || ''}</p>
              </div>

              {/* No mobile, mostra actions dentro do dropdown */}
              {actions && isMobile && (
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>
                  {actions}
                </div>
              )}

              {[
                { icon: faCreditCard, label: 'Assinatura', onClick: () => { navigate('/assinatura'); setDropdownOpen(false); } },
                { icon: faCircleUser, label: 'Perfil', onClick: () => { navigate('/perfil'); setDropdownOpen(false); } },
                { icon: faDoorOpen, label: 'Sair', onClick: () => { logout(); setDropdownOpen(false); }, color: colors.error },
              ].map(item => (
                <button key={item.label} onClick={item.onClick} style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: typography.sizes.sm, color: item.color || colors.neutral700, textAlign: 'left' }}>
                  <FontAwesomeIcon icon={item.icon} style={{ width: '14px' }} />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
