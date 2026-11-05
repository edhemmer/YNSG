'use client';

import {useRef, useState, type KeyboardEvent, type ReactNode} from 'react';

export type BillingTab = {key: string; label: string; badge?: number; render: () => ReactNode};

// One focused panel at a time. Panels that were opened stay mounted (hidden) so drafts and
// uncertain-command recovery survive switching tabs, matching the old "open once, keep" behavior.
export default function BillingTabs({tabs, taxesHref}: {tabs: BillingTab[]; taxesHref?: string}) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  const [opened, setOpened] = useState<Record<string, boolean>>({[tabs[0]?.key ?? '']: true});
  const list = useRef<HTMLDivElement>(null);
  const choose = (key: string) => { setActive(key); setOpened(current => current[key] ? current : {...current, [key]: true}); };
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    choose(next.key);
    list.current?.querySelector<HTMLButtonElement>('#billing-tab-' + next.key)?.focus();
  };
  return <section className="billing-tabs" aria-label="Billing sections">
    <div className="billing-tablist" role="tablist" ref={list}>
      {tabs.map((tab, index) => <button key={tab.key} id={'billing-tab-' + tab.key} type="button" role="tab" className="billing-tab" aria-selected={active === tab.key} aria-controls={'billing-panel-' + tab.key} tabIndex={active === tab.key ? 0 : -1} onClick={() => choose(tab.key)} onKeyDown={event => move(event, index)}>
        {tab.label}{tab.badge ? <span className="billing-tab-badge" aria-label={tab.badge + ' waiting'}>{tab.badge}</span> : null}
      </button>)}
      {taxesHref ? <a className="billing-tab billing-tab-link" href={taxesHref}>Income taxes <span aria-hidden="true">↗</span></a> : null}
    </div>
    {tabs.map(tab => <div key={tab.key} id={'billing-panel-' + tab.key} role="tabpanel" aria-labelledby={'billing-tab-' + tab.key} hidden={active !== tab.key} className="billing-panel">
      {opened[tab.key] ? tab.render() : null}
    </div>)}
  </section>;
}
