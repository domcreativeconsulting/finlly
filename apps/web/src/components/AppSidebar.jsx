import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  Target,
  Paperclip,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import logoIcon from '../assets/logo.png';

const NAV_ITEMS = [
  {
    icon: <LayoutDashboard size={20} />,
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    icon: <ArrowUpCircle size={20} />,
    label: 'Contas a pagar',
    path: '/contas-pagar',
  },
  {
    icon: <ArrowDownCircle size={20} />,
    label: 'Contas a receber',
    path: '/contas-receber',
  },
  {
    icon: <TrendingUp size={20} />,
    label: 'Investimentos',
    path: '/investimentos',
  },
  { icon: <Target size={20} />, label: 'Metas', path: '/metas' },
  { icon: <Paperclip size={20} />, label: 'Anexos', path: '/anexos' },
  {
    icon: <LogOut size={20} />,
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

export default function AppSidebar({
  sidebarOpen,
  currentPath,
  isExpanded,
  onHoverChange,
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
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
