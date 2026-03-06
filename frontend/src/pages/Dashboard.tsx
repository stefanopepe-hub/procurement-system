import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin } from 'antd';
import {
  TeamOutlined, FileTextOutlined, StarOutlined, WarningOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface Stats {
  total_suppliers: number;
  active_contracts: number;
  pending_ratings: number;
  expiring_contracts: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    Promise.all([
      axios.get(`${API_BASE}/suppliers/?page=1&size=1`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${API_BASE}/contracts/?page=1&size=1`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(([suppRes, contRes]) => {
      setStats({
        total_suppliers: suppRes.headers['x-total-count'] || 0,
        active_contracts: contRes.headers['x-total-count'] || 0,
        pending_ratings: 0,
        expiring_contracts: 0,
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Dashboard</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic title="Fornitori Attivi" value={stats?.total_suppliers ?? '-'} prefix={<TeamOutlined />} valueStyle={{ color: '#1a3a5c' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic title="Contratti Attivi" value={stats?.active_contracts ?? '-'} prefix={<FileTextOutlined />} valueStyle={{ color: '#389e0d' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic title="Valutazioni Pendenti" value={stats?.pending_ratings ?? 0} prefix={<StarOutlined />} valueStyle={{ color: '#d48806' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic title="Contratti in Scadenza" value={stats?.expiring_contracts ?? 0} prefix={<WarningOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Azioni Rapide" className="stat-card">
            <Row gutter={[8, 8]}>
              {[
                { label: 'Nuovo Fornitore', link: '/suppliers/new', color: '#1a3a5c' },
                { label: 'Nuovo Contratto', link: '/contracts/new', color: '#389e0d' },
                { label: 'Vai ai Fornitori', link: '/suppliers', color: '#595959' },
                { label: 'Vai ai Contratti', link: '/contracts', color: '#595959' },
              ].map(a => (
                <Col key={a.label} span={12}>
                  <a href={a.link}>
                    <Card size="small" hoverable style={{ textAlign: 'center', borderColor: a.color, color: a.color, fontWeight: 500 }}>
                      {a.label}
                    </Card>
                  </a>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<><ClockCircleOutlined /> Attività Recenti</>} className="stat-card">
            <p style={{ color: '#8c8c8c', textAlign: 'center', padding: '20px 0' }}>
              Le attività recenti appariranno qui.
            </p>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
