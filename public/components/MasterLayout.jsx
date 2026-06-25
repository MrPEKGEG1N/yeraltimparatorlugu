/**
 * React referans bileşeni — vanilla: MasterLayout.js + Header.js + Sidebar.js
 */
import Header from './Header';
import Sidebar from './Sidebar';

export default function MasterLayout({ children }) {
  return (
    <div id="masterLayout">
      <header className="ml-header mafia-border" id="headerStatsBar">
        <Header />
      </header>
      <div className="ml-body">
        <nav className="ml-sidebar mafia-border mafia-border-panel" id="sidebarMenu">
          <Sidebar />
        </nav>
        <main className="ml-main-content">
          <div className="ml-content-frame mafia-border mafia-border-panel" id="masterContentFrame">
            <div className="ml-plaque gizli" id="masterFramePlaque" />
            <div id="sehirBanner" className="ml-sehir-banner gizli" />
            <div id="anaIcerik" className="ml-content-slot">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
