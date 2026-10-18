import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import styles from './button.module.css';

export type ButtonType = 'primary' | 'secondary' | 'tertiary' | 'flat' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

type Common = {
  kind?: ButtonType;
  size?: ButtonSize;
  leftIcon?: IconName;
  rightIcon?: IconName;
  /** Shows a spinner and blocks clicks while a request is in flight. The label should say what is happening. */
  busy?: boolean;
  wide?: boolean;
  className?: string;
  children: ReactNode;
};

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };
type AsLink = Common & { href: string; onClick?: () => void; 'aria-label'?: string };

const iconSize = (size: ButtonSize) => (size === 'lg' || size === 'xl' ? 20 : 16);

function Inner({ leftIcon, rightIcon, busy, size, children }: Pick<Common, 'leftIcon' | 'rightIcon' | 'busy' | 'children'> & { size: ButtonSize }) {
  return <>
    {busy ? <span className={styles.spinner} aria-hidden /> : leftIcon && <Icon name={leftIcon} size={iconSize(size)} />}
    <span className={styles.label}>{children}</span>
    {rightIcon && !busy && <Icon name={rightIcon} size={iconSize(size)} className={styles.trailing} />}
  </>;
}

/** Figma "Button": Primary is the single yellow call to action per view; Secondary, Tertiary and Flat step down; Danger denies. */
export function Button(props: AsButton | AsLink) {
  const { kind = 'secondary', size = 'md', leftIcon, rightIcon, busy, wide, className, children } = props;
  const classes = cx(styles.button, styles[kind], styles[size], wide && styles.wide, busy && styles.busy, className);
  if (props.href !== undefined) {
    return <Link href={props.href} className={classes} onClick={props.onClick} aria-label={props['aria-label']}>
      <Inner leftIcon={leftIcon} rightIcon={rightIcon} size={size}>{children}</Inner>
    </Link>;
  }
  const { kind: _k, size: _s, leftIcon: _l, rightIcon: _r, busy: _b, wide: _w, className: _c, children: _ch, type = 'button', disabled, ...rest } = props;
  return <button {...rest} type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined}>
    <Inner leftIcon={leftIcon} rightIcon={rightIcon} busy={busy} size={size}>{children}</Inner>
  </button>;
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName; label: string; kind?: 'primary' | 'secondary' | 'flat'; size?: 'sm' | 'md' | 'lg';
};

/** Figma "Icon button". The label is required: it is the accessible name. */
export function IconButton({ icon, label, kind = 'flat', size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return <button {...rest} type={type} aria-label={label} title={label} className={cx(styles.button, styles.iconOnly, styles[kind], styles[`icon_${size}`], className)}>
    <Icon name={icon} size={size === 'sm' ? 16 : 20} />
  </button>;
}

type TextLinkProps = { href?: string; onClick?: () => void; children: ReactNode; className?: string; external?: boolean; icon?: IconName; type?: 'button' | 'submit' };

/** Figma "Link": an inline text action. It gets an underline and turns yellow on hover. */
export function TextLink({ href, onClick, children, className, external, icon, type = 'button' }: TextLinkProps) {
  const body = <>{children}{icon && <Icon name={icon} size={16} />}</>;
  if (href && external) return <a href={href} target="_blank" rel="noreferrer" className={cx(styles.link, className)}>{body}</a>;
  if (href) return <Link href={href} className={cx(styles.link, className)} onClick={onClick}>{body}</Link>;
  return <button type={type} onClick={onClick} className={cx(styles.link, styles.linkButton, className)}>{body}</button>;
}
