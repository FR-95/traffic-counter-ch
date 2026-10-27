import logoUrl from './design/assets/intersys-logo-white.svg';
import { de } from './i18n/de.ts';

interface Props {
  link: { href: string; label: string };
}

export function AppHeader({ link }: Props) {
  return (
    <header className="app-header">
      <img className="app-header__logo" src={logoUrl} alt={de.brand.logoAlt} width={124} height={24} />
      <span className="app-header__name">{de.brand.toolName}</span>
      <nav className="app-header__nav" aria-label={de.nav.label}>
        <a href={link.href}>{link.label}</a>
      </nav>
    </header>
  );
}
