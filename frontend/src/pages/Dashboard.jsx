import { useState, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { HiOutlineArrowPath, HiOutlineKey } from 'react-icons/hi2';
import { getHealth, getSystemConfig, getActivity, setAdminToken, getAdminToken } from '../api/chainlocker';
import { useToast } from '../components/Toast';
import AnimatedSection from '../components/AnimatedSection';
import './Dashboard.css';

export default function Dashboard() {
  const toast = useToast();
  const [token, setToken] = useState(getAdminToken());
  const [health, setHealth] = useState(null);
  const [config, setConfig] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState({});

  const refreshHealth = useCallback(async () => {
    setLoading((l) => ({ ...l, health: true }));
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      toast.error('Health check failed: ' + err.message);
    } finally {
      setLoading((l) => ({ ...l, health: false }));
    }
  }, [toast]);

  const refreshConfig = useCallback(async () => {
    setLoading((l) => ({ ...l, config: true }));
    try {
      const data = await getSystemConfig();
      setConfig(data);
    } catch (err) {
      setConfig(null);
    } finally {
      setLoading((l) => ({ ...l, config: false }));
    }
  }, []);

  const refreshActivity = useCallback(async () => {
    setLoading((l) => ({ ...l, activity: true }));
    try {
      const data = await getActivity(15);
      setActivity(data);
    } catch (err) {
      setActivity([]);
    } finally {
      setLoading((l) => ({ ...l, activity: false }));
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    refreshConfig();
    refreshActivity();
  }, [refreshHealth, refreshConfig, refreshActivity]);

  const handleSaveToken = (e) => {
    e.preventDefault();
    setAdminToken(token);
    toast.success('Admin token saved');
    refreshConfig();
    refreshActivity();
  };

  const statusClass = (ok) => (ok ? 'status-ok' : 'status-warn');
  const statusLabel = (ok) => (ok ? 'Online' : 'Degraded');

  return (
    <div className="dashboard-page page-wrapper">
      <div className="container">
        <AnimatedSection animation="fadeUp">
          <div className="page-header">
            <h1>Control <span className="gradient-text">Dashboard</span></h1>
            <p>Monitor node status, view system configuration, and track credential activity.</p>
          </div>
        </AnimatedSection>

        {/* Token */}
        <AnimatedSection animation="fadeUp" delay={0.1}>
          <div className="glass-card token-card">
            <form onSubmit={handleSaveToken} className="token-form">
              <HiOutlineKey className="token-icon" />
              <input
                type="password"
                className="form-input token-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter admin token"
              />
              <button type="submit" className="btn btn-primary">Save Token</button>
            </form>
          </div>
        </AnimatedSection>

        {/* Health */}
        <AnimatedSection animation="fadeUp" delay={0.2} className="grid-2">
          <div className="glass-card">
            <div className="card-header">
              <h3>Node Status</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={refreshHealth}
                disabled={loading.health}
              >
                <HiOutlineArrowPath className={loading.health ? 'spin-icon' : ''} />
                Refresh
              </button>
            </div>
            {health ? (
              <div className="status-grid">
                <div className="status-row">
                  <span>Service</span>
                  <span className={`status-pill ${statusClass(health.status === 'ok')}`}>
                    {health.status}
                  </span>
                </div>
                <div className="status-row">
                  <span>IPFS</span>
                  <span className={`status-pill ${statusClass(health.ipfs?.reachable)}`}>
                    {statusLabel(health.ipfs?.reachable)}
                  </span>
                </div>
                <div className="status-row">
                  <span>Solana</span>
                  <span className={`status-pill ${statusClass(health.solana?.reachable)}`}>
                    {statusLabel(health.solana?.reachable)}
                  </span>
                </div>
                <div className="status-row">
                  <span>Storage</span>
                  <span className={`status-pill ${statusClass(health.storage?.ready)}`}>
                    {statusLabel(health.storage?.ready)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                {loading.health ? <div className="spinner"></div> : <p>Unable to connect to backend</p>}
              </div>
            )}
          </div>

          <div className="glass-card">
            <div className="card-header">
              <h3>System Config</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={refreshConfig}
                disabled={loading.config}
              >
                <HiOutlineArrowPath className={loading.config ? 'spin-icon' : ''} />
                Refresh
              </button>
            </div>
            {config ? (
              <pre className="json-output">{JSON.stringify(config, null, 2)}</pre>
            ) : (
              <div className="empty-state">
                {loading.config ? <div className="spinner"></div> : <p>Provide admin token to view config</p>}
              </div>
            )}
          </div>
        </AnimatedSection>

        {/* Activity Feed */}
        <AnimatedSection animation="fadeUp" delay={0.3}>
          <div className="glass-card activity-card">
            <div className="card-header">
              <h3>Activity Feed</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={refreshActivity}
                disabled={loading.activity}
              >
                <HiOutlineArrowPath className={loading.activity ? 'spin-icon' : ''} />
                Reload
              </button>
            </div>
            {activity.length > 0 ? (
              <div className="activity-list">
                {[...activity].reverse().map((event, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-meta">
                      <time>{new Date(event.at).toLocaleString()}</time>
                      <span className={`status-pill ${event.status === 'success' || event.status === 'submitted' || event.status === 'found' ? 'status-ok' : 'status-info'}`}>
                        {event.status}
                      </span>
                    </div>
                    <strong className="activity-action">{event.action}</strong>
                    <p className="activity-detail">{event.detail}</p>
                    {event.sha256Hex && (
                      <code className="activity-hash">{event.sha256Hex}</code>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                {loading.activity ? <div className="spinner"></div> : <p>No recent activity</p>}
              </div>
            )}
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
