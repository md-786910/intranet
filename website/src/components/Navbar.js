import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';

const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/service' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-surface shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <Logo size="md" />
            </Link>
          </div>
          
          <div className="hidden sm:flex sm:items-center sm:space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-body-sm font-medium ${
                  isActive(link.path)
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:border-outline hover:text-on-surface'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            <a
              href="http://localhost:3001"
              className="inline-flex items-center px-4 py-2 border border-transparent text-body-sm font-medium rounded-md text-on-primary-container bg-primary-container hover:bg-primary-fixed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              Employee Login
            </a>
            <a
              href="http://localhost:3000"
              className="inline-flex items-center px-4 py-2 border border-transparent text-body-sm font-medium rounded-md text-on-primary bg-primary hover:bg-on-primary-fixed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              Admin Portal
            </a>
          </div>

          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="sm:hidden bg-surface border-t border-outline-variant">
          <div className="pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`block pl-3 pr-4 py-2 border-l-4 text-body-md font-medium ${
                  isActive(link.path)
                    ? 'bg-primary-container border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:bg-surface-variant hover:border-outline hover:text-on-surface'
                }`}
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="mt-4 pt-4 border-t border-outline-variant px-4 space-y-2">
              <a
                href="http://localhost:3001"
                className="block w-full text-center px-4 py-2 border border-transparent text-body-md font-medium rounded-md text-on-primary-container bg-primary-container hover:bg-primary-fixed"
              >
                Employee Login
              </a>
              <a
                href="http://localhost:3000"
                className="block w-full text-center px-4 py-2 border border-transparent text-body-md font-medium rounded-md text-on-primary bg-primary hover:bg-on-primary-fixed"
              >
                Admin Portal
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
