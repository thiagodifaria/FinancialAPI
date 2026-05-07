import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { docs } from './docsSpec';

export function DocsView() {
  const [activeId, setActiveId] = useState(docs[0].id);
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => docs.filter((doc) => `${doc.title} ${doc.section}`.toLowerCase().includes(query.toLowerCase())),
    [query]
  );
  const active = docs.find((doc) => doc.id === activeId) ?? docs[0];
  const scrollToHeading = (label: string) => {
    const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>('.doc-article h2'));
    const target = headings.find((heading) => heading.textContent?.trim() === label);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="docs-view">
      <aside className="docs-sidebar">
        <div className="search-box">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar guias..." />
        </div>
        {filtered.map((doc) => (
          <button key={doc.id} className={doc.id === active.id ? 'active' : ''} onClick={() => setActiveId(doc.id)}>
            <span>{doc.section}</span>
            {doc.title}
          </button>
        ))}
      </aside>
      <article className="doc-article">
        <span className="section-label">{active.section}</span>
        <h1>{active.title}</h1>
        <div className="prose" dangerouslySetInnerHTML={{ __html: active.html }} />
      </article>
      <aside className="toc">
        <strong>Nesta página</strong>
        {active.toc.map((item) => (
          <a
            key={item}
            href="#"
            onClick={(event) => {
              event.preventDefault();
              scrollToHeading(item);
            }}
          >
            {item}
          </a>
        ))}
      </aside>
    </div>
  );
}
