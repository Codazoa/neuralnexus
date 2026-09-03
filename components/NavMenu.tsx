import Link from 'next/link';
import DropDownMenu from '@/components/DropDownMenu';
import RefreshButton from '@/components/RefreshButton';
import ThemeToggle from '@/components/ThemeToggle';

export default function NavMenu() {
  return (
    <header className="nn-surface-2 nn-border sticky top-0 z-20 border-b backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        <Link href={'/'}>
          <h1 className="nn-text text-lg font-bold tracking-tight sm:text-xl">
            <span className="nn-accent">Neural</span>Nexus
          </h1>
        </Link>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <ThemeToggle />
          <DropDownMenu />
        </div>
      </nav>
    </header>
  );
}
