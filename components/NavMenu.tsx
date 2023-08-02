import Link from 'next/link';
import DropDownMenu from '@/components/DropDownMenu';

export default function NavMenu() {
  return (
    <nav className='flex pl-4 place-content-center justify-between items-center bg-orange-100'>
      <Link href={'/'}>
        <h1 className='text-2xl font-bold text-black'>NeuralNexus</h1>
      </Link>
      <div className='px-2 py-2 flex-none'>
        <DropDownMenu />
      </div>
    </nav>
  );
}