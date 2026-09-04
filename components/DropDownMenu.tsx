'use client'

import { Menu, Transition } from '@headlessui/react';
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
        {/* Icon-only ghost button so it matches the Refresh + Theme buttons
            (issue #30: it was a large 44x28 image and too dark to see in
            dark mode). The `nn-btn-ghost` surface is theme-aware, so it
            stays visible on both `--nn-surface` values. */}
        <Menu.Button
          className="nn-btn nn-btn-ghost !px-2.5 !py-2 text-base leading-none"
          aria-label="Open navigation menu"
          title="Menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
          </svg>
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
