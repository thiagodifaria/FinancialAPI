import { BookOpen, Code2, Home, Server } from 'lucide-react';
import type { AppTab } from '../types/navigation';

const items: Array<{ tab: AppTab; label: string; icon: typeof Home }> = [
  { tab: 'home', label: 'Home', icon: Home },
  { tab: 'docs', label: 'Documentação', icon: BookOpen },
  { tab: 'api', label: 'API Explorer', icon: Code2 },
];

export function TopNav({ active, setActive }: { active: AppTab; setActive: (tab: AppTab) => void }) {
  return (
    <header className="top-nav">
      <button className="brand" onClick={() => setActive('home')}>
        <Server size={22} />
        <span>Financial</span>
        <strong>API</strong>
      </button>
      <nav>
        {items.map((item) => (
          <button
            key={item.tab}
            className={active === item.tab ? 'active' : ''}
            onClick={() => setActive(item.tab)}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>
      <a className="open-api" href="/api/openapi.json" target="_blank" rel="noreferrer">
        OpenAPI
      </a>
    </header>
  );
}
