import './globals.css';
import NavMenu from '../components/NavMenu';
import { Open_Sans } from 'next/font/google';

const myFont = Open_Sans({ weight: '400', subsets: ['latin'] });

export const metadata = {
  title: 'NeuralNexus',
  description: 'Local-first RSS everything-feed',
}

// Runs before first paint: applies the stored (or system) theme so there
// is no flash of the wrong palette.
const THEME_BOOTSTRAP = `
(function () {
  try {
    var t = localStorage.getItem("nnx_theme");
    if (t !== "light" && t !== "dark") {
      t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={myFont.className}>
        <div>
          <NavMenu />
          {children}
        </div>
      </body>
    </html>
  );
}
