import type { CSSProperties } from 'react';
import { cx } from './cx';
import styles from './icon.module.css';

/** Outline Atomize icons exported from Figma into public/icons. Filled icons are reserved for selected states. */
export type IconName =
  | 'add' | 'ai' | 'arrow-right' | 'arrow-right-up' | 'bell' | 'chart' | 'chat' | 'check' | 'chevron-down' | 'chevron-left'
  | 'chevron-right' | 'copy' | 'cross' | 'doc' | 'info' | 'lock' | 'settings' | 'user' | 'wallet';

type Props = { name: IconName; size?: 12 | 14 | 16 | 20 | 24; className?: string; label?: string };

/**
 * The SVG file is used as a mask, so the icon takes the colour of its text (currentColor) without editing the asset.
 * Decorative by default; pass `label` when the icon is the only content of a control.
 */
export function Icon({ name, size = 16, className, label }: Props) {
  const style = { '--icon': `url(/icons/${name}.svg)`, width: size, height: size } as CSSProperties;
  return <span className={cx(styles.icon, className)} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
