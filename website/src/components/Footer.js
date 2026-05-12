import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

const Footer = () => {
  return (
    <footer className="bg-surface-container-high border-t border-outline-variant">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4">
              <Logo size="md" />
            </div>
            <p className="text-on-surface-variant text-body-sm max-w-xs">
              Empowering organizations with seamless communication, efficient workflows, and connected employee experiences.
            </p>
          </div>
          <div>
            <h3 className="text-h3 text-on-surface font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">Home</Link></li>
              <li><Link to="/service" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">Services</Link></li>
              <li><Link to="/about" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-h3 text-on-surface font-semibold mb-4">Portals</h3>
            <ul className="space-y-2">
              <li><a href="http://localhost:3001" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">Employee Login</a></li>
              <li><a href="http://localhost:3000" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">Admin Portal</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-outline-variant">
          <p className="text-body-sm text-on-surface-variant text-center">
            &copy; {new Date().getFullYear()} BrightNOW Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
