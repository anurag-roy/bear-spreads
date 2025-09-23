import { UserButton } from './user-button';

export function Header() {
  return (
    <div className='border-border border-b py-4'>
      <header className='mx-auto flex max-w-6xl items-center justify-between px-4'>
        <div className='flex items-center gap-4'>
          <img src='/logo.png' alt='Bear Spreads' className='size-8' />
          <h1 className='text-2xl font-bold'>Bear Spreads Call/Put</h1>
        </div>
        <UserButton />
      </header>
    </div>
  );
}
