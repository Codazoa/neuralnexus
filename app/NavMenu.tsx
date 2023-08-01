import Link from 'next/link';
import Image from 'next/image';
import styles from './NavMenu.module.css';
import { SignInButton, SignOutButton } from '@/components/buttons';
import AuthCheck from '@/components/AuthCheck';

export default function NavMenu() {
  return (
    <nav className={styles.nav}>
      <Link href={'/'}>
        <Image
          src="/artificial-intelligence.png"
          width={50}
          height={30}
          alt="NextSpace Logo" 
        />
      </Link>
      <ul className={styles.links}>
        <li>
          <Link href={'/about'}>About</Link>
        </li>
        <li>
          <Link href={'/myfeed'}>Feed</Link>
        </li>
        <li>
          <Link href={'/preferences'}>Preferences</Link>
        </li>
        <li>
          <SignInButton/>
        </li>
        <li>
          <AuthCheck>
            <SignOutButton />
          </AuthCheck>
        </li>
      </ul>
    </nav>
  );
}