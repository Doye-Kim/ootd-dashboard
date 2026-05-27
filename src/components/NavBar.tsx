'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: '메인' },
  { href: '/wardrobe', label: '옷장' },
  { href: '/taste', label: '취향' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className='px-4'>
      <ul className='flex'>
        {TABS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={`block py-3 px-4 text-sm ${
                pathname === href
                  ? 'border-b-2 border-black font-bold dark:border-white'
                  : 'font-medium text-gray-400'
              }`}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
