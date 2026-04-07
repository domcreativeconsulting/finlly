import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTableColumns,
  faCircleUp,
  faCircleDown,
  faChartLine,
  faBullseye,
  faPaperclip,
  faClipboardList,
  faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import logoIcon from '../assets/logo.png';

const NAV_ITEMS = [
  {
    icon: <FontAwesomeIcon icon={faTableColumns} style={{ fontSize: '20px' }} />,
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    icon: <FontAwesomeIcon icon={faCircleUp} style={{ fontSize: '20px' }} />,
    label: 'Contas a pagar',
    path: '/contas-pagar',
  },
  {
    icon: <FontAwesomeIcon icon={faCircleDown} style={{ fontSize: '20px' }} />,
    label: 'Contas a receber',
    path: '/contas-receber',
  },
  {
    icon: <FontAwesomeIcon icon={faChartLine} style={{ fontSize: '20px' }} />,
    label: 'Investimentos',
    path: '/investimentos',
  },
  { icon: <FontAwesomeIcon icon={faBullseye} style={{ fontSize: '20px' }} />, label: 'Metas', path: '/metas' },
  { icon: <FontAwesomeIcon icon={faPaperclip} style={{ fontSize: '20px' }} />, label: 'Anexos', path: '/anexos' },
  { icon: <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '20px' }} />, label: 'Relatórios', path: '/relatorios' },
  {
    icon: <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: '20px' }} />,
    label: 'Sair',
    path: '/logout',
    isLogout: true,
  },
];

function NavItem({ item, onNavigate }) {
  const [hovered, setHovered] = useState(false);

  return (
    <li
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '4px',
        padding: '0 8px',
        boxSizing: 'border-box',
      }}
    >
      <button
        onClick={() => onNavigate(item)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={item.label}
        aria-label={item.label}
        aria-current={item.active ? 'page' : undefined}
        style={{
          width: '100%',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background:
            hovered || item.active ? 'rgba(255,255,255,0.18)' : 'none',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          color: '#ffffff',
          fontSize: '20px',
          transition: 'background 0.18s ease, color 0.18s ease',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            minWidth: '44px',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.icon}
        </span>
      </button>
    </li>
  );
}

function NavItemExpanded({ item, onNavigate }) {
  const [hovered, setHovered] = useState(false);

  return (
    <li
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '4px',
        padding: '0 10px',
        boxSizing: 'border-box',
      }}
    >
      <button
        onClick={() => onNavigate(item)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={item.label}
        aria-label={item.label}
        aria-current={item.active ? 'page' : undefined}
        style={{
          width: '100%',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background:
            hovered || item.active ? 'rgba(255,255,255,0.18)' : 'none',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          color: '#ffffff',
          fontSize: '20px',
          transition: 'background 0.18s ease, color 0.18s ease',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            minWidth: '44px',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.icon}
        </span>
        <span
          style={{
            fontSize: '14px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            color: 'inherit',
          }}
        >
          {item.label}
        </span>
      </button>
    </li>
  );
}

function MobileNavItem({ item, onNavigate }) {
  return (
    <button
      onClick={() => onNavigate(item)}
      title={item.label}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: item.active ? '#ffffff' : 'rgba(255,255,255,0.65)',
        fontSize: '9px',
        fontWeight: item.active ? 600 : 400,
        padding: '4px 8px',
        borderRadius: '8px',
        minWidth: '44px',
        minHeight: '44px',
        transition: 'color 0.15s ease',
      }}
    >
      <span style={{ fontSize: '20px' }}>{item.icon}</span>
      <span>{item.label.split(' ')[0]}</span>
    </button>
  );
}

export default function AppSidebar({
  sidebarOpen,
  currentPath,
  isExpanded,
  onHoverChange,
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const effectivelyExpanded = isHovered || isExpanded;

  function handleMouseEnter() {
    setIsHovered(true);
    onHoverChange?.(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    onHoverChange?.(false);
  }

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    active: item.path === currentPath,
  }));

  async function handleNavigate(item) {
    if (item.isLogout) {
      await logout();
      navigate('/login');
    } else {
      navigate(item.path);
    }
  }

  if (isMobile) {
    return (
      <nav
        aria-label="Navegação principal"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          backgroundColor: '#33528a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 1030,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {navItems.map((item) => (
          <MobileNavItem key={item.path} item={item} onNavigate={handleNavigate} />
        ))}
      </nav>
    );
  }

  return (
    <nav
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...sidebarStyles.sidebar,
        ...(sidebarOpen ? {} : sidebarStyles.sidebarHidden),
        width: effectivelyExpanded ? '220px' : '92px',
      }}
      aria-label="Navegação principal"
    >
      {/* Logo */}
      <div
        style={{
          width: '100%',
          height: '62px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px',
          flexShrink: 0,
          padding: isHovered ? '0 16px' : '0',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'padding 0.3s ease',
        }}
      >
        <img
          src={logoIcon}
          alt="Finlly"
          style={{
            height: effectivelyExpanded ? '36px' : '13px',
            width: 'auto',
            transition: 'height 0.3s ease',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Nav items */}
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: '12px 15px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: effectivelyExpanded ? 'flex-start' : 'center',
          gap: '15px',
          width: '100%',
        }}
      >
        {navItems.map((item) =>
          effectivelyExpanded ? (
            <NavItemExpanded
              key={item.path}
              item={item}
              onNavigate={handleNavigate}
            />
          ) : (
            <NavItem key={item.path} item={item} onNavigate={handleNavigate} />
          )
        )}
      </ul>
    </nav>
  );
}

const sidebarStyles = {
  sidebar: {
    position: 'fixed',
    top: '16px',
    left: '16px',
    bottom: '16px',
    width: '92px',
    backgroundColor: '#33528a',
    borderRadius: '20px',
    boxShadow: 'rgba(51, 82, 138, 0.22) 0px 10px 35px 0px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '15px',
    paddingBottom: '15px',
    overflowX: 'hidden',
    overflowY: 'auto',
    zIndex: 1030,
    flexShrink: 0,
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  sidebarHidden: {
    width: '0',
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'hidden',
  },
};
