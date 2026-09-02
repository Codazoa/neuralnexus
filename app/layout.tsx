import './globals.css';
import NavMenu from '../components/NavMenu';
import { Open_Sans } from 'next/font/google';

const myFont = Open_Sans({ weight: '400', subsets: ['latin'] });

export const metadata = {
  title: 'NeuralNexus',
  description: 'Local-first RSS everything-feed',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={myFont.className}>
        <div>
          <NavMenu />
          {children}
        </div>
      </body>
    </html>
  );
}
