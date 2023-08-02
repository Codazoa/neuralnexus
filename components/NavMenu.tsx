import Link from 'next/link';
import Image from 'next/image';
import styles from './NavMenu.module.css';
import { SignInButton, SignOutButton } from '@/components/buttons';
import AuthCheck from '@/components/AuthCheck';
import DropDownMenu from '@/components/DropDownMenu';

export default function NavMenu() {
  return (
    <nav className='flex pl-4 place-content-center justify-between items-center bg-orange-100'>
      <h1 className='text-2xl font-bold text-black'>NeuralNexus</h1>
      <div className='px-2 py-2 flex-none'>
        <DropDownMenu />
      </div>
    </nav>
  );
}