import KeyGate from '@/components/KeyGate';

// / — welcome + your feed, behind the key gate. Before unlocking you
// see the private-key unlock panel instead.
export default function Home() {
  return (
    <KeyGate withKeyBar={false}>
      <div className="nn-bg mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="nn-text text-3xl font-bold tracking-tight">
          Welcome to {' '}
          <span className="nn-accent">Neural</span>Nexus
        </h1>
        <p className="nn-mut mt-3 leading-relaxed">
          The local everything-feed. Add your RSS feeds under
          {' '}
          <a href="/preferences/feeds" className="nn-accent font-medium underline">
            Feeds
          </a>{' '}
          and read them all in one place, in any theme, on any device.
        </p>
      </div>
    </KeyGate>
  );
}
