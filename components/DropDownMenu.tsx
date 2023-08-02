'use client'

import { Menu, Transition } from '@headlessui/react';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';
import { SignInButton, SignOutButton } from './buttons';
import AuthCheck from '@/components/AuthCheck';

const links = [
  { href: '/', label: 'Home' },
  { href: '/myfeed', label: 'MyFeed' },
  { href: '/preferences/user' , label: 'Preferences' },
  { href: '/about', label: 'About' },
]

export default function DropDownMenu() {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
          <Image
            src="/artificial-intelligence.png"
            width={50}
            height={30}
            alt="NeuralNexus Logo" 
          />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {links.map((link) => (
              <Menu.Item key={link.href} as={Fragment}>
                {({ active }) => (
                  <Link className={`block px-4 py-2 text-sm ${ active ? 'bg-blue-500 text-white': 'bg-white text-black'}`}
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                )}
              </Menu.Item>
            ))}
          </div>
          <div className='py-1'>
            <Menu.Item as='button'>
            {({ active }) => (
              <div className={`block px-4 py-2 text-sm ${ active ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}>
                <SignInButton />
                <AuthCheck>
                  <SignOutButton />
                </AuthCheck>
              </div>
            )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}