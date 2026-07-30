import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import ConversationScene from './components/ConversationScene.jsx';
import MixamoTestScene from './components/MixamoTestScene.jsx';
import FaceUploadScene from './components/FaceUploadScene.jsx';
import MediaPipeTestScene from './components/MediaPipeTestScene.jsx';
import FaceTalkScene from './components/FaceTalkScene.jsx';

class GlobalErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 20, background: 'black', height: '100vh', width: '100vw', overflow: 'auto' }}>
          <h2>Global React Crash!</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack || this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function getRoute() {
  const h = window.location.hash;
  if (h === '#face')        return 'face';
  if (h === '#mixamo')      return 'mixamo';
  if (h === '#mediapipe')   return 'mediapipe';
  if (h === '#debug')       return 'debug';       // old FaceTalkScene (debug mode)
  return 'conversation';                           // default: full conversation UI
}

function MainAppFlow() {
  const { customError, setCustomError } = useApp();
  const [route, setRoute] = useState(getRoute());
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (window.appLogs) setLogs([...window.appLogs]);
    const onLog = () => { if (window.appLogs) setLogs([...window.appLogs]); };
    window.addEventListener('app_log_updated', onLog);
    return () => window.removeEventListener('app_log_updated', onLog);
  }, []);

  // Nav is hidden on the main conversation screen to keep it immersive
  const showNav = route !== 'conversation';

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* ── Nav tabs (hidden on main conversation screen) ── */}
      {showNav && (
        <nav style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, display: 'flex', gap: 4,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0 0 14px 14px', padding: '6px 10px',
        }}>
          {[
            { hash: '',           label: '🗣️ FaceTalk',   key: 'conversation' },
            { hash: '#face',      label: '📸 Face Upload', key: 'face'         },
            { hash: '#mixamo',    label: '🎭 Mixamo',      key: 'mixamo'       },
            { hash: '#mediapipe', label: '🧠 MediaPipe',   key: 'mediapipe'    },
            { hash: '#debug',     label: '🔧 Debug',       key: 'debug'        },
          ].map(({ hash, label, key }) => (
            <a
              key={key}
              href={hash}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.2s',
                background: route === key ? 'rgba(99,102,241,0.25)' : 'transparent',
                color: route === key ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                border: route === key ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      )}

      {/* ── Pages ── */}
      {route === 'conversation' && <ConversationScene />}
      {route === 'face'         && <FaceUploadScene />}
      {route === 'mixamo'       && <MixamoTestScene />}
      {route === 'mediapipe'    && <MediaPipeTestScene />}
      {route === 'debug'        && <FaceTalkScene />}

      {/* ── Debug log (dev only) ── */}
      {logs.length > 0 && route !== 'conversation' && (
        <div style={{
          position: 'fixed', bottom: 60, left: 16, zIndex: 100,
          maxWidth: 400, maxHeight: 160, overflowY: 'auto',
          background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '8px 12px',
          fontSize: '0.65rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)',
          pointerEvents: 'none',
        }}>
          {logs.slice(-12).map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* ── Error toast (for non-conversation routes) ── */}
      {customError && route !== 'conversation' && (
        <div style={{
          position: 'fixed', top: 60, right: 16, zIndex: 300,
          maxWidth: 320, background: 'rgba(127,0,0,0.9)', borderRadius: 12,
          padding: '12px 16px', color: '#fff', fontSize: '0.8rem',
          border: '1px solid rgba(255,0,0,0.3)',
        }}>
          ⚠️ {customError}
          <button onClick={() => setCustomError(null)} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </main>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AppProvider>
        <MainAppFlow />
      </AppProvider>
    </GlobalErrorBoundary>
  );
}
