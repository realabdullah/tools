import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const surface =
  'z-50 min-w-[10rem] overflow-hidden rounded-md border border-border-strong bg-elevated p-1 shadow-pop';
const item =
  'flex h-7 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-2xs text-fg-muted outline-none ' +
  'data-highlighted:bg-surface data-highlighted:text-fg data-disabled:pointer-events-none data-disabled:opacity-45';

export const Menu = ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={4} className={cn(surface, 'animate-menu')}>
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);

export const MenuItem = ({
  children,
  onSelect,
  disabled,
  icon,
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean | undefined;
  icon?: ReactNode;
}) => (
  <DropdownMenu.Item className={item} onSelect={onSelect} disabled={disabled ?? false}>
    {icon ? <span className="text-fg-subtle shrink-0">{icon}</span> : null}
    {children}
  </DropdownMenu.Item>
);

export const MenuSeparator = () => <DropdownMenu.Separator className="bg-border my-1 h-px" />;

export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <DropdownMenu.Label className="text-2xs text-fg-subtle px-2 py-1 font-medium tracking-[0.07em] uppercase">
    {children}
  </DropdownMenu.Label>
);

export const MenuRadioItem = ({
  children,
  checked,
  onSelect,
}: {
  children: ReactNode;
  checked: boolean;
  onSelect: () => void;
}) => (
  <DropdownMenu.Item className={item} onSelect={onSelect}>
    <span className="text-accent w-3 shrink-0">
      {checked ? <Check size={11} aria-hidden /> : null}
    </span>
    {children}
  </DropdownMenu.Item>
);
