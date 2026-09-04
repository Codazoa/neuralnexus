import KeyGate from '@/components/KeyGate';
import MyFeed from '@/components/MyFeed';

// /myfeed — the aggregated feed, behind the key gate.
export default function MyFeedPage() {
  return (
    <KeyGate>
      <MyFeed />
    </KeyGate>
  );
}
