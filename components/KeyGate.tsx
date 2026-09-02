import { getCurrentUser } from '@/lib/key';
import KeyBar from '@/components/KeyBar';
import UnlockPanel from '@/components/UnlockPanel';

type Props = {
  children: React.ReactNode;
  withKeyBar?: boolean;
};

// Server-side gate: renders the unlock panel when there is no active
// local session, otherwise the app content (with an optional key bar
// showing the masked device key and a Lock button).
export default async function KeyGate({ children, withKeyBar = true }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return <UnlockPanel />;
  }
  return (
    <div>
      {withKeyBar && <KeyBar />}
      {children}
    </div>
  );
}
