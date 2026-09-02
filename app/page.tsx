import KeyGate from '@/components/KeyGate';

// / — welcome + your feed, behind the key gate. Before unlocking you
// see the private-key unlock panel instead.
export default function Home() {
  return (
    <KeyGate>
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-lg">Welcome to NeuralNexus — the everything feed.</p>
        <p className="mt-2 text-sm text-neutral-600">
          Add RSS feeds under the menu → Feeds, then read them all here.
          Everything is stored locally on this device.
        </p>
      </div>
    </KeyGate>
  );
}
