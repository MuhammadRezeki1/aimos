const analyticsCards = [
  {
    label: "Signal volume",
    value: "24.8K",
    change: "+18%",
    tone: "blue"
  },
  {
    label: "Sentiment score",
    value: "72",
    change: "Stable",
    tone: "slate"
  },
  {
    label: "Viral risk",
    value: "Low",
    change: "-9%",
    tone: "blue"
  }
];

const chartBars = [44, 62, 50, 78, 66, 88, 72];

export function LoginDashboardPreview() {
  return (
    <div className="login-dashboard-preview" aria-label="AIMOS dashboard preview">
      <div className="preview-signal-node preview-signal-node-one" aria-hidden="true" />
      <div className="preview-signal-node preview-signal-node-two" aria-hidden="true" />
      <div className="preview-signal-line preview-signal-line-one" aria-hidden="true" />
      <div className="preview-signal-line preview-signal-line-two" aria-hidden="true" />

      <div className="preview-topbar">
        <div className="preview-logo-badge">
          <span>A</span>
          <strong>AIMOS</strong>
        </div>
        <span className="preview-status">Live monitoring</span>
      </div>

      <div className="preview-search">
        <span aria-hidden="true" />
        <p>Search public reaction, creators, keywords...</p>
      </div>

      <div className="preview-card-grid">
        {analyticsCards.map((card) => (
          <div className="preview-analytics-card" key={card.label}>
            <p>{card.label}</p>
            <div>
              <strong>{card.value}</strong>
              <span className={`preview-card-change preview-card-change-${card.tone}`}>
                {card.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="preview-main-grid">
        <section className="preview-ai-card" aria-label="AI summary">
          <div className="preview-section-heading">
            <span>AI Summary</span>
            <strong>12 sources</strong>
          </div>
          <h2>Conversation sentiment is improving around service reliability.</h2>
          <p>
            AIMOS detected lower complaint intensity and stronger engagement from verified creator accounts.
          </p>
          <div className="preview-ai-tags">
            <span>Public reaction</span>
            <span>Creator signal</span>
            <span>Trend shift</span>
          </div>
        </section>

        <section className="preview-chart-card" aria-label="Signal trend chart">
          <div className="preview-section-heading">
            <span>Signal trend</span>
            <strong>7 days</strong>
          </div>
          <div className="preview-mini-chart">
            {chartBars.map((height, index) => (
              <span
                // Static chart preview bars do not have stable semantic labels.
                aria-hidden="true"
                key={`${height}-${index}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="preview-chart-footer">
            <span>Mon</span>
            <span>Sun</span>
          </div>
        </section>
      </div>
    </div>
  );
}
