import React, { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Typography, Spin, Badge, List, Tag,
  Button, Timeline, Alert, Progress, Space, Divider, message, Empty,
} from 'antd';
import {
  TeamOutlined, FileTextOutlined, StarOutlined, WarningOutlined,
  ClockCircleOutlined, PlusOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, LinkOutlined, UserOutlined, BellFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { suppliersApi, contractsApi, vendorRatingApi, adminApi } from '../services/api';
import { useAuthStore, isAdmin } from '../store/auth';
import type { ContractListItem, SupplierListItem } from '../types';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ─── Types ──────────────────────────────────────────────────────────────────

interface PendingRatingRequest {
  supplier_id: number;
  ragione_sociale: string;
  requested_at: string | null;
  expires_at: string | null;
  tipo: string | null;
  request_id: number;
}

interface AuditEntry {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  status: string;
  created_at: string | null;
}

interface SemaforoCounts {
  verde: number;
  giallo: number;
  rosso: number;
  grigio: number;
}

interface ContractStatusCounts {
  attivo: number;
  non_attivo: number;
  in_rinegoziazione: number;
}

interface KpiStats {
  totalSuppliers: number;
  activeContracts: number;
  expiringContracts: number;
  pendingRatings: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return dayjs(dateStr).diff(dayjs(), 'day');
}

function expiryBadge(days: number) {
  if (days < 30) {
    return <Tag color="red">{days}gg</Tag>;
  }
  return <Tag color="orange">{days}gg</Tag>;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    LOGIN_FAILED: 'Login fallito',
    CREATE: 'Creazione',
    UPDATE: 'Modifica',
    DELETE: 'Eliminazione',
    VIEW: 'Visualizzazione',
    CHANGE_PASSWORD: 'Cambio password',
    UA_REVIEW: 'Revisione UA',
    ASSOCIATE_ORDER: 'Associazione ordine',
  };
  return map[action] ?? action;
}

function resourceLabel(type: string): string {
  const map: Record<string, string> = {
    contract: 'Contratto',
    supplier: 'Fornitore',
    auth: 'Autenticazione',
    vendor_rating: 'Valutazione',
  };
  return map[type] ?? type;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const KpiCards: React.FC<{ stats: KpiStats; loading: boolean }> = ({ stats, loading }) => (
  <Row gutter={[16, 16]}>
    <Col xs={24} sm={12} lg={6}>
      <Card className="stat-card">
        <Statistic
          title="Fornitori Attivi"
          value={loading ? '-' : stats.totalSuppliers}
          prefix={<TeamOutlined />}
          valueStyle={{ color: '#1a3a5c' }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card className="stat-card">
        <Statistic
          title="Contratti Attivi"
          value={loading ? '-' : stats.activeContracts}
          prefix={<FileTextOutlined />}
          valueStyle={{ color: '#389e0d' }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card className="stat-card">
        <Statistic
          title="Contratti in Scadenza (60gg)"
          value={loading ? '-' : stats.expiringContracts}
          prefix={<WarningOutlined />}
          valueStyle={{ color: stats.expiringContracts > 0 ? '#cf1322' : '#389e0d' }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card className="stat-card">
        <Statistic
          title="Valutazioni Pendenti"
          value={loading ? '-' : stats.pendingRatings}
          prefix={<StarOutlined />}
          valueStyle={{ color: '#d48806' }}
        />
      </Card>
    </Col>
  </Row>
);

const ExpiringContractsAlert: React.FC<{ contracts: ContractListItem[]; loading: boolean }> = ({
  contracts,
  loading,
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card title={<><WarningOutlined style={{ color: '#cf1322' }} /> Contratti in Scadenza</>} className="stat-card">
        <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
      </Card>
    );
  }

  if (contracts.length === 0) {
    return (
      <Card title={<><CheckCircleOutlined style={{ color: '#389e0d' }} /> Contratti in Scadenza</>} className="stat-card">
        <Empty description="Nessun contratto in scadenza nei prossimi 60 giorni" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const shown = contracts.slice(0, 5);

  return (
    <Card
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#cf1322' }} />
          <span>Contratti in Scadenza</span>
          <Badge count={contracts.length} style={{ backgroundColor: contracts.some(c => (daysUntil(c.data_scadenza) ?? 999) < 30) ? '#cf1322' : '#d48806' }} />
        </Space>
      }
      className="stat-card"
      extra={
        contracts.length > 5 && (
          <Button type="link" size="small" onClick={() => navigate('/contracts')}>
            Vedi tutti ({contracts.length})
          </Button>
        )
      }
    >
      <List
        size="small"
        dataSource={shown}
        renderItem={(c) => {
          const days = daysUntil(c.data_scadenza) ?? 0;
          return (
            <List.Item
              key={c.id}
              style={{ paddingLeft: 0, paddingRight: 0 }}
              actions={[
                <Button
                  key="open"
                  type="link"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={() => navigate(`/contracts/${c.id}`)}
                >
                  Apri
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={4}>
                    {expiryBadge(days)}
                    <Text strong style={{ fontSize: 13 }}>{c.oggetto}</Text>
                  </Space>
                }
                description={
                  <Space size={8} style={{ fontSize: 12 }}>
                    <Text type="secondary"><TeamOutlined /> {c.ragione_sociale}</Text>
                    <Text type="secondary">
                      Scade: {c.data_scadenza ? dayjs(c.data_scadenza).format('DD/MM/YYYY') : '—'}
                    </Text>
                    <Tag bordered={false} color="default" style={{ fontSize: 11 }}>{c.id_contratto}</Tag>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );
};

const ContractStatusChart: React.FC<{ counts: ContractStatusCounts; loading: boolean }> = ({
  counts,
  loading,
}) => {
  const total = counts.attivo + counts.non_attivo + counts.in_rinegoziazione;

  return (
    <Card title={<><FileTextOutlined /> Contratti per Stato</>} className="stat-card">
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <Space style={{ marginBottom: 4 }}>
              <Badge color="#389e0d" text="Attivi" />
              <Text strong>{counts.attivo}</Text>
              {total > 0 && <Text type="secondary" style={{ fontSize: 12 }}>({Math.round(counts.attivo / total * 100)}%)</Text>}
            </Space>
            <Progress
              percent={total > 0 ? Math.round(counts.attivo / total * 100) : 0}
              strokeColor="#389e0d"
              showInfo={false}
              size="small"
            />
          </div>
          <div>
            <Space style={{ marginBottom: 4 }}>
              <Badge color="#1a3a5c" text="Non Attivi" />
              <Text strong>{counts.non_attivo}</Text>
              {total > 0 && <Text type="secondary" style={{ fontSize: 12 }}>({Math.round(counts.non_attivo / total * 100)}%)</Text>}
            </Space>
            <Progress
              percent={total > 0 ? Math.round(counts.non_attivo / total * 100) : 0}
              strokeColor="#1a3a5c"
              showInfo={false}
              size="small"
            />
          </div>
          <div>
            <Space style={{ marginBottom: 4 }}>
              <Badge color="#d48806" text="In Rinegoziazione" />
              <Text strong>{counts.in_rinegoziazione}</Text>
              {total > 0 && <Text type="secondary" style={{ fontSize: 12 }}>({Math.round(counts.in_rinegoziazione / total * 100)}%)</Text>}
            </Space>
            <Progress
              percent={total > 0 ? Math.round(counts.in_rinegoziazione / total * 100) : 0}
              strokeColor="#d48806"
              showInfo={false}
              size="small"
            />
          </div>
          <Divider style={{ margin: '4px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>Totale: {total} contratti</Text>
        </Space>
      )}
    </Card>
  );
};

const SemaforoChart: React.FC<{ counts: SemaforoCounts; loading: boolean }> = ({
  counts,
  loading,
}) => {
  const total = counts.verde + counts.giallo + counts.rosso + counts.grigio;

  const items = [
    { key: 'verde', label: 'Verde (Ottimo)', color: '#52c41a', count: counts.verde },
    { key: 'giallo', label: 'Giallo (Sufficiente)', color: '#faad14', count: counts.giallo },
    { key: 'rosso', label: 'Rosso (Critico)', color: '#ff4d4f', count: counts.rosso },
    { key: 'grigio', label: 'Grigio (Senza dati)', color: '#8c8c8c', count: counts.grigio },
  ];

  return (
    <Card title={<><StarOutlined /> Semaforo Fornitori</>} className="stat-card">
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
      ) : total === 0 ? (
        <Empty description="Nessun dato di valutazione disponibile" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {items.map(({ key, label, color, count }) => (
            <div key={key}>
              <Space style={{ marginBottom: 4 }}>
                <Badge color={color} text={label} />
                <Text strong>{count}</Text>
                {total > 0 && <Text type="secondary" style={{ fontSize: 12 }}>({Math.round(count / total * 100)}%)</Text>}
              </Space>
              <Progress
                percent={total > 0 ? Math.round(count / total * 100) : 0}
                strokeColor={color}
                showInfo={false}
                size="small"
              />
            </div>
          ))}
          <Divider style={{ margin: '4px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>Fornitori valutati: {total - counts.grigio} / {total}</Text>
        </Space>
      )}
    </Card>
  );
};

const SupplierCategoryChart: React.FC<{ suppliers: SupplierListItem[]; loading: boolean }> = ({
  suppliers,
  loading,
}) => {
  const categoryMap: Record<string, number> = {};
  suppliers.forEach((s) => {
    (s.categorie_merceologiche ?? []).forEach((cat) => {
      categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
    });
  });

  const sorted = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const total = sorted.reduce((sum, [, n]) => sum + n, 0);

  const colors = ['#1a3a5c', '#389e0d', '#d48806', '#cf1322', '#722ed1', '#13c2c2'];

  return (
    <Card title={<><TeamOutlined /> Fornitori per Categoria</>} className="stat-card">
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
      ) : sorted.length === 0 ? (
        <Empty description="Nessuna categoria disponibile" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {sorted.map(([cat, count], idx) => (
            <div key={cat}>
              <Space style={{ marginBottom: 4 }} wrap>
                <Badge color={colors[idx % colors.length]} text={cat} />
                <Text strong>{count}</Text>
                {total > 0 && <Text type="secondary" style={{ fontSize: 12 }}>({Math.round(count / total * 100)}%)</Text>}
              </Space>
              <Progress
                percent={total > 0 ? Math.round(count / total * 100) : 0}
                strokeColor={colors[idx % colors.length]}
                showInfo={false}
                size="small"
              />
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
};

const AuditActivity: React.FC<{ entries: AuditEntry[]; loading: boolean; isAdminUser: boolean }> = ({
  entries,
  loading,
  isAdminUser,
}) => {
  if (!isAdminUser) {
    return (
      <Card title={<><ClockCircleOutlined /> Attività Recenti</>} className="stat-card">
        <Alert
          type="info"
          message="Accesso limitato"
          description="Accedi come admin o super admin per visualizzare il registro attività."
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card title={<><ClockCircleOutlined /> Attività Recenti</>} className="stat-card">
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
      ) : entries.length === 0 ? (
        <Empty description="Nessuna attività registrata" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Timeline
          style={{ marginTop: 8 }}
          items={entries.slice(0, 10).map((e) => ({
            key: e.id,
            color: e.status === 'failure' ? 'red' : e.action === 'DELETE' ? 'orange' : 'blue',
            children: (
              <div style={{ lineHeight: 1.4 }}>
                <Space size={4} wrap>
                  <Tag color={e.status === 'failure' ? 'red' : 'blue'} style={{ fontSize: 11 }}>
                    {actionLabel(e.action)}
                  </Tag>
                  <Text style={{ fontSize: 12 }}>{resourceLabel(e.resource_type)}</Text>
                  {e.resource_id && (
                    <Text type="secondary" style={{ fontSize: 11 }}>#{e.resource_id}</Text>
                  )}
                </Space>
                <br />
                <Space size={8}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <UserOutlined /> user#{e.user_id ?? '?'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {e.created_at ? dayjs(e.created_at).format('DD/MM HH:mm') : '—'}
                  </Text>
                </Space>
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );
};

const QuickActions: React.FC<{ isAdminUser: boolean }> = ({ isAdminUser }) => {
  const navigate = useNavigate();
  const [checkingExpiries, setCheckingExpiries] = useState(false);

  const handleCheckExpiries = async () => {
    setCheckingExpiries(true);
    try {
      // The endpoint may not exist, handle gracefully
      const token = localStorage.getItem('access_token');
      const apiBase = ((window as any).__API_URL__ || import.meta.env.VITE_API_URL || '') + '/api/v1';
      const res = await fetch(`${apiBase}/admin/check-expiries`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        message.success('Verifica scadenze completata');
      } else {
        message.info('Verifica scadenze non disponibile');
      }
    } catch {
      message.info('Funzione non disponibile in questo ambiente');
    } finally {
      setCheckingExpiries(false);
    }
  };

  return (
    <Card title="Azioni Rapide" className="stat-card">
      <Row gutter={[8, 8]}>
        {isAdminUser && (
          <>
            <Col span={12}>
              <Button
                block
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/suppliers/new')}
                style={{ background: '#1a3a5c', borderColor: '#1a3a5c' }}
              >
                Nuovo Fornitore
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/contracts/new')}
                style={{ background: '#389e0d', borderColor: '#389e0d' }}
              >
                Nuovo Contratto
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                icon={<WarningOutlined />}
                onClick={handleCheckExpiries}
                loading={checkingExpiries}
              >
                Verifica Scadenze
              </Button>
            </Col>
          </>
        )}
        <Col span={isAdminUser ? 12 : 24}>
          <Button block icon={<TeamOutlined />} onClick={() => navigate('/suppliers')}>
            Vai ai Fornitori
          </Button>
        </Col>
        {isAdminUser && (
          <Col span={24}>
            <Button block icon={<FileTextOutlined />} onClick={() => navigate('/contracts')}>
              Vai ai Contratti
            </Button>
          </Col>
        )}
      </Row>
    </Card>
  );
};

// ─── Pending Ratings Alert ───────────────────────────────────────────────────

const PendingRatingsAlert: React.FC<{
  requests: PendingRatingRequest[];
  total: number;
  loading: boolean;
}> = ({ requests, total, loading }) => {
  const navigate = useNavigate();

  if (loading || total === 0) return null;

  const shown = requests.slice(0, 5);

  return (
    <Card
      style={{
        marginBottom: 24,
        background: 'linear-gradient(135deg, #fffbe6 0%, #fff7d6 100%)',
        border: '1px solid #faad14',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(250,173,20,0.15)',
      }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      <Space align="start" style={{ width: '100%' }}>
        <BellFilled style={{ fontSize: 22, color: '#d48806', marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Space>
              <Typography.Text strong style={{ fontSize: 16, color: '#7c5800' }}>
                Valutazioni fornitori in attesa
              </Typography.Text>
              <Badge
                count={total}
                style={{ backgroundColor: '#d48806' }}
              />
            </Space>
            {total > 5 && (
              <Button
                type="link"
                size="small"
                style={{ color: '#d48806', padding: 0 }}
                onClick={() => navigate('/vendor-rating')}
              >
                Vedi tutte ({total})
              </Button>
            )}
          </div>
          <List
            size="small"
            dataSource={shown}
            renderItem={(r) => {
              const daysLeft = r.expires_at
                ? dayjs(r.expires_at).diff(dayjs(), 'day')
                : null;
              const isUrgent = daysLeft !== null && daysLeft <= 7;
              return (
                <List.Item
                  key={r.request_id}
                  style={{
                    paddingLeft: 0,
                    paddingRight: 0,
                    borderBottom: '1px solid rgba(250,173,20,0.2)',
                  }}
                  actions={[
                    <Button
                      key="rate"
                      type="primary"
                      size="small"
                      icon={<StarOutlined />}
                      onClick={() => navigate(`/vendor-rating/supplier/${r.supplier_id}`)}
                      style={{
                        background: '#d48806',
                        borderColor: '#d48806',
                        fontSize: 12,
                      }}
                    >
                      Valuta ora
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space size={6}>
                        <Typography.Text strong style={{ fontSize: 13 }}>
                          {r.ragione_sociale}
                        </Typography.Text>
                        {r.tipo && (
                          <Tag style={{ fontSize: 10, margin: 0 }}>{r.tipo}</Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Space size={12} style={{ fontSize: 11, color: '#7c5800' }}>
                        <span>
                          Richiesta il{' '}
                          {r.requested_at ? dayjs(r.requested_at).format('DD/MM/YYYY') : '—'}
                        </span>
                        {daysLeft !== null && (
                          <span style={{ color: isUrgent ? '#cf1322' : '#d48806', fontWeight: 600 }}>
                            {isUrgent ? (
                              <><WarningOutlined /> {daysLeft}gg rimasti (urgente)</>
                            ) : (
                              <>{daysLeft}gg rimasti</>
                            )}
                          </span>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </div>
      </Space>
    </Card>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const adminUser = isAdmin(user);
  const isSuperAdmin = user?.role === 'super_admin';

  // KPI state
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiStats, setKpiStats] = useState<KpiStats>({
    totalSuppliers: 0,
    activeContracts: 0,
    expiringContracts: 0,
    pendingRatings: 0,
  });

  // Expiring contracts
  const [expiringLoading, setExpiringLoading] = useState(true);
  const [expiringContracts, setExpiringContracts] = useState<ContractListItem[]>([]);

  // Contract status chart
  const [contractStatusLoading, setContractStatusLoading] = useState(true);
  const [contractCounts, setContractCounts] = useState<ContractStatusCounts>({
    attivo: 0,
    non_attivo: 0,
    in_rinegoziazione: 0,
  });

  // Semaforo chart
  const [semaforoLoading, setSemaforoLoading] = useState(true);
  const [semaforoCounts, setSemaforoCounts] = useState<SemaforoCounts>({
    verde: 0,
    giallo: 0,
    rosso: 0,
    grigio: 0,
  });

  // Supplier category chart
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [allSuppliers, setAllSuppliers] = useState<SupplierListItem[]>([]);

  // Audit log
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  // Pending vendor ratings
  const [pendingRatingLoading, setPendingRatingLoading] = useState(true);
  const [pendingRatingTotal, setPendingRatingTotal] = useState(0);
  const [pendingRatingRequests, setPendingRatingRequests] = useState<PendingRatingRequest[]>([]);

  const loadKpi = useCallback(async () => {
    setKpiLoading(true);
    try {
      const [suppRes, activeContRes, expiringContRes] = await Promise.allSettled([
        suppliersApi.list({ status: 'accreditato', page: 1, page_size: 1 }),
        contractsApi.list({ status: ['attivo'], page: 1, page_size: 1 }),
        // Use date range: today to today+60 days for expiring contracts with active status
        contractsApi.list({
          status: ['attivo'],
          data_scadenza_from: dayjs().format('YYYY-MM-DD'),
          data_scadenza_to: dayjs().add(60, 'day').format('YYYY-MM-DD'),
          page: 1,
          page_size: 1,
        }),
      ]);

      const totalSuppliers =
        suppRes.status === 'fulfilled' ? (suppRes.value.data?.total ?? 0) : 0;
      const activeContracts =
        activeContRes.status === 'fulfilled' ? (activeContRes.value.data?.total ?? 0) : 0;
      const expiringContracts =
        expiringContRes.status === 'fulfilled' ? (expiringContRes.value.data?.total ?? 0) : 0;

      // Pending ratings: vendor rating requests not yet completed
      // We use the dashboard total as a proxy (all rated suppliers)
      let pendingRatings = 0;
      try {
        const ratingRes = await vendorRatingApi.dashboard({ page: 1, page_size: 1 });
        // We don't have a direct pending count; use 0 as baseline
        pendingRatings = 0;
        void ratingRes;
      } catch {
        // silently ignore
      }

      setKpiStats({ totalSuppliers, activeContracts, expiringContracts, pendingRatings });
    } catch {
      // silently ignore
    } finally {
      setKpiLoading(false);
    }
  }, []);

  const loadExpiringContracts = useCallback(async () => {
    if (!adminUser) {
      setExpiringLoading(false);
      return;
    }
    setExpiringLoading(true);
    try {
      const res = await contractsApi.list({
        status: ['attivo'],
        data_scadenza_from: dayjs().format('YYYY-MM-DD'),
        data_scadenza_to: dayjs().add(60, 'day').format('YYYY-MM-DD'),
        page: 1,
        page_size: 60,
      });
      const items: ContractListItem[] = res.data?.items ?? [];
      // Sort by expiry date ascending
      items.sort((a, b) =>
        dayjs(a.data_scadenza).valueOf() - dayjs(b.data_scadenza).valueOf()
      );
      setExpiringContracts(items);
    } catch {
      setExpiringContracts([]);
    } finally {
      setExpiringLoading(false);
    }
  }, [adminUser]);

  const loadContractCounts = useCallback(async () => {
    if (!adminUser) {
      setContractStatusLoading(false);
      return;
    }
    setContractStatusLoading(true);
    try {
      const [attiviRes, nonAttiviRes, rinegoRes] = await Promise.allSettled([
        contractsApi.list({ status: ['attivo'], page: 1, page_size: 1 }),
        contractsApi.list({ status: ['non_attivo'], page: 1, page_size: 1 }),
        contractsApi.list({ status: ['in_rinegoziazione'], page: 1, page_size: 1 }),
      ]);
      setContractCounts({
        attivo: attiviRes.status === 'fulfilled' ? (attiviRes.value.data?.total ?? 0) : 0,
        non_attivo: nonAttiviRes.status === 'fulfilled' ? (nonAttiviRes.value.data?.total ?? 0) : 0,
        in_rinegoziazione: rinegoRes.status === 'fulfilled' ? (rinegoRes.value.data?.total ?? 0) : 0,
      });
    } catch {
      // silently ignore
    } finally {
      setContractStatusLoading(false);
    }
  }, [adminUser]);

  const loadSemaforo = useCallback(async () => {
    if (!adminUser) {
      setSemaforoLoading(false);
      return;
    }
    setSemaforoLoading(true);
    try {
      const [verdeRes, gialloRes, rossoRes, grigioRes] = await Promise.allSettled([
        vendorRatingApi.dashboard({ semaforo: 'verde', page: 1, page_size: 1 }),
        vendorRatingApi.dashboard({ semaforo: 'giallo', page: 1, page_size: 1 }),
        vendorRatingApi.dashboard({ semaforo: 'rosso', page: 1, page_size: 1 }),
        vendorRatingApi.dashboard({ semaforo: 'grigio', page: 1, page_size: 1 }),
      ]);
      setSemaforoCounts({
        verde: verdeRes.status === 'fulfilled' ? (verdeRes.value.data?.total ?? 0) : 0,
        giallo: gialloRes.status === 'fulfilled' ? (gialloRes.value.data?.total ?? 0) : 0,
        rosso: rossoRes.status === 'fulfilled' ? (rossoRes.value.data?.total ?? 0) : 0,
        grigio: grigioRes.status === 'fulfilled' ? (grigioRes.value.data?.total ?? 0) : 0,
      });
    } catch {
      // silently ignore
    } finally {
      setSemaforoLoading(false);
    }
  }, [adminUser]);

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const res = await suppliersApi.list({ page: 1, page_size: 200 });
      setAllSuppliers(res.data?.items ?? []);
    } catch {
      setAllSuppliers([]);
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  const loadAuditLog = useCallback(async () => {
    if (!isSuperAdmin) {
      setAuditLoading(false);
      return;
    }
    setAuditLoading(true);
    try {
      const res = await adminApi.auditLog();
      setAuditEntries(res.data ?? []);
    } catch {
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  }, [isSuperAdmin]);

  const loadPendingRatings = useCallback(async () => {
    if (!adminUser) {
      setPendingRatingLoading(false);
      return;
    }
    setPendingRatingLoading(true);
    try {
      const res = await vendorRatingApi.pendingCount();
      const data = res.data;
      setPendingRatingTotal(data.pending ?? 0);
      setPendingRatingRequests(data.requests ?? []);
    } catch {
      // silently ignore
      setPendingRatingTotal(0);
      setPendingRatingRequests([]);
    } finally {
      setPendingRatingLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    loadKpi();
    loadExpiringContracts();
    loadContractCounts();
    loadSemaforo();
    loadSuppliers();
    loadAuditLog();
    loadPendingRatings();
  }, [loadKpi, loadExpiringContracts, loadContractCounts, loadSemaforo, loadSuppliers, loadAuditLog, loadPendingRatings]);

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Dashboard</Title>

      {/* Pending Vendor Ratings Alert — stile Amazon */}
      {adminUser && (
        <PendingRatingsAlert
          requests={pendingRatingRequests}
          total={pendingRatingTotal}
          loading={pendingRatingLoading}
        />
      )}

      {/* KPI Cards */}
      <KpiCards stats={kpiStats} loading={kpiLoading} />

      {/* Alert: Expiring Contracts */}
      {adminUser && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24}>
            <ExpiringContractsAlert contracts={expiringContracts} loading={expiringLoading} />
          </Col>
        </Row>
      )}

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {adminUser && (
          <>
            <Col xs={24} sm={24} lg={8}>
              <ContractStatusChart counts={contractCounts} loading={contractStatusLoading} />
            </Col>
            <Col xs={24} sm={24} lg={8}>
              <SemaforoChart counts={semaforoCounts} loading={semaforoLoading} />
            </Col>
            <Col xs={24} sm={24} lg={8}>
              <SupplierCategoryChart suppliers={allSuppliers} loading={suppliersLoading} />
            </Col>
          </>
        )}
        {!adminUser && (
          <Col xs={24}>
            <SupplierCategoryChart suppliers={allSuppliers} loading={suppliersLoading} />
          </Col>
        )}
      </Row>

      {/* Bottom Row: Activity + Quick Actions */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <AuditActivity
            entries={auditEntries}
            loading={auditLoading}
            isAdminUser={adminUser}
          />
        </Col>
        <Col xs={24} lg={10}>
          <QuickActions isAdminUser={adminUser} />
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
