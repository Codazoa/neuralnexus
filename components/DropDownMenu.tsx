'use client'

import { Menu, Transition } from '@headlessui/react';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';

const links = [
  { href: '/', label: 'Home' },
  { href: '/myfeed', label: 'My Feed' },
  { href: '/preferences/feeds', label: 'Feeds' },
  { href: '/about', label: 'About' },
]

export default function DropDownMenu() {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="inline-flex items-center justify-center rounded-md ring-1 nn-surface nn-ring px-2.5 py-2 shadow-sm transition hover:opacity-90">
          <Image
            src="/artificial-intelligence.png"
            width={44}
            height={28}
            alt="NeuralNexus menu"
            className="rounded"
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
        <Menu.Items className="absolute right-0 z-30 mt-2 w-52 origin-top-right nn-surface rounded-lg border nn-border shadow-xl">
          <div className="py-1">
            {links.map((link) => (
              <Menu.Item key={link.href} as={Fragment}>
                {({ active }) => (
                  <Link
                    className={`block rounded-md px-4 py-2 text-sm transition ${
                      active
                        ? 'nn-accent-soft font-medium'
                        : 'nn-mut'
                    }`}
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}
