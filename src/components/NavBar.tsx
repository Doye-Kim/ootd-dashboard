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
    <nav className="flex border-b border-gray-200 px-4">
      {TABS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`py-3 px-4 text-sm font-medium ${
            pathname === href ? 'border-b-2 border-black' : 'text-gray-400'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
