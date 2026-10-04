// Catches a crash while rendering a screen and shows a way out, instead of
// React unmounting the whole app and leaving a blank window. Everything is
// already saved before a screen renders, so nothing is lost. LayersApp keys
// it by the current screen, so switching tabs tries again.

import { Component } from 'react';
import { COLORS } from '../theme.js';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Layers screen crashed:', error, info && info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="px-6 pt-16 pb-8 text-center">
        <span style={{ fontSize: 30 }}>🧩</span>
        <p className="font-display mt-3" style={{ fontSize: 22, color: COLORS.ink }}>This screen hit a problem</p>
        <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>Your data is saved. Go back to Today, or reload Layers to try again.</p>
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => { this.setState({ error: null }); if (this.props.onHome) this.props.onHome(); }} className="text-sm font-semibold rounded-full px-4 py-2.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Go to Today</button>
          <button onClick={() => window.location.reload()} className="text-sm font-semibold rounded-full px-4 py-2.5" style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>Reload Layers</button>
        </div>
        <p className="text-xs mt-6" style={{ color: COLORS.inkSoft, wordBreak: 'break-word' }}>{String(this.state.error && this.state.error.message || this.state.error)}</p>
      </div>
    );
  }
}
