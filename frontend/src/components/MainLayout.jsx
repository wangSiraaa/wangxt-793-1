import React from 'react';
import { Layout, Menu, Button, Dropdown, Avatar } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  ShopOutlined,
  TeamOutlined,
  CameraOutlined,
  FileTextOutlined,
  PrinterOutlined,
  ScanOutlined,
  HistoryOutlined,
  LogoutOutlined,
  UserOutlined
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: '/exhibitors',
      icon: <ShopOutlined />,
      label: '展商管理'
    },
    {
      key: '/personnel',
      icon: <TeamOutlined />,
      label: '人员管理'
    },
    {
      key: '/photo-audit',
      icon: <CameraOutlined />,
      label: '照片审核',
      roles: ['organizer']
    },
    {
      key: '/credential-audit',
      icon: <FileTextOutlined />,
      label: '证件审核',
      roles: ['organizer']
    },
    {
      key: '/batches',
      icon: <PrinterOutlined />,
      label: '制证批次',
      roles: ['organizer', 'printer']
    },
    {
      key: '/verify',
      icon: <ScanOutlined />,
      label: '扫码核验',
      roles: ['organizer', 'security']
    },
    {
      key: '/verify-logs',
      icon: <HistoryOutlined />,
      label: '核验日志'
    }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  const roleLabels = {
    exhibitor: '展商',
    organizer: '主办方',
    printer: '制证员',
    security: '安保人员'
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-logo">展会展商证件办理系统</div>
        <div className="app-user">
          <Dropdown menu={{ items: userMenuItems }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar icon={<UserOutlined />} size="small" />
              <span>{user.realName || user.username}</span>
              <span style={{ color: '#1890ff' }}>({roleLabels[user.role] || user.role})</span>
            </div>
          </Dropdown>
        </div>
      </Header>
      <Layout>
        <Sider width={200} theme="dark">
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[location.pathname]}
            items={filteredMenuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Content className="app-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
