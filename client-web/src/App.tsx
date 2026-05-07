import { useState } from 'react';
import { TopNav } from './components/TopNav';
import { ApiExplorerView } from './features/api-explorer/ApiExplorerView';
import { DocsView } from './features/docs/DocsView';
import { HomeView } from './features/home/HomeView';
import { OperationsView } from './features/operations/OperationsView';
import type { AppTab } from './types/navigation';

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  return (
    <div className="app-shell">
      <TopNav active={activeTab} setActive={setActiveTab} />
      <div className="app-content">
        {activeTab === 'home' && <HomeView setTab={setActiveTab} />}
        {activeTab === 'docs' && <DocsView />}
        {activeTab === 'api' && <ApiExplorerView />}
        {activeTab === 'ops' && <OperationsView />}
      </div>
    </div>
  );
}
